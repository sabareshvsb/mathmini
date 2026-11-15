"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Crosshair,
  Layers,
  Map as MapIcon,
  Maximize2,
  Network as NetworkIcon,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useTrafficStore } from "@/lib/store/traffic-store";
import { CONGESTION_META, cn } from "@/lib/format";
import type { CityEdge, CityNode } from "@/lib/graph/types";
import type { Vehicle } from "@/lib/sim/types";

const EMPTY_VEHICLES: Vehicle[] = [];
const EMPTY_NODES: string[] = [];

const SIGNAL_COLORS = {
  GREEN: "#34d399",
  YELLOW: "#fbbf24",
  RED: "#f87171",
};

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

interface Viewport {
  x: number;
  y: number;
  k: number;
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
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ x: 0, y: 0, panX: 0, panY: 0, moved: false, active: false });
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, k: 1 });
  const [hoveredEdge, setHoveredEdge] = useState<CityEdge | null>(null);

  const network = useTrafficStore((state) => state.network);
  const roads = useTrafficStore((state) => state.roads);
  const signals = useTrafficStore((state) => state.signals);
  const missions = useTrafficStore((state) => state.missions);
  const mapView = useTrafficStore((state) => state.mapView);
  const globalRoute = useTrafficStore((state) => state.route);
  const globalMst = useTrafficStore((state) => state.mstEdges);
  const source = useTrafficStore((state) => state.source);
  const destination = useTrafficStore((state) => state.destination);
  const selectedNode = useTrafficStore((state) => state.selectedNode);
  const setMapView = useTrafficStore((state) => state.setMapView);
  const vehicles = useTrafficStore((state) => (showVehicleLayer ? state.vehicles : EMPTY_VEHICLES));

  const labelsVisible = showLabels ?? !compact;
  const edgeLabelsVisible = showEdgeLabels ?? (!compact && viewport.k > 1.12);
  const legendVisible = showLegend ?? !compact;
  const controlsVisible = showControls ?? !compact;

  const nodeMap = useMemo(() => new Map(network.nodes.map((node) => [node.id, node])), [network.nodes]);
  const edgesById = useMemo(() => new Map(network.edges.map((edge) => [edge.id, edge])), [network.edges]);
  const degreeMap = useMemo(() => {
    const degrees = new Map<string, number>();
    for (const node of network.nodes) degrees.set(node.id, 0);
    for (const edge of network.edges) {
      degrees.set(edge.from, (degrees.get(edge.from) ?? 0) + 1);
      degrees.set(edge.to, (degrees.get(edge.to) ?? 0) + 1);
    }
    return degrees;
  }, [network]);

  const effectiveRoute = routeEdges ?? (useGlobalRoute ? globalRoute?.primary.pathEdges ?? [] : []);
  const effectiveAlternatives =
    alternativeEdges ??
    (useGlobalRoute
      ? (globalRoute?.alternatives ?? []).map((route) => route.pathEdges)
      : []);
  const effectiveEmergency =
    emergencyEdges ??
    missions.filter((mission) => mission.status === "enroute").flatMap((mission) => mission.routeEdges);
  const effectiveMst = mstEdges ?? (useGlobalMst ? globalMst : null);

  const routeSet = useMemo(() => new Set(effectiveRoute), [effectiveRoute]);
  const altSet = useMemo(() => new Set(effectiveAlternatives.flat()), [effectiveAlternatives]);
  const emergencySet = useMemo(() => new Set(effectiveEmergency), [effectiveEmergency]);
  const mstSet = useMemo(() => new Set(effectiveMst ?? []), [effectiveMst]);
  const visitedNodeSet = useMemo(() => new Set(visitedNodes ?? EMPTY_NODES), [visitedNodes]);
  const visitedEdgeSet = useMemo(() => new Set(visitedEdges ?? EMPTY_NODES), [visitedEdges]);
  const hasPrimaryRoute = effectiveRoute.length > 0;

  const congestedNodes = useMemo(() => {
    const incoming = new Map<string, number[]>();
    for (const edge of network.edges) {
      const density = roads[edge.id]?.density ?? edge.baseDemand;
      if (!incoming.has(edge.to)) incoming.set(edge.to, []);
      if (!incoming.has(edge.from)) incoming.set(edge.from, []);
      incoming.get(edge.to)?.push(density);
      incoming.get(edge.from)?.push(density);
    }
    return [...incoming.entries()]
      .map(([id, values]) => ({ id, density: values.reduce((a, b) => a + b, 0) / Math.max(1, values.length) }))
      .sort((a, b) => b.density - a.density)
      .slice(0, 14);
  }, [network, roads]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || !interactive) return;
    const handler = (event: WheelEvent) => {
      event.preventDefault();
      const factor = event.deltaY < 0 ? 1.12 : 0.9;
      setViewport((current) => {
        const nextK = Math.max(0.65, Math.min(4.2, current.k * factor));
        const scale = nextK / current.k;
        return {
          k: nextK,
          x: 600 - (600 - current.x) * scale,
          y: 410 - (410 - current.y) * scale,
        };
      });
    };
    element.addEventListener("wheel", handler, { passive: false });
    return () => element.removeEventListener("wheel", handler);
  }, [interactive]);

  function zoomBy(factor: number) {
    setViewport((current) => {
      const nextK = Math.max(0.65, Math.min(4.2, current.k * factor));
      const scale = nextK / current.k;
      return {
        k: nextK,
        x: 600 - (600 - current.x) * scale,
        y: 410 - (410 - current.y) * scale,
      };
    });
  }

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive) return;
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      panX: viewport.x,
      panY: viewport.y,
      moved: false,
      active: true,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    const dx = event.clientX - dragRef.current.x;
    const dy = event.clientY - dragRef.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) dragRef.current.moved = true;
    const rect = event.currentTarget.getBoundingClientRect();
    const scale = 1200 / Math.max(1, rect.width);
    setViewport((current) => ({
      ...current,
      x: dragRef.current.panX + dx * scale,
      y: dragRef.current.panY + dy * scale,
    }));
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current.active = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  function handleNodeClick(nodeId: string) {
    if (!interactive || dragRef.current.moved || !onNodeClick) return;
    onNodeClick(nodeId);
  }

  function nodeRadius(node: CityNode) {
    const degree = degreeMap.get(node.id) ?? 2;
    return Math.min(10, 5.4 + degree * 0.55) + (node.type === "terminal" ? 1.2 : 0);
  }

  return (
    <div
      className={cn("map-shell group/map", !height && "aspect-[1200/820]", className)}
      style={height ? { height } : undefined}
    >
      <div
        ref={containerRef}
        className={cn("absolute inset-0 touch-none", interactive && "cursor-grab active:cursor-grabbing")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <svg viewBox="0 0 1200 820" className="h-full w-full" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Interactive city road graph">
          <defs>
            <radialGradient id={`${uid}-glow`} cx="60%" cy="38%" r="65%">
              <stop offset="0%" stopColor="#0e7490" stopOpacity="0.22" />
              <stop offset="60%" stopColor="#0c4a6e" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#050b16" stopOpacity="0" />
            </radialGradient>
            <pattern id={`${uid}-dots`} width="34" height="34" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="rgba(56,189,248,0.16)" />
            </pattern>
            <pattern id={`${uid}-blocks`} width="46" height="46" patternUnits="userSpaceOnUse">
              <rect width="46" height="46" fill="transparent" />
              <rect x="5" y="5" width="15" height="12" rx="1.5" fill="#0b1d33" />
              <rect x="26" y="9" width="12" height="16" rx="1.5" fill="#0a1a2e" />
              <rect x="8" y="27" width="10" height="12" rx="1.5" fill="#0a1a2e" />
              <rect x="28" y="31" width="14" height="9" rx="1.5" fill="#0b1d33" />
            </pattern>
            <radialGradient id={`${uid}-heat-red`}>
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.38" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
            </radialGradient>
            <radialGradient id={`${uid}-heat-amber`}>
              <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
            </radialGradient>
            <linearGradient id={`${uid}-geo`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#071426" />
              <stop offset="55%" stopColor="#06101f" />
              <stop offset="100%" stopColor="#040b16" />
            </linearGradient>
            <linearGradient id={`${uid}-river`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#0e7490" stopOpacity="0.65" />
              <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.4" />
            </linearGradient>
            <filter id={`${uid}-softglow`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id={`${uid}-strongglow`} x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="7" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <rect width="1200" height="820" fill="#040b16" />
          <rect width="1200" height="820" fill={`url(#${uid}-glow)`} />
          <rect width="1200" height="820" fill={`url(#${uid}-dots)`} opacity="0.55" />

          <g
            style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.k})` }}
            className="transition-transform duration-75"
          >
            {mapView === "geo" ? <GeoBackdrop uid={uid} /> : <GraphBackdrop uid={uid} />}

            {heatmap ? (
              <g pointerEvents="none">
                {congestedNodes.map((item) => {
                  const node = nodeMap.get(item.id);
                  if (!node) return null;
                  const color = item.density > 0.72 ? "red" : item.density > 0.5 ? "amber" : null;
                  if (!color) return null;
                  return (
                    <circle
                      key={`heat-${item.id}`}
                      cx={node.x}
                      cy={node.y}
                      r={40 + item.density * 55}
                      fill={`url(#${uid}-heat-${color})`}
                    />
                  );
                })}
              </g>
            ) : null}

            <g>
              {network.edges.map((edge) => {
                const from = nodeMap.get(edge.from);
                const to = nodeMap.get(edge.to);
                if (!from || !to) return null;
                const road = roads[edge.id];
                const level = road?.level ?? "low";
                const color = CONGESTION_META[level].color;
                const isRoute = routeSet.has(edge.id);
                const isAlt = altSet.has(edge.id) && !isRoute;
                const isEmergency = emergencySet.has(edge.id);
                const isMst = mstSet.has(edge.id);
                const isVisited = visitedEdgeSet.has(edge.id);
                const isActive = activeEdge === edge.id;
                const dim =
                  (dimNonRoute && hasPrimaryRoute && !isRoute && !isEmergency) ||
                  (effectiveMst && !isMst);
                const width = 1.4 + edge.lanes * 0.55;

                return (
                  <g key={edge.id} opacity={dim ? 0.22 : 1}>
                    <line
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      stroke="#13243a"
                      strokeWidth={width + 3.4}
                      strokeLinecap="round"
                    />
                    <line
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      stroke={color}
                      strokeWidth={width + 0.8}
                      strokeLinecap="round"
                      strokeOpacity={road?.blocked ? 0.5 : isVisited ? 0.85 : 0.66}
                      strokeDasharray={road?.blocked ? "7 5" : isMst && !isRoute ? "9 5" : undefined}
                    />
                    {isVisited ? (
                      <line
                        x1={from.x}
                        y1={from.y}
                        x2={to.x}
                        y2={to.y}
                        stroke="#22d3ee"
                        strokeWidth={1.2}
                        strokeOpacity={0.45}
                      />
                    ) : null}
                    {isAlt ? (
                      <line
                        x1={from.x}
                        y1={from.y}
                        x2={to.x}
                        y2={to.y}
                        stroke="#a78bfa"
                        strokeWidth={3.2}
                        strokeDasharray="6 7"
                        strokeLinecap="round"
                        opacity={0.9}
                      />
                    ) : null}
                    {isMst && !isRoute ? (
                      <line
                        x1={from.x}
                        y1={from.y}
                        x2={to.x}
                        y2={to.y}
                        stroke="#a3e635"
                        strokeWidth={2.6}
                        strokeDasharray="10 6"
                        strokeLinecap="round"
                        opacity={0.9}
                      />
                    ) : null}
                    {isRoute ? (
                      <>
                        <line
                          x1={from.x}
                          y1={from.y}
                          x2={to.x}
                          y2={to.y}
                          stroke="#22d3ee"
                          strokeWidth={7}
                          strokeLinecap="round"
                          opacity={0.28}
                          filter={`url(#${uid}-strongglow)`}
                        />
                        <line
                          x1={from.x}
                          y1={from.y}
                          x2={to.x}
                          y2={to.y}
                          stroke="#67e8f9"
                          strokeWidth={3.4}
                          strokeLinecap="round"
                        />
                      </>
                    ) : null}
                    {isEmergency ? (
                      <>
                        <line
                          x1={from.x}
                          y1={from.y}
                          x2={to.x}
                          y2={to.y}
                          stroke="#fb7185"
                          strokeWidth={9}
                          strokeLinecap="round"
                          opacity={0.22}
                          filter={`url(#${uid}-strongglow)`}
                        />
                        <line
                          x1={from.x}
                          y1={from.y}
                          x2={to.x}
                          y2={to.y}
                          stroke="#fda4af"
                          strokeWidth={4}
                          strokeLinecap="round"
                          strokeDasharray="12 8"
                          className="animate-dash"
                        />
                      </>
                    ) : null}
                    {isActive ? (
                      <line
                        x1={from.x}
                        y1={from.y}
                        x2={to.x}
                        y2={to.y}
                        stroke="#fbbf24"
                        strokeWidth={5.5}
                        strokeLinecap="round"
                        opacity={0.95}
                      />
                    ) : null}
                    {road?.blocked ? (
                      <g transform={`translate(${(from.x + to.x) / 2} ${(from.y + to.y) / 2})`}>
                        <circle r="10" fill="#2a0a10" stroke="#fb7185" strokeWidth="1.4" />
                        <path d="M -3.5 -3.5 L 3.5 3.5 M 3.5 -3.5 L -3.5 3.5" stroke="#fb7185" strokeWidth="1.8" />
                      </g>
                    ) : road?.incident ? (
                      <g transform={`translate(${(from.x + to.x) / 2} ${(from.y + to.y) / 2})`}>
                        <circle r="9" fill="#2a1a05" stroke="#fbbf24" strokeWidth="1.2" />
                        <text textAnchor="middle" y="3.2" fontSize="9" fill="#fbbf24" fontWeight="700">
                          !
                        </text>
                      </g>
                    ) : null}
                    {edgeLabelsVisible ? (
                      <text
                        x={(from.x + to.x) / 2}
                        y={(from.y + to.y) / 2 - 6}
                        textAnchor="middle"
                        fontSize={compact ? 7.5 : 8.5}
                        fill="#94a3b8"
                        stroke="#040b16"
                        strokeWidth="3"
                        paintOrder="stroke"
                        pointerEvents="none"
                        style={{ fontFamily: "monospace" }}
                      >
                        {edge.lengthKm.toFixed(1)} km
                      </text>
                    ) : null}
                    {interactive ? (
                      <line
                        x1={from.x}
                        y1={from.y}
                        x2={to.x}
                        y2={to.y}
                        stroke="transparent"
                        strokeWidth={16}
                        className="cursor-help"
                        onMouseEnter={() => setHoveredEdge(edge)}
                        onMouseLeave={() => setHoveredEdge(null)}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (!dragRef.current.moved) onEdgeClick?.(edge.id);
                        }}
                      />
                    ) : null}
                  </g>
                );
              })}
            </g>

            {showVehicleLayer
              ? vehicles.map((vehicle) => {
                  const from = nodeMap.get(vehicle.from);
                  const to = nodeMap.get(vehicle.to);
                  if (!from || !to) return null;
                  const dx = to.x - from.x;
                  const dy = to.y - from.y;
                  const len = Math.max(1, Math.hypot(dx, dy));
                  const nx = -dy / len;
                  const ny = dx / len;
                  const x = from.x + dx * vehicle.progress + nx * vehicle.laneOffset * 7;
                  const y = from.y + dy * vehicle.progress + ny * vehicle.laneOffset * 7;
                  const isEmergency = vehicle.type === "emergency";
                  const radius = isEmergency ? 5 : vehicle.type === "bus" ? 4.2 : vehicle.type === "truck" ? 3.8 : 2.9;
                  return (
                    <g key={vehicle.id} transform={`translate(${x} ${y})`} pointerEvents="none">
                      {isEmergency ? (
                        <circle r={radius + 5} fill="#fb7185" opacity={0.16} className="animate-pulse" />
                      ) : null}
                      {vehicle.type === "bus" || vehicle.type === "truck" ? (
                        <rect
                          x={-radius - 1}
                          y={-radius + 0.5}
                          width={radius * 2 + 2}
                          height={radius * 2 - 1}
                          rx="1.4"
                          fill={vehicle.color}
                          opacity="0.92"
                        />
                      ) : (
                        <circle r={radius} fill={vehicle.color} opacity="0.95" />
                      )}
                      {isEmergency ? (
                        <circle r={radius + 1.5} fill="none" stroke="#fff1f2" strokeWidth="1" opacity="0.8" />
                      ) : null}
                    </g>
                  );
                })
              : null}

            <g>
              {network.nodes.map((node) => {
                const signal = signals[node.id];
                const radius = nodeRadius(node);
                const isSource = source === node.id;
                const isDestination = destination === node.id;
                const isSelected = selectedNode === node.id;
                const isVisited = visitedNodeSet.has(node.id);
                const fill =
                  node.type === "terminal"
                    ? "#0e7490"
                    : node.type === "roundabout"
                      ? "#7c3aed"
                      : "#0f2a44";
                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x} ${node.y})`}
                    className={cn(interactive && "cursor-pointer")}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleNodeClick(node.id);
                    }}
                    onMouseEnter={() => setHoveredEdge(null)}
                  >
                    {isVisited ? (
                      <circle r={radius + 6} fill="none" stroke="#22d3ee" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.9" />
                    ) : null}
                    {isSource ? (
                      <circle r={radius + 6.5} fill="none" stroke="#22d3ee" strokeWidth="1.8" opacity="0.9" className="animate-pulse" />
                    ) : null}
                    {isDestination ? (
                      <>
                        <circle r={radius + 7.5} fill="none" stroke="#34d399" strokeWidth="1.5" opacity="0.9" />
                        <circle r={radius + 4.2} fill="none" stroke="#34d399" strokeWidth="1" opacity="0.55" />
                      </>
                    ) : null}
                    {isSelected ? (
                      <circle r={radius + 9} fill="none" stroke="#fbbf24" strokeWidth="1" strokeDasharray="2 2" opacity="0.9" />
                    ) : null}
                    <circle r={radius + 2.5} fill={fill} opacity="0.3" />
                    <circle r={radius} fill={fill} stroke="#67e8f9" strokeWidth="1.1" />
                    <circle r={Math.max(1.6, radius * 0.32)} fill="#e0f2fe" opacity="0.9" />
                    {showSignalDots && signal ? (
                      <g transform={`translate(${radius + 3} ${-radius - 3})`}>
                        <circle r="3.6" fill="#040b16" stroke={SIGNAL_COLORS[signal.phase]} strokeWidth="1.2" />
                        <circle r="1.7" fill={SIGNAL_COLORS[signal.phase]}>
                          {signal.phase === "RED" ? null : null}
                        </circle>
                      </g>
                    ) : null}
                    {isSource || isDestination ? (
                      <text
                        y={-radius - 9}
                        textAnchor="middle"
                        fontSize="7.5"
                        fontWeight="700"
                        fill={isSource ? "#67e8f9" : "#6ee7b7"}
                        style={{ fontFamily: "monospace", letterSpacing: "0.1em" }}
                      >
                        {isSource ? "SOURCE" : "DEST"}
                      </text>
                    ) : null}
                    {labelsVisible ? (
                      <text
                        y={radius + 12.5}
                        textAnchor="middle"
                        fontSize={compact ? 7 : 8.4}
                        fill="#94a3b8"
                        stroke="#040b16"
                        strokeWidth="3"
                        paintOrder="stroke"
                        style={{ fontFamily: "ui-sans-serif, system-ui" }}
                      >
                        {node.name}
                      </text>
                    ) : null}
                    {labelsVisible && viewport.k < 1.3 ? (
                      <text
                        y={-radius - 4}
                        textAnchor="middle"
                        fontSize="6"
                        fill="#475569"
                        style={{ fontFamily: "monospace" }}
                      >
                        {node.id}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </g>
          </g>

          {mapView === "geo" ? <GeoOverlay uid={uid} /> : null}
        </svg>
      </div>

      <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap items-center gap-1.5">
        <span className="pointer-events-auto inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-ink-950/80 px-2 py-1 font-mono text-[8.5px] uppercase tracking-[0.14em] text-slate-400 backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#22d3ee]" />
          {mapView === "graph" ? "Graph View · G = (V,E)" : "Geographic View · Nova City"}
        </span>
        <span className="pointer-events-auto rounded-md border border-white/10 bg-ink-950/80 px-2 py-1 font-mono text-[8.5px] uppercase tracking-[0.14em] text-slate-500 backdrop-blur">
          V {network.nodes.length} · E {network.edges.length}
        </span>
        {!compact ? (
          <span className="pointer-events-auto rounded-md border border-cyan-400/15 bg-cyan-400/[0.06] px-2 py-1 font-mono text-[8.5px] uppercase tracking-[0.14em] text-cyan-300/80 backdrop-blur">
            simulated
          </span>
        ) : null}
      </div>

      {controlsVisible ? (
        <div className="absolute right-3 top-3 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => setMapView(mapView === "graph" ? "geo" : "graph")}
            title={mapView === "graph" ? "Switch to geographic map" : "Switch to graph view"}
            className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-ink-950/85 text-slate-300 backdrop-blur transition hover:border-cyan-400/30 hover:text-cyan-200"
          >
            {mapView === "graph" ? <MapIcon size={14} /> : <NetworkIcon size={14} />}
          </button>
          <button
            type="button"
            onClick={() => zoomBy(1.25)}
            title="Zoom in"
            className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-ink-950/85 text-slate-300 backdrop-blur transition hover:border-cyan-400/30 hover:text-cyan-200"
          >
            <ZoomIn size={14} />
          </button>
          <button
            type="button"
            onClick={() => zoomBy(0.8)}
            title="Zoom out"
            className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-ink-950/85 text-slate-300 backdrop-blur transition hover:border-cyan-400/30 hover:text-cyan-200"
          >
            <ZoomOut size={14} />
          </button>
          <button
            type="button"
            onClick={() => setViewport({ x: 0, y: 0, k: 1 })}
            title="Reset view"
            className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-ink-950/85 text-slate-300 backdrop-blur transition hover:border-cyan-400/30 hover:text-cyan-200"
          >
            {viewport.k !== 1 ? <Maximize2 size={14} /> : <Crosshair size={14} />}
          </button>
          <span className="grid h-6 place-items-center rounded-md border border-white/10 bg-ink-950/85 font-mono text-[8px] text-slate-500 backdrop-blur">
            {viewport.k.toFixed(1)}×
          </span>
        </div>
      ) : null}

      {legendVisible ? (
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg border border-white/10 bg-ink-950/85 px-2.5 py-2 backdrop-blur">
          <div className="mb-1.5 flex items-center gap-1.5 font-mono text-[7.5px] uppercase tracking-[0.16em] text-slate-500">
            <Layers size={9} /> Road status
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {(["low", "moderate", "heavy", "severe"] as const).map((level) => (
              <div key={level} className="flex items-center gap-1.5">
                <span className="h-1 w-3 rounded-full" style={{ background: CONGESTION_META[level].color }} />
                <span className="text-[8px] text-slate-400">{CONGESTION_META[level].label}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5">
              <span className="h-1 w-3 rounded-full bg-cyan-300" />
              <span className="text-[8px] text-slate-400">Optimal route</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-1 w-3 rounded-full bg-rose-400" />
              <span className="text-[8px] text-slate-400">Emergency</span>
            </div>
          </div>
        </div>
      ) : null}

      {hoveredEdge && interactive ? (
        <div className="pointer-events-none absolute bottom-3 right-3 w-[190px] rounded-lg border border-cyan-400/20 bg-ink-950/92 px-3 py-2 backdrop-blur">
          <p className="truncate font-mono text-[9px] uppercase tracking-[0.12em] text-cyan-300/80">
            {hoveredEdge.id} · {hoveredEdge.corridor}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-300">
            {nodeMap.get(hoveredEdge.from)?.name} ↔ {nodeMap.get(hoveredEdge.to)?.name}
          </p>
          <div className="mt-1.5 grid grid-cols-2 gap-1 font-mono text-[9px] text-slate-500">
            <span>{hoveredEdge.lengthKm.toFixed(2)} km</span>
            <span>{hoveredEdge.speedLimit} km/h</span>
            <span>{hoveredEdge.lanes} lanes</span>
            <span style={{ color: CONGESTION_META[roads[hoveredEdge.id]?.level ?? "low"].color }}>
              {Math.round((roads[hoveredEdge.id]?.density ?? 0) * 100)}% load
            </span>
          </div>
          {roads[hoveredEdge.id]?.blocked ? (
            <p className="mt-1 font-mono text-[8.5px] uppercase tracking-wide text-rose-300">Road blocked</p>
          ) : null}
        </div>
      ) : null}

      {!network.nodes.length && emptyHint ? (
        <div className="absolute inset-0 grid place-items-center bg-ink-950/70 text-xs text-slate-500">{emptyHint}</div>
      ) : null}
    </div>
  );
}

function GraphBackdrop({ uid }: { uid: string }) {
  return (
    <g pointerEvents="none" opacity="0.9">
      <circle cx="600" cy="410" r="390" fill="none" stroke="rgba(34,211,238,0.05)" strokeWidth="1" strokeDasharray="2 8" />
      <circle cx="600" cy="410" r="300" fill="none" stroke="rgba(34,211,238,0.04)" strokeWidth="1" strokeDasharray="2 8" />
      <path
        d="M 40 710 Q 280 640 520 700 T 1160 650"
        fill="none"
        stroke={`url(#${uid}-river)`}
        strokeWidth="26"
        strokeLinecap="round"
        opacity="0.08"
      />
      <text x="60" y="790" fill="rgba(100,116,139,0.35)" fontSize="9" fontFamily="monospace" letterSpacing="4">
        NOVA CITY · CENTRAL TRAFFIC DISTRICT · SAMPLE GRAPH
      </text>
      <text x="1140" y="790" textAnchor="end" fill="rgba(100,116,139,0.28)" fontSize="8" fontFamily="monospace">
        1200 × 820 schematic canvas
      </text>
    </g>
  );
}

function GeoBackdrop({ uid }: { uid: string }) {
  return (
    <g pointerEvents="none">
      <rect width="1200" height="820" fill={`url(#${uid}-geo)`} />
      <rect width="1200" height="820" fill={`url(#${uid}-blocks)`} opacity="0.5" />
      <path
        d="M 0 486 C 170 430 300 520 455 512 C 640 502 720 610 900 606 C 1035 603 1120 642 1200 668 L 1200 820 L 0 820 Z"
        fill="#071a2a"
        opacity="0.55"
      />
      <path
        d="M 60 -20 C 150 150 275 220 320 350 C 365 480 540 585 700 615 C 850 643 1010 725 1080 840"
        fill="none"
        stroke={`url(#${uid}-river)`}
        strokeWidth="34"
        strokeLinecap="round"
        opacity="0.8"
      />
      <path
        d="M 60 -20 C 150 150 275 220 320 350 C 365 480 540 585 700 615 C 850 643 1010 725 1080 840"
        fill="none"
        stroke="rgba(103,232,249,0.18)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="1 10"
      />
      <ellipse cx="888" cy="470" rx="84" ry="48" fill="#0c3a4a" opacity="0.55" />
      <ellipse cx="888" cy="470" rx="62" ry="31" fill="#0e7490" opacity="0.14" />
      <ellipse cx="952" cy="490" rx="26" ry="14" fill="#0e7490" opacity="0.18" />
      <ellipse cx="705" cy="585" rx="58" ry="26" fill="#052e16" opacity="0.7" />
      <ellipse cx="160" cy="210" rx="62" ry="38" fill="#052e16" opacity="0.6" />
      <ellipse cx="470" cy="720" rx="90" ry="34" fill="#052e16" opacity="0.45" />
      <g fontFamily="monospace" fill="rgba(125,211,252,0.16)" fontSize="13" letterSpacing="5">
        <text x="120" y="70">NORTH DISTRICT</text>
        <text x="500" y="400">CENTRAL</text>
        <text x="100" y="600">WEST BANK</text>
        <text x="900" y="720">SOUTH INDUSTRIAL</text>
        <text x="880" y="120">EAST RIDGE</text>
      </g>
      <g fontFamily="monospace" fill="rgba(103,232,249,0.3)" fontSize="8" letterSpacing="2">
        <text x="250" y="330" transform="rotate(56 250 330)">NOVA RIVER</text>
        <text x="850" y="475">LAKE MERIDIAN</text>
      </g>
      <g stroke="rgba(148,163,184,0.1)" strokeWidth="1">
        <line x1="0" y1="70" x2="1200" y2="70" strokeDasharray="2 10" />
        <line x1="0" y1="750" x2="1200" y2="750" strokeDasharray="2 10" />
        <line x1="70" y1="0" x2="70" y2="820" strokeDasharray="2 10" />
        <line x1="1130" y1="0" x2="1130" y2="820" strokeDasharray="2 10" />
      </g>
      <g fontFamily="monospace" fill="rgba(100,116,139,0.5)" fontSize="7">
        <text x="16" y="72">13.017° N</text>
        <text x="16" y="752">12.950° N</text>
        <text x="76" y="812">77.548° E</text>
        <text x="1090" y="812">77.634° E</text>
      </g>
    </g>
  );
}

function GeoOverlay({ uid }: { uid: string }) {
  return (
    <g pointerEvents="none">
      <g transform="translate(1110 70)">
        <circle r="20" fill="rgba(3,10,20,0.65)" stroke="rgba(103,232,249,0.25)" strokeWidth="0.8" />
        <path d="M 0 -12 L 5 7 L 0 3 L -5 7 Z" fill="#67e8f9" opacity="0.8" />
        <text y="-23" textAnchor="middle" fontSize="7" fill="#67e8f9" opacity="0.7" fontFamily="monospace">
          N
        </text>
      </g>
      <g transform="translate(66 742)">
        <line x1="0" y1="0" x2="96" y2="0" stroke="rgba(148,163,184,0.6)" strokeWidth="1.4" />
        <line x1="0" y1="-4" x2="0" y2="4" stroke="rgba(148,163,184,0.6)" strokeWidth="1.2" />
        <line x1="96" y1="-4" x2="96" y2="4" stroke="rgba(148,163,184,0.6)" strokeWidth="1.2" />
        <text x="48" y="-7" textAnchor="middle" fontSize="7" fill="rgba(148,163,184,0.75)" fontFamily="monospace">
          2 km
        </text>
      </g>
    </g>
  );
}
