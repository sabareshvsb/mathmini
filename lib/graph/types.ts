export type NodeType = "junction" | "roundabout" | "signalized" | "terminal";

export interface CityNode {
  id: string;
  name: string;
  district: string;
  x: number;
  y: number;
  lat: number;
  lng: number;
  type: NodeType;
  signalized: boolean;
}

export interface CityEdge {
  id: string;
  from: string;
  to: string;
  name: string;
  corridor: string;
  lengthKm: number;
  speedLimit: number;
  lanes: number;
  baseDemand: number;
}

export interface CityNetwork {
  name: string;
  version: number;
  description: string;
  nodes: CityNode[];
  edges: CityEdge[];
}

export type WeightMode = "distance" | "time" | "congestion" | "balanced";

export interface RouteWeights {
  distance: number;
  traffic: number;
  signal: number;
  incident: number;
}

export interface WeightContext {
  density: Record<string, number>;
  blocked: Record<string, boolean>;
  incident: Record<string, boolean>;
  signalDelayMin: Record<string, number>;
  publicTransportPriority?: boolean;
  emergency?: boolean;
  weatherFactor?: number;
}

export interface PathTraceStep {
  type: "start" | "visit" | "relax" | "accept" | "skip" | "done";
  step: number;
  node?: string;
  from?: string;
  to?: string;
  edgeId?: string;
  distance?: number;
  note?: string;
}

export interface PathResult {
  algorithm: "dijkstra" | "astar" | "bfs" | "dfs";
  source: string;
  target: string;
  found: boolean;
  pathNodes: string[];
  pathEdges: string[];
  totalCost: number;
  totalDistanceKm: number;
  totalTimeMin: number;
  visitedOrder: string[];
  explored: number;
  executionMs: number;
  memoryKb: number;
  trace: PathTraceStep[];
  log: string[];
  heuristic?: string;
}

export interface MstResult {
  algorithm: "kruskal" | "prim";
  edges: string[];
  totalWeight: number;
  components: number;
  visitedOrder: string[];
  executionMs: number;
  trace: PathTraceStep[];
  log: string[];
}

export interface TraversalResult {
  algorithm: "bfs" | "dfs";
  source: string;
  target?: string;
  order: string[];
  visitedEdges: string[];
  pathNodes: string[];
  pathEdges: string[];
  found: boolean;
  executionMs: number;
  trace: PathTraceStep[];
  log: string[];
}

export interface AlgorithmInfo {
  key: string;
  name: string;
  category: "Shortest Path" | "Traversal" | "Spanning Tree";
  complexity: string;
  space: string;
  description: string;
  guarantees: string;
}

export const ALGORITHM_INFO: AlgorithmInfo[] = [
  {
    key: "dijkstra",
    name: "Dijkstra's Algorithm",
    category: "Shortest Path",
    complexity: "O((V + E) log V)",
    space: "O(V + E)",
    description:
      "A greedy label-setting algorithm that grows the shortest-path tree from the source using a priority queue. It is optimal for non-negative edge weights and is the reference algorithm for weighted road routing.",
    guarantees: "Guarantees the minimum-cost path when all edge weights are non-negative.",
  },
  {
    key: "astar",
    name: "A* Search",
    category: "Shortest Path",
    complexity: "O(E log V) worst case",
    space: "O(V)",
    description:
      "An informed search that adds a geographic heuristic (great-circle distance to the destination) to the Dijkstra priority. A consistent heuristic preserves optimality while exploring fewer nodes.",
    guarantees: "Optimal with an admissible and consistent heuristic; typically explores fewer nodes than Dijkstra.",
  },
  {
    key: "bfs",
    name: "Breadth-First Search",
    category: "Traversal",
    complexity: "O(V + E)",
    space: "O(V)",
    description:
      "Explores the road network level by level using a FIFO queue. It finds the path with the fewest edges (hops), ignoring road length and traffic weight.",
    guarantees: "Shortest path in an unweighted graph, and complete reachability analysis.",
  },
  {
    key: "dfs",
    name: "Depth-First Search",
    category: "Traversal",
    complexity: "O(V + E)",
    space: "O(V)",
    description:
      "Explores as deep as possible before backtracking using a LIFO stack. Useful for connectivity, cycle detection and discovering all reachable intersections.",
    guarantees: "Complete traversal; does not guarantee a shortest path.",
  },
  {
    key: "kruskal",
    name: "Kruskal's Algorithm",
    category: "Spanning Tree",
    complexity: "O(E log E)",
    space: "O(V + E)",
    description:
      "Builds a minimum spanning tree by sorting all roads by cost and adding each edge that does not create a cycle, detected with a union-find structure. It models the cheapest connected road backbone.",
    guarantees: "Minimum total edge weight spanning forest for the given graph.",
  },
  {
    key: "prim",
    name: "Prim's Algorithm",
    category: "Spanning Tree",
    complexity: "O(E log V)",
    space: "O(V + E)",
    description:
      "Grows a minimum spanning tree from a seed intersection by repeatedly adding the cheapest road that connects the tree to an unvisited intersection.",
    guarantees: "Minimum total edge weight spanning tree; efficient on dense road networks.",
  },
];
