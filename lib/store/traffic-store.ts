"use client";

import { create } from "zustand";
import { buildCityNetwork, DEFAULT_NETWORK } from "../graph/city-data";
import {
  alternativeRoutes,
  dijkstra,
  type PathOptions,
} from "../graph/algorithms";
import type {
  CityEdge,
  CityNetwork,
  CityNode,
  MstResult,
  PathResult,
  RouteWeights,
  WeightMode,
} from "../graph/types";
import { TrafficSimulator, DEFAULT_CONFIG } from "../sim/simulator";
import type {
  BeforeAfter,
  DemoState,
  FleetUnit,
  OptimizationStat,
  RouteBundle,
  SimSnapshot,
  SimConfig,
  SignalTiming,
  Toast,
  UiState,
  Weather,
} from "../sim/types";

const engine = new TrafficSimulator();
const initial = engine.getSnapshot();

export function getSimulator(): TrafficSimulator {
  return engine;
}

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function cloneNetwork(): CityNetwork {
  return JSON.parse(JSON.stringify(DEFAULT_NETWORK)) as CityNetwork;
}

function persistNetwork(network: CityNetwork) {
  if (typeof window === "undefined") return;
  fetch("/api/network", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ network }),
  }).catch(() => {
    /* persistence is best-effort; simulator remains authoritative locally */
  });
}

export interface TrafficStore extends SimSnapshot, UiState {
  initialized: boolean;
  init: () => void;
  tick: (dt: number) => void;
  start: () => void;
  pause: () => void;
  toggle: () => void;
  reset: () => void;
  setSpeed: (value: number) => void;
  setSpawnRate: (value: number) => void;
  setMaxVehicles: (value: number) => void;
  setWeather: (weather: Weather) => void;
  setAdaptiveSignals: (value: boolean) => void;
  setCoordinatedSignals: (value: boolean) => void;
  setPublicTransportPriority: (value: boolean) => void;
  setAutoReroute: (value: boolean) => void;
  setTiming: (timing: Partial<SignalTiming>) => void;
  setWeights: (weights: Partial<RouteWeights>) => void;
  generateCongestion: (count?: number) => void;
  spawnBurst: (count: number) => void;
  reportAccident: (edgeId: string, note?: string) => void;
  closeRoad: (edgeId: string) => void;
  clearIncident: (incidentId: string) => void;
  clearAllIncidents: () => void;
  setRoadDensity: (edgeId: string, density: number) => void;
  requestPedestrian: (nodeId: string) => void;
  dispatchEmergency: (fleetId: string, destination: string) => void;
  recallMission: (missionId: string) => void;
  addFleetUnit: (unit: Omit<FleetUnit, "id" | "status">) => void;
  removeFleetUnit: (id: string) => void;
  addNode: (input: { name: string; district: string; x?: number; y?: number }) => boolean;
  removeNode: (id: string) => void;
  addEdge: (input: {
    from: string;
    to: string;
    name: string;
    lengthKm: number;
    speedLimit: number;
    lanes: number;
    baseDemand?: number;
  }) => boolean;
  removeEdge: (id: string) => void;
  updateEdge: (id: string, patch: Partial<CityEdge>) => void;
  resetNetwork: () => void;
  runRoute: (source: string, destination: string, mode: WeightMode, weights?: RouteWeights) => RouteBundle | null;
  clearRoute: () => void;
  setSource: (id: string) => void;
  setDestination: (id: string) => void;
  setSelectedNode: (id: string | null) => void;
  setMapView: (view: "graph" | "geo") => void;
  toggleOption: (key: "showWeights" | "showLabels" | "showHeatmap" | "showVehicles") => void;
  runMst: (kind?: "kruskal" | "prim") => MstResult;
  captureBaseline: () => BeforeAfter | null;
  compareBaseline: () => BeforeAfter | null;
  pushToast: (message: string, kind?: Toast["kind"]) => void;
  dismissToast: (id: string) => void;
  setSync: (status: UiState["syncStatus"], peers?: number) => void;
  login: (username: string, password: string) => boolean;
  logout: () => void;
  openDemo: () => void;
  closeDemo: () => void;
  setDemoStep: (step: number) => void;
  setDemoPlaying: (playing: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  applyNetworkFromServer: (network: CityNetwork) => void;
  saveConfig: (patch: Partial<SimConfig>) => void;
}

const initialUi: UiState = {
  mapView: "geo",
  showWeights: true,
  showLabels: true,
  showHeatmap: false,
  showVehicles: true,
  source: "J01",
  destination: "J30",
  route: null,
  selectedNode: null,
  mstEdges: null,
  demo: { open: false, step: 0, playing: false, autoStartedAt: 0 },
  toasts: [],
  syncStatus: "connecting",
  peers: 0,
  baseline: null,
  lastOptimization: null,
  auth: { role: null, name: null, checked: false },
  sidebarOpen: false,
};

export const useTrafficStore = create<TrafficStore>()((set, get) => ({
  ...initial,
  ...initialUi,
  initialized: false,

  init: () => {
    if (get().initialized) return;
    engine.onSnapshot = (snapshot) => set(snapshot);
    set({ initialized: true });
    if (typeof window !== "undefined") {
      try {
        const saved = window.localStorage.getItem("bengaluru-traffic-auth");
        if (saved) {
          const parsed = JSON.parse(saved) as { role: "admin" | "viewer"; name: string };
          if (parsed.role) set({ auth: { role: parsed.role, name: parsed.name, checked: true } });
        } else {
          set({ auth: { role: null, name: null, checked: true } });
        }
      } catch {
        set({ auth: { role: null, name: null, checked: true } });
      }
      fetch("/api/network")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.network?.nodes?.length) {
            engine.setNetwork(data.network as CityNetwork);
          } else {
            fetch("/api/network", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ network: engine.network }),
            }).catch(() => undefined);
          }
        })
        .catch(() => undefined);
    }
    engine.emit();
  },

  tick: (dt) => engine.tick(dt),

  start: () => engine.start(),
  pause: () => engine.pause(),
  toggle: () => (get().running ? engine.pause() : engine.start()),
  reset: () => engine.reset(),
  setSpeed: (value) => engine.setSpeed(value),
  setSpawnRate: (value) => engine.setSpawnRate(value),
  setMaxVehicles: (value) => engine.setMaxVehicles(value),
  setWeather: (weather) => engine.setWeather(weather),
  setAdaptiveSignals: (value) => engine.setAdaptiveSignals(value),
  setCoordinatedSignals: (value) => engine.setCoordinatedSignals(value),
  setPublicTransportPriority: (value) => engine.setPublicTransportPriority(value),
  setAutoReroute: (value) => engine.setAutoReroute(value),
  setTiming: (timing) => engine.setTiming(timing),
  setWeights: (weights) => engine.setWeights(weights),

  generateCongestion: (count) => {
    engine.surgeCongestion(count);
    get().pushToast("Traffic surge generated on high-demand corridors", "warning");
  },
  spawnBurst: (count) => {
    engine.spawnBurst(count);
    get().pushToast(`${count} vehicles injected into the simulation`, "info");
  },
  reportAccident: (edgeId, note) => {
    engine.reportAccident(edgeId, note);
    get().pushToast("Accident simulated · routing weights updated", "critical");
  },
  closeRoad: (edgeId) => {
    engine.closeRoad(edgeId);
    get().pushToast("Road closed · routes recalculated", "critical");
  },
  clearIncident: (incidentId) => {
    engine.clearIncident(incidentId);
    get().pushToast("Incident cleared", "success");
  },
  clearAllIncidents: () => {
    engine.clearAllIncidents();
    get().pushToast("All incidents cleared", "success");
  },
  setRoadDensity: (edgeId, density) => engine.setRoadDensity(edgeId, density),
  requestPedestrian: (nodeId) => {
    engine.requestPedestrian(nodeId);
    get().pushToast("Pedestrian crossing phase requested", "info");
  },
  dispatchEmergency: (fleetId, destination) => {
    const mission = engine.dispatchEmergency(fleetId, destination);
    if (mission) {
      get().pushToast(`${mission.label} dispatched with priority corridor`, "critical");
    } else {
      get().pushToast("Unable to dispatch: no available route", "warning");
    }
  },
  recallMission: (missionId) => {
    engine.recallMission(missionId);
    get().pushToast("Emergency mission recalled", "warning");
  },
  addFleetUnit: (unit) => engine.addFleetUnit(unit),
  removeFleetUnit: (id) => engine.removeFleetUnit(id),

  addNode: ({ name, district, x, y }) => {
    const ids = engine.network.nodes
      .map((n) => Number(n.id.replace("J", "")))
      .filter((n) => Number.isFinite(n));
    const next = `J${String(Math.max(0, ...ids) + 1).padStart(2, "0")}`;
    const px = x ?? 300 + Math.random() * 500;
    const py = y ?? 200 + Math.random() * 400;
    const lng = 77.545 + (px / 1200) * 0.09;
    const lat = 13.02 - (py / 820) * 0.075;
    const node: CityNode = {
      id: next,
      name: name.trim(),
      district: district.trim() || "Central",
      x: Math.round(px),
      y: Math.round(py),
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
      type: "signalized",
      signalized: true,
    };
    const network: CityNetwork = {
      ...engine.network,
      version: engine.network.version + 1,
      nodes: [...engine.network.nodes, node],
    };
    engine.setNetwork(network);
    persistNetwork(network);
    get().pushToast(`Intersection ${next} · ${node.name} added`, "success");
    return true;
  },

  removeNode: (id) => {
    if (engine.network.nodes.length <= 2) {
      get().pushToast("The network must retain at least two intersections", "warning");
      return;
    }
    const network: CityNetwork = {
      ...engine.network,
      version: engine.network.version + 1,
      nodes: engine.network.nodes.filter((n) => n.id !== id),
      edges: engine.network.edges.filter((e) => e.from !== id && e.to !== id),
    };
    engine.setNetwork(network);
    persistNetwork(network);
    if (get().source === id) set({ source: network.nodes[0].id });
    if (get().destination === id) set({ destination: network.nodes[network.nodes.length - 1].id });
    get().pushToast(`Intersection ${id} removed with connected roads`, "warning");
  },

  addEdge: ({ from, to, name, lengthKm, speedLimit, lanes, baseDemand }) => {
    if (from === to) {
      get().pushToast("A road must connect two different intersections", "warning");
      return false;
    }
    const duplicate = engine.network.edges.some(
      (e) => (e.from === from && e.to === to) || (e.from === to && e.to === from),
    );
    if (duplicate) {
      get().pushToast("A road already connects these intersections", "warning");
      return false;
    }
    const ids = engine.network.edges
      .map((e) => Number(e.id.replace("E", "")))
      .filter((n) => Number.isFinite(n));
    const next = `E${String(Math.max(0, ...ids) + 1).padStart(3, "0")}`;
    const edge: CityEdge = {
      id: next,
      from,
      to,
      name: name.trim() || `Connector ${next}`,
      corridor: name.trim() || "Custom Corridor",
      lengthKm: Number(lengthKm.toFixed(2)),
      speedLimit: Math.round(speedLimit),
      lanes: Math.round(lanes),
      baseDemand: baseDemand ?? 0.3,
    };
    const network: CityNetwork = {
      ...engine.network,
      version: engine.network.version + 1,
      edges: [...engine.network.edges, edge],
    };
    engine.setNetwork(network);
    persistNetwork(network);
    get().pushToast(`Road ${next} opened between ${from} and ${to}`, "success");
    return true;
  },

  removeEdge: (id) => {
    const network: CityNetwork = {
      ...engine.network,
      version: engine.network.version + 1,
      edges: engine.network.edges.filter((e) => e.id !== id),
    };
    engine.setNetwork(network);
    persistNetwork(network);
    get().pushToast(`Road ${id} removed from the network`, "warning");
  },

  updateEdge: (id, patch) => {
    const network: CityNetwork = {
      ...engine.network,
      version: engine.network.version + 1,
      edges: engine.network.edges.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    };
    engine.setNetwork(network);
    persistNetwork(network);
  },

  resetNetwork: () => {
    const network = cloneNetwork();
    engine.setNetwork(network);
    persistNetwork(network);
    set({ mstEdges: null, route: null });
    get().pushToast("Sample city network restored", "success");
  },

  runRoute: (source, destination, mode, weights) => {
    if (source === destination) {
      get().pushToast("Source and destination must be different", "warning");
      return null;
    }
    const ctx = engine.weightContext(mode);
    const options: PathOptions = {
      mode,
      ctx,
      weights: weights ?? engine.config.weights,
    };
    const primary = dijkstra(engine.network, source, destination, options);
    if (!primary.found) {
      get().pushToast("No available route — check road closures", "critical");
      set({ route: null });
      return null;
    }
    const alternatives = alternativeRoutes(engine.network, source, destination, options, 2);
    const baseline =
      mode === "distance"
        ? null
        : dijkstra(engine.network, source, destination, { ...options, mode: "distance" });
    const bundle: RouteBundle = {
      primary,
      alternatives,
      baseline,
      createdAt: Date.now(),
    };

    const baselineTime = baseline?.totalTimeMin ?? primary.totalTimeMin;
    const timeSavedMin = Number(Math.max(0, baselineTime - primary.totalTimeMin).toFixed(1));
    const baselineDensity = (baseline?.pathEdges ?? [])
      .reduce((sum, id) => sum + (ctx.density[id] ?? 0), 0) / Math.max(1, baseline?.pathEdges.length ?? 1);
    const primaryDensity =
      primary.pathEdges.reduce((sum, id) => sum + (ctx.density[id] ?? 0), 0) /
      Math.max(1, primary.pathEdges.length);
    const stat: OptimizationStat = {
      id: uid("OPT"),
      source,
      destination,
      mode,
      distanceKm: primary.totalDistanceKm,
      timeMin: primary.totalTimeMin,
      timeSavedMin,
      congestionAvoided: Number(Math.max(0, baselineDensity - primaryDensity).toFixed(2)),
      wallTime: Date.now(),
      algorithm: "Dijkstra",
    };
    const node = (id: string) => engine.network.nodes.find((n) => n.id === id)?.name ?? id;
    engine.log(
      "route",
      `Dijkstra route ${node(source)} → ${node(destination)} · ${primary.pathEdges.length} segments · ${primary.totalDistanceKm} km · ${primary.totalTimeMin} min`,
      "success",
    );
    engine.recordOptimization(stat);
    set({ route: bundle, source, destination, lastOptimization: stat });
    get().pushToast(
      `Optimal route found · ${primary.totalDistanceKm} km · ${primary.totalTimeMin} min (simulated)`,
      "success",
    );
    return bundle;
  },

  clearRoute: () => set({ route: null }),
  setSource: (id) => {
    if (id === get().destination) {
      get().pushToast("Source cannot equal destination", "warning");
      return;
    }
    set({ source: id, route: null, selectedNode: id });
  },
  setDestination: (id) => {
    if (id === get().source) {
      get().pushToast("Destination cannot equal source", "warning");
      return;
    }
    set({ destination: id, route: null, selectedNode: id });
  },
  setSelectedNode: (id) => set({ selectedNode: id }),
  setMapView: (view) => set({ mapView: view }),
  toggleOption: (key) => set({ [key]: !get()[key] } as Partial<TrafficStore>),

  runMst: (kind = "kruskal") => {
    const result = engine.runMst(kind);
    set({ mstEdges: result.edges });
    engine.log(
      "algorithm",
      `${kind === "kruskal" ? "Kruskal" : "Prim"} minimum spanning tree · ${result.edges.length} roads · ${result.totalWeight} km`,
      "success",
    );
    get().pushToast(
      `${kind === "kruskal" ? "Kruskal" : "Prim"} MST: ${result.edges.length} edges · ${result.totalWeight} km`,
      "success",
    );
    return result;
  },

  captureBaseline: () => {
    const baseline = engine.captureBaseline();
    set({ baseline });
    get().pushToast("Baseline captured for before/after comparison", "info");
    return baseline;
  },

  compareBaseline: () => {
    const baseline = engine.compareBaseline();
    set({ baseline });
    if (!baseline) {
      get().pushToast("Capture a baseline first", "warning");
      return null;
    }
    return baseline;
  },

  pushToast: (message, kind = "info") => {
    const id = uid("T");
    set({ toasts: [...get().toasts, { id, message, kind }] });
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        set({ toasts: get().toasts.filter((t) => t.id !== id) });
      }, 4800);
    }
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  setSync: (status, peers = 0) => set({ syncStatus: status, peers }),

  login: (username, password) => {
    const normalized = username.trim().toLowerCase();
    if (normalized === "admin" && password === "admin123") {
      const auth = { role: "admin" as const, name: "Traffic Administrator", checked: true };
      set({ auth });
      if (typeof window !== "undefined") window.localStorage.setItem("bengaluru-traffic-auth", JSON.stringify(auth));
      get().pushToast("Administrator session started", "success");
      return true;
    }
    if (normalized === "viewer" && password === "viewer123") {
      const auth = { role: "viewer" as const, name: "Operations Viewer", checked: true };
      set({ auth });
      if (typeof window !== "undefined") window.localStorage.setItem("bengaluru-traffic-auth", JSON.stringify(auth));
      get().pushToast("Viewer session started · read-only access", "info");
      return true;
    }
    get().pushToast("Invalid credentials", "critical");
    return false;
  },
  logout: () => {
    set({ auth: { role: null, name: null, checked: true } });
    if (typeof window !== "undefined") window.localStorage.removeItem("bengaluru-traffic-auth");
    get().pushToast("Session ended", "info");
  },

  openDemo: () =>
    set({
      demo: { open: true, step: 0, playing: false, autoStartedAt: Date.now() },
    }),
  closeDemo: () => set({ demo: { ...get().demo, open: false, playing: false } }),
  setDemoStep: (step) => set({ demo: { ...get().demo, step: Math.max(0, Math.min(13, step)) } }),
  setDemoPlaying: (playing) =>
    set({ demo: { ...get().demo, playing, autoStartedAt: Date.now() } }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  applyNetworkFromServer: (network) => {
    engine.setNetwork(network as CityNetwork);
  },

  saveConfig: (patch) => {
    const next = { ...engine.config, ...patch };
    engine.config = next;
    engine.log("admin", "Simulation configuration saved", "success");
    engine.emit();
  },
}));

export const demoSteps = [
  {
    title: "Load the sample city graph",
      body: "Bengaluru is modelled as a weighted graph G = (V, E). Major intersections form the vertex set V and primary road corridors form the edge set E, laid out to reflect the city's actual geography. Every road carries a live simulation weight.",
    action: "load",
  },
  {
    title: "Inspect the network",
    body: "Each cyan node is an intersection, each line a bidirectional road. Colour encodes simulated congestion — green is free-flowing, red is severe. The Graph View exposes topology; Geographic View places the same graph on a city plan.",
    action: "inspect",
  },
  {
    title: "Generate vehicles",
    body: "Vehicles are introduced with real origins and destinations. Each one runs Dijkstra on the current weighted graph, so its route responds to distance, congestion and signal delay.",
    action: "vehicles",
  },
  {
    title: "Traffic density rises",
    body: "As more vehicles enter the network, edge load increases. Density is written back into each road's weight in real time, closing the loop between traffic physics and graph theory.",
    action: "density",
  },
  {
    title: "Identify congested corridors",
    body: "Roads crossing the heavy/severe threshold are flagged. In the dashboard they power the congestion distribution and incident feeds; in the map they glow orange and red.",
    action: "congestion",
  },
  {
    title: "Run Dijkstra's algorithm",
    body: "Dijkstra settles intersections in increasing cost order using a priority queue, guaranteeing the minimum-cost path for non-negative weights. The animated map shows the resulting optimal route.",
    action: "dijkstra",
  },
  {
    title: "Run A* search",
    body: "A* adds a great-circle heuristic to the same priority queue. Because the heuristic never overestimates remaining travel cost, the result is still optimal — typically with fewer expanded nodes.",
    action: "astar",
  },
  {
    title: "Compare the algorithms",
    body: "Both routes share the same cost. The laboratory reports expanded nodes, execution time and memory estimates so the computational trade-off is measurable — not assumed.",
    action: "compare",
  },
  {
    title: "Activate adaptive signals",
    body: "Signal green time is recalculated from incoming density: 20 s when quiet, up to 60 s under very heavy load. Corridor coordination can phase adjacent intersections into a green wave.",
    action: "signals",
  },
  {
    title: "Introduce a road blockage",
    body: "An operator closes a segment on the optimised route. The edge is removed from every routing computation and its weight becomes prohibitive, exactly as a real traffic control room would handle a closure.",
    action: "block",
  },
  {
    title: "Recalculate the optimal route",
    body: "Dijkstra is re-run against the updated graph. The replacement route demonstrates dynamic rerouting: the topology changed, the algorithm adapted, and vehicles already on the corridor are redirected.",
    action: "reroute",
  },
  {
    title: "Dispatch an emergency vehicle",
    body: "An ambulance requests the fastest available corridor to the destination. It receives a priority route, signal preemption at every upcoming intersection and a cleared lane profile in the simulation.",
    action: "emergency",
  },
  {
    title: "Emergency prioritisation",
    body: "Signals along the corridor are forced green while the vehicle passes, then restored to adaptive control. Congestion on priority edges is reduced as simulated traffic yields, and the mission ETA is tracked live.",
    action: "priority",
  },
  {
    title: "Before / after analytics",
    body: "The analytics view compares the captured baseline with the current state. All values are measured inside this simulation — never presented as real-world city improvements.",
    action: "analytics",
  },
];
