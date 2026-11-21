"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CONGESTION_META } from "@/lib/format";
import type { CityNetwork } from "@/lib/graph/types";
import type { RoadRuntime, SignalRuntime, Vehicle } from "@/lib/sim/types";

type Props = {
  network: CityNetwork;
  roads: Record<string, RoadRuntime>;
  signals: Record<string, SignalRuntime>;
  vehicles: Vehicle[];
  source: string;
  destination: string;
  selectedNode: string | null;
  routeEdges: string[];
  alternativeEdges: string[][];
  emergencyEdges: string[];
  mstEdges: string[] | null;
  visitedNodes: string[];
  visitedEdges: string[];
  activeEdge: string | null;
  dimNonRoute: boolean;
  heatmap: boolean;
  compact: boolean;
  interactive: boolean;
  showVehicleLayer: boolean;
  showSignalDots: boolean;
  showLabels: boolean;
  showEdgeLabels: boolean;
  showLegend: boolean;
  showControls: boolean;
  onNodeClick?: (id: string) => void;
  onEdgeClick?: (id: string) => void;
  focus: [number, number][] | null;
  emptyHint?: string;
};

type EdgeGeom = [number, number][];
const GEOM_CACHE_KEY = "bengaluru-edge-geoms-v2";

function readGeomCache(): Record<string, EdgeGeom> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(GEOM_CACHE_KEY) || "{}") as Record<string, EdgeGeom>;
  } catch {
    return {};
  }
}

function writeGeomCache(cache: Record<string, EdgeGeom>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(GEOM_CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* ignore quota */
  }
}

async function fetchEdgeGeometry(from: { lat: number; lng: number }, to: { lat: number; lng: number }): Promise<EdgeGeom | null> {
  const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const coords = data?.routes?.[0]?.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  return coords.map((c: [number, number]) => [c[1], c[0]] as [number, number]);
}

function FitRoute({ focus }: { focus: [number, number][] | null }) {
  const map = useMap();
  useEffect(() => {
    if (!focus?.length) return;
    map.fitBounds(L.latLngBounds(focus), { padding: [40, 40], maxZoom: 15 });
  }, [focus, map]);
  return null;
}

export default function LeafletNetworkMap(props: Props) {
  const {
    network, roads, signals, vehicles, source, destination, selectedNode,
    routeEdges, alternativeEdges, emergencyEdges, mstEdges, visitedNodes, visitedEdges,
    activeEdge, dimNonRoute, heatmap, compact, interactive, showVehicleLayer, showSignalDots,
    showLabels, showEdgeLabels, showLegend, showControls, onNodeClick, onEdgeClick, focus, emptyHint,
  } = props;

  const nodeMap = useMemo(() => new Map(network.nodes.map((n) => [n.id, n])), [network.nodes]);
  const [edgeGeoms, setEdgeGeoms] = useState<Record<string, EdgeGeom>>({});

  useEffect(() => {
    let cancelled = false;
    const cached = readGeomCache();
    const next: Record<string, EdgeGeom> = {};
    for (const edge of network.edges) {
      const key = `${edge.id}:${edge.from}-${edge.to}`;
      if (cached[key]) next[key] = cached[key];
    }
    if (Object.keys(next).length) setEdgeGeoms((prev) => ({ ...next, ...prev }));

    const missing = network.edges.filter((e) => !cached[`${e.id}:${e.from}-${e.to}`]);
    if (!missing.length) return;

    (async () => {
      const batchSize = 4;
      for (let i = 0; i < missing.length; i += batchSize) {
        if (cancelled) return;
        const batch = missing.slice(i, i + batchSize);
        const results = await Promise.all(batch.map(async (edge) => {
          const a = nodeMap.get(edge.from);
          const b = nodeMap.get(edge.to);
          if (!a || !b) return null;
          try {
            const geom = await fetchEdgeGeometry(a, b);
            return geom ? { key: `${edge.id}:${edge.from}-${edge.to}`, geom } : null;
          } catch {
            return null;
          }
        }));
        if (cancelled) return;
        const updates: Record<string, EdgeGeom> = {};
        for (const r of results) if (r) updates[r.key] = r.geom;
        if (Object.keys(updates).length) {
          setEdgeGeoms((prev) => {
            const merged = { ...prev, ...updates };
            writeGeomCache({ ...readGeomCache(), ...merged });
            return merged;
          });
        }
        if (i + batchSize < missing.length) await new Promise((r) => setTimeout(r, 150));
      }
    })();

    return () => { cancelled = true; };
  }, [network.edges, nodeMap]);

  const routeSet = useMemo(() => new Set(routeEdges), [routeEdges]);
  const altSet = useMemo(() => new Set(alternativeEdges.flat()), [alternativeEdges]);
  const emergencySet = useMemo(() => new Set(emergencyEdges), [emergencyEdges]);
  const mstSet = useMemo(() => new Set(mstEdges ?? []), [mstEdges]);
  const visitedNodeSet = useMemo(() => new Set(visitedNodes), [visitedNodes]);
  const visitedEdgeSet = useMemo(() => new Set(visitedEdges), [visitedEdges]);
  const hasPrimary = routeEdges.length > 0;

  const center = useMemo<[number, number]>(() => {
    if (!network.nodes.length) return [12.9716, 77.5946];
    const lat = network.nodes.reduce((a, n) => a + n.lat, 0) / network.nodes.length;
    const lng = network.nodes.reduce((a, n) => a + n.lng, 0) / network.nodes.length;
    return [lat, lng];
  }, [network.nodes]);

  const edgePositions = (edgeId: string, fromId: string, toId: string): EdgeGeom => {
    const key = `${edgeId}:${fromId}-${toId}`;
    if (edgeGeoms[key]) return edgeGeoms[key];
    const a = nodeMap.get(fromId); const b = nodeMap.get(toId);
    if (!a || !b) return [];
    return [[a.lat, a.lng], [b.lat, b.lng]];
  };

  const routeFocus = useMemo(() => {
    if (!routeEdges.length) return focus;
    const pts: EdgeGeom = [];
    for (const id of routeEdges) {
      const edge = network.edges.find((e) => e.id === id);
      if (!edge) continue;
      pts.push(...edgePositions(edge.id, edge.from, edge.to));
    }
    return pts.length ? pts : focus;
  }, [routeEdges, edgeGeoms, network.edges, focus, nodeMap]);

  const vehiclePoints = useMemo(() => {
    if (!showVehicleLayer) return [];
    return vehicles.map((v) => {
      const geom = edgePositions(v.edgeId, v.from, v.to);
      if (geom.length < 2) return null;
      const idx = Math.min(geom.length - 2, Math.floor(v.progress * (geom.length - 1)));
      const t = (v.progress * (geom.length - 1)) - idx;
      const p1 = geom[idx]; const p2 = geom[idx + 1] || p1;
      const lat = p1[0] + (p2[0] - p1[0]) * t;
      const lng = p1[1] + (p2[1] - p1[1]) * t;
      return { ...v, lat, lng };
    }).filter(Boolean) as Array<Vehicle & { lat: number; lng: number }>;
  }, [vehicles, edgeGeoms, nodeMap, showVehicleLayer, network.edges]);

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={center}
        zoom={12}
        className="h-full w-full"
        zoomControl={showControls}
        dragging={interactive}
        scrollWheelZoom={interactive}
        doubleClickZoom={interactive}
        touchZoom={interactive}
        attributionControl={!compact}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | Routing: OSRM'
        />
        <FitRoute focus={routeFocus} />

        {heatmap && network.nodes.map((n) => {
          const density = network.edges
            .filter((e) => e.from === n.id || e.to === n.id)
            .map((e) => roads[e.id]?.density ?? e.baseDemand);
          const avg = density.reduce((a, b) => a + b, 0) / Math.max(1, density.length);
          if (avg < 0.45) return null;
          return (
            <CircleMarker key={`heat-${n.id}`} center={[n.lat, n.lng]} radius={18 + avg * 22}
              pathOptions={{ color: avg > 0.72 ? "#ef4444" : "#f59e0b", fillColor: avg > 0.72 ? "#ef4444" : "#f59e0b", fillOpacity: 0.18, weight: 0 }} />
          );
        })}

        {network.edges.map((edge) => {
          const a = nodeMap.get(edge.from); const b = nodeMap.get(edge.to);
          if (!a || !b) return null;
          const road = roads[edge.id];
          const level = road?.level ?? "low";
          const isRoute = routeSet.has(edge.id);
          const isAlt = altSet.has(edge.id) && !isRoute;
          const isEmergency = emergencySet.has(edge.id);
          const isMst = mstSet.has(edge.id);
          const dim = (dimNonRoute && hasPrimary && !isRoute && !isEmergency) || (mstEdges && !isMst);
          const congestionColor = CONGESTION_META[level as keyof typeof CONGESTION_META]?.color ?? "#34d399";
          const color = isEmergency ? "#f43f5e" : isRoute ? "#2563eb" : isAlt ? "#8b5cf6" : isMst ? "#65a30d" : congestionColor;
          const weight = isRoute || isEmergency ? 6 : isAlt || isMst ? 4 : 2 + edge.lanes * 0.6;
          const positions = edgePositions(edge.id, edge.from, edge.to);
          if (positions.length < 2) return null;
          return (
            <Polyline key={edge.id} positions={positions}
              pathOptions={{ color, weight, opacity: dim ? 0.2 : isRoute ? 0.95 : 0.72, dashArray: isAlt || (isMst && !isRoute) ? "8 8" : road?.blocked ? "6 6" : undefined }}
              eventHandlers={{ click: () => onEdgeClick?.(edge.id) }}>
              {(showEdgeLabels || activeEdge === edge.id || visitedEdgeSet.has(edge.id)) && (
                <Tooltip sticky direction="top" opacity={1}>
                  <span className="text-xs font-medium">{edge.name} · {edge.lengthKm.toFixed(2)} km · {Math.round((road?.density ?? 0) * 100)}%</span>
                </Tooltip>
              )}
              <Popup>
                <div className="text-xs">
                  <div className="font-semibold">{edge.id} · {edge.corridor}</div>
                  <div>{a.name} ↔ {b.name}</div>
                  <div>{edge.lengthKm.toFixed(2)} km · {edge.speedLimit} km/h · {edge.lanes} lanes</div>
                  <div>Load: {Math.round((road?.density ?? 0) * 100)}% · {level}</div>
                  {road?.blocked ? <div className="text-rose-600 font-medium">Blocked</div> : null}
                </div>
              </Popup>
            </Polyline>
          );
        })}

        {vehiclePoints.map((v) => (
          <CircleMarker key={v.id} center={[v.lat, v.lng]} radius={v.type === "emergency" ? 5 : v.type === "bus" ? 4 : 3}
            pathOptions={{ color: v.type === "emergency" ? "#fff1f2" : "#ffffff", weight: 1, fillColor: v.color, fillOpacity: 0.95 }} />
        ))}

        {network.nodes.map((node) => {
          const isSource = source === node.id;
          const isDestination = destination === node.id;
          const isSelected = selectedNode === node.id;
          const isVisited = visitedNodeSet.has(node.id);
          const signal = signals[node.id];
          const radius = isSource || isDestination || isSelected ? 8 : node.type === "terminal" ? 7 : 6;
          const color = isSource ? "#2563eb" : isDestination ? "#059669" : isSelected ? "#f59e0b" : isVisited ? "#3b82f6" : "#1e293b";
          return (
            <CircleMarker key={node.id} center={[node.lat, node.lng]} radius={radius}
              pathOptions={{ color: "#ffffff", weight: 2, fillColor: color, fillOpacity: 0.95 }}
              eventHandlers={{ click: () => onNodeClick?.(node.id) }}>
              {(showLabels || isSource || isDestination || isSelected) && (
                <Tooltip direction="top" offset={[0, -4]} opacity={1} permanent={isSource || isDestination}>
                  <span className="text-[11px] font-medium">{isSource ? "SRC · " : isDestination ? "DST · " : ""}{node.name}</span>
                </Tooltip>
              )}
              <Popup>
                <div className="text-xs">
                  <div className="font-semibold">{node.id} · {node.name}</div>
                  <div>{node.district} · {node.type}</div>
                  {signal ? <div>Signal: {signal.phase} · {signal.remaining}s · queue {signal.queue}</div> : null}
                </div>
              </Popup>
              {showSignalDots && signal ? (
                <Tooltip direction="right" offset={[8, 0]} opacity={1} permanent className="!bg-transparent !border-0 !shadow-none !p-0">
                  <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 999, background: signal.phase === "GREEN" ? "#22c55e" : signal.phase === "YELLOW" ? "#f59e0b" : "#ef4444" }} />
                </Tooltip>
              ) : null}
            </CircleMarker>
          );
        })}
      </MapContainer>

      <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-1.5 z-[500]">
        <span className="rounded-md border border-slate-200 bg-white/95 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-700 shadow-sm">Bengaluru Map · Actual Road Routes</span>
        <span className="rounded-md border border-slate-200 bg-white/95 px-2 py-1 text-[10px] font-medium text-slate-500 shadow-sm">V {network.nodes.length} · E {network.edges.length}</span>
      </div>

      {showLegend ? (
        <div className="absolute bottom-3 left-3 z-[500] rounded-lg border border-slate-200 bg-white/95 px-2.5 py-2 shadow-sm">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Legend</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-slate-600">
            {(["low","moderate","heavy","severe"] as const).map((l) => (
              <div key={l} className="flex items-center gap-1.5"><span className="h-1.5 w-3 rounded-full" style={{ background: CONGESTION_META[l].color }} />{CONGESTION_META[l].label}</div>
            ))}
            <div className="flex items-center gap-1.5"><span className="h-1.5 w-3 rounded-full bg-blue-600" />Optimal route</div>
            <div className="flex items-center gap-1.5"><span className="h-1.5 w-3 rounded-full bg-rose-500" />Emergency</div>
          </div>
        </div>
      ) : null}

      {!network.nodes.length && emptyHint ? (
        <div className="absolute inset-0 z-[500] grid place-items-center bg-white/80 text-sm text-slate-500">{emptyHint}</div>
      ) : null}
    </div>
  );
}
