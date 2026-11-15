import { buildAdjacency, haversineKm } from "./city-data";
import type {
  CityEdge,
  CityNetwork,
  CityNode,
  MstResult,
  PathResult,
  PathTraceStep,
  RouteWeights,
  TraversalResult,
  WeightContext,
  WeightMode,
} from "./types";

export const DEFAULT_WEIGHTS: RouteWeights = {
  distance: 1,
  traffic: 1.6,
  signal: 1,
  incident: 8,
};

export class MinHeap<T> {
  private items: Array<{ value: T; priority: number }> = [];

  get size() {
    return this.items.length;
  }

  push(value: T, priority: number) {
    this.items.push({ value, priority });
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.items[parent].priority <= this.items[i].priority) break;
      [this.items[parent], this.items[i]] = [this.items[i], this.items[parent]];
      i = parent;
    }
  }

  pop(): T | undefined {
    if (this.items.length === 0) return undefined;
    const top = this.items[0];
    const last = this.items.pop()!;
    if (this.items.length > 0) {
      this.items[0] = last;
      let i = 0;
      for (;;) {
        const left = 2 * i + 1;
        const right = left + 1;
        let smallest = i;
        if (left < this.items.length && this.items[left].priority < this.items[smallest].priority) smallest = left;
        if (right < this.items.length && this.items[right].priority < this.items[smallest].priority) smallest = right;
        if (smallest === i) break;
        [this.items[smallest], this.items[i]] = [this.items[i], this.items[smallest]];
        i = smallest;
      }
    }
    return top.value;
  }
}

export function effectiveSpeed(edge: CityEdge, density: number, weatherFactor = 1): number {
  return Math.max(8, edge.speedLimit * (1 - 0.58 * Math.min(1, density)) * weatherFactor);
}

export interface GenericWeight {
  (from: string, to: string, edge: CityEdge): number;
}

export function createWeightFn(
  mode: WeightMode,
  ctx: WeightContext,
  weights: RouteWeights = DEFAULT_WEIGHTS,
): GenericWeight {
  return (_from: string, to: string, edge: CityEdge) => {
    const density = ctx.density[edge.id] ?? edge.baseDemand;
    const weather = ctx.weatherFactor ?? 1;
    const speed = effectiveSpeed(edge, density, weather);
    const timeMin = (edge.lengthKm / speed) * 60;
    const signal = (ctx.signalDelayMin[to] ?? 0) * weights.signal;
    const incidentPenalty = ctx.incident[edge.id] ? weights.incident : 0;
    const blockedPenalty = ctx.blocked[edge.id] ? 1e7 : 0;

    switch (mode) {
      case "distance":
        return edge.lengthKm + blockedPenalty;
      case "time":
        return timeMin + signal + incidentPenalty + blockedPenalty;
      case "congestion":
        return edge.lengthKm * (1 + 5.5 * density) + incidentPenalty + blockedPenalty;
      case "balanced":
      default:
        return (
          edge.lengthKm * weights.distance * (1 + density * weights.traffic) +
          signal +
          incidentPenalty +
          blockedPenalty
        );
    }
  };
}

function heuristicMin(
  nodeId: string,
  targetId: string,
  nodes: Map<string, CityNode>,
  mode: WeightMode,
  weights: RouteWeights,
): number {
  const a = nodes.get(nodeId);
  const b = nodes.get(targetId);
  if (!a || !b) return 0;
  const h = haversineKm(a, b);
  switch (mode) {
    case "time":
      return (h / 65) * 60;
    case "congestion":
    case "distance":
      return h;
    case "balanced":
    default:
      return h * weights.distance;
  }
}

function reconstruct(
  parents: Map<string, { node: string; edge: string }>,
  source: string,
  target: string,
): { nodes: string[]; edges: string[] } {
  const nodes: string[] = [target];
  const edges: string[] = [];
  let cursor = target;
  let guard = 0;
  while (cursor !== source && guard < 1000) {
    const parent = parents.get(cursor);
    if (!parent) return { nodes: [], edges: [] };
    edges.unshift(parent.edge);
    nodes.unshift(parent.node);
    cursor = parent.node;
    guard += 1;
  }
  return cursor === source ? { nodes, edges } : { nodes: [], edges: [] };
}

export interface PathOptions {
  mode: WeightMode;
  ctx: WeightContext;
  weights?: RouteWeights;
  penaltyEdges?: Record<string, number>;
  traceLimit?: number;
}

function makeAdjacency(network: CityNetwork, ctx: WeightContext) {
  const adjacency = buildAdjacency(network);
  return adjacency;
}

export function dijkstra(
  network: CityNetwork,
  source: string,
  target: string,
  options: PathOptions,
): PathResult {
  const started = performance.now();
  const weights = options.weights ?? DEFAULT_WEIGHTS;
  const weightFnBase = createWeightFn(options.mode, options.ctx, weights);
  const adjacency = makeAdjacency(network, options.ctx);
  const nodesById = new Map(network.nodes.map((n) => [n.id, n]));
  const dist = new Map<string, number>();
  const parents = new Map<string, { node: string; edge: string }>();
  const heap = new MinHeap<string>();
  const settled = new Set<string>();
  const visitedOrder: string[] = [];
  const trace: PathTraceStep[] = [];
  const log: string[] = [];
  const traceLimit = options.traceLimit ?? 4000;

  const tracePush = (step: Omit<PathTraceStep, "step">) => {
    if (trace.length >= traceLimit) return;
    trace.push({ ...step, step: trace.length + 1 });
  };

  for (const node of network.nodes) dist.set(node.id, Infinity);
  dist.set(source, 0);
  heap.push(source, 0);
  tracePush({ type: "start", node: source, note: `Source ${source} initialised with distance 0` });
  log.push(`Initialise distance[${source}] = 0, all other nodes = ∞`);

  while (heap.size) {
    const current = heap.pop()!;
    if (settled.has(current)) continue;
    settled.add(current);
    visitedOrder.push(current);
    tracePush({
      type: "visit",
      node: current,
      distance: Number((dist.get(current) ?? 0).toFixed(3)),
      note: `Extract minimum from priority queue`,
    });
    log.push(
      `Visit ${current} (dist ${(dist.get(current) ?? 0).toFixed(2)}) — ${settled.size}/${network.nodes.length} settled`,
    );
    if (current === target) break;

    for (const link of adjacency.get(current) ?? []) {
      if (options.ctx.blocked[link.edge.id]) continue;
      if (settled.has(link.node)) continue;
      const penalty = options.penaltyEdges?.[link.edge.id] ?? 0;
      const cost = weightFnBase(current, link.node, link.edge) + penalty;
      const candidate = (dist.get(current) ?? Infinity) + cost;
      const previous = dist.get(link.node) ?? Infinity;
      if (candidate < previous) {
        dist.set(link.node, candidate);
        parents.set(link.node, { node: current, edge: link.edge.id });
        heap.push(link.node, candidate);
        tracePush({
          type: "accept",
          from: current,
          to: link.node,
          edgeId: link.edge.id,
          distance: Number(candidate.toFixed(3)),
          note: `Relax edge: ${previous === Infinity ? "∞" : previous.toFixed(2)} → ${candidate.toFixed(2)}`,
        });
        if (trace.length < 90) {
          log.push(
            `Relax ${current} → ${link.node} via ${link.edge.id}: distance becomes ${candidate.toFixed(2)}`,
          );
        }
      } else {
        tracePush({
          type: "skip",
          from: current,
          to: link.node,
          edgeId: link.edge.id,
          distance: Number(candidate.toFixed(3)),
          note: `Candidate ${candidate.toFixed(2)} ≥ known ${previous.toFixed(2)}; discard`,
        });
      }
    }
  }

  const path = reconstruct(parents, source, target);
  const found = path.nodes.length > 0;
  const summary = summarizePath(network, path.nodes, path.edges, options.ctx);
  tracePush({
    type: "done",
    note: found ? `Optimal route reconstructed with cost ${summary.totalCost.toFixed(2)}` : "Destination unreachable",
  });
  log.push(
    found
      ? `Destination reached. Shortest path: ${path.nodes.join(" → ")}`
      : "Search exhausted — no route available.",
  );

  return {
    algorithm: "dijkstra",
    source,
    target,
    found,
    pathNodes: path.nodes,
    pathEdges: path.edges,
    totalCost: found ? Number((dist.get(target) ?? summary.totalCost).toFixed(3)) : 0,
    totalDistanceKm: summary.totalDistanceKm,
    totalTimeMin: summary.totalTimeMin,
    visitedOrder,
    explored: settled.size,
    executionMs: Number((performance.now() - started).toFixed(3)),
    memoryKb: Number(((dist.size + parents.size + settled.size + heap.size) * 0.08).toFixed(2)),
    trace,
    log,
    heuristic: "none",
  };
}

export function astar(
  network: CityNetwork,
  source: string,
  target: string,
  options: PathOptions,
): PathResult {
  const started = performance.now();
  const weights = options.weights ?? DEFAULT_WEIGHTS;
  const weightFnBase = createWeightFn(options.mode, options.ctx, weights);
  const adjacency = makeAdjacency(network, options.ctx);
  const nodesById = new Map(network.nodes.map((n) => [n.id, n]));
  const dist = new Map<string, number>();
  const parents = new Map<string, { node: string; edge: string }>();
  const heap = new MinHeap<string>();
  const settled = new Set<string>();
  const visitedOrder: string[] = [];
  const trace: PathTraceStep[] = [];
  const log: string[] = [];
  const traceLimit = options.traceLimit ?? 4000;

  const tracePush = (step: Omit<PathTraceStep, "step">) => {
    if (trace.length >= traceLimit) return;
    trace.push({ ...step, step: trace.length + 1 });
  };

  for (const node of network.nodes) dist.set(node.id, Infinity);
  dist.set(source, 0);
  const h0 = heuristicMin(source, target, nodesById, options.mode, weights);
  heap.push(source, h0);
  tracePush({
    type: "start",
    node: source,
    distance: 0,
    note: `Priority = g + h = 0 + ${h0.toFixed(2)} (great-circle heuristic)`,
  });
  log.push(`Start ${source}. Heuristic to target ≈ ${h0.toFixed(2)}`);

  while (heap.size) {
    const current = heap.pop()!;
    if (settled.has(current)) continue;
    settled.add(current);
    visitedOrder.push(current);
    tracePush({
      type: "visit",
      node: current,
      distance: Number((dist.get(current) ?? 0).toFixed(3)),
      note: "Expand most promising node",
    });
    if (current === target) break;

    for (const link of adjacency.get(current) ?? []) {
      if (options.ctx.blocked[link.edge.id]) continue;
      if (settled.has(link.node)) continue;
      const penalty = options.penaltyEdges?.[link.edge.id] ?? 0;
      const cost = weightFnBase(current, link.node, link.edge) + penalty;
      const candidate = (dist.get(current) ?? Infinity) + cost;
      if (candidate < (dist.get(link.node) ?? Infinity)) {
        dist.set(link.node, candidate);
        parents.set(link.node, { node: current, edge: link.edge.id });
        const h = heuristicMin(link.node, target, nodesById, options.mode, weights);
        heap.push(link.node, candidate + h);
        tracePush({
          type: "accept",
          from: current,
          to: link.node,
          edgeId: link.edge.id,
          distance: Number(candidate.toFixed(3)),
          note: `g = ${candidate.toFixed(2)}, h = ${h.toFixed(2)}, f = ${(candidate + h).toFixed(2)}`,
        });
      }
    }
  }

  const path = reconstruct(parents, source, target);
  const found = path.nodes.length > 0;
  const summary = summarizePath(network, path.nodes, path.edges, options.ctx);
  tracePush({
    type: "done",
    note: found ? `A* route reconstructed with cost ${summary.totalCost.toFixed(2)}` : "Destination unreachable",
  });
  log.push(found ? `A* optimal path: ${path.nodes.join(" → ")}` : "A* exhausted — no route available.");

  const hTarget = heuristicMin(target, target, nodesById, options.mode, weights);
  return {
    algorithm: "astar",
    source,
    target,
    found,
    pathNodes: path.nodes,
    pathEdges: path.edges,
    totalCost: found ? Number((dist.get(target) ?? summary.totalCost).toFixed(3)) : 0,
    totalDistanceKm: summary.totalDistanceKm,
    totalTimeMin: summary.totalTimeMin,
    visitedOrder,
    explored: settled.size,
    executionMs: Number((performance.now() - started).toFixed(3)),
    memoryKb: Number(((dist.size + parents.size + settled.size + heap.size) * 0.1).toFixed(2)),
    trace,
    log,
    heuristic: `Great-circle distance × cost scale (h(target) = ${hTarget.toFixed(2)})`,
  };
}

export function bfs(
  network: CityNetwork,
  source: string,
  target: string,
  ctx: WeightContext,
): TraversalResult {
  const started = performance.now();
  const adjacency = makeAdjacency(network, ctx);
  const queue: string[] = [source];
  const discovered = new Set<string>([source]);
  const parents = new Map<string, { node: string; edge: string }>();
  const order: string[] = [];
  const visitedEdges: string[] = [];
  const trace: PathTraceStep[] = [];
  const log: string[] = [];

  trace.push({ type: "start", node: source, step: 1, note: "Seed FIFO queue with source" });
  while (queue.length) {
    const node = queue.shift()!;
    order.push(node);
    trace.push({
      type: "visit",
      node,
      step: trace.length + 1,
      note: `Dequeue ${node} · frontier size ${queue.length}`,
    });
    if (node === target) break;
    for (const link of adjacency.get(node) ?? []) {
      if (ctx.blocked[link.edge.id] || discovered.has(link.node)) continue;
      discovered.add(link.node);
      parents.set(link.node, { node, edge: link.edge.id });
      visitedEdges.push(link.edge.id);
      queue.push(link.node);
      trace.push({
        type: "accept",
        from: node,
        to: link.node,
        edgeId: link.edge.id,
        step: trace.length + 1,
        note: `Discover ${link.node} at hop ${order.indexOf(node) >= 0 ? "n+1" : "n"}`,
      });
    }
  }

  const path = reconstruct(parents, source, target);
  log.push(`BFS explores in hop order: ${order.join(" → ")}`);
  return {
    algorithm: "bfs",
    source,
    target,
    order,
    visitedEdges,
    pathNodes: path.nodes,
    pathEdges: path.edges,
    found: path.nodes.length > 0,
    executionMs: Number((performance.now() - started).toFixed(3)),
    trace,
    log,
  };
}

export function dfs(
  network: CityNetwork,
  source: string,
  target: string,
  ctx: WeightContext,
): TraversalResult {
  const started = performance.now();
  const adjacency = makeAdjacency(network, ctx);
  const stack: string[] = [source];
  const discovered = new Set<string>();
  const parents = new Map<string, { node: string; edge: string }>();
  const order: string[] = [];
  const visitedEdges: string[] = [];
  const trace: PathTraceStep[] = [];
  const log: string[] = [];

  trace.push({ type: "start", node: source, step: 1, note: "Push source on LIFO stack" });
  while (stack.length) {
    const node = stack.pop()!;
    if (discovered.has(node)) continue;
    discovered.add(node);
    order.push(node);
    trace.push({
      type: "visit",
      node,
      step: trace.length + 1,
      note: `Pop and visit ${node} · stack size ${stack.length}`,
    });
    if (node === target) break;
    const neighbours = [...(adjacency.get(node) ?? [])].reverse();
    for (const link of neighbours) {
      if (ctx.blocked[link.edge.id] || discovered.has(link.node)) continue;
      if (!parents.has(link.node) && link.node !== source) {
        parents.set(link.node, { node, edge: link.edge.id });
      }
      visitedEdges.push(link.edge.id);
      stack.push(link.node);
      trace.push({
        type: "accept",
        from: node,
        to: link.node,
        edgeId: link.edge.id,
        step: trace.length + 1,
        note: `Push ${link.node} — depth-first descent`,
      });
    }
  }

  const path = reconstruct(parents, source, target);
  log.push(`DFS traversal order: ${order.join(" → ")}`);
  return {
    algorithm: "dfs",
    source,
    target,
    order,
    visitedEdges,
    pathNodes: path.nodes,
    pathEdges: path.edges,
    found: path.nodes.length > 0,
    executionMs: Number((performance.now() - started).toFixed(3)),
    trace,
    log,
  };
}

class UnionFind {
  private parent = new Map<string, string>();
  private rank = new Map<string, number>();

  constructor(nodes: string[]) {
    for (const node of nodes) {
      this.parent.set(node, node);
      this.rank.set(node, 0);
    }
  }

  find(x: string): string {
    const p = this.parent.get(x);
    if (!p || p === x) return x;
    const root = this.find(p);
    this.parent.set(x, root);
    return root;
  }

  union(a: string, b: string): boolean {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return false;
    const rankA = this.rank.get(ra) ?? 0;
    const rankB = this.rank.get(rb) ?? 0;
    if (rankA < rankB) this.parent.set(ra, rb);
    else if (rankA > rankB) this.parent.set(rb, ra);
    else {
      this.parent.set(rb, ra);
      this.rank.set(ra, rankA + 1);
    }
    return true;
  }
}

export function kruskal(network: CityNetwork, ctx?: WeightContext): MstResult {
  const started = performance.now();
  const sorted = [...network.edges]
    .filter((e) => !ctx?.blocked[e.id])
    .sort((a, b) => a.lengthKm - b.lengthKm);
  const uf = new UnionFind(network.nodes.map((n) => n.id));
  const picked: string[] = [];
  const visitedOrder: string[] = [];
  const trace: PathTraceStep[] = [];
  const log: string[] = [];
  let total = 0;

  for (const edge of sorted) {
    const fromRoot = uf.find(edge.from);
    const toRoot = uf.find(edge.to);
    const accept = fromRoot !== toRoot;
    trace.push({
      type: accept ? "accept" : "skip",
      from: edge.from,
      to: edge.to,
      edgeId: edge.id,
      distance: edge.lengthKm,
      step: trace.length + 1,
      note: accept
        ? `Add ${edge.id} (${edge.lengthKm} km) — components merged`
        : `Reject ${edge.id} — would create a cycle`,
    });
    if (accept) {
      uf.union(edge.from, edge.to);
      picked.push(edge.id);
      total += edge.lengthKm;
      if (!visitedOrder.includes(edge.from)) visitedOrder.push(edge.from);
      if (!visitedOrder.includes(edge.to)) visitedOrder.push(edge.to);
      log.push(`Add ${edge.id} ${edge.from}–${edge.to} (${edge.lengthKm} km)`);
    }
  }

  const roots = new Set(network.nodes.map((n) => uf.find(n.id)));
  log.push(`MST complete: ${picked.length} roads, ${total.toFixed(2)} km total, ${roots.size} component(s)`);
  trace.push({ type: "done", step: trace.length + 1, note: `Total spanning cost ${total.toFixed(2)} km` });
  return {
    algorithm: "kruskal",
    edges: picked,
    totalWeight: Number(total.toFixed(2)),
    components: roots.size,
    visitedOrder,
    executionMs: Number((performance.now() - started).toFixed(3)),
    trace,
    log,
  };
}

export function prim(network: CityNetwork, startNode?: string, ctx?: WeightContext): MstResult {
  const started = performance.now();
  const adjacency = makeAdjacency(network, ctx ?? emptyContext());
  const source = startNode ?? network.nodes[0]?.id;
  const inTree = new Set<string>();
  const picked: string[] = [];
  const visitedOrder: string[] = [];
  const trace: PathTraceStep[] = [];
  const log: string[] = [];
  let total = 0;

  if (!source) {
    return {
      algorithm: "prim",
      edges: [],
      totalWeight: 0,
      components: 0,
      visitedOrder: [],
      executionMs: 0,
      trace: [],
      log: ["Network is empty"],
    };
  }

  inTree.add(source);
  visitedOrder.push(source);
  trace.push({ type: "start", node: source, step: 1, note: `Grow tree from ${source}` });

  while (inTree.size < network.nodes.length) {
    let best: { edge: CityEdge; to: string } | null = null;
    for (const node of inTree) {
      for (const link of adjacency.get(node) ?? []) {
        if (ctx?.blocked[link.edge.id] || inTree.has(link.node)) continue;
        if (!best || link.edge.lengthKm < best.edge.lengthKm) {
          best = { edge: link.edge, to: link.node };
        }
      }
    }
    if (!best) break;
    inTree.add(best.to);
    visitedOrder.push(best.to);
    picked.push(best.edge.id);
    total += best.edge.lengthKm;
    trace.push({
      type: "accept",
      from: best.edge.from,
      to: best.edge.to,
      edgeId: best.edge.id,
      distance: best.edge.lengthKm,
      step: trace.length + 1,
      note: `Cheapest cut edge ${best.edge.id} connects ${best.to}`,
    });
    log.push(`Add ${best.edge.id} (${best.edge.lengthKm} km) linking ${best.to}`);
  }

  const reached = inTree.size;
  trace.push({ type: "done", step: trace.length + 1, note: `Prim tree built over ${reached} nodes` });
  return {
    algorithm: "prim",
    edges: picked,
    totalWeight: Number(total.toFixed(2)),
    components: reached === network.nodes.length ? 1 : 2,
    visitedOrder,
    executionMs: Number((performance.now() - started).toFixed(3)),
    trace,
    log,
  };
}

export function emptyContext(): WeightContext {
  return { density: {}, blocked: {}, incident: {}, signalDelayMin: {}, weatherFactor: 1 };
}

export function summarizePath(
  network: CityNetwork,
  pathNodes: string[],
  pathEdges: string[],
  ctx: WeightContext,
) {
  const edgesById = new Map(network.edges.map((e) => [e.id, e]));
  let distance = 0;
  let time = 0;
  let congestion = 0;
  let incidentCount = 0;
  for (const edgeId of pathEdges) {
    const edge = edgesById.get(edgeId);
    if (!edge) continue;
    const density = ctx.density[edgeId] ?? edge.baseDemand;
    distance += edge.lengthKm;
    time += (edge.lengthKm / effectiveSpeed(edge, density, ctx.weatherFactor ?? 1)) * 60;
    time += ctx.signalDelayMin[edge.to] ?? 0;
    congestion += density;
    if (ctx.incident[edgeId]) incidentCount += 1;
  }
  return {
    totalDistanceKm: Number(distance.toFixed(2)),
    totalTimeMin: Number(time.toFixed(1)),
    avgCongestion: pathEdges.length ? Number((congestion / pathEdges.length).toFixed(2)) : 0,
    incidentCount,
    totalCost: Number((distance + time * 0.05).toFixed(2)),
  };
}

/** Generates distinct alternative routes by penalising edges already used. */
export function alternativeRoutes(
  network: CityNetwork,
  source: string,
  target: string,
  options: PathOptions,
  count = 2,
): PathResult[] {
  const results: PathResult[] = [];
  const signatures = new Set<string>();
  let penalty: Record<string, number> = {};

  for (let i = 0; i < count; i++) {
    let result = dijkstra(network, source, target, { ...options, penaltyEdges: penalty });
    let attempts = 0;
    let signature = result.pathEdges.join("|");
    while (result.found && signatures.has(signature) && attempts < 4) {
      penalty = { ...penalty };
      for (const edgeId of result.pathEdges) penalty[edgeId] = (penalty[edgeId] ?? 0) + 5;
      result = dijkstra(network, source, target, { ...options, penaltyEdges: penalty });
      signature = result.pathEdges.join("|");
      attempts += 1;
    }
    if (!result.found || signatures.has(signature)) break;
    signatures.add(signature);
    results.push({ ...result, algorithm: "dijkstra" });
    for (const edgeId of result.pathEdges) {
      penalty[edgeId] = (penalty[edgeId] ?? 0) + 3 + i * 2;
    }
  }
  return results;
}

export function comparePathAlgorithms(
  network: CityNetwork,
  source: string,
  target: string,
  options: PathOptions,
) {
  const dijkstraResult = dijkstra(network, source, target, options);
  const astarResult = astar(network, source, target, options);
  const bfsResult = bfs(network, source, target, options.ctx);
  const dfsResult = dfs(network, source, target, options.ctx);
  const uniqueExplored = new Set<string>();
  for (const node of dijkstraResult.visitedOrder) uniqueExplored.add(node);

  return {
    dijkstra: dijkstraResult,
    astar: astarResult,
    bfs: {
      ...bfsResult,
      totalCost: bfsResult.pathEdges.length,
      totalDistanceKm: summarizePath(network, bfsResult.pathNodes, bfsResult.pathEdges, options.ctx).totalDistanceKm,
      totalTimeMin: summarizePath(network, bfsResult.pathNodes, bfsResult.pathEdges, options.ctx).totalTimeMin,
      explored: bfsResult.order.length,
      memoryKb: Number((bfsResult.order.length * 0.08).toFixed(2)),
    } as unknown as PathResult,
    dfs: {
      ...dfsResult,
      totalCost: dfsResult.pathEdges.length,
      totalDistanceKm: summarizePath(network, dfsResult.pathNodes, dfsResult.pathEdges, options.ctx).totalDistanceKm,
      totalTimeMin: summarizePath(network, dfsResult.pathNodes, dfsResult.pathEdges, options.ctx).totalTimeMin,
      explored: dfsResult.order.length,
      memoryKb: Number((dfsResult.order.length * 0.08).toFixed(2)),
    } as unknown as PathResult,
    mst: kruskal(network, options.ctx),
    primMst: prim(network, source, options.ctx),
    graphSize: { nodes: network.nodes.length, edges: network.edges.length },
    uniqueDijkstraNodes: uniqueExplored.size,
  };
}
