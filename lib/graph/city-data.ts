import type { CityEdge, CityNetwork, CityNode } from "./types";

/**
 * Bengaluru road network model.
 * 30 signalised intersections, 69 bidirectional road segments.
 * Coordinates are schematic canvas positions (1200 x 820) plus an approximate
 * geographic projection. Place names and corridors are inspired by Bengaluru;
 * the dataset is deterministic so server and client render identical geometry.
 */

const COLS = 6;
const ROWS = 5;

const X = [135, 330, 520, 720, 910, 1085];
const Y = [115, 290, 455, 625, 765];

const NAMES = [
  "Yelahanka",
  "Hebbal",
  "Nagawara",
  "Hennur",
  "Banaswadi",
  "KR Puram",
  "Peenya",
  "Yeshwanthpur",
  "Malleshwaram",
  "Sadashivanagar",
  "Jayamahal",
  "Indiranagar",
  "Nagarbhavi",
  "Rajajinagar",
  "Majestic",
  "MG Road",
  "Domlur",
  "Marathahalli",
  "Kengeri",
  "Vijayanagar",
  "Chamrajpet",
  "KR Market",
  "Koramangala",
  "Bellandur",
  "Electronic City",
  "JP Nagar",
  "Jayanagar",
  "Lalbagh",
  "HSR Layout",
  "Sarjapur Road",
];

const DISTRICTS = [
  "North", "North", "North East", "North East", "East", "East",
  "West", "North West", "Central", "Central", "Central", "East",
  "West", "West", "Central", "Central", "East", "East",
  "South West", "South West", "South", "South", "South East", "South East",
  "South", "South", "South", "South", "South East", "South East",
];

const HORIZONTAL = [
  "Bellary Road · North Corridor",
  "Tumkur Road · West Link",
  "Old Airport Road · Central Corridor",
  "Outer Ring Road · South",
  "Bannerghatta Road · South Link",
];

const VERTICAL = [
  "Mysore Road",
  "Magadi Road",
  "Chord Road · Bellary Road",
  "Hosur Road",
  "Old Airport Road",
  "Old Madras Road · Sarjapur Link",
];

const EXTRA_ROADS: Array<[number, number, string]> = [
  [3, 10, "Hebbal Flyover"],
  [8, 15, "Cubbon Park Link"],
  [9, 16, "MG Road Underpass"],
  [14, 21, "KR Market Connector"],
  [15, 22, "Hosur Road Flyover"],
  [20, 27, "Jayanagar Link"],
  [21, 28, "Silk Board Flyover"],
  [2, 8, "Yelahanka Link"],
  [11, 17, "Domlur Flyover"],
  [17, 23, "Bellandur Link"],
  [12, 18, "NICE Road Connector"],
  [24, 30, "Electronic City Flyover"],
  [4, 11, "Hennur · Indiranagar Link"],
  [6, 12, "Nagarbhavi Link"],
  [1, 8, "Hebbal · Yeshwanthpur Link"],
  [19, 26, "Kengeri · JP Nagar Link"],
  [10, 17, "Sadashivanagar Link"],
  [22, 29, "Sarjapur Road Connector"],
  [5, 12, "Banaswadi · KR Puram Link"],
  [18, 24, "Bommanahalli Link"],
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
    lat: Number((13.12 - (y / 820) * 0.24).toFixed(6)),
    lng: Number((77.44 + (x / 1200) * 0.3).toFixed(6)),
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
    name: "Bengaluru · Central Traffic Grid",
    version: 2,
    description:
      "Bengaluru-inspired synthetic road graph used by the simulation engine. Intersections and corridors reference real areas, but all traffic, incidents and travel times in this application are simulated.",
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
