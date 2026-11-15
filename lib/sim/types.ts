import type {
  CityEdge,
  CityNetwork,
  CityNode,
  PathResult,
  RouteWeights,
  WeightMode,
} from "../graph/types";

export type VehicleType = "car" | "bus" | "truck" | "motorcycle" | "emergency";
export type CongestionLevel = "low" | "moderate" | "heavy" | "severe" | "blocked";
export type SignalPhase = "GREEN" | "YELLOW" | "RED";
export type Weather = "clear" | "rain" | "storm" | "fog";
export type Severity = "info" | "success" | "warning" | "critical";
export type MissionStatus = "enroute" | "arrived" | "cleared";

export interface RoadRuntime {
  edgeId: string;
  density: number;
  level: CongestionLevel;
  vehicles: number;
  avgSpeedKmh: number;
  blocked: boolean;
  incident: boolean;
  closed: boolean;
  demand: number;
  surge: number;
  priorityCleared: boolean;
}

export interface SignalRuntime {
  nodeId: string;
  phase: SignalPhase;
  remaining: number;
  greenDuration: number;
  redDuration: number;
  cycle: number;
  queue: number;
  incomingDensity: number;
  mode: "adaptive" | "fixed" | "coordinated" | "preempted" | "pedestrian";
  offset: number;
  pedestrianRemaining: number;
}

export interface Vehicle {
  id: string;
  type: VehicleType;
  color: string;
  edgeId: string;
  from: string;
  to: string;
  progress: number;
  speedKmh: number;
  routeEdges: string[];
  routeNodes: string[];
  routeIndex: number;
  origin: string;
  destination: string;
  startedAt: number;
  waitSec: number;
  distanceKm: number;
  laneOffset: number;
  emergencyMissionId?: string;
}

export interface Incident {
  id: string;
  edgeId: string;
  kind: "accident" | "roadwork" | "closure" | "weather" | "event";
  note: string;
  startedAt: number;
  endsAt: number | null;
  blocked: boolean;
  active: boolean;
}

export interface EmergencyMission {
  id: string;
  fleetId: string;
  label: string;
  type: "ambulance" | "fire" | "police";
  origin: string;
  destination: string;
  routeEdges: string[];
  routeNodes: string[];
  startedAt: number;
  progress: number;
  etaSec: number;
  status: MissionStatus;
  preemptedNodes: string[];
  baselineTimeMin: number;
  estimatedTimeMin: number;
  responseSec?: number;
  vehicleId: string;
}

export interface FleetUnit {
  id: string;
  label: string;
  type: "ambulance" | "fire" | "police";
  baseNode: string;
  status: "idle" | "enroute";
  callsign: string;
}

export interface LogEvent {
  id: string;
  wallTime: number;
  simSec: number;
  kind: string;
  message: string;
  severity: Severity;
}

export interface HistoryPoint {
  simMinute: number;
  wallTime: number;
  avgSpeedKmh: number;
  vehicles: number;
  congestion: number;
  waitingSec: number;
  flow: number;
  efficiency: number;
  incidents: number;
  seeded?: boolean;
}

export interface Metrics {
  totalIntersections: number;
  totalRoads: number;
  activeVehicles: number;
  congestedRoads: number;
  blockedRoads: number;
  avgTravelTimeMin: number;
  flowEfficiency: number;
  activeSignals: number;
  emergencyVehicles: number;
  avgSpeedKmh: number;
  completedTrips: number;
  totalDistanceKm: number;
  totalRouteTrips: number;
  avgWaitingSec: number;
  signalEfficiency: number;
  reroutes: number;
  throughputPerHour: number;
  vehiclesPerType: Record<VehicleType, number>;
  congestionDistribution: { low: number; moderate: number; heavy: number; severe: number };
}

export interface SignalTiming {
  low: number;
  moderate: number;
  heavy: number;
  veryHeavy: number;
  yellow: number;
}

export interface SimConfig {
  spawnRate: number;
  maxVehicles: number;
  speedMultiplier: number;
  weather: Weather;
  adaptiveSignals: boolean;
  coordinatedSignals: boolean;
  publicTransportPriority: boolean;
  autoReroute: boolean;
  timing: SignalTiming;
  weights: RouteWeights;
}

export interface OptimizationStat {
  id: string;
  source: string;
  destination: string;
  mode: WeightMode;
  distanceKm: number;
  timeMin: number;
  timeSavedMin: number;
  congestionAvoided: number;
  wallTime: number;
  algorithm: string;
}

export interface BeforeAfter {
  capturedAt: number;
  before: { waitingSec: number; efficiency: number; avgSpeed: number; congested: number };
  after: { waitingSec: number; efficiency: number; avgSpeed: number; congested: number };
}

export interface Analytics {
  hourlyVolume: number[];
  hourlyCongestion: number[];
  daily: Array<{ label: string; volume: number; congestion: number; waiting: number }>;
  monthly: Array<{ label: string; volume: number; congestion: number; waiting: number }>;
  roadUtilization: Array<{
    edgeId: string;
    name: string;
    from: string;
    to: string;
    density: number;
    vehicles: number;
    utilizationPct: number;
  }>;
  intersectionPerformance: Array<{
    nodeId: string;
    name: string;
    queue: number;
    greenDuration: number;
    throughput: number;
    efficiency: number;
  }>;
  optimizationStats: OptimizationStat[];
  beforeAfter: BeforeAfter | null;
  forecast: number[];
  seededHours: boolean;
}

export interface SimSnapshot {
  network: CityNetwork;
  networkVersion: number;
  running: boolean;
  simTime: number;
  startedAt: number;
  config: SimConfig;
  vehicles: Vehicle[];
  roads: Record<string, RoadRuntime>;
  signals: Record<string, SignalRuntime>;
  incidents: Incident[];
  missions: EmergencyMission[];
  fleet: FleetUnit[];
  metrics: Metrics;
  history: HistoryPoint[];
  logs: LogEvent[];
  analytics: Analytics;
  rerouteCount: number;
  completedTrips: number;
  seeded: boolean;
}

export interface RouteRequest {
  source: string;
  destination: string;
  mode: WeightMode;
  weights?: RouteWeights;
}

export interface RouteBundle {
  primary: PathResult;
  alternatives: PathResult[];
  baseline: PathResult | null;
  createdAt: number;
}

export interface DemoState {
  open: boolean;
  step: number;
  playing: boolean;
  autoStartedAt: number;
}

export interface Toast {
  id: string;
  message: string;
  kind: "info" | "success" | "warning" | "critical";
}

export interface UiState {
  mapView: "graph" | "geo";
  showWeights: boolean;
  showLabels: boolean;
  showHeatmap: boolean;
  showVehicles: boolean;
  source: string;
  destination: string;
  route: RouteBundle | null;
  selectedNode: string | null;
  mstEdges: string[] | null;
  demo: DemoState;
  toasts: Toast[];
  syncStatus: "connecting" | "connected" | "offline";
  peers: number;
  baseline: BeforeAfter | null;
  lastOptimization: OptimizationStat | null;
  auth: {
    role: "admin" | "viewer" | null;
    name: string | null;
    checked: boolean;
  };
  sidebarOpen: boolean;
}

export interface SimNodeEdgeInfo {
  node: CityNode;
  edge: CityEdge;
  path?: PathResult;
}
