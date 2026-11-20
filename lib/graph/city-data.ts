import type { CityEdge, CityNetwork, CityNode } from "./types";

/**
 * Bengaluru major road network model.
 * 30 key intersections/junctions and 52 bidirectional corridors inspired by
 * Bengaluru's primary road network (ORR, Hosur Rd, Bellary Rd, Tumkur Rd, etc.).
 * Node positions are projected from geographic coordinates so the graph view
 * reflects actual city layout. Traffic, incidents and travel times are simulated.
 */

const LAT_TOP = 13.13;
const LAT_BOTTOM = 12.82;
const LNG_LEFT = 77.46;
const LNG_RIGHT = 77.77;

function geoToXY(lat: number, lng: number) {
  return {
    x: Math.round(((lng - LNG_LEFT) / (LNG_RIGHT - LNG_LEFT)) * 1200),
    y: Math.round(((LAT_TOP - lat) / (LAT_TOP - LAT_BOTTOM)) * 820),
  };
}

type NodeSeed = {
  id: string;
  name: string;
  district: string;
  lat: number;
  lng: number;
  type?: CityNode["type"];
};

const NODE_SEEDS: NodeSeed[] = [
  { id: "J01", name: "Hebbal", district: "North", lat: 13.0358, lng: 77.5970 },
  { id: "J02", name: "Yelahanka", district: "North", lat: 13.1007, lng: 77.5963, type: "terminal" },
  { id: "J03", name: "Yeshwanthpur", district: "North West", lat: 13.0280, lng: 77.5400 },
  { id: "J04", name: "Peenya", district: "West", lat: 13.0285, lng: 77.5195, type: "terminal" },
  { id: "J05", name: "KR Puram", district: "East", lat: 13.0096, lng: 77.6960 },
  { id: "J06", name: "Whitefield", district: "East", lat: 12.9698, lng: 77.7499, type: "terminal" },
  { id: "J07", name: "Majestic", district: "Central", lat: 12.9776, lng: 77.5713 },
  { id: "J08", name: "Malleshwaram", district: "Central", lat: 13.0031, lng: 77.5643 },
  { id: "J09", name: "MG Road", district: "Central", lat: 12.9758, lng: 77.6045 },
  { id: "J10", name: "Indiranagar", district: "East", lat: 12.9784, lng: 77.6408 },
  { id: "J11", name: "Domlur", district: "East", lat: 12.9607, lng: 77.6387 },
  { id: "J12", name: "Marathahalli", district: "East", lat: 12.9592, lng: 77.6974 },
  { id: "J13", name: "Rajajinagar", district: "West", lat: 12.9916, lng: 77.5523 },
  { id: "J14", name: "Vijayanagar", district: "West", lat: 12.9719, lng: 77.5300 },
  { id: "J15", name: "KR Market", district: "Central", lat: 12.9654, lng: 77.5776 },
  { id: "J16", name: "Shivajinagar", district: "Central", lat: 12.9857, lng: 77.6057 },
  { id: "J17", name: "Koramangala", district: "South East", lat: 12.9352, lng: 77.6245 },
  { id: "J18", name: "Silk Board", district: "South East", lat: 12.9177, lng: 77.6238, type: "roundabout" },
  { id: "J19", name: "HSR Layout", district: "South East", lat: 12.9121, lng: 77.6446 },
  { id: "J20", name: "Bellandur", district: "South East", lat: 12.9260, lng: 77.6762 },
  { id: "J21", name: "Sarjapur Road", district: "South East", lat: 12.9103, lng: 77.6822, type: "terminal" },
  { id: "J22", name: "Jayanagar", district: "South", lat: 12.9308, lng: 77.5838 },
  { id: "J23", name: "JP Nagar", district: "South", lat: 12.9063, lng: 77.5857 },
  { id: "J24", name: "Banashankari", district: "South", lat: 12.9250, lng: 77.5468 },
  { id: "J25", name: "Kengeri", district: "South West", lat: 12.8996, lng: 77.4827, type: "terminal" },
  { id: "J26", name: "Electronic City", district: "South", lat: 12.8399, lng: 77.6770, type: "terminal" },
  { id: "J27", name: "BTM Layout", district: "South", lat: 12.9166, lng: 77.6101 },
  { id: "J28", name: "Richmond Town", district: "Central", lat: 12.9662, lng: 77.5993 },
  { id: "J29", name: "Mysore Road", district: "South West", lat: 12.9462, lng: 77.5298 },
  { id: "J30", name: "Tin Factory", district: "East", lat: 12.9960, lng: 77.6685 },
];

type EdgeSeed = [from: string, to: string, corridor: string, speedLimit: number, lanes: number];

const EDGE_SEEDS: EdgeSeed[] = [
  ["J02", "J01", "Bellary Road", 70, 4],
  ["J01", "J08", "Bellary Road", 60, 4],
  ["J08", "J16", "CV Raman Road", 50, 3],
  ["J16", "J09", "Cubbon Road", 45, 3],
  ["J09", "J28", "MG Road - Residency", 40, 3],
  ["J28", "J15", "JC Road", 40, 3],
  ["J15", "J22", "KR Road", 45, 3],
  ["J22", "J23", "Kanakapura Road", 50, 3],
  ["J23", "J27", "Bannerghatta Road", 50, 3],
  ["J27", "J18", "Hosur Road", 55, 4],
  ["J18", "J19", "Outer Ring Road", 60, 4],
  ["J19", "J20", "Outer Ring Road", 60, 4],
  ["J20", "J12", "Outer Ring Road", 60, 4],
  ["J12", "J30", "Varthur - HAL Road", 55, 3],
  ["J30", "J05", "Old Madras Road", 60, 4],
  ["J05", "J01", "Outer Ring Road", 65, 4],
  ["J04", "J03", "Tumkur Road", 60, 4],
  ["J03", "J13", "Tumkur Road", 55, 4],
  ["J13", "J07", "Dr Rajkumar Road", 45, 3],
  ["J07", "J15", "KG Road", 40, 4],
  ["J14", "J29", "Magadi Road", 50, 3],
  ["J29", "J24", "Mysore Road Connector", 50, 3],
  ["J24", "J22", "Outer Ring Road", 55, 3],
  ["J25", "J29", "Mysore Road", 70, 4],
  ["J07", "J08", "Seshadri Road", 40, 3],
  ["J03", "J08", "Yeshwanthpur Link", 45, 3],
  ["J09", "J10", "Swami Vivekananda Road", 45, 3],
  ["J10", "J11", "100 Feet Road", 45, 3],
  ["J11", "J17", "Inner Ring Road", 50, 3],
  ["J17", "J27", "Hosur Road", 55, 4],
  ["J17", "J18", "Hosur Road", 60, 4],
  ["J18", "J26", "Hosur Road Elevated", 70, 6],
  ["J11", "J12", "HAL Airport Road", 55, 3],
  ["J10", "J30", "Old Madras Road Link", 55, 3],
  ["J20", "J21", "Sarjapur Road", 55, 3],
  ["J19", "J21", "Sarjapur Main Road", 50, 3],
  ["J13", "J14", "Chord Road", 45, 3],
  ["J14", "J07", "Magadi Road", 45, 3],
  ["J16", "J01", "Mekhri Circle Road", 55, 4],
  ["J28", "J17", "Richmond - Adugodi Road", 45, 3],
  ["J24", "J23", "Outer Ring Road", 55, 3],
  ["J29", "J15", "Mysore Road Flyover", 55, 4],
  ["J09", "J11", "Old Airport Road", 50, 3],
  ["J12", "J06", "Whitefield Main Road", 55, 3],
  ["J05", "J06", "ITPL Main Road", 55, 3],
  ["J01", "J03", "Outer Ring Road", 60, 4],
  ["J23", "J18", "Bannerghatta - Hosur Link", 50, 3],
  ["J27", "J22", "Bannerghatta Road", 45, 3],
  ["J15", "J14", "Mysore Road", 45, 3],
  ["J16", "J07", "Palace Road", 40, 3],
  ["J10", "J05", "Old Madras Road", 55, 3],
  ["J20", "J11", "Intermediate Ring Road", 50, 3],
];

function buildNodes(): CityNode[] {
  return NODE_SEEDS.map((seed) => {
    const { x, y } = geoToXY(seed.lat, seed.lng);
    return {
      id: seed.id,
      name: seed.name,
      district: seed.district,
      x,
      y,
      lat: Number(seed.lat.toFixed(6)),
      lng: Number(seed.lng.toFixed(6)),
      type: seed.type ?? "signalized",
      signalized: true,
    };
  });
}

function corridorDemand(corridor: string, speedLimit: number, lanes: number, seed: number) {
  const high = /Outer Ring|Hosur|Bellary|Tumkur|Old Madras|Airport/i.test(corridor);
  const base = high ? 0.34 : 0.24;
  return Number(Math.min(0.62, base + (lanes - 3) * 0.03 + (70 - speedLimit) * 0.0015 + (seed % 7) * 0.01).toFixed(3));
}

export function haversineKm(a: Pick<CityNode, "lat" | "lng">, b: Pick<CityNode, "lat" | "lng">): number {
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

export function buildCityNetwork(): CityNetwork {
  const nodes = buildNodes();
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edges: CityEdge[] = EDGE_SEEDS.map(([from, to, corridor, speedLimit, lanes], i) => {
    const a = byId.get(from)!;
    const b = byId.get(to)!;
    return {
      id: `E${String(i + 1).padStart(3, "0")}`,
      from,
      to,
      name: corridor,
      corridor,
      lengthKm: Number(haversineKm(a, b).toFixed(2)),
      speedLimit,
      lanes,
      baseDemand: corridorDemand(corridor, speedLimit, lanes, i),
    };
  });

  return {
    name: "Bengaluru Major Road Network",
    version: 3,
    description:
      "Bengaluru-inspired road graph of major intersections and primary corridors (ORR, Hosur Road, Bellary Road, Tumkur Road and key arterials). Node locations are geographically projected; traffic, incidents and travel times are simulated.",
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
