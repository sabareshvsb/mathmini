"use client";

import { useMemo, useState } from "react";
import {
  Binary,
  BookOpen,
  Boxes,
  Cpu,
  FlaskConical,
  GitBranch,
  ListOrdered,
  Play,
  Route as RouteIcon,
  Timer,
  Waypoints,
} from "lucide-react";
import { useTrafficStore, getSimulator } from "@/lib/store/traffic-store";
import {
  astar,
  bfs,
  comparePathAlgorithms,
  dfs,
  dijkstra,
  kruskal,
  prim,
} from "@/lib/graph/algorithms";
import { ALGORITHM_INFO } from "@/lib/graph/types";
import type {
  MstResult,
  PathResult,
  TraversalResult,
  WeightMode,
} from "@/lib/graph/types";
import { cn, simClock } from "@/lib/format";
import { NetworkMap } from "@/components/network-map";
import {
  Badge,
  Button,
  Card,
  PageHeader,
  SectionHeader,
  Segmented,
  Select,
  SimulationNote,
  StatCard,
} from "@/components/ui";

type AlgorithmKey = "dijkstra" | "astar" | "bfs" | "dfs" | "kruskal" | "prim";
type Result =
  | { kind: "path"; path: PathResult }
  | { kind: "traversal"; traversal: TraversalResult }
  | { kind: "mst"; mst: MstResult }
  | null;

const ALGOS: Array<{ key: AlgorithmKey; label: string; short: string }> = [
  { key: "dijkstra", label: "Dijkstra", short: "Weighted shortest path" },
  { key: "astar", label: "A* search", short: "Heuristic shortest path" },
  { key: "bfs", label: "Breadth-first", short: "Fewest hops" },
  { key: "dfs", label: "Depth-first", short: "Full traversal" },
  { key: "kruskal", label: "Kruskal MST", short: "Union-find backbone" },
  { key: "prim", label: "Prim MST", short: "Cheapest cut growth" },
];

export default function LabPage() {
  const network = useTrafficStore((state) => state.network);
  const source = useTrafficStore((state) => state.source);
  const destination = useTrafficStore((state) => state.destination);
  const metrics = useTrafficStore((state) => state.metrics);
  const setSource = useTrafficStore((state) => state.setSource);
  const setDestination = useTrafficStore((state) => state.setDestination);
  const [algorithm, setAlgorithm] = useState<AlgorithmKey>("dijkstra");
  const [mode, setMode] = useState<WeightMode>("time");
  const [result, setResult] = useState<Result>(null);
  const [comparison, setComparison] = useState<ReturnType<typeof comparePathAlgorithms> | null>(null);
  const [runAt, setRunAt] = useState<number>(0);

  const info = ALGORITHM_INFO.find((entry) => entry.key === algorithm);
  const trace = useMemo(() => {
    if (!result) return [];
    if (result.kind === "path") return result.path.trace;
    if (result.kind === "traversal") return result.traversal.trace;
    return result.mst.trace;
  }, [result]);

  const pathResult = result?.kind === "path" ? result.path : null;
  const traversalResult = result?.kind === "traversal" ? result.traversal : null;
  const mstResult = result?.kind === "mst" ? result.mst : null;
  const visitedNodes =
    pathResult?.visitedOrder ?? traversalResult?.order ?? null;
  const visitedEdges =
    pathResult?.pathEdges ?? traversalResult?.visitedEdges ?? null;
  const routeEdges = pathResult?.pathEdges ?? null;
  const mstEdges = mstResult?.edges ?? null;

  function run() {
    const sim = getSimulator();
    const ctx = sim.weightContext(mode);
    const options = { mode, ctx, weights: sim.config.weights };
    setComparison(null);
    if (algorithm === "dijkstra") setResult({ kind: "path", path: dijkstra(network, source, destination, options) });
    else if (algorithm === "astar") setResult({ kind: "path", path: astar(network, source, destination, options) });
    else if (algorithm === "bfs") setResult({ kind: "traversal", traversal: bfs(network, source, destination, ctx) });
    else if (algorithm === "dfs") setResult({ kind: "traversal", traversal: dfs(network, source, destination, ctx) });
    else if (algorithm === "kruskal") setResult({ kind: "mst", mst: kruskal(network, ctx) });
    else setResult({ kind: "mst", mst: prim(network, source, ctx) });
    setRunAt(Date.now());
  }

  function compare() {
    const sim = getSimulator();
    setComparison(
      comparePathAlgorithms(network, source, destination, {
        mode,
        ctx: sim.weightContext(mode),
        weights: sim.config.weights,
      }),
    );
    setAlgorithm("dijkstra");
    setResult({ kind: "path", path: dijkstra(network, source, destination, { mode, ctx: sim.weightContext(mode), weights: sim.config.weights }) });
    setRunAt(Date.now());
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Graph Algorithms"
        title="Algorithm laboratory"
        description="Execute the graph algorithms that power routing, signal coordination and network planning. Every run is deterministic against the current simulated graph and reports expanded nodes, execution cost and trace steps."
        actions={
          <>
            <Button size="sm" variant="secondary" onClick={compare}>
              <Cpu size={12} /> Compare four searches
            </Button>
            <Button size="sm" variant="primary" onClick={run}>
              <Play size={12} /> Run {ALGOS.find((entry) => entry.key === algorithm)?.label}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Graph size" value={`${metrics.totalIntersections}/${metrics.totalRoads}`} icon={Waypoints} accent="#2563eb" hint="Vertices / edges" />
        <StatCard label="Algorithm" value={ALGOS.find((entry) => entry.key === algorithm)?.label.split(" ")[0] ?? "—"} icon={FlaskConical} accent="#a78bfa" hint={info?.category} delay={1} />
        <StatCard
          label="Explored"
          value={pathResult?.explored ?? traversalResult?.order.length ?? mstResult?.visitedOrder.length ?? "—"}
          icon={ListOrdered}
          accent="#34d399"
          hint="Nodes touched by the run"
          delay={2}
        />
        <StatCard
          label="Execution"
          value={result ? executionMs(result).toFixed(2) : "—"}
          unit={result ? "ms" : undefined}
          icon={Timer}
          accent="#fbbf24"
          hint="Measured in-browser"
          delay={3}
        />
        <StatCard
          label="Cost / weight"
          value={
            pathResult
              ? pathResult.totalCost.toFixed(1)
              : mstResult
                ? `${mstResult.totalWeight}`
                : traversalResult
                  ? traversalResult.pathEdges.length
                  : "—"
          }
          icon={Binary}
          accent="#fb7185"
          hint={mstResult ? "Total km" : "Weighted units"}
          delay={4}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <Card className="p-4">
            <SectionHeader eyebrow="Workspace" title="Algorithm and query" />
            <div className="mt-3 space-y-2">
              {ALGOS.map((entry) => (
                <button
                  key={entry.key}
                  type="button"
                  onClick={() => setAlgorithm(entry.key)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition",
                    algorithm === entry.key
                      ? "border-blue-200 bg-blue-500/[0.06]"
                      : "border-blue-100 bg-slate-50 hover:border-blue-200",
                  )}
                >
                  <span className={cn("grid h-6 w-6 place-items-center rounded-md border", algorithm === entry.key ? "border-blue-200 text-blue-700" : "border-blue-100 text-slate-500")}>
                    <GitBranch size={12} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10.5px] text-slate-700">{entry.label}</span>
                    <span className="block font-sans text-[8px] text-slate-500">{entry.short}</span>
                  </span>
                  {algorithm === entry.key ? <Badge tone="cyan">active</Badge> : null}
                </button>
              ))}
            </div>
            <div className="mt-3 space-y-2">
              <Select value={source} onChange={(event) => setSource(event.target.value)} aria-label="Source">
                {network.nodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    From {node.id} · {node.name}
                  </option>
                ))}
              </Select>
              <Select value={destination} onChange={(event) => setDestination(event.target.value)} aria-label="Destination">
                {network.nodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    To {node.id} · {node.name}
                  </option>
                ))}
              </Select>
              <Segmented
                value={mode}
                onChange={setMode}
                size="xs"
                options={[
                  { value: "time", label: "Time" },
                  { value: "distance", label: "Distance" },
                  { value: "congestion", label: "Traffic" },
                  { value: "balanced", label: "Balanced" },
                ]}
              />
              <Button variant="primary" className="w-full" onClick={run}>
                <Play size={12} /> Execute algorithm
              </Button>
            </div>
          </Card>

          <Card className="p-4">
            <SectionHeader eyebrow="Complexity" title={info?.name ?? "Algorithm"} />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="rounded-md border border-blue-100 bg-slate-50 px-2 py-1.5">
                <p className="font-sans text-[7.5px] uppercase tracking-[0.12em] text-slate-500">Time</p>
                <p className="mt-0.5 font-sans text-[10px] text-blue-700">{info?.complexity}</p>
              </div>
              <div className="rounded-md border border-blue-100 bg-slate-50 px-2 py-1.5">
                <p className="font-sans text-[7.5px] uppercase tracking-[0.12em] text-slate-500">Space</p>
                <p className="mt-0.5 font-sans text-[10px] text-violet-700">{info?.space}</p>
              </div>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-slate-500">{info?.description}</p>
            <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-400/[0.04] px-2.5 py-2 text-[9.5px] leading-relaxed text-emerald-700/60">
              {info?.guarantees}
            </p>
          </Card>

          <SimulationNote />
        </div>

        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100 px-4 py-3">
              <SectionHeader eyebrow="Visual trace" title="Graph execution overlay" className="flex-1" />
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone="cyan">{visitedNodes?.length ?? 0} visited</Badge>
                {routeEdges ? <Badge tone="green">{routeEdges.length} path edges</Badge> : null}
                {mstEdges ? <Badge tone="violet">{mstEdges.length} MST edges</Badge> : null}
              </div>
            </div>
            <NetworkMap
              height="clamp(340px, 48vh, 540px)"
              visitedNodes={visitedNodes ?? undefined}
              visitedEdges={visitedEdges ?? undefined}
              routeEdges={routeEdges ?? undefined}
              mstEdges={mstEdges ?? undefined}
              dimNonRoute={Boolean(routeEdges)}
              showVehicleLayer={false}
            />
            <div className="flex flex-wrap items-center gap-3 border-t border-blue-100 px-4 py-2 font-sans text-[8px] uppercase tracking-[0.12em] text-slate-500">
              <span className="flex items-center gap-1.5"><span className="h-1.5 w-3 rounded-full bg-amber-300" /> visited node</span>
              <span className="flex items-center gap-1.5"><span className="h-1.5 w-3 rounded-full bg-blue-500" /> relaxed edge</span>
              <span className="flex items-center gap-1.5"><span className="h-1.5 w-3 rounded-full bg-emerald-400" /> optimal path</span>
              <span className="flex items-center gap-1.5"><span className="h-1.5 w-3 rounded-full bg-violet-400" /> spanning tree</span>
              {runAt ? <span className="ml-auto">run at {simClock(runAt / 1000)}</span> : null}
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-4">
              <SectionHeader
                eyebrow="Result"
                title={
                  pathResult
                    ? "Shortest path found"
                    : traversalResult
                      ? "Traversal complete"
                      : mstResult
                        ? "Spanning tree built"
                        : "Awaiting execution"
                }
                actions={result ? <Badge tone={pathResult && !pathResult.found ? "red" : "green"}>{pathResult ? (pathResult.found ? "found" : "unreachable") : "ok"}</Badge> : null}
              />
              {result ? (
                <div className="mt-3 space-y-2.5 text-[10.5px]">
                  {pathResult ? (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <Metric label="Distance" value={`${pathResult.totalDistanceKm} km`} />
                        <Metric label="Est. time" value={`${pathResult.totalTimeMin} min`} />
                        <Metric label="Explored" value={String(pathResult.explored)} />
                        <Metric label="Memory" value={`${pathResult.memoryKb} KB`} />
                      </div>
                      <div className="rounded-lg border border-blue-100 bg-slate-50 px-2.5 py-2">
                        <p className="font-sans text-[8px] uppercase tracking-[0.12em] text-slate-500">Path</p>
                        <p className="mt-1 break-words font-sans text-[9px] leading-relaxed text-slate-700">
                          {pathResult.pathNodes.join(" → ") || "No route"}
                        </p>
                      </div>
                      <p className="font-sans text-[8.5px] text-slate-500">{pathResult.heuristic}</p>
                    </>
                  ) : traversalResult ? (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <Metric label="Visited" value={String(traversalResult.order.length)} />
                        <Metric label="Hops" value={String(traversalResult.pathEdges.length)} />
                        <Metric label="Found" value={traversalResult.found ? "yes" : "no"} />
                        <Metric label="Edges scanned" value={String(traversalResult.visitedEdges.length)} />
                      </div>
                      <div className="rounded-lg border border-blue-100 bg-slate-50 px-2.5 py-2">
                        <p className="font-sans text-[8px] uppercase tracking-[0.12em] text-slate-500">Traversal order</p>
                        <p className="mt-1 break-words font-sans text-[9px] leading-relaxed text-slate-700">
                          {traversalResult.order.join(" → ")}
                        </p>
                      </div>
                    </>
                  ) : mstResult ? (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <Metric label="Selected edges" value={String(mstResult.edges.length)} />
                        <Metric label="Total weight" value={`${mstResult.totalWeight} km`} />
                        <Metric label="Components" value={String(mstResult.components)} />
                        <Metric label="Execution" value={`${mstResult.executionMs} ms`} />
                      </div>
                      <div className="rounded-lg border border-blue-100 bg-slate-50 px-2.5 py-2">
                        <p className="font-sans text-[8px] uppercase tracking-[0.12em] text-slate-500">Tree edges</p>
                        <p className="mt-1 break-words font-sans text-[9px] leading-relaxed text-slate-700">
                          {mstResult.edges.join(", ") || "None"}
                        </p>
                      </div>
                    </>
                  ) : null}
                </div>
              ) : (
                <p className="mt-3 rounded-xl border border-dashed border-blue-100 px-4 py-8 text-center text-[10.5px] text-slate-500">
                  Choose an algorithm and press execute to populate the result panel and graph overlay.
                </p>
              )}
            </Card>

            <Card className="p-4">
              <SectionHeader
                eyebrow="Step trace"
                title="Execution log"
                actions={trace.length ? <Badge tone="slate">{trace.length} steps</Badge> : null}
              />
              <div className="scroll-area mt-3 max-h-[290px] space-y-1 overflow-y-auto pr-1">
                {trace.length === 0 ? (
                  <p className="text-[10px] text-slate-500">
                    Algorithm trace steps will appear here after execution.
                  </p>
                ) : (
                  trace.map((step) => (
                    <div key={step.step} className="flex gap-2 font-sans text-[8.5px] leading-relaxed">
                      <span className="w-7 shrink-0 text-right text-slate-400">{step.step}</span>
                      <span
                        className={cn(
                          "w-10 shrink-0 uppercase",
                          step.type === "accept"
                            ? "text-emerald-700/80"
                            : step.type === "visit"
                              ? "text-blue-700/80"
                              : step.type === "skip"
                                ? "text-amber-700/70"
                                : step.type === "done"
                                  ? "text-violet-700/80"
                                  : "text-slate-500",
                        )}
                      >
                        {step.type}
                      </span>
                      <span className="min-w-0 flex-1 text-slate-600">
                        {step.note ?? `${step.from ?? ""} → ${step.to ?? step.node ?? ""}`}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>

      <Card className="p-4">
        <SectionHeader
          eyebrow="Benchmark"
          title="Dijkstra, A*, BFS and DFS on the same query"
          subtitle="Reference the same graph and cost context. BFS and DFS optimise hop count, not travel time."
          actions={
            <Button size="sm" variant="outline" onClick={compare}>
              <Cpu size={12} /> Run comparison
            </Button>
          }
        />
        {comparison ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead className="font-sans text-[8px] uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-2 py-2">Algorithm</th>
                  <th className="px-2 py-2 text-right">Explored</th>
                  <th className="px-2 py-2 text-right">ms</th>
                  <th className="px-2 py-2 text-right">Memory</th>
                  <th className="px-2 py-2 text-right">Cost</th>
                  <th className="px-2 py-2 text-right">Distance</th>
                  <th className="px-2 py-2 text-right">Time</th>
                  <th className="px-2 py-2 text-right">Hops</th>
                  <th className="px-2 py-2 text-right">Result</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Dijkstra", comparison.dijkstra, "#2563eb"],
                  ["A*", comparison.astar, "#a3e635"],
                  ["BFS", comparison.bfs, "#a78bfa"],
                  ["DFS", comparison.dfs, "#fb923c"],
                ].map(([name, item, color]) => {
                  const path = item as PathResult;
                  return (
                    <tr key={name as string} className="border-t border-blue-100 text-[10px] text-slate-600">
                      <td className="px-2 py-2 font-sans" style={{ color: color as string }}>
                        {name as string}
                      </td>
                      <td className="px-2 py-2 text-right font-sans">{path.explored}</td>
                      <td className="px-2 py-2 text-right font-sans">{path.executionMs.toFixed(2)}</td>
                      <td className="px-2 py-2 text-right font-sans">{path.memoryKb.toFixed(1)} KB</td>
                      <td className="px-2 py-2 text-right font-sans">{path.totalCost.toFixed(1)}</td>
                      <td className="px-2 py-2 text-right font-sans">{path.totalDistanceKm.toFixed(2)} km</td>
                      <td className="px-2 py-2 text-right font-sans">{path.totalTimeMin.toFixed(1)} min</td>
                      <td className="px-2 py-2 text-right font-sans">{path.pathEdges.length}</td>
                      <td className="px-2 py-2 text-right">
                        <Badge tone={path.found ? "green" : "red"}>{path.found ? "found" : "none"}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-blue-100 px-4 py-5">
            <p className="flex items-center gap-2 text-[10.5px] text-slate-500">
              <BookOpen size={14} /> Run the comparison to benchmark all four search strategies.
            </p>
            <Button size="sm" variant="secondary" onClick={compare}>
              Compare now
            </Button>
          </div>
        )}
      </Card>

      <div className="grid gap-2 text-[9px] text-slate-500 sm:grid-cols-3">
        <span className="flex items-center gap-1.5"><Boxes size={10} /> Results computed against the current simulated graph</span>
        <span className="flex items-center gap-1.5"><RouteIcon size={10} /> Path cost includes density, signals and incidents</span>
        <span className="flex items-center gap-1.5"><Cpu size={10} /> Timings are in-browser measurements, not benchmarks</span>
      </div>
    </div>
  );
}

function executionMs(result: Exclude<Result, null>): number {
  if (result.kind === "path") return result.path.executionMs;
  if (result.kind === "traversal") return result.traversal.executionMs;
  return result.mst.executionMs;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-blue-100 bg-slate-50 px-2 py-1.5">
      <p className="font-sans text-[7.5px] uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-0.5 font-sans text-[10px] text-slate-700">{value}</p>
    </div>
  );
}

