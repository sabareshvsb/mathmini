"use client";

import { useState } from "react";
import {
  ArrowLeftRight,
  Construction,
  Crosshair,
  Layers,
  MapPin,
  Navigation,
  Route as RouteIcon,
  Siren,
  Trash2,
  TriangleAlert,
  ZoomIn,
} from "lucide-react";
import { useTrafficStore } from "@/lib/store/traffic-store";
import { CONGESTION_META, cn, formatMinutes, simClock } from "@/lib/format";
import { NetworkMap } from "@/components/network-map";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Progress,
  SectionHeader,
  Segmented,
  Select,
  SimulationNote,
  StatusDot,
  Toggle,
} from "@/components/ui";

export default function MapPage() {
  const network = useTrafficStore((state) => state.network);
  const roads = useTrafficStore((state) => state.roads);
  const signals = useTrafficStore((state) => state.signals);
  const incidents = useTrafficStore((state) => state.incidents);
  const route = useTrafficStore((state) => state.route);
  const source = useTrafficStore((state) => state.source);
  const destination = useTrafficStore((state) => state.destination);
  const selectedNode = useTrafficStore((state) => state.selectedNode);
  const mapView = useTrafficStore((state) => state.mapView);
  const showWeights = useTrafficStore((state) => state.showWeights);
  const showLabels = useTrafficStore((state) => state.showLabels);
  const showHeatmap = useTrafficStore((state) => state.showHeatmap);
  const showVehicles = useTrafficStore((state) => state.showVehicles);
  const metrics = useTrafficStore((state) => state.metrics);
  const setSource = useTrafficStore((state) => state.setSource);
  const setDestination = useTrafficStore((state) => state.setDestination);
  const setSelectedNode = useTrafficStore((state) => state.setSelectedNode);
  const setMapView = useTrafficStore((state) => state.setMapView);
  const toggleOption = useTrafficStore((state) => state.toggleOption);
  const runRoute = useTrafficStore((state) => state.runRoute);
  const clearRoute = useTrafficStore((state) => state.clearRoute);
  const reportAccident = useTrafficStore((state) => state.reportAccident);
  const closeRoad = useTrafficStore((state) => state.closeRoad);
  const clearIncident = useTrafficStore((state) => state.clearIncident);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);

  const node = network.nodes.find((entry) => entry.id === selectedNode) ?? null;
  const edge = network.edges.find((entry) => entry.id === selectedEdge) ?? null;
  const road = selectedEdge ? roads[selectedEdge] : null;
  const incident = selectedEdge ? incidents.find((entry) => entry.edgeId === selectedEdge && entry.active) : undefined;
  const activeIncidents = incidents.filter((entry) => entry.active);
  const selectedSignal = selectedNode ? signals[selectedNode] : null;
  const incoming = selectedEdge
    ? network.edges.filter((entry) => entry.to === selectedEdge || entry.from === selectedEdge).length
    : 0;

  function swap() {
    const currentSource = useTrafficStore.getState().source;
    const currentDestination = useTrafficStore.getState().destination;
    setSource(currentDestination);
    setDestination(currentSource);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Network Operations"
        title="Live traffic map"
        description="Pan, zoom and inspect the simulated road graph. Select any intersection or road segment to read its live state, or run a Dijkstra route between two nodes."
        actions={
          <>
            <Segmented
              value={mapView}
              onChange={setMapView}
              options={[
                { value: "graph", label: "Graph", icon: Crosshair },
                { value: "geo", label: "Geographic", icon: Layers },
              ]}
            />
            <Button size="sm" variant="outline" onClick={() => runRoute(source, destination, "time")}>
              <Navigation size={12} /> Optimise route
            </Button>
          </>
        }
      >
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {Object.entries(metrics.congestionDistribution).map(([level, count]) => {
            const meta = CONGESTION_META[level as keyof typeof CONGESTION_META];
            return (
              <div key={level} className="rounded-lg border border-blue-100 bg-slate-50 px-2.5 py-2">
                <p className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.12em] text-slate-500">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
                  {meta.label}
                </p>
                <p className="mt-0.5 font-mono text-sm" style={{ color: meta.color }}>
                  {count}
                </p>
              </div>
            );
          })}
          <div className="rounded-lg border border-blue-100 bg-slate-50 px-2.5 py-2">
            <p className="font-mono text-[8px] uppercase tracking-[0.12em] text-slate-500">Blocked</p>
            <p className="mt-0.5 font-mono text-sm text-rose-700">{metrics.blockedRoads}</p>
          </div>
          <div className="rounded-lg border border-blue-100 bg-slate-50 px-2.5 py-2">
            <p className="font-mono text-[8px] uppercase tracking-[0.12em] text-slate-500">Vehicles</p>
            <p className="mt-0.5 font-mono text-sm text-blue-700">{metrics.activeVehicles}</p>
          </div>
        </div>
      </PageHeader>

      <div className="grid gap-4 xl:grid-cols-[330px_1fr]">
        <div className="space-y-4">
          <Card className="p-4">
            <SectionHeader eyebrow="Routing" title="Origin → destination" />
            <div className="mt-3 space-y-2">
              <Select value={source} onChange={(event) => setSource(event.target.value)} aria-label="Origin intersection">
                {network.nodes.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.id} · {entry.name}
                  </option>
                ))}
              </Select>
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={swap}
                  className="grid h-6 w-6 place-items-center rounded-full border border-blue-100 bg-blue-50 text-slate-600 transition hover:border-blue-200 hover:text-blue-700"
                  aria-label="Swap origin and destination"
                >
                  <ArrowLeftRight size={11} />
                </button>
              </div>
              <Select
                value={destination}
                onChange={(event) => setDestination(event.target.value)}
                aria-label="Destination intersection"
              >
                {network.nodes.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.id} · {entry.name}
                  </option>
                ))}
              </Select>
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant="primary" onClick={() => runRoute(source, destination, "time")}>
                  <RouteIcon size={12} /> Route
                </Button>
                <Button size="sm" variant="ghost" onClick={clearRoute}>
                  Clear
                </Button>
              </div>
            </div>

            {route ? (
              <div className="mt-3 rounded-lg border border-blue-200 bg-blue-500/[0.04] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-blue-700/70">Dijkstra optimum</p>
                  <Badge tone="green">optimal</Badge>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
                  <div>
                    <p className="font-mono text-sm text-slate-900">{route.primary.totalDistanceKm}</p>
                    <p className="font-mono text-[7.5px] uppercase tracking-wider text-slate-500">km</p>
                  </div>
                  <div>
                    <p className="font-mono text-sm text-slate-900">{formatMinutes(route.primary.totalTimeMin, 0)}</p>
                    <p className="font-mono text-[7.5px] uppercase tracking-wider text-slate-500">est.</p>
                  </div>
                  <div>
                    <p className="font-mono text-sm text-slate-900">{route.primary.explored}</p>
                    <p className="font-mono text-[7.5px] uppercase tracking-wider text-slate-500">explored</p>
                  </div>
                </div>
                <p className="mt-2 truncate font-mono text-[8.5px] text-slate-500">
                  {route.primary.pathNodes.join(" → ")}
                </p>
              </div>
            ) : null}
          </Card>

          <Card className="p-4">
            <SectionHeader eyebrow="Layers" title="Map display" />
            <div className="mt-3 space-y-3">
              <Toggle checked={showVehicles} onChange={() => toggleOption("showVehicles")} label="Vehicle layer" description="Animated synthetic vehicles" />
              <Toggle checked={showHeatmap} onChange={() => toggleOption("showHeatmap")} label="Congestion heatmap" description="Glow density per corridor" />
              <Toggle checked={showLabels} onChange={() => toggleOption("showLabels")} label="Intersection labels" />
              <Toggle checked={showWeights} onChange={() => toggleOption("showWeights")} label="Edge weights" description="Live simulated weight on hover" />
            </div>
          </Card>

          <Card className="p-4">
            <SectionHeader
              eyebrow="Selection"
              title={node ? `${node.id} · ${node.name}` : edge ? edge.name : "Nothing selected"}
              actions={
                node || edge ? (
                  <Button size="sm" variant="ghost" onClick={() => setSelectedNode(null)}>
                    <Trash2 size={11} />
                  </Button>
                ) : null
              }
            />
            {node ? (
              <div className="mt-3 space-y-2 text-[11px]">
                <div className="grid grid-cols-2 gap-2">
                  <Info label="District" value={node.district} />
                  <Info label="Type" value={node.type} />
                  <Info label="Coordinates" value={`${node.lat.toFixed(3)}, ${node.lng.toFixed(3)}`} />
                  <Info label="Signal" value={node.signalized ? (selectedSignal?.mode ?? "signalised") : "unsignalised"} />
                </div>
                {selectedSignal ? (
                  <div className="rounded-lg border border-blue-100 bg-slate-50 p-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[9px] text-slate-500">Phase</span>
                      <span
                        className={cn(
                          "font-mono text-[11px] font-semibold",
                          selectedSignal.phase === "GREEN"
                            ? "text-emerald-700"
                            : selectedSignal.phase === "YELLOW"
                              ? "text-amber-700"
                              : "text-rose-700",
                        )}
                      >
                        {selectedSignal.phase} · {selectedSignal.remaining}s
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-1 text-center">
                      <Mini label="Queue" value={selectedSignal.queue} />
                      <Mini label="Density" value={`${(selectedSignal.incomingDensity * 100).toFixed(0)}%`} />
                      <Mini label="Cycle" value={`${selectedSignal.cycle}s`} />
                    </div>
                  </div>
                ) : null}
                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setSource(node.id)}>
                    Set origin
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setDestination(node.id)}>
                    Set destination
                  </Button>
                </div>
              </div>
            ) : edge ? (
              <div className="mt-3 space-y-2 text-[11px]">
                <div className="grid grid-cols-2 gap-2">
                  <Info label="Endpoints" value={`${edge.from} ↔ ${edge.to}`} />
                  <Info label="Corridor" value={edge.corridor} />
                  <Info label="Length" value={`${edge.lengthKm} km`} />
                  <Info label="Speed limit" value={`${edge.speedLimit} km/h`} />
                  <Info label="Lanes" value={String(edge.lanes)} />
                  <Info label="Incoming edges" value={String(incoming)} />
                </div>
                {road ? (
                  <div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-slate-500">Live density</span>
                      <span className="font-mono text-slate-800">{(road.density * 100).toFixed(0)}%</span>
                    </div>
                    <Progress
                      value={road.density * 100}
                      color={CONGESTION_META[road.level].color}
                      height={5}
                      className="mt-1"
                    />
                    <p className="mt-1 font-mono text-[8.5px] text-slate-500">
                      {road.vehicles} vehicles · {road.avgSpeedKmh.toFixed(0)} km/h avg · {road.level}
                    </p>
                  </div>
                ) : null}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => reportAccident(edge.id)}
                    disabled={Boolean(incident)}
                  >
                    <TriangleAlert size={11} /> Accident
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => closeRoad(edge.id)} disabled={Boolean(incident)}>
                    <Construction size={11} /> Close road
                  </Button>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={MapPin}
                title="Select a node or road"
                description="Click any intersection or edge on the map to inspect simulated state and trigger incidents."
              />
            )}
          </Card>
        </div>

        <div className="space-y-3">
          <Card className="relative overflow-hidden">
            <NetworkMap
              height="clamp(420px, 64vh, 780px)"
              useGlobalRoute
              useGlobalMst
              heatmap={showHeatmap}
              showVehicleLayer={showVehicles}
              showLabels={showLabels}
              onNodeClick={(nodeId) => {
                setSelectedNode(nodeId);
                setSelectedEdge(null);
              }}
              onEdgeClick={(edgeId) => {
                setSelectedEdge(edgeId);
                setSelectedNode(null);
              }}
            />
            <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-1.5">
              <Badge tone="cyan" dot>
                {mapView === "geo" ? "Geographic projection" : "Graph topology"}
              </Badge>
              <Badge tone="slate">
                <ZoomIn size={9} /> scroll to zoom
              </Badge>
            </div>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="p-4">
              <SectionHeader
                eyebrow="Incident feed"
                title="Active disruptions"
                actions={<Badge tone={activeIncidents.length ? "red" : "green"}>{activeIncidents.length}</Badge>}
              />
              <div className="mt-3 max-h-[190px] space-y-2 overflow-y-auto">
                {activeIncidents.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-blue-100 px-3 py-5 text-center text-[10.5px] text-slate-500">
                    Network clear. Select a road to simulate an incident.
                  </p>
                ) : (
                  activeIncidents.map((entry) => (
                    <div key={entry.id} className="rounded-lg border border-blue-100 bg-slate-50 px-2.5 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[10.5px] text-slate-800">{entry.note}</p>
                          <p className="font-mono text-[8px] text-slate-500">
                            {entry.edgeId} · {entry.kind} · {simClock(entry.startedAt)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => clearIncident(entry.id)}
                          className="shrink-0 text-[9px] text-rose-700/80 hover:text-rose-700"
                        >
                          clear
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Card className="p-4">
              <SectionHeader eyebrow="Emergency overlay" title="Priority corridors" />
              <div className="mt-2 space-y-1.5 text-[10.5px] text-slate-600">
                <p className="flex items-center gap-2">
                  <span className="h-1.5 w-6 rounded-full bg-rose-400" /> Emergency mission route
                </p>
                <p className="flex items-center gap-2">
                  <span className="h-1.5 w-6 rounded-full bg-blue-500" /> Optimised primary route
                </p>
                <p className="flex items-center gap-2">
                  <span className="h-1.5 w-6 rounded-full bg-violet-400" /> Alternative route
                </p>
                <p className="flex items-center gap-2">
                  <span className="h-1.5 w-6 rounded-full bg-emerald-400" /> Minimum spanning tree
                </p>
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-400/[0.04] px-2.5 py-2">
                <StatusDot tone={metrics.emergencyVehicles ? "red" : "slate"} pulse={metrics.emergencyVehicles > 0} />
                <p className="text-[10px] text-slate-700">
                  {metrics.emergencyVehicles} emergency vehicle{metrics.emergencyVehicles === 1 ? "" : "s"} in network
                </p>
                <Siren size={12} className="ml-auto text-rose-700/70" />
              </div>
            </Card>
          </div>
          <SimulationNote />
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-blue-100 bg-slate-50 px-2 py-1.5">
      <p className="font-mono text-[7.5px] uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-0.5 truncate font-mono text-[9.5px] text-slate-700">{value}</p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="font-mono text-[7px] uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="font-mono text-[9.5px] text-slate-700">{value}</p>
    </div>
  );
}
