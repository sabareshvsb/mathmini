"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { useTrafficStore } from "@/lib/store/traffic-store";
import { cn } from "@/lib/format";
import type { Vehicle } from "@/lib/sim/types";

const EMPTY_VEHICLES: Vehicle[] = [];
const EMPTY_NODES: string[] = [];

const LeafletMap = dynamic(() => import("./leaflet-network-map"), { ssr: false });

export interface NetworkMapProps {
  className?: string;
  height?: number | string;
  compact?: boolean;
  interactive?: boolean;
  showVehicleLayer?: boolean;
  showSignalDots?: boolean;
  showLabels?: boolean;
  showEdgeLabels?: boolean;
  showLegend?: boolean;
  showControls?: boolean;
  heatmap?: boolean;
  routeEdges?: string[];
  alternativeEdges?: string[][];
  emergencyEdges?: string[];
  mstEdges?: string[] | null;
  visitedNodes?: string[];
  visitedEdges?: string[];
  activeEdge?: string | null;
  dimNonRoute?: boolean;
  onNodeClick?: (nodeId: string) => void;
  onEdgeClick?: (edgeId: string) => void;
  useGlobalRoute?: boolean;
  useGlobalMst?: boolean;
  emptyHint?: string;
}

export function NetworkMap({
  className,
  height,
  compact = false,
  interactive = true,
  showVehicleLayer = true,
  showSignalDots = true,
  showLabels,
  showEdgeLabels,
  showLegend,
  showControls,
  heatmap = false,
  routeEdges,
  alternativeEdges,
  emergencyEdges,
  mstEdges,
  visitedNodes,
  visitedEdges,
  activeEdge = null,
  dimNonRoute = false,
  onNodeClick,
  onEdgeClick,
  useGlobalRoute = false,
  useGlobalMst = false,
  emptyHint,
}: NetworkMapProps) {
  const network = useTrafficStore((s) => s.network);
  const roads = useTrafficStore((s) => s.roads);
  const signals = useTrafficStore((s) => s.signals);
  const missions = useTrafficStore((s) => s.missions);
  const globalRoute = useTrafficStore((s) => s.route);
  const globalMst = useTrafficStore((s) => s.mstEdges);
  const source = useTrafficStore((s) => s.source);
  const destination = useTrafficStore((s) => s.destination);
  const selectedNode = useTrafficStore((s) => s.selectedNode);
  const vehicles = useTrafficStore((s) => (showVehicleLayer ? s.vehicles : EMPTY_VEHICLES));

  const effectiveRoute = routeEdges ?? (useGlobalRoute ? globalRoute?.primary.pathEdges ?? [] : []);
  const effectiveAlternatives =
    alternativeEdges ?? (useGlobalRoute ? (globalRoute?.alternatives ?? []).map((r) => r.pathEdges) : []);
  const effectiveEmergency =
    emergencyEdges ?? missions.filter((m) => m.status === "enroute").flatMap((m) => m.routeEdges);
  const effectiveMst = mstEdges ?? (useGlobalMst ? globalMst : null);

  const routeKey = effectiveRoute.join(",");
  const focus = useMemo(() => {
    if (!effectiveRoute.length) return null;
    const nodeMap = new Map(network.nodes.map((n) => [n.id, n]));
    const edgeMap = new Map(network.edges.map((e) => [e.id, e]));
    const pts: [number, number][] = [];
    for (const id of effectiveRoute) {
      const e = edgeMap.get(id);
      if (!e) continue;
      const a = nodeMap.get(e.from); const b = nodeMap.get(e.to);
      if (a) pts.push([a.lat, a.lng]);
      if (b) pts.push([b.lat, b.lng]);
    }
    return pts.length ? pts : null;
  }, [routeKey, network.nodes, network.edges]);

  return (
    <div className={cn("map-shell", !height && "aspect-[1200/820]", className)} style={height ? { height } : undefined}>
      <LeafletMap
        network={network}
        roads={roads}
        signals={signals}
        vehicles={vehicles}
        source={source}
        destination={destination}
        selectedNode={selectedNode}
        routeEdges={effectiveRoute}
        alternativeEdges={effectiveAlternatives}
        emergencyEdges={effectiveEmergency}
        mstEdges={effectiveMst}
        visitedNodes={visitedNodes ?? EMPTY_NODES}
        visitedEdges={visitedEdges ?? EMPTY_NODES}
        activeEdge={activeEdge}
        dimNonRoute={dimNonRoute}
        heatmap={heatmap}
        compact={compact}
        interactive={interactive}
        showVehicleLayer={showVehicleLayer}
        showSignalDots={showSignalDots}
        showLabels={showLabels ?? !compact}
        showEdgeLabels={showEdgeLabels ?? !compact}
        showLegend={showLegend ?? !compact}
        showControls={showControls ?? !compact}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        focus={focus}
        emptyHint={emptyHint}
      />
    </div>
  );
}
