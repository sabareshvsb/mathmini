import { buildAdjacency, DEFAULT_NETWORK, haversineKm } from "../graph/city-data";
import {
  DEFAULT_WEIGHTS,
  dijkstra,
  effectiveSpeed,
  emptyContext,
  kruskal,
  prim,
  type PathOptions,
} from "../graph/algorithms";
import type {
  CityEdge,
  CityNetwork,
  CityNode,
  MstResult,
  PathResult,
  RouteWeights,
  WeightContext,
  WeightMode,
} from "../graph/types";
import type {
  Analytics,
  BeforeAfter,
  CongestionLevel,
  EmergencyMission,
  FleetUnit,
  HistoryPoint,
  Incident,
  LogEvent,
  Metrics,
  OptimizationStat,
  RoadRuntime,
  Severity,
  SignalPhase,
  SignalRuntime,
  SignalTiming,
  SimConfig,
  SimSnapshot,
  Vehicle,
  VehicleType,
  Weather,
} from "./types";

export const SIM_SECONDS_PER_REAL = 30;
export const START_SIM_TIME = 8 * 3600 + 10 * 60;
const MAX_LOGS = 80;
const PUBLISH_MS = 140;

export const VEHICLE_COLORS: Record<VehicleType, string> = {
  car: "#3b82f6",
  bus: "#fbbf24",
  truck: "#a78bfa",
  motorcycle: "#34d399",
  emergency: "#fb7185",
};

export const VEHICLE_LABELS: Record<VehicleType, string> = {
  car: "Cars",
  bus: "Buses",
  truck: "Trucks",
  motorcycle: "Motorcycles",
  emergency: "Emergency",
};

const DEFAULT_TIMING: SignalTiming = {
  low: 20,
  moderate: 35,
  heavy: 50,
  veryHeavy: 60,
  yellow: 4,
};

export const DEFAULT_CONFIG: SimConfig = {
  spawnRate: 18,
  maxVehicles: 180,
  speedMultiplier: 1,
  weather: "clear",
  adaptiveSignals: true,
  coordinatedSignals: false,
  publicTransportPriority: true,
  autoReroute: true,
  timing: { ...DEFAULT_TIMING },
  weights: { ...DEFAULT_WEIGHTS },
};

const WEATHER_SPEED: Record<Weather, number> = {
  clear: 1,
  rain: 0.8,
  storm: 0.66,
  fog: 0.74,
};

const WEATHER_DEMAND: Record<Weather, number> = {
  clear: 1,
  rain: 1.06,
  storm: 1.14,
  fog: 1.05,
};

const DEFAULT_FLEET: FleetUnit[] = [
  { id: "FL-01", label: "Ambulance A-201", type: "ambulance", baseNode: "J01", status: "idle", callsign: "MEDIC-201" },
  { id: "FL-02", label: "Fire Engine F-12", type: "fire", baseNode: "J20", status: "idle", callsign: "FIRE-12" },
  { id: "FL-03", label: "Police Unit P-77", type: "police", baseNode: "J18", status: "idle", callsign: "PATROL-77" },
];

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, decimals = 2) {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

function congestionLevel(density: number, blocked: boolean): CongestionLevel {
  if (blocked) return "blocked";
  if (density >= 0.8) return "severe";
  if (density >= 0.62) return "heavy";
  if (density >= 0.4) return "moderate";
  return "low";
}

const HOUR_PROFILE = [
  0.28, 0.22, 0.18, 0.16, 0.19, 0.29, 0.46, 0.68, 0.86, 0.92, 0.74, 0.66,
  0.69, 0.72, 0.75, 0.82, 0.9, 0.94, 0.88, 0.76, 0.64, 0.54, 0.42, 0.34,
];

function hourProfile(hour: number): number {
  return HOUR_PROFILE[((hour % 24) + 24) % 24];
}

export class TrafficSimulator {
  network: CityNetwork;
  networkVersion = 1;
  config: SimConfig;
  running = true;
  simTime = START_SIM_TIME;
  startedAt = Date.now();
  vehicles: Vehicle[] = [];
  roads: Record<string, RoadRuntime> = {};
  signals: Record<string, SignalRuntime> = {};
  incidents: Incident[] = [];
  missions: EmergencyMission[] = [];
  fleet: FleetUnit[] = [];
  logs: LogEvent[] = [];
  history: HistoryPoint[] = [];
  analytics: Analytics;
  metrics: Metrics;
  completedTrips = 0;
  completedTimestamps: number[] = [];
  totalCompletedDistance = 0;
  rerouteCount = 0;
  baseline: BeforeAfter | null = null;
  onSnapshot: ((snapshot: SimSnapshot) => void) | null = null;

  private nodesById = new Map<string, CityNode>();
  private edgesById = new Map<string, CityEdge>();
  private adjacency = new Map<string, Array<{ node: string; edge: CityEdge }>>();
  private incomingEdges = new Map<string, CityEdge[]>();
  private signalPreemptUntil = new Map<string, number>();
  private pedestrianUntil = new Map<string, number>();
  private signalPhase = new Map<string, SignalPhase>();
  private signalRemaining = new Map<string, number>();
  private vehicleSeq = 1;
  private missionSeq = 1;
  private logSeq = 1;
  private incidentSeq = 1;
  private spawnAccumulator = 0;
  private lastPublish = 0;
  private lastHistorySample = 0;
  private lastEstimate = 0;
  private lastAnalytics = 0;
  private lastLogWall: Record<string, number> = {};
  private rng = mulberry32(20260214);
  private seeded = true;
  private avgTravelEstimate = 14.2;
  private optimizationStats: OptimizationStat[] = [];
  private hourlyVolume: number[] = [];
  private hourlyCongestionSum: number[] = [];
  private hourlyCongestionCount: number[] = [];
  private daily: Analytics["daily"] = [];
  private monthly: Analytics["monthly"] = [];
  private seededHours = true;
  private lastPriorityEdges = new Set<string>();
  private densityOverrides = new Map<string, { value: number; until: number }>();

  constructor(network: CityNetwork = DEFAULT_NETWORK) {
    this.network = network;
    this.config = {
      ...DEFAULT_CONFIG,
      timing: { ...DEFAULT_TIMING },
      weights: { ...DEFAULT_WEIGHTS },
    };
    this.fleet = DEFAULT_FLEET.map((f) => ({ ...f }));
    this.rebuildTopology();
    this.seedBaseline();
    this.initSignals();
    this.seedVehicles(72);
    this.metrics = this.computeMetrics();
    this.analytics = this.computeAnalytics();
    this.log("sim", "Simulation engine initialised · Bengaluru network loaded", "info");
    this.log("sim", "72 synthetic vehicles generated across the network", "info");
    this.log("signal", "Adaptive signal controller online for 30 intersections", "success");
    this.log("data", "All traffic values are simulation data — not live city traffic", "warning");
  }

  // ---------------------------------------------------------------- topology
  private rebuildTopology() {
    this.nodesById = new Map(this.network.nodes.map((n) => [n.id, n]));
    this.edgesById = new Map(this.network.edges.map((e) => [e.id, e]));
    this.adjacency = buildAdjacency(this.network);
    this.incomingEdges = new Map();
    for (const node of this.network.nodes) this.incomingEdges.set(node.id, []);
    for (const edge of this.network.edges) {
      this.incomingEdges.get(edge.to)?.push(edge);
      this.incomingEdges.get(edge.from)?.push(edge);
    }
    for (const edge of this.network.edges) {
      if (!this.roads[edge.id]) {
        this.roads[edge.id] = {
          edgeId: edge.id,
          density: edge.baseDemand,
          level: congestionLevel(edge.baseDemand, false),
          vehicles: 0,
          avgSpeedKmh: edge.speedLimit,
          blocked: false,
          incident: false,
          closed: false,
          demand: edge.baseDemand,
          surge: 0,
          priorityCleared: false,
        };
      }
    }
    const activeIds = new Set(this.network.edges.map((e) => e.id));
    for (const id of Object.keys(this.roads)) if (!activeIds.has(id)) delete this.roads[id];
    for (const node of this.network.nodes) {
      if (!this.signals[node.id]) this.initSignal(node, 0);
    }
    for (const id of Object.keys(this.signals)) {
      if (!this.nodesById.has(id)) delete this.signals[id];
    }
    this.incidents = this.incidents.filter((i) => this.edgesById.has(i.edgeId) && i.active);
    this.vehicles = this.vehicles.filter((v) => this.edgesById.has(v.edgeId));
  }

  private initSignal(node: CityNode, index: number) {
    const phase: SignalPhase = index % 4 === 0 ? "GREEN" : index % 4 === 1 ? "YELLOW" : "RED";
    const remaining = 8 + ((index * 7) % 40);
    const offset = Math.round((node.x / 1200) * 30);
    this.signals[node.id] = {
      nodeId: node.id,
      phase,
      remaining,
      greenDuration: 35,
      redDuration: 26,
      cycle: 65,
      queue: 0,
      incomingDensity: 0.3,
      mode: this.config.coordinatedSignals ? "coordinated" : "adaptive",
      offset,
      pedestrianRemaining: 0,
    };
    this.signalPhase.set(node.id, phase);
    this.signalRemaining.set(node.id, remaining);
  }

  private initSignals() {
    this.network.nodes.forEach((node, index) => this.initSignal(node, index));
  }

  // ------------------------------------------------------------- seed history
  private seedBaseline() {
    const nowWall = Date.now();
    const startMinute = Math.floor(this.simTime / 60);
    for (let i = 60; i >= 1; i--) {
      const minute = startMinute - i;
      const hour = Math.floor((minute / 60) % 24);
      const profile = hourProfile(hour);
      const wave = Math.sin(i / 6) * 0.04;
      const congestion = clamp(profile * 0.72 + wave, 0.08, 0.92);
      const waiting = clamp(12 + profile * 48 + Math.cos(i / 5) * 4, 8, 95);
      this.history.push({
        simMinute: minute,
        wallTime: nowWall - i * 1000,
        avgSpeedKmh: round(52 - congestion * 34 + Math.sin(i / 4) * 2, 1),
        vehicles: Math.round(50 + profile * 120 + Math.sin(i / 3) * 12),
        congestion: round(congestion, 3),
        waitingSec: round(waiting, 1),
        flow: Math.round(1100 + profile * 900),
        efficiency: round(clamp(100 - congestion * 78, 24, 96), 1),
        incidents: 0,
        seeded: true,
      });
    }
    this.lastHistorySample = this.simTime;

    for (let h = 0; h < 24; h++) {
      const profile = hourProfile(h);
      this.hourlyVolume[h] = Math.round(380 + profile * 1550);
      this.hourlyCongestionSum[h] = profile * 80;
      this.hourlyCongestionCount[h] = 1;
    }
    for (let d = 6; d >= 0; d--) {
      const profile = 0.78 + Math.sin(d * 1.3) * 0.08;
      this.daily.push({
        label: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][(6 - d + 6) % 7],
        volume: Math.round(24800 * profile),
        congestion: round(0.46 + Math.sin(d * 0.9) * 0.06, 2),
        waiting: round(34 + Math.sin(d * 1.1) * 5, 1),
      });
    }
    for (let d = 29; d >= 0; d--) {
      const profile = 0.82 + Math.sin(d * 0.6) * 0.12;
      this.monthly.push({
        label: `D${30 - d}`,
        volume: Math.round(25000 * profile),
        congestion: round(0.45 + Math.cos(d * 0.5) * 0.08, 2),
        waiting: round(33 + Math.cos(d * 0.7) * 6, 1),
      });
    }
  }

  // ------------------------------------------------------------------ helpers
  simClock(): string {
    const seconds = ((this.simTime % 86400) + 86400) % 86400;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  hour(): number {
    return Math.floor(((this.simTime % 86400) + 86400) % 86400 / 3600);
  }

  rushFactor(): number {
    const h = ((this.simTime % 86400) + 86400) % 86400 / 3600;
    return (
      0.68 +
      0.55 * Math.exp(-((h - 9.2) ** 2) / 6) +
      0.6 * Math.exp(-((h - 18.3) ** 2) / 9)
    );
  }

  weatherSpeedFactor(): number {
    return WEATHER_SPEED[this.config.weather];
  }

  log(kind: string, message: string, severity: Severity = "info", throttleMs = 0) {
    if (throttleMs > 0) {
      const last = this.lastLogWall[kind] ?? 0;
      if (Date.now() - last < throttleMs) return;
      this.lastLogWall[kind] = Date.now();
    }
    this.logs.unshift({
      id: `L${this.logSeq++}`,
      wallTime: Date.now(),
      simSec: Math.round(this.simTime),
      kind,
      message,
      severity,
    });
    if (this.logs.length > MAX_LOGS) this.logs.pop();
  }

  private edgeVehicles(edgeId: string): number {
    let count = 0;
    for (const v of this.vehicles) if (v.edgeId === edgeId) count += 1;
    return count;
  }

  private signalGreenFor(density: number): number {
    if (!this.config.adaptiveSignals) return 35;
    const t = this.config.timing;
    if (density >= 0.78) return t.veryHeavy;
    if (density >= 0.58) return t.heavy;
    if (density >= 0.36) return t.moderate;
    return t.low;
  }

  weightContext(mode: WeightMode = "time", emergency = false): WeightContext {
    const density: Record<string, number> = {};
    const blocked: Record<string, boolean> = {};
    const incident: Record<string, boolean> = {};
    const signalDelayMin: Record<string, number> = {};
    for (const edge of this.network.edges) {
      const road = this.roads[edge.id];
      density[edge.id] = road ? road.density : edge.baseDemand;
      blocked[edge.id] = Boolean(road?.blocked || road?.closed);
      incident[edge.id] = Boolean(road?.incident);
    }
    for (const node of this.network.nodes) {
      const signal = this.signals[node.id];
      if (!signal) {
        signalDelayMin[node.id] = 0.15;
        continue;
      }
      let delaySec = 0;
      if (signal.phase === "GREEN") delaySec = 1 + signal.queue * 0.6;
      else if (signal.phase === "YELLOW") delaySec = signal.remaining + 6 + signal.queue * 0.8;
      else delaySec = signal.remaining * 0.55 + 4 + signal.queue * 1.2;
      if (emergency) delaySec *= 0.25;
      signalDelayMin[node.id] = round(delaySec / 60, 3);
    }
    return {
      density,
      blocked,
      incident,
      signalDelayMin,
      weatherFactor: this.weatherSpeedFactor(),
      emergency,
      publicTransportPriority: this.config.publicTransportPriority,
    };
  }

  private path(
    source: string,
    target: string,
    mode: WeightMode = "time",
    weights?: RouteWeights,
    extraPenalty?: Record<string, number>,
  ): PathResult {
    const ctx = this.weightContext(mode);
    return dijkstra(this.network, source, target, {
      mode,
      ctx,
      weights: weights ?? this.config.weights,
      penaltyEdges: extraPenalty,
    });
  }

  // ---------------------------------------------------------------- vehicles
  private seedVehicles(count: number) {
    const nodeIds = this.network.nodes.map((n) => n.id);
    for (let i = 0; i < count; i++) {
      const origin = nodeIds[Math.floor(this.rng() * nodeIds.length)];
      let destination = nodeIds[Math.floor(this.rng() * nodeIds.length)];
      let guard = 0;
      while (destination === origin && guard < 10) {
        destination = nodeIds[Math.floor(this.rng() * nodeIds.length)];
        guard += 1;
      }
      const path = this.path(origin, destination, "time");
      if (!path.found || path.pathEdges.length === 0) continue;
      const type = this.pickType();
      const firstEdge = this.edgesById.get(path.pathEdges[0]);
      if (!firstEdge) continue;
      this.vehicles.push({
        id: `V-${String(this.vehicleSeq++).padStart(4, "0")}`,
        type,
        color: VEHICLE_COLORS[type],
        edgeId: path.pathEdges[0],
        from: path.pathNodes[0],
        to: path.pathNodes[1],
        progress: round(this.rng(), 3),
        speedKmh: firstEdge.speedLimit,
        routeEdges: path.pathEdges,
        routeNodes: path.pathNodes,
        routeIndex: 0,
        origin,
        destination,
        startedAt: this.simTime - Math.round(this.rng() * 900),
        waitSec: 0,
        distanceKm: 0,
        laneOffset: round((this.rng() - 0.5) * 0.7, 2),
      });
    }
  }

  private pickType(): VehicleType {
    const r = this.rng();
    if (r < 0.54) return "car";
    if (r < 0.68) return "motorcycle";
    if (r < 0.82) return "truck";
    return "bus";
  }

  private spawnVehicle(emergency = false, emergencyId?: string): Vehicle | null {
    if (this.network.nodes.length < 2) return null;
    const nodes = this.network.nodes;
    let guard = 0;
    while (guard < 6) {
      guard += 1;
      const origin = nodes[Math.floor(this.rng() * nodes.length)].id;
      let destination = nodes[Math.floor(this.rng() * nodes.length)].id;
      if (origin === destination) continue;
      if (emergency) destination = this.emergencyDestination ?? destination;
      const path = this.path(origin, destination, "time");
      if (!path.found || path.pathEdges.length === 0) continue;
      const type: VehicleType = emergency ? "emergency" : this.pickType();
      const firstEdge = this.edgesById.get(path.pathEdges[0]);
      if (!firstEdge) continue;
      const vehicle: Vehicle = {
        id: emergency ? `EMV-${this.missionSeq++}` : `V-${String(this.vehicleSeq++).padStart(4, "0")}`,
        type,
        color: VEHICLE_COLORS[type],
        edgeId: path.pathEdges[0],
        from: path.pathNodes[0],
        to: path.pathNodes[1],
        progress: 0,
        speedKmh: firstEdge.speedLimit,
        routeEdges: path.pathEdges,
        routeNodes: path.pathNodes,
        routeIndex: 0,
        origin,
        destination,
        startedAt: this.simTime,
        waitSec: 0,
        distanceKm: 0,
        laneOffset: round((this.rng() - 0.5) * 0.7, 2),
        emergencyMissionId: emergencyId,
      };
      this.vehicles.push(vehicle);
      return vehicle;
    }
    return null;
  }

  emergencyDestination: string | null = null;

  spawnBurst(count: number) {
    let added = 0;
    for (let i = 0; i < count; i++) {
      if (this.vehicles.length >= this.config.maxVehicles + 20) break;
      if (this.spawnVehicle()) added += 1;
    }
    if (added > 0) {
      this.seeded = false;
      this.log("vehicle", `${added} additional vehicles generated by the simulation`, "info");
      this.emit();
    }
  }

  private advanceVehicle(vehicle: Vehicle, dtSim: number): boolean {
    const edge = this.edgesById.get(vehicle.edgeId);
    const road = this.roads[vehicle.edgeId];
    if (!edge || !road) return false;
    if (vehicle.routeIndex >= vehicle.routeEdges.length) {
      this.completeTrip(vehicle);
      return false;
    }

    let speed = effectiveSpeed(edge, road.density, this.weatherSpeedFactor());
    if (vehicle.type === "emergency") speed = Math.max(45, speed) * 1.35;
    else if (vehicle.type === "bus" && this.config.publicTransportPriority) speed *= 1.08;
    if (road.closed || road.incident) speed = Math.min(speed, road.closed ? 6 : 12);
    if (road.priorityCleared && vehicle.type !== "emergency") speed *= 0.6;

    const signal = this.signals[vehicle.to];
    const approaching = vehicle.progress > 0.8;
    if (
      signal &&
      approaching &&
      vehicle.type !== "emergency" &&
      (signal.phase === "RED" || signal.phase === "YELLOW")
    ) {
      speed = 0;
      vehicle.waitSec += dtSim;
    }

    vehicle.speedKmh = round(speed, 1);
    if (speed > 0) {
      const travelKm = (speed / 3600) * dtSim;
      vehicle.progress += travelKm / Math.max(0.1, edge.lengthKm);
      vehicle.distanceKm += travelKm;
    }

    if (vehicle.progress < 1) return true;

    let reached = vehicle.to;
    let overshoot = Math.max(0, vehicle.progress - 1) * edge.lengthKm;
    let nextIndex = vehicle.routeIndex + 1;
    if (nextIndex >= vehicle.routeEdges.length || reached === vehicle.destination) {
      this.completeTrip(vehicle);
      return false;
    }

    let nextEdgeId = vehicle.routeEdges[nextIndex];
    let nextEdge = this.edgesById.get(nextEdgeId);
    const nextRoad = nextEdgeId ? this.roads[nextEdgeId] : undefined;
    const needsReroute =
      !nextEdge ||
      nextRoad?.blocked ||
      nextRoad?.closed ||
      (!nextEdge && reached !== vehicle.destination);

    if (needsReroute && this.config.autoReroute) {
      const rerouted = this.reroute(vehicle, reached);
      if (!rerouted) {
        this.completeTrip(vehicle);
        return false;
      }
      nextEdgeId = vehicle.routeEdges[0];
      nextEdge = this.edgesById.get(nextEdgeId);
      nextIndex = 0;
      overshoot = 0;
    } else if (nextIndex + 1 < vehicle.routeNodes.length) {
      vehicle.routeIndex = nextIndex;
      vehicle.from = reached;
      vehicle.to = vehicle.routeNodes[nextIndex + 1];
      vehicle.edgeId = nextEdgeId;
      if (nextEdge) {
        vehicle.progress = clamp(overshoot / nextEdge.lengthKm, 0, 0.99);
      } else {
        vehicle.progress = 0;
      }
      // opportunistic re-route around heavy congestion
      if (this.config.autoReroute && reroutedRandom(this.rng) && nextRoad && nextRoad.density > 0.82) {
        this.reroute(vehicle, reached);
      }
      return true;
    } else {
      this.completeTrip(vehicle);
      return false;
    }
    return true;
  }

  private reroute(vehicle: Vehicle, currentNode: string): boolean {
    const path = this.path(currentNode, vehicle.destination, "time");
    if (!path.found || path.pathEdges.length === 0) return false;
    vehicle.routeNodes = path.pathNodes;
    vehicle.routeEdges = path.pathEdges;
    vehicle.routeIndex = 0;
    vehicle.from = path.pathNodes[0];
    vehicle.to = path.pathNodes[1];
    vehicle.edgeId = path.pathEdges[0];
    vehicle.progress = 0;
    vehicle.waitSec = 0;
    this.rerouteCount += 1;
    this.log(
      "reroute",
      `Vehicle ${vehicle.id} rerouted via ${path.pathNodes.length} intersections to avoid congestion`,
      "warning",
      5000,
    );
    return true;
  }

  private completeTrip(vehicle: Vehicle) {
    this.completedTrips += 1;
    this.completedTimestamps.push(this.simTime);
    if (this.completedTimestamps.length > 600) this.completedTimestamps.shift();
    this.totalCompletedDistance += vehicle.distanceKm;
    const durationMin = (this.simTime - vehicle.startedAt) / 60;
    if (durationMin > 0 && durationMin < 240) {
      this.avgTravelEstimate = round(this.avgTravelEstimate * 0.92 + durationMin * 0.08, 2);
    }
    if (vehicle.emergencyMissionId) {
      const mission = this.missions.find((m) => m.id === vehicle.emergencyMissionId);
      if (mission && mission.status === "enroute") {
        mission.status = "cleared";
        mission.progress = 1;
        mission.responseSec = Math.round(this.simTime - mission.startedAt);
        const fleet = this.fleet.find((f) => f.id === mission.fleetId);
        if (fleet) fleet.status = "idle";
        this.log(
          "emergency",
          `${mission.label} reached ${mission.destination} · corridor cleared, signals restored`,
          "success",
        );
      }
    }
  }

  // ----------------------------------------------------------------- signals
  private updateSignals(dtSim: number) {
    const hour = this.hour();
    const coordinated = this.config.coordinatedSignals;
    const cycle = 84;
    const green = 46;
    const yellow = this.config.timing.yellow;
    const preemptNodes = new Set<string>();

    for (const mission of this.missions) {
      if (mission.status !== "enroute") continue;
      const vehicle = this.vehicles.find((v) => v.emergencyMissionId === mission.id);
      if (!vehicle) continue;
      for (let i = 0; i <= 2; i++) {
        const nodeId = vehicle.routeNodes[vehicle.routeIndex + i];
        if (nodeId) {
          preemptNodes.add(nodeId);
          this.signalPreemptUntil.set(nodeId, this.simTime + 4);
        }
      }
    }

    for (const node of this.network.nodes) {
      const runtime = this.signals[node.id];
      if (!runtime) continue;
      const incoming = this.incomingEdges.get(node.id) ?? [];
      let weighted = 0;
      let lanes = 0;
      let queue = 0;
      for (const edge of incoming) {
        const road = this.roads[edge.id];
        if (!road) continue;
        weighted += road.density * edge.lanes;
        lanes += edge.lanes;
        queue += road.vehicles * (road.density > 0.55 ? 1 : 0.2);
      }
      runtime.incomingDensity = round(lanes ? weighted / lanes : 0.3, 3);
      runtime.queue = Math.round(queue);

      const pedUntil = this.pedestrianUntil.get(node.id) ?? 0;
      if (pedUntil > this.simTime) {
        runtime.mode = "pedestrian";
        runtime.phase = "RED";
        runtime.pedestrianRemaining = Math.round(pedUntil - this.simTime);
        runtime.remaining = runtime.pedestrianRemaining;
        this.signalPhase.set(node.id, "RED");
        this.signalRemaining.set(node.id, runtime.remaining);
        continue;
      }

      const preemptUntil = this.signalPreemptUntil.get(node.id) ?? 0;
      if (preemptUntil > this.simTime && preemptNodes.has(node.id)) {
        runtime.mode = "preempted";
        runtime.phase = "GREEN";
        runtime.remaining = Math.max(4, Math.round(preemptUntil - this.simTime));
        runtime.greenDuration = Math.max(runtime.greenDuration, runtime.remaining);
        this.signalPhase.set(node.id, "GREEN");
        this.signalRemaining.set(node.id, runtime.remaining);
        continue;
      }

      if (coordinated) {
        runtime.mode = "coordinated";
        const offset = Math.round((node.x / 1200) * 30);
        runtime.offset = offset;
        const position = (this.simTime + offset) % cycle;
        runtime.cycle = cycle;
        runtime.greenDuration = green;
        if (position < green) {
          runtime.phase = "GREEN";
          runtime.remaining = Math.ceil(green - position);
        } else if (position < green + yellow) {
          runtime.phase = "YELLOW";
          runtime.remaining = Math.ceil(green + yellow - position);
        } else {
          runtime.phase = "RED";
          runtime.remaining = Math.ceil(cycle - position);
        }
        this.signalPhase.set(node.id, runtime.phase);
        this.signalRemaining.set(node.id, runtime.remaining);
        continue;
      }

      let remaining = (this.signalRemaining.get(node.id) ?? runtime.remaining) - dtSim;
      let phase = this.signalPhase.get(node.id) ?? runtime.phase;
      runtime.mode = this.config.adaptiveSignals ? "adaptive" : "fixed";

      if (phase === "GREEN" && remaining <= 0) {
        phase = "YELLOW";
        remaining = this.config.timing.yellow;
      } else if (phase === "YELLOW" && remaining <= 0) {
        phase = "RED";
        remaining = clamp(18 + (1 - runtime.incomingDensity) * 12, 16, 34);
        runtime.redDuration = Math.round(remaining);
      } else if (phase === "RED" && remaining <= 0) {
        phase = "GREEN";
        const target = this.signalGreenFor(runtime.incomingDensity);
        runtime.greenDuration = Math.round(target);
        remaining = target;
      }
      if (phase === "GREEN" && remaining <= 0) remaining = runtime.greenDuration;
      runtime.phase = phase;
      runtime.remaining = round(Math.max(0, remaining), 1);
      runtime.cycle = Math.round(runtime.greenDuration + this.config.timing.yellow + runtime.redDuration);
      this.signalPhase.set(node.id, phase);
      this.signalRemaining.set(node.id, remaining);
    }
  }

  private updateRoads(dtSim: number) {
    const hour = this.hour();
    const rush = this.rushFactor();
    const demandWeather = WEATHER_DEMAND[this.config.weather];
    const priorityEdges = new Set<string>();
    for (const mission of this.missions) {
      if (mission.status !== "enroute") continue;
      mission.routeEdges.forEach((id) => priorityEdges.add(id));
    }
    this.lastPriorityEdges = priorityEdges;
    const counts = new Map<string, number>();
    for (const v of this.vehicles) counts.set(v.edgeId, (counts.get(v.edgeId) ?? 0) + 1);

    this.network.edges.forEach((edge, index) => {
      const road = this.roads[edge.id];
      if (!road) return;
      const override = this.densityOverrides.get(edge.id);
      if (override && this.simTime > override.until) this.densityOverrides.delete(edge.id);
      const incident = this.incidents.find((i) => i.edgeId === edge.id && i.active);
      road.closed = Boolean(incident?.kind === "closure" && incident.active);
      road.blocked = Boolean(incident?.blocked || road.closed);
      road.incident = Boolean(incident && !road.closed);
      road.surge = Math.max(0, road.surge - dtSim * 0.0025);
      const count = counts.get(edge.id) ?? 0;
      road.vehicles = count;
      const load = count / Math.max(8, edge.lanes * 16);
      const base = edge.baseDemand * rush * demandWeather;
      const noise = Math.sin(this.simTime / 55 + index * 1.7) * 0.035;
      const incidentBoost = road.incident ? 0.34 : 0;
      let target = clamp(base + load * 0.9 + road.surge + noise + incidentBoost, 0, 1);
      const priority = priorityEdges.has(edge.id);
      road.priorityCleared = priority;
      if (priority) target *= 0.42;
      if (road.closed) target = 1;
      const manual = this.densityOverrides.get(edge.id);
      if (manual) target = manual.value;
      const alpha = clamp(dtSim / 6, 0.01, 1);
      road.density = round(road.density + (target - road.density) * alpha, 4);
      road.demand = round(base + road.surge, 3);
      road.avgSpeedKmh = round(effectiveSpeed(edge, road.density, this.weatherSpeedFactor()), 1);
      road.level = congestionLevel(road.density, road.blocked);
    });
  }

  private updateMissions() {
    for (const mission of this.missions) {
      if (mission.status !== "enroute") continue;
      const vehicle = this.vehicles.find((v) => v.emergencyMissionId === mission.id);
      if (!vehicle) continue;
      let total = 0;
      let travelled = 0;
      mission.routeEdges.forEach((id, index) => {
        const edge = this.edgesById.get(id);
        if (!edge) return;
        total += edge.lengthKm;
        if (index < vehicle.routeIndex) travelled += edge.lengthKm;
        else if (index === vehicle.routeIndex) travelled += edge.lengthKm * clamp(vehicle.progress, 0, 1);
      });
      mission.progress = round(clamp(travelled / Math.max(0.1, total), 0, 1), 3);
      const remaining = Math.max(0.1, total - travelled);
      mission.etaSec = Math.round((remaining / 42) * 3600);
      for (const node of vehicle.routeNodes.slice(vehicle.routeIndex, vehicle.routeIndex + 3)) {
        if (!mission.preemptedNodes.includes(node)) mission.preemptedNodes.push(node);
      }
    }
    const cutoff = this.simTime - 1800;
    if (this.missions.length > 30) {
      this.missions = this.missions.filter((m) => m.status === "enroute" || m.startedAt > cutoff).slice(0, 30);
    }
  }

  private spawnTick(dtReal: number) {
    if (!this.running) return;
    if (this.vehicles.length >= this.config.maxVehicles) return;
    this.spawnAccumulator += (this.config.spawnRate / 60) * dtReal * this.config.speedMultiplier;
    while (this.spawnAccumulator >= 1) {
      this.spawnAccumulator -= 1;
      if (this.vehicles.length >= this.config.maxVehicles) break;
      const spawned = this.spawnVehicle();
      if (spawned) {
        this.seeded = false;
        const h = this.hour();
        this.hourlyVolume[h] = (this.hourlyVolume[h] ?? 0) + 1;
      }
    }
  }

  private updateIncidents() {
    let changed = false;
    for (const incident of this.incidents) {
      if (incident.active && incident.endsAt !== null && this.simTime >= incident.endsAt) {
        incident.active = false;
        changed = true;
        this.log(
          "incident",
          `Incident cleared on ${this.edgesById.get(incident.edgeId)?.name ?? incident.edgeId}`,
          "success",
        );
        const road = this.roads[incident.edgeId];
        if (road) {
          road.incident = false;
          road.blocked = false;
          road.closed = false;
        }
      }
    }
    if (changed) this.incidents = this.incidents.filter((i) => i.active);
  }

  // ------------------------------------------------------------------- tick
  tick(dtReal: number) {
    if (!this.running) return;
    const dt = Math.min(0.12, Math.max(0.001, dtReal));
    const dtSim = dt * SIM_SECONDS_PER_REAL * this.config.speedMultiplier;
    this.simTime += dtSim;

    this.updateIncidents();
    this.updateMissions();

    const survivors: Vehicle[] = [];
    for (const vehicle of this.vehicles) {
      if (this.advanceVehicle(vehicle, dtSim)) survivors.push(vehicle);
    }
    this.vehicles = survivors;
    this.updateSignals(dtSim);
    this.updateRoads(dtSim);
    this.spawnTick(dt);

    this.lastEstimate += dt;
    if (this.lastEstimate > 3) {
      this.lastEstimate = 0;
      this.avgTravelEstimate = this.estimateTravelTime();
      this.metrics = this.computeMetrics();
      this.analytics = this.computeAnalytics();
    } else {
      this.metrics = this.computeMetrics();
    }

    if (this.simTime - this.lastHistorySample >= 30) {
      this.lastHistorySample = this.simTime;
      this.sampleHistory();
    }

    const now = Date.now();
    if (now - this.lastPublish >= PUBLISH_MS) {
      this.lastPublish = now;
      this.emit();
    }
  }

  private sampleHistory() {
    const hour = this.hour();
    this.hourlyCongestionSum[hour] =
      (this.hourlyCongestionSum[hour] ?? 0) + (1 - this.metrics.flowEfficiency / 100) * 100;
    this.hourlyCongestionCount[hour] = (this.hourlyCongestionCount[hour] ?? 0) + 1;
    const point: HistoryPoint = {
      simMinute: Math.round(this.simTime / 60),
      wallTime: Date.now(),
      avgSpeedKmh: round(this.metrics.avgSpeedKmh, 1),
      vehicles: this.vehicles.length,
      congestion: round(1 - this.metrics.flowEfficiency / 100, 3),
      waitingSec: round(this.metrics.avgWaitingSec, 1),
      flow: Math.round(this.metrics.avgSpeedKmh * Math.max(1, this.vehicles.length) * 0.62),
      efficiency: round(this.metrics.flowEfficiency, 1),
      incidents: this.incidents.filter((i) => i.active).length,
    };
    this.history.push(point);
    if (this.history.length > 240) this.history.shift();
  }

  private estimateTravelTime(): number {
    const samples: Array<[string, string]> = [
      ["J01", "J30"],
      ["J07", "J24"],
      ["J13", "J18"],
      ["J25", "J06"],
      ["J02", "J28"],
    ];
    let sum = 0;
    let count = 0;
    for (const [source, target] of samples) {
      const result = this.path(source, target, "time");
      if (result.found) {
        sum += result.totalTimeMin;
        count += 1;
      }
    }
    return count ? round(sum / count, 1) : this.avgTravelEstimate;
  }

  private computeMetrics(): Metrics {
    const totalRoads = this.network.edges.length;
    const congestedRoads = Object.values(this.roads).filter(
      (r) => r.level === "heavy" || r.level === "severe" || r.level === "blocked",
    ).length;
    const blockedRoads = Object.values(this.roads).filter((r) => r.blocked || r.closed).length;
    const activeVehicles = this.vehicles.length;
    const avgSpeed = activeVehicles
      ? this.vehicles.reduce((sum, v) => sum + v.speedKmh, 0) / activeVehicles
      : 0;
    const avgWaiting = activeVehicles
      ? this.vehicles.reduce((sum, v) => sum + v.waitSec, 0) / activeVehicles
      : 0;
    const avgDensity = totalRoads
      ? this.network.edges.reduce((sum, e) => sum + (this.roads[e.id]?.density ?? 0), 0) / totalRoads
      : 0;
    const blockedRatio = totalRoads ? blockedRoads / totalRoads : 0;
    const incidentCount = this.incidents.filter((i) => i.active).length;
    const efficiency = clamp(100 - avgDensity * 74 - blockedRatio * 48 - incidentCount * 1.2, 4, 99);
    const signalList = Object.values(this.signals);
    const greenRatio = signalList.length
      ? signalList.reduce(
          (sum, s) => sum + (s.phase === "GREEN" ? 1 : s.phase === "YELLOW" ? 0.5 : 0.15),
          0,
        ) / signalList.length
      : 0;
    const avgQueue = signalList.length
      ? signalList.reduce((sum, s) => sum + s.queue, 0) / signalList.length
      : 0;
    const signalEfficiency = clamp(42 + greenRatio * 46 - avgQueue * 0.7, 15, 98);
    const recent = this.completedTimestamps.filter((t) => this.simTime - t <= 3600).length;
    const perType: Record<VehicleType, number> = {
      car: 0,
      bus: 0,
      truck: 0,
      motorcycle: 0,
      emergency: 0,
    };
    for (const v of this.vehicles) perType[v.type] += 1;
    const distribution = { low: 0, moderate: 0, heavy: 0, severe: 0 };
    for (const road of Object.values(this.roads)) {
      if (road.level === "low") distribution.low += 1;
      else if (road.level === "moderate") distribution.moderate += 1;
      else if (road.level === "heavy") distribution.heavy += 1;
      else distribution.severe += 1;
    }
    return {
      totalIntersections: this.network.nodes.length,
      totalRoads,
      activeVehicles,
      congestedRoads,
      blockedRoads,
      avgTravelTimeMin: this.avgTravelEstimate,
      flowEfficiency: round(efficiency, 1),
      activeSignals: signalList.length,
      emergencyVehicles: this.missions.filter((m) => m.status === "enroute").length,
      avgSpeedKmh: round(avgSpeed, 1),
      completedTrips: this.completedTrips,
      totalDistanceKm: round(this.totalCompletedDistance, 1),
      totalRouteTrips: this.completedTrips,
      avgWaitingSec: round(avgWaiting, 1),
      signalEfficiency: round(signalEfficiency, 1),
      reroutes: this.rerouteCount,
      throughputPerHour: recent,
      vehiclesPerType: perType,
      congestionDistribution: distribution,
    };
  }

  private computeAnalytics(): Analytics {
    const roadUtilization = this.network.edges
      .map((edge) => {
        const road = this.roads[edge.id];
        return {
          edgeId: edge.id,
          name: edge.name,
          from: this.nodesById.get(edge.from)?.name ?? edge.from,
          to: this.nodesById.get(edge.to)?.name ?? edge.to,
          density: round(road?.density ?? 0, 3),
          vehicles: road?.vehicles ?? 0,
          utilizationPct: Math.round(clamp((road?.density ?? 0) * 100, 0, 100)),
        };
      })
      .sort((a, b) => b.density - a.density)
      .slice(0, 18);

    const intersectionPerformance = this.network.nodes
      .map((node) => {
        const signal = this.signals[node.id];
        const queue = signal?.queue ?? 0;
        const green = signal?.greenDuration ?? 35;
        const cycle = signal?.cycle ?? 65;
        return {
          nodeId: node.id,
          name: node.name,
          queue,
          greenDuration: Math.round(green),
          throughput: Math.round(120 + queue * 18 + green * 3),
          efficiency: Math.round(clamp((green / Math.max(1, cycle)) * 100 + 30 - queue * 1.4, 20, 98)),
        };
      })
      .sort((a, b) => b.queue - a.queue);

    const hourlyCongestion = this.hourlyCongestionSum.map((sum, index) => {
      const count = this.hourlyCongestionCount[index] || 1;
      return round(clamp(sum / count, 4, 96), 1);
    });

    let forecast: number[] = [];
    const recent = this.history.slice(-12);
    if (recent.length >= 3) {
      const base = 1 - recent[recent.length - 1].efficiency / 100;
      const trend =
        (1 - recent[recent.length - 1].efficiency / 100) - (1 - recent[0].efficiency / 100);
      forecast = Array.from({ length: 6 }, (_, index) =>
        round(clamp(base + (trend / recent.length) * (index + 1) * 3, 0.02, 0.98), 3),
      );
    } else {
      forecast = Array.from({ length: 6 }, (_, i) =>
        round(clamp(0.35 + Math.sin(i / 2) * 0.06, 0.05, 0.9), 3),
      );
    }

    return {
      hourlyVolume: [...this.hourlyVolume],
      hourlyCongestion,
      daily: this.daily,
      monthly: this.monthly,
      roadUtilization,
      intersectionPerformance,
      optimizationStats: [...this.optimizationStats],
      beforeAfter: this.baseline,
      forecast,
      seededHours: this.seededHours,
    };
  }

  // ---------------------------------------------------------------- actions
  start() {
    if (this.running) return;
    this.running = true;
    this.log("sim", "Simulation resumed", "success");
    this.emit();
  }

  pause() {
    if (!this.running) return;
    this.running = false;
    this.log("sim", "Simulation paused by operator", "warning");
    this.emit();
  }

  reset() {
    this.vehicles = [];
    this.roads = {};
    this.signals = {};
    this.incidents = [];
    this.missions = [];
    this.logs = [];
    this.history = [];
    this.completedTrips = 0;
    this.completedTimestamps = [];
    this.totalCompletedDistance = 0;
    this.rerouteCount = 0;
    this.baseline = null;
    this.optimizationStats = [];
    this.simTime = START_SIM_TIME;
    this.startedAt = Date.now();
    this.vehicleSeq = 1;
    this.missionSeq = 1;
    this.logSeq = 1;
    this.incidentSeq = 1;
    this.spawnAccumulator = 0;
    this.avgTravelEstimate = 14.2;
    this.rng = mulberry32(20260214);
    this.signals = {};
    this.signalPhase.clear();
    this.signalRemaining.clear();
    this.signalPreemptUntil.clear();
    this.pedestrianUntil.clear();
    this.densityOverrides.clear();
    this.fleet = DEFAULT_FLEET.map((f) => ({ ...f }));
    this.config = {
      ...DEFAULT_CONFIG,
      timing: { ...DEFAULT_TIMING },
      weights: { ...DEFAULT_WEIGHTS },
    };
    this.hourlyVolume = [];
    this.hourlyCongestionSum = [];
    this.hourlyCongestionCount = [];
    this.daily = [];
    this.monthly = [];
    this.seededHours = true;
    this.seeded = true;
    this.running = true;
    this.rebuildTopology();
    this.seedBaseline();
    this.initSignals();
    this.seedVehicles(72);
    this.metrics = this.computeMetrics();
    this.analytics = this.computeAnalytics();
    this.log("sim", "Simulation reset · baseline scenario restored", "warning");
    this.log("data", "All traffic values are simulation data — not live city traffic", "info");
    this.emit();
  }

  setSpeed(value: number) {
    this.config = { ...this.config, speedMultiplier: clamp(value, 0.25, 6) };
    this.log("sim", `Simulation speed set to ${value}×`, "info", 1000);
    this.emit();
  }

  setSpawnRate(value: number) {
    this.config = { ...this.config, spawnRate: Math.round(clamp(value, 0, 90)) };
    this.log("sim", `Vehicle generation rate set to ${this.config.spawnRate}/min`, "info", 1000);
    this.emit();
  }

  setMaxVehicles(value: number) {
    this.config = { ...this.config, maxVehicles: Math.round(clamp(value, 40, 400)) };
    this.emit();
  }

  setWeather(weather: Weather) {
    this.config = { ...this.config, weather };
    this.log("weather", `Weather simulation changed to ${weather.toUpperCase()}`, "warning");
    this.emit();
  }

  setAdaptiveSignals(value: boolean) {
    this.config = { ...this.config, adaptiveSignals: value, coordinatedSignals: value ? false : this.config.coordinatedSignals };
    this.log("signal", `Adaptive signal timing ${value ? "enabled" : "disabled"}`, "success");
    this.emit();
  }

  setCoordinatedSignals(value: boolean) {
    this.config = { ...this.config, coordinatedSignals: value, adaptiveSignals: value ? false : this.config.adaptiveSignals };
    this.log(
      "signal",
      value ? "Green-wave coordination enabled with corridor offsets" : "Green-wave coordination disabled",
      "success",
    );
    this.emit();
  }

  setPublicTransportPriority(value: boolean) {
    this.config = { ...this.config, publicTransportPriority: value };
    this.log("signal", `Public transport priority ${value ? "enabled" : "disabled"}`, "info");
    this.emit();
  }

  setAutoReroute(value: boolean) {
    this.config = { ...this.config, autoReroute: value };
    this.log("reroute", `Automatic rerouting ${value ? "enabled" : "disabled"}`, "info");
    this.emit();
  }

  setTiming(timing: Partial<SignalTiming>) {
    this.config = { ...this.config, timing: { ...this.config.timing, ...timing } };
    this.log("signal", "Signal green-time thresholds updated", "success");
    this.emit();
  }

  setWeights(weights: Partial<RouteWeights>) {
    this.config = { ...this.config, weights: { ...this.config.weights, ...weights } };
    this.emit();
  }

  surgeCongestion(edgeCount = 6) {
    const candidates = [...this.network.edges]
      .sort((a, b) => b.baseDemand - a.baseDemand)
      .slice(0, Math.max(edgeCount, 4));
    for (const edge of candidates) {
      const road = this.roads[edge.id];
      if (road) road.surge = Math.min(0.55, road.surge + 0.38);
    }
    this.log(
      "congestion",
      `Traffic surge generated on ${candidates.length} high-demand corridors`,
      "critical",
    );
    this.spawnBurst(30);
    this.emit();
  }

  reportAccident(edgeId: string, note = "Multi-vehicle collision", durationSec = 240) {
    const edge = this.edgesById.get(edgeId);
    if (!edge) return;
    const existing = this.incidents.find((i) => i.edgeId === edgeId && i.active);
    if (existing) return;
    const incident: Incident = {
      id: `I${String(this.incidentSeq++).padStart(3, "0")}`,
      edgeId,
      kind: "accident",
      note,
      startedAt: this.simTime,
      endsAt: this.simTime + durationSec,
      blocked: false,
      active: true,
    };
    this.incidents.push(incident);
    const road = this.roads[edgeId];
    if (road) {
      road.incident = true;
      road.surge = Math.min(0.7, road.surge + 0.3);
    }
    this.log("incident", `Accident reported on ${edge.name} (${edge.from}–${edge.to}): ${note}`, "critical");
    for (const vehicle of this.vehicles) {
      if (vehicle.edgeId === edgeId) this.reroute(vehicle, vehicle.from);
    }
    this.emit();
  }

  closeRoad(edgeId: string, note = "Operator road closure") {
    const edge = this.edgesById.get(edgeId);
    if (!edge) return;
    this.incidents = this.incidents.filter((i) => !(i.edgeId === edgeId && i.active));
    const incident: Incident = {
      id: `I${String(this.incidentSeq++).padStart(3, "0")}`,
      edgeId,
      kind: "closure",
      note,
      startedAt: this.simTime,
      endsAt: null,
      blocked: true,
      active: true,
    };
    this.incidents.push(incident);
    const road = this.roads[edgeId];
    if (road) {
      road.closed = true;
      road.blocked = true;
    }
    this.log("closure", `Road blocked: ${edge.name} (${edge.from}–${edge.to}) · routing recalculated`, "critical");
    for (const vehicle of this.vehicles) {
      if (vehicle.edgeId === edgeId || vehicle.routeEdges[vehicle.routeIndex + 1] === edgeId) {
        this.reroute(vehicle, vehicle.from);
      }
    }
    this.emit();
  }

  clearIncident(incidentId: string) {
    const incident = this.incidents.find((i) => i.id === incidentId);
    if (!incident) return;
    incident.active = false;
    this.incidents = this.incidents.filter((i) => i.active);
    const road = this.roads[incident.edgeId];
    if (road) {
      road.incident = false;
      road.blocked = false;
      road.closed = false;
      road.surge = 0;
    }
    this.log("incident", `Incident ${incidentId} cleared · corridor reopened`, "success");
    this.emit();
  }

  clearAllIncidents() {
    for (const incident of this.incidents) {
      const road = this.roads[incident.edgeId];
      if (road) {
        road.incident = false;
        road.blocked = false;
        road.closed = false;
      }
    }
    this.incidents = [];
    this.log("incident", "All incidents cleared and corridors reopened", "success");
    this.emit();
  }

  setRoadDensity(edgeId: string, density: number) {
    const road = this.roads[edgeId];
    if (!road) return;
    const value = clamp(density, 0, 1);
    road.density = value;
    road.level = congestionLevel(road.density, road.blocked);
    this.densityOverrides.set(edgeId, { value, until: this.simTime + 120 });
    this.log("admin", `Manual density override on ${edgeId}: ${Math.round(value * 100)}% (120 s)`, "warning");
    this.emit();
  }

  requestPedestrian(nodeId: string) {
    const node = this.nodesById.get(nodeId);
    if (!node) return;
    this.pedestrianUntil.set(nodeId, this.simTime + 16);
    this.log("signal", `Pedestrian crossing requested at ${node.name} · 16 s signal hold`, "warning");
    this.emit();
  }

  dispatchEmergency(fleetId: string, destination: string) {
    const unit = this.fleet.find((f) => f.id === fleetId);
    if (!unit || unit.status === "enroute") return null;
    const target = this.nodesById.get(destination);
    const originNode = this.nodesById.get(unit.baseNode);
    if (!target || !originNode) return null;
    const path = this.path(unit.baseNode, destination, "time");
    if (!path.found) {
      this.log("emergency", `No available route for ${unit.label} to ${target.name}`, "critical");
      this.emit();
      return null;
    }
    const baseline = this.path(unit.baseNode, destination, "distance");
    const missionId = `M${String(this.missionSeq).padStart(3, "0")}`;
    const vehicle = this.spawnVehicle(true, missionId);
    if (!vehicle) return null;
    vehicle.routeEdges = path.pathEdges;
    vehicle.routeNodes = path.pathNodes;
    vehicle.routeIndex = 0;
    vehicle.from = path.pathNodes[0];
    vehicle.to = path.pathNodes[1];
    vehicle.edgeId = path.pathEdges[0];
    vehicle.progress = 0;
    vehicle.origin = unit.baseNode;
    vehicle.destination = destination;
    unit.status = "enroute";
    const mission: EmergencyMission = {
      id: missionId,
      fleetId,
      label: unit.label,
      type: unit.type,
      origin: unit.baseNode,
      destination,
      routeEdges: path.pathEdges,
      routeNodes: path.pathNodes,
      startedAt: this.simTime,
      progress: 0,
      etaSec: Math.round(path.totalTimeMin * 60),
      status: "enroute",
      preemptedNodes: [...path.pathNodes],
      baselineTimeMin: baseline.totalTimeMin,
      estimatedTimeMin: path.totalTimeMin,
      vehicleId: vehicle.id,
    };
    this.missions.unshift(mission);
    this.log(
      "emergency",
      `${unit.label} dispatched ${originNode.name} → ${target.name} · priority corridor active (${path.pathEdges.length} segments)`,
      "critical",
    );
    this.log(
      "signal",
      `Signal preemption armed on ${mission.preemptedNodes.length} intersections along the emergency route`,
      "warning",
    );
    this.emit();
    return mission;
  }

  recallMission(missionId: string) {
    const mission = this.missions.find((m) => m.id === missionId);
    if (!mission) return;
    mission.status = "cleared";
    const fleet = this.fleet.find((f) => f.id === mission.fleetId);
    if (fleet) fleet.status = "idle";
    this.vehicles = this.vehicles.filter((v) => v.emergencyMissionId !== mission.id);
    this.log("emergency", `${mission.label} recalled · signal preemption released`, "warning");
    this.emit();
  }

  addFleetUnit(unit: Omit<FleetUnit, "id" | "status">) {
    const id = `FL-${String(this.fleet.length + 1).padStart(2, "0")}`;
    this.fleet.push({ ...unit, id, status: "idle" });
    this.log("admin", `Emergency unit ${unit.label} added to the fleet`, "success");
    this.emit();
  }

  removeFleetUnit(id: string) {
    this.fleet = this.fleet.filter((f) => f.id !== id);
    this.emit();
  }

  captureBaseline() {
    this.baseline = {
      capturedAt: Date.now(),
      before: {
        waitingSec: this.metrics.avgWaitingSec,
        efficiency: this.metrics.flowEfficiency,
        avgSpeed: this.metrics.avgSpeedKmh,
        congested: this.metrics.congestedRoads,
      },
      after: {
        waitingSec: this.metrics.avgWaitingSec,
        efficiency: this.metrics.flowEfficiency,
        avgSpeed: this.metrics.avgSpeedKmh,
        congested: this.metrics.congestedRoads,
      },
    };
    this.log("analytics", "Baseline captured for before/after simulation comparison", "info");
    this.emit();
    return this.baseline;
  }

  compareBaseline(): BeforeAfter | null {
    if (!this.baseline) return null;
    this.baseline = {
      ...this.baseline,
      after: {
        waitingSec: this.metrics.avgWaitingSec,
        efficiency: this.metrics.flowEfficiency,
        avgSpeed: this.metrics.avgSpeedKmh,
        congested: this.metrics.congestedRoads,
      },
    };
    this.log(
      "analytics",
      `Before/after comparison updated: efficiency ${this.baseline.before.efficiency}% → ${this.baseline.after.efficiency}% (simulation)`,
      "success",
    );
    this.emit();
    return this.baseline;
  }

  recordOptimization(stat: OptimizationStat) {
    this.optimizationStats.unshift(stat);
    if (this.optimizationStats.length > 15) this.optimizationStats.pop();
    this.log(
      "route",
      `Optimized route ${stat.source} → ${stat.destination} (${stat.mode}) · ${stat.timeSavedMin.toFixed(1)} min saved vs distance baseline`,
      "success",
    );
    this.emit();
  }

  setNetwork(network: CityNetwork) {
    this.network = network;
    this.networkVersion += 1;
    this.rebuildTopology();
    for (const vehicle of this.vehicles) {
      if (!vehicle.routeEdges.every((id) => this.edgesById.has(id))) {
        this.reroute(vehicle, vehicle.from);
      }
    }
    this.log("admin", "Road network updated and routing tables rebuilt", "success");
    this.emit();
  }

  runMst(kind: "kruskal" | "prim" = "kruskal"): MstResult {
    const ctx = emptyContext();
    return kind === "kruskal" ? kruskal(this.network, ctx) : prim(this.network, this.network.nodes[0]?.id, ctx);
  }

  searchTravelTime(source: string, target: string, mode: WeightMode) {
    return this.path(source, target, mode);
  }

  // ---------------------------------------------------------------- snapshot
  getSnapshot(): SimSnapshot {
    return {
      network: this.network,
      networkVersion: this.networkVersion,
      running: this.running,
      simTime: this.simTime,
      startedAt: this.startedAt,
      config: {
        ...this.config,
        timing: { ...this.config.timing },
        weights: { ...this.config.weights },
      },
      vehicles: this.vehicles.map((v) => ({ ...v, routeEdges: [...v.routeEdges], routeNodes: [...v.routeNodes] })),
      roads: Object.fromEntries(Object.entries(this.roads).map(([id, road]) => [id, { ...road }])),
      signals: Object.fromEntries(Object.entries(this.signals).map(([id, signal]) => [id, { ...signal }])),
      incidents: this.incidents.map((i) => ({ ...i })),
      missions: this.missions.map((m) => ({
        ...m,
        routeEdges: [...m.routeEdges],
        routeNodes: [...m.routeNodes],
        preemptedNodes: [...m.preemptedNodes],
      })),
      fleet: this.fleet.map((f) => ({ ...f })),
      metrics: { ...this.metrics, vehiclesPerType: { ...this.metrics.vehiclesPerType }, congestionDistribution: { ...this.metrics.congestionDistribution } },
      history: [...this.history],
      logs: [...this.logs],
      analytics: {
        ...this.analytics,
        hourlyVolume: [...this.analytics.hourlyVolume],
        hourlyCongestion: [...this.analytics.hourlyCongestion],
        roadUtilization: this.analytics.roadUtilization.map((r) => ({ ...r })),
        intersectionPerformance: this.analytics.intersectionPerformance.map((r) => ({ ...r })),
        optimizationStats: this.analytics.optimizationStats.map((r) => ({ ...r })),
        forecast: [...this.analytics.forecast],
      },
      rerouteCount: this.rerouteCount,
      completedTrips: this.completedTrips,
      seeded: this.seeded,
    };
  }

  emit() {
    this.metrics = this.computeMetrics();
    this.analytics = this.computeAnalytics();
    this.onSnapshot?.(this.getSnapshot());
  }
}

function reroutedRandom(rng: () => number): boolean {
  return rng() < 0.006;
}
