import type { CityEdge, CityNetwork, CityNode } from "./types";

/**
 * Sample city: "Nova City" road network.
 * 30 signalised intersections, 70+ bidirectional road segments.
 * Coordinates are schematic canvas positions (1200 x 820) plus a synthetic
 * geographic projection. The dataset is deterministic so server and client
 * render identical geometry.
 */

const COLS = 6;
const ROWS = 5;

const X = [135, 330, 520, 720, 910, 1085];
const Y = [115, 290, 455, 625, 765];

const NAMES = [
  "Northgate Terminal",
  "Airport Road",
  "Tech Park",
  "University Gate",
  "Hillview",
  "East Terminal",
  "Riverside",
  "Old Town",
  "Central Square",
  "Museum Road",
  "Greenfield",
  "Stadium",
  "Harbor Point",
  "Market Street",
  "City Center",
  "Business Bay",
  "Lakeview",
  "East Market",
  "Dockyard",
  "Rail Yard",
  "Convention Centre",
  "Medical District",
  "Industrial Park",
  "Freight Terminal",
  "South Gate",
  "Garden City",
  "Sunrise Colony",
  "Ring Road South",
  "Logistics Hub",
  "South Terminal",
];

const DISTRICTS = [
  "North", "North", "Tech", "North", "East", "East",
  "West", "Old Town", "Central", "Central", "East", "East",
  "West", "Old Town", "Central", "Central", "East", "East",
  "West", "South", "Central", "South", "South", "East",
  "South", "South", "South", "South", "East", "South",
];

const HORIZONTAL = [
  "Airport Expressway",
  "Heritage Avenue",
  "Central Boulevard",
  "Commerce Link Road",
  "Southern Ring Road",
];

const VERTICAL = [
  "West River Link",
  "Riverside Drive",
  "Central Spine",
  "Tech Corridor",
  "Lakeview Avenue",
  "East Connector",
];

const EXTRA_ROADS: Array<[number, number, string]> = [
  [3, 10, "Innovation Flyover"],
  [8, 15, "Civic Loop"],
  [9, 16, "Metro Link"],
  [14, 21, "Exhibition Link"],
  [15, 22, "Medical Relief Road"],
  [20, 27, "Garden Bypass"],
  [21, 28, "South Crosstown"],
  [2, 8, "Airport Connector"],
  [11, 17, "Lakeview Link"],
  [17, 23, "Industrial Connector"],
  [12, 18, "Stadium Approach"],
  [24, 30, "Freight Corridor"],
  [4, 11, "Campus Link"],
  [6, 12, "East Bypass"],
  [1, 8, "Northgate Link"],
  [19, 26, "Dockyard Bypass"],
  [10, 17, "Park Avenue"],
  [22, 29, "Emergency Relief Road"],
  [5, 12, "Hillview Link"],
  [18, 24, "Harbor East Link"],
];

function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function nodeId(index: number): string {
  return `J${String(index + 1).padStart(2, "0")}`;
}

function projectGeo(x: number, y: number) {
  return {
    lat: Number((13.02 - (y / 820) * 0.075).toFixed(6)),
    lng: Number((77.545 + (x / 1200) * 0.09).toFixed(6)),
  };
}

function buildNodes(): CityNode[] {
  const nodes: CityNode[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const index = r * COLS + c;
      const jitterX = Math.sin(index * 1.71) * 10;
      const jitterY = Math.cos(index * 2.33) * 9;
      const x = Math.round(X[c] + jitterX);
      const y = Math.round(Y[r] + jitterY);
      const geo = projectGeo(x, y);
      nodes.push({
        id: nodeId(index),
        name: NAMES[index],
        district: DISTRICTS[index],
        x,
        y,
        lat: geo.lat,
        lng: geo.lng,
        type: index === 0 || index === 5 || index === 24 || index === 29 ? "terminal" : "signalized",
        signalized: true,
      });
    }
  }
  return nodes;
}

function distanceKm(a: CityNode, b: CityNode): number {
  const px = Math.hypot(a.x - b.x, a.y - b.y);
  return Number((px * 0.0125).toFixed(2));
}

export function buildCityNetwork(): CityNetwork {
  const nodes = buildNodes();
  const edges: CityEdge[] = [];
  let edgeCounter = 0;

  const addEdge = (
    fromIdx: number,
    toIdx: number,
    corridor: string,
    speedLimit: number,
    lanes: number,
  ) => {
    const from = nodes[fromIdx];
    const to = nodes[toIdx];
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;
    const centrality = Math.max(
      0,
      Math.min(1, 1 - Math.hypot((midX - 600) / 620, (midY - 410) / 430)),
    );
    const jitter = pseudoRandom(edgeCounter + 3);
    const baseDemand = Number(
      Math.min(
        0.62,
        0.14 + centrality * 0.32 + (lanes - 2) * 0.018 + jitter * 0.06,
      ).toFixed(3),
    );
    edgeCounter += 1;
    edges.push({
      id: `E${String(edgeCounter).padStart(3, "0")}`,
      from: from.id,
      to: to.id,
      name: `${corridor}`,
      corridor,
      lengthKm: distanceKm(from, to),
      speedLimit,
      lanes,
      baseDemand,
    });
  };

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS - 1; c++) {
      addEdge(
        r * COLS + c,
        r * COLS + c + 1,
        HORIZONTAL[r],
        r === 0 ? 65 : r === 2 ? 55 : 50,
        r === 2 ? 4 : 3,
      );
    }
  }

  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS - 1; r++) {
      addEdge(
        r * COLS + c,
        (r + 1) * COLS + c,
        VERTICAL[c],
        c === 2 ? 55 : 45,
        c === 2 ? 4 : 3,
      );
    }
  }

  for (const [from, to, name] of EXTRA_ROADS) {
    addEdge(from - 1, to - 1, name, 65, 3);
  }

  for (const node of nodes) {
    const degree = edges.filter((e) => e.from === node.id || e.to === node.id).length;
    if (node.type !== "terminal" && node.id === "J15") node.type = "roundabout";
    else if (node.type !== "terminal" && degree >= 5) node.type = "signalized";
  }

  return {
    name: "Nova City · Central Traffic District",
    version: 1,
    description:
      "Synthetic 30-intersection weighted road graph used by the simulation engine. All traffic, incidents and travel times in this application are simulated.",
    nodes,
    edges,
  };
}

export const DEFAULT_NETWORK: CityNetwork = buildCityNetwork();

export function buildAdjacency(network: CityNetwork) {
  const adjacency = new Map<string, Array<{ node: string; edge: CityEdge }>>();
  for (const node of network.nodes) adjacency.set(node.id, []);
  for (const edge of network.edges) {
    adjacency.get(edge.from)?.push({ node: edge.to, edge });
    adjacency.get(edge.to)?.push({ node: edge.from, edge });
  }
  return adjacency;
}

export function networkStats(network: CityNetwork) {
  const adjacency = buildAdjacency(network);
  const degrees = network.nodes.map((n) => adjacency.get(n.id)?.length ?? 0);
  const avgDegree = degrees.reduce((a, b) => a + b, 0) / Math.max(1, degrees.length);
  const totalLength = network.edges.reduce((a, e) => a + e.lengthKm, 0);
  return {
    vertices: network.nodes.length,
    edges: network.edges.length,
    directedEdges: network.edges.length * 2,
    avgDegree: Number(avgDegree.toFixed(2)),
    totalLengthKm: Number(totalLength.toFixed(1)),
    districts: new Set(network.nodes.map((n) => n.district)).size,
  };
}

export function haversineKm(a: CityNode, b: CityNode): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
