"use client";

import { useState } from "react";
import {
  ArrowRight,
  Compass,
  Gauge,
  GitCompare,
  Navigation,
  Route as RouteIcon,
  Scale,
  SlidersHorizontal,
  Timer,
  Zap,
} from "lucide-react";
import { useTrafficStore, getSimulator } from "@/lib/store/traffic-store";
import { comparePathAlgorithms } from "@/lib/graph/algorithms";
import type { WeightMode } from "@/lib/graph/types";
import { formatMinutes, simClock } from "@/lib/format";
import { NetworkMap } from "@/components/network-map";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  PageHeader,
  Progress,
  SectionHeader,
  Segmented,
  Select,
  SimulationNote,
  Slider,
  StatCard,
} from "@/components/ui";

type Comparison = ReturnType<typeof comparePathAlgorithms>;

const MODES: Array<{ value: WeightMode; label: string; icon: typeof Timer }> = [
  { value: "time", label: "Fastest", icon: Timer },
  { value: "distance", label: "Shortest", icon: Compass },
  { value: "congestion", label: "Avoid traffic", icon: Gauge },
  { value: "balanced", label: "Balanced", icon: Scale },
];

export default function OptimizePage() {
  const network = useTrafficStore((state) => state.network);
  const source = useTrafficStore((state) => state.source);
  const destination = useTrafficStore((state) => state.destination);
  const route = useTrafficStore((state) => state.route);
  const weights = useTrafficStore((state) => state.config.weights);
  const optimizationStats = useTrafficStore((state) => state.analytics.optimizationStats);
  const lastOptimization = useTrafficStore((state) => state.lastOptimization);
  const metrics = useTrafficStore((state) => state.metrics);
  const setSource = useTrafficStore((state) => state.setSource);
  const setDestination = useTrafficStore((state) => state.setDestination);
  const setWeights = useTrafficStore((state) => state.setWeights);
  const runRoute = useTrafficStore((state) => state.runRoute);
  const clearRoute = useTrafficStore((state) => state.clearRoute);
  const [mode, setMode] = useState<WeightMode>("time");
  const [comparison, setComparison] = useState<Comparison | null>(null);

  const nodeName = (id: string) => network.nodes.find((node) => node.id === id)?.name ?? id;

  function optimise() {
    const sim = getSimulator();
    const ctx = sim.weightContext(mode);
    setComparison(
      comparePathAlgorithms(network, source, destination, {
        mode,
        ctx,
        weights: sim.config.weights,
      }),
    );
    runRoute(source, destination, mode);
  }

  const rows = comparison
    ? ([
        { key: "dijkstra", result: comparison.dijkstra, color: "#2563eb" },
        { key: "astar", result: comparison.astar, color: "#a3e635" },
        { key: "bfs", result: comparison.bfs, color: "#a78bfa" },
        { key: "dfs", result: comparison.dfs, color: "#fb923c" },
      ] as const)
    : [];

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Routing Engine"
        title="Route optimization"
        description="Compute the optimal path across the live weighted graph, compare Dijkstra, A*, BFS and DFS on the same query, and inspect how congestion changes the chosen corridor."
        actions={
          <>
            <Badge tone="cyan" dot>
              Dijkstra optimal
            </Badge>
            <Button size="sm" variant="primary" onClick={optimise}>
              <Navigation size={12} /> Optimise now
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Route distance"
          value={route ? route.primary.totalDistanceKm : "—"}
          unit="km"
          icon={RouteIcon}
          accent="#2563eb"
          hint={route ? `${route.primary.pathEdges.length} segments` : "No active route"}
        />
        <StatCard
          label="Estimated travel time"
          value={route ? route.primary.totalTimeMin.toFixed(1) : "—"}
          unit="min"
          icon={Timer}
          accent="#34d399"
          hint="Weighted by live density"
          delay={1}
        />
        <StatCard
          label="Time saved vs shortest"
          value={lastOptimization ? lastOptimization.timeSavedMin.toFixed(1) : "—"}
          unit="min"
          icon={Zap}
          accent="#a78bfa"
          hint="Compared with distance route"
          delay={2}
        />
        <StatCard
          label="Graph size"
          value={`${metrics.totalIntersections}/${metrics.totalRoads}`}
          icon={GitCompare}
          accent="#fbbf24"
          hint="Vertices / edges evaluated"
          delay={3}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100 px-4 py-3">
            <SectionHeader eyebrow="Optimal corridor" title="Route preview" className="flex-1" />
            <div className="flex items-center gap-1.5">
              {route ? <Badge tone="green">found</Badge> : <Badge tone="slate">awaiting query</Badge>}
              <Button size="sm" variant="ghost" onClick={clearRoute}>
                Clear
              </Button>
            </div>
          </div>
          <NetworkMap height="clamp(380px, 54vh, 620px)" useGlobalRoute />
          <div className="border-t border-blue-100 px-4 py-3">
            {route ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md border border-blue-200 bg-blue-500/[0.06] px-2 py-1 font-sans text-[9px] text-blue-700">
                    {route.primary.source} · {nodeName(route.primary.source)}
                  </span>
                  <ArrowRight size={12} className="text-slate-500" />
                  <span className="rounded-md border border-violet-200 bg-violet-400/[0.06] px-2 py-1 font-sans text-[9px] text-violet-700">
                    {route.primary.target} · {nodeName(route.primary.target)}
                  </span>
                  <span className="ml-auto font-sans text-[8.5px] text-slate-500">
                    computed {simClock(route.createdAt / 1000)}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {route.primary.pathNodes.map((node, index) => (
                    <span key={`${node}-${index}`} className="flex items-center gap-1">
                      <span className="rounded border border-blue-100 bg-slate-50 px-1.5 py-0.5 font-sans text-[8.5px] text-slate-600">
                        {node}
                      </span>
                      {index < route.primary.pathNodes.length - 1 ? (
                        <ArrowRight size={8} className="text-slate-400" />
                      ) : null}
                    </span>
                  ))}
                </div>
                {route.alternatives.length ? (
                  <div className="mt-3">
                    <p className="font-sans text-[8px] uppercase tracking-[0.16em] text-slate-500">
                      Alternative corridors
                    </p>
                    <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
                      {route.alternatives.map((alternative, index) => (
                        <div
                          key={`${alternative.pathEdges.join("-")}-${index}`}
                          className="flex items-center justify-between gap-2 rounded-lg border border-blue-100 bg-slate-50 px-2.5 py-1.5"
                        >
                          <span className="font-sans text-[9px] text-slate-600">ALT {index + 1}</span>
                          <span className="font-sans text-[9px] text-slate-500">
                            {alternative.totalDistanceKm} km · {formatMinutes(alternative.totalTimeMin, 0)}
                          </span>
                          <span className="font-sans text-[9px] text-amber-700/80">
                            +{Math.max(0, alternative.totalTimeMin - route.primary.totalTimeMin).toFixed(1)}m
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <EmptyState
                icon={RouteIcon}
                title="No route computed"
                description="Choose an origin and destination, then run the optimizer to draw the optimal weighted path."
                action={
                  <Button size="sm" variant="primary" onClick={optimise}>
                    <Navigation size={12} /> Optimise route
                  </Button>
                }
              />
            )}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <SectionHeader eyebrow="Query" title="Origin, destination, cost model" />
            <div className="mt-3 space-y-3">
              <Field label="Origin intersection">
                <Select value={source} onChange={(event) => setSource(event.target.value)}>
                  {network.nodes.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.id} · {node.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Destination intersection">
                <Select value={destination} onChange={(event) => setDestination(event.target.value)}>
                  {network.nodes.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.id} · {node.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <div>
                <p className="label-xs mb-1.5">Cost objective</p>
                <Segmented value={mode} onChange={setMode} options={MODES.map((item) => ({ value: item.value, label: item.label, icon: item.icon }))} />
              </div>
              <Button variant="primary" className="w-full" onClick={optimise}>
                <Navigation size={13} /> Run Dijkstra optimisation
              </Button>
              <p className="text-[9.5px] leading-relaxed text-slate-500">
                Weights combine road length, live density, signal delay and incident penalties. Blocked edges receive a
                prohibitive cost and are excluded from consideration.
              </p>
            </div>
          </Card>

          <Card className="p-4">
            <SectionHeader
              eyebrow="Cost model"
              title="Weight tuning"
              actions={<Badge tone="violet">balanced mode</Badge>}
            />
            <div className="mt-3 space-y-3">
              <Slider
                label="Distance weight"
                value={weights.distance}
                min={0.2}
                max={3}
                step={0.1}
                onChange={(value) => setWeights({ distance: value })}
                display={weights.distance.toFixed(1)}
              />
              <Slider
                label="Traffic penalty"
                value={weights.traffic}
                min={0}
                max={4}
                step={0.1}
                onChange={(value) => setWeights({ traffic: value })}
                display={weights.traffic.toFixed(1)}
              />
              <Slider
                label="Signal delay"
                value={weights.signal}
                min={0}
                max={3}
                step={0.1}
                onChange={(value) => setWeights({ signal: value })}
                display={weights.signal.toFixed(1)}
              />
              <Slider
                label="Incident penalty"
                value={weights.incident}
                min={0}
                max={20}
                step={0.5}
                onChange={(value) => setWeights({ incident: value })}
                display={weights.incident.toFixed(1)}
              />
            </div>
          </Card>
        </div>
      </div>

      <Card className="p-4">
        <SectionHeader
          eyebrow="Algorithm benchmark"
          title="Same query, four strategies"
          subtitle="All algorithms run against the identical weighted graph and cost context. BFS and DFS ignore weights, so their hop-count routes are shorter to compute but not necessarily faster to drive."
          actions={
            <Button size="sm" variant="outline" onClick={optimise}>
              <SlidersHorizontal size={12} /> Recompute
            </Button>
          }
        />
        {comparison ? (
          <>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-left">
                <thead className="font-sans text-[8px] uppercase tracking-[0.12em] text-slate-500">
                  <tr>
                    <th className="px-2 py-2">Algorithm</th>
                    <th className="px-2 py-2 text-right">Explored</th>
                    <th className="px-2 py-2 text-right">Execute</th>
                    <th className="px-2 py-2 text-right">Memory</th>
                    <th className="px-2 py-2 text-right">Cost</th>
                    <th className="px-2 py-2 text-right">Distance</th>
                    <th className="px-2 py-2 text-right">Time</th>
                    <th className="px-2 py-2 text-right">Hops</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ key, result, color }) => (
                    <tr key={key} className="border-t border-blue-100 text-[10px] text-slate-600">
                      <td className="px-2 py-2">
                        <span className="inline-flex items-center gap-1.5 font-sans" style={{ color }}>
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
                          {key === "astar" ? "A*" : key.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right font-sans">{result.explored}</td>
                      <td className="px-2 py-2 text-right font-sans">{result.executionMs.toFixed(2)} ms</td>
                      <td className="px-2 py-2 text-right font-sans">{result.memoryKb.toFixed(1)} KB</td>
                      <td className="px-2 py-2 text-right font-sans">{result.totalCost.toFixed(1)}</td>
                      <td className="px-2 py-2 text-right font-sans">{result.totalDistanceKm.toFixed(2)} km</td>
                      <td className="px-2 py-2 text-right font-sans">{result.totalTimeMin.toFixed(1)} min</td>
                      <td className="px-2 py-2 text-right font-sans">{result.pathEdges.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg border border-blue-100 bg-slate-50 px-3 py-2">
                <p className="font-sans text-[8px] uppercase tracking-[0.14em] text-slate-500">Route agreement</p>
                <p className="mt-0.5 text-[10.5px] text-slate-700">
                  {comparison.dijkstra.totalCost.toFixed(2) === comparison.astar.totalCost.toFixed(2)
                    ? "Dijkstra and A* return identical optimal cost"
                    : "A* cost differs — heuristic inspection required"}
                </p>
              </div>
              <div className="rounded-lg border border-blue-100 bg-slate-50 px-3 py-2">
                <p className="font-sans text-[8px] uppercase tracking-[0.14em] text-slate-500">A* efficiency</p>
                <p className="mt-0.5 text-[10.5px] text-emerald-700">
                  {comparison.dijkstra.explored > 0
                    ? `${Math.max(0, Math.round((1 - comparison.astar.explored / comparison.dijkstra.explored) * 100))}% fewer nodes expanded`
                    : "—"}
                </p>
              </div>
              <div className="rounded-lg border border-blue-100 bg-slate-50 px-3 py-2">
                <p className="font-sans text-[8px] uppercase tracking-[0.14em] text-slate-500">Heuristic</p>
                <p className="mt-0.5 truncate text-[10px] text-slate-700">{comparison.astar.heuristic}</p>
              </div>
            </div>
          </>
        ) : (
          <div className="mt-3 rounded-xl border border-dashed border-blue-100 px-4 py-8 text-center">
            <p className="text-[11px] text-slate-500">
              Run the optimizer to benchmark Dijkstra, A*, BFS and DFS on the current graph.
            </p>
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card className="p-4">
          <SectionHeader
            eyebrow="Optimization log"
            title="Recent queries"
            actions={<Badge tone="slate">{optimizationStats.length} stored</Badge>}
          />
          <div className="scroll-area mt-3 max-h-[260px] overflow-y-auto">
            <table className="w-full border-collapse text-left">
              <thead className="font-sans text-[8px] uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-2 py-1.5">Query</th>
                  <th className="px-2 py-1.5">Mode</th>
                  <th className="px-2 py-1.5 text-right">Distance</th>
                  <th className="px-2 py-1.5 text-right">Time</th>
                  <th className="px-2 py-1.5 text-right">Saved</th>
                </tr>
              </thead>
              <tbody>
                {optimizationStats.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-2 py-6 text-center text-[10.5px] text-slate-500">
                      No queries yet. Run an optimization to populate the log.
                    </td>
                  </tr>
                ) : (
                  optimizationStats.map((stat) => (
                    <tr key={stat.id} className="border-t border-blue-100 text-[10px] text-slate-600">
                      <td className="px-2 py-1.5 font-sans">
                        {stat.source} → {stat.destination}
                      </td>
                      <td className="px-2 py-1.5 capitalize">{stat.mode}</td>
                      <td className="px-2 py-1.5 text-right font-sans">{stat.distanceKm} km</td>
                      <td className="px-2 py-1.5 text-right font-sans">{stat.timeMin} min</td>
                      <td className="px-2 py-1.5 text-right font-sans text-emerald-700">+{stat.timeSavedMin} min</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-4">
          <SectionHeader eyebrow="Congestion avoidance" title="Baseline comparison" />
          {route?.baseline ? (
            <div className="mt-3 space-y-3">
              <CompareRow
                label="Shortest-distance route"
                value={`${route.baseline.totalDistanceKm} km`}
                secondary={`${route.baseline.totalTimeMin} min under current traffic`}
                color="#94a3b8"
              />
              <CompareRow
                label="Traffic-optimised route"
                value={`${route.primary.totalDistanceKm} km`}
                secondary={`${route.primary.totalTimeMin} min under current traffic`}
                color="#2563eb"
              />
              <div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-500">Travel-time improvement</span>
                  <span className="font-sans text-emerald-700">
                    {Math.max(0, route.baseline.totalTimeMin - route.primary.totalTimeMin).toFixed(1)} min
                  </span>
                </div>
                <Progress
                  value={
                    route.baseline.totalTimeMin > 0
                      ? Math.max(0, (1 - route.primary.totalTimeMin / route.baseline.totalTimeMin) * 100)
                      : 0
                  }
                  color="#34d399"
                  height={6}
                  className="mt-1"
                />
              </div>
            </div>
          ) : (
            <p className="mt-3 text-[10.5px] leading-relaxed text-slate-500">
              Run a time-based optimization to compare the congestion-aware route against the pure shortest-distance
              baseline.
            </p>
          )}
          <SimulationNote className="mt-3" />
        </Card>
      </div>
    </div>
  );
}

function CompareRow({
  label,
  value,
  secondary,
  color,
}: {
  label: string;
  value: string;
  secondary: string;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-blue-100 bg-slate-50 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[10px] text-slate-600">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
          {label}
        </span>
        <span className="font-sans text-[11px] text-slate-800">{value}</span>
      </div>
      <p className="mt-0.5 font-sans text-[8.5px] text-slate-500">{secondary}</p>
    </div>
  );
}
