"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  Check,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Pause,
  Play,
  RotateCcw,
  Route as RouteIcon,
  Siren,
  SkipBack,
  SkipForward,
  Sparkles,
  X,
} from "lucide-react";
import { astar, dijkstra } from "@/lib/graph/algorithms";
import type { PathResult } from "@/lib/graph/types";
import { demoSteps, getSimulator, useTrafficStore } from "@/lib/store/traffic-store";
import { cn, simClock } from "@/lib/format";
import { NetworkMap } from "./network-map";
import { Badge, Button, Progress } from "./ui";

interface Comparison {
  dijkstra: PathResult;
  astar: PathResult;
  timestamp: number;
}

export function DemoMode() {
  const router = useRouter();
  const demo = useTrafficStore((state) => state.demo);
  const metrics = useTrafficStore((state) => state.metrics);
  const route = useTrafficStore((state) => state.route);
  const missions = useTrafficStore((state) => state.missions);
  const baseline = useTrafficStore((state) => state.baseline);
  const closedRef = useRef<string | null>(null);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [blockedEdge, setBlockedEdge] = useState<string | null>(null);
  const [missionId, setMissionId] = useState<string | null>(null);

  const step = demo.step;
  const content = demoSteps[step];
  const activeMission = missions.find((mission) => mission.id === missionId) ?? missions.find((m) => m.status === "enroute");

  const setDemoStep = useTrafficStore((state) => state.setDemoStep);
  const setDemoPlaying = useTrafficStore((state) => state.setDemoPlaying);
  const closeDemo = useTrafficStore((state) => state.closeDemo);

  function computeComparison(): Comparison | null {
    const state = useTrafficStore.getState();
    const sim = getSimulator();
    const ctx = sim.weightContext("time");
    if (state.source === state.destination) return null;
    const d = dijkstra(sim.network, state.source, state.destination, {
      mode: "time",
      ctx,
      weights: sim.config.weights,
    });
    const a = astar(sim.network, state.source, state.destination, {
      mode: "time",
      ctx,
      weights: sim.config.weights,
    });
    if (!d.found || !a.found) return null;
    const value = { dijkstra: d, astar: a, timestamp: Date.now() };
    setComparison(value);
    return value;
  }

  function runStep(index: number, fromAuto = false) {
    const state = useTrafficStore.getState();
    const sim = getSimulator();
    switch (index) {
      case 0: {
        state.reset();
        state.setMapView("graph");
        state.setSource("J01");
        state.setDestination("J30");
        state.clearRoute();
        state.clearAllIncidents();
        setComparison(null);
        setBlockedEdge(null);
        setMissionId(null);
        state.setSpeed(2);
        state.start();
        break;
      }
      case 1: {
        state.setMapView("graph");
        state.start();
        break;
      }
      case 2: {
        state.start();
        state.spawnBurst(48);
        break;
      }
      case 3: {
        state.start();
        state.setSpawnRate(34);
        state.setSpeed(2);
        break;
      }
      case 4: {
        state.start();
        state.generateCongestion(6);
        break;
      }
      case 5: {
        state.start();
        state.setSource("J01");
        state.setDestination("J30");
        state.runRoute("J01", "J30", "time");
        break;
      }
      case 6: {
        state.start();
        const d = state.route?.primary ?? state.runRoute("J01", "J30", "time")?.primary;
        const ctx = sim.weightContext("time");
        const a = astar(sim.network, "J01", "J30", { mode: "time", ctx, weights: sim.config.weights });
        if (d && a.found) {
          const value = { dijkstra: d, astar: a, timestamp: Date.now() };
          setComparison(value);
          sim.log(
            "algorithm",
            `A* completed · ${a.explored} nodes explored in ${a.executionMs} ms for the same optimal cost`,
            "success",
          );
          sim.emit();
        }
        break;
      }
      case 7: {
        if (!comparison) computeComparison();
        state.start();
        break;
      }
      case 8: {
        state.captureBaseline();
        state.setAdaptiveSignals(true);
        state.setCoordinatedSignals(true);
        state.start();
        break;
      }
      case 9: {
        state.start();
        const primary = state.route?.primary;
        let edgeId = primary?.pathEdges[Math.floor(primary.pathEdges.length / 2)] ?? null;
        if (!edgeId) {
          edgeId = sim.network.edges[Math.floor(sim.network.edges.length / 2)]?.id ?? null;
        }
        if (edgeId && sim.roads[edgeId]?.blocked) {
          edgeId = sim.network.edges.find((edge) => !sim.roads[edge.id]?.blocked)?.id ?? edgeId;
        }
        if (edgeId) {
          closedRef.current = edgeId;
          setBlockedEdge(edgeId);
          state.closeRoad(edgeId);
        }
        break;
      }
      case 10: {
        state.start();
        state.runRoute(state.source, state.destination, "time");
        break;
      }
      case 11: {
        state.start();
        const ambulance = sim.fleet.find((unit) => unit.type === "ambulance" && unit.status === "idle");
        const unit = ambulance ?? sim.fleet.find((fleetUnit) => fleetUnit.status === "idle");
        if (unit) {
          state.dispatchEmergency(unit.id, state.destination === unit.baseNode ? "J24" : state.destination);
          const latest = useTrafficStore.getState().missions[0];
          if (latest) setMissionId(latest.id);
        }
        break;
      }
      case 12: {
        state.start();
        state.setAdaptiveSignals(true);
        state.setCoordinatedSignals(true);
        if (!missionId) {
          const latest = sim.missions.find((mission) => mission.status === "enroute");
          if (latest) setMissionId(latest.id);
        }
        break;
      }
      case 13: {
        state.compareBaseline();
        state.start();
        break;
      }
      default:
        break;
    }
    if (fromAuto) state.setDemoStep(index);
  }

  useEffect(() => {
    if (!demo.open) return;
    setComparison(null);
    setBlockedEdge(null);
    setMissionId(null);
    useTrafficStore.getState().setDemoPlaying(false);
    runStep(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo.open]);

  useEffect(() => {
    if (!demo.open || !demo.playing) return;
    if (demo.step >= demoSteps.length - 1) {
      setDemoPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => {
      const next = demo.step + 1;
      setDemoStep(next);
      runStep(next, true);
    }, 10500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo.open, demo.playing, demo.step]);

  function goTo(next: number) {
    const clamped = Math.max(0, Math.min(demoSteps.length - 1, next));
    setDemoStep(clamped);
    runStep(clamped);
  }

  function handleClose() {
    closeDemo();
    if (closedRef.current) {
      const road = getSimulator().roads[closedRef.current];
      if (road?.blocked) getSimulator().clearIncident(getSimulator().incidents.find((i) => i.edgeId === closedRef.current)?.id ?? "");
      closedRef.current = null;
    }
  }

  function handleAnalytics() {
    closeDemo();
    router.push("/analytics");
  }

  const efficiency = metrics.flowEfficiency;
  const mission = activeMission;

  return (
    <AnimatePresence>
      {demo.open ? (
        <motion.div
          className="fixed inset-0 z-[85] overflow-y-auto bg-white/90 p-3 backdrop-blur-xl sm:p-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.985 }}
            transition={{ duration: 0.28 }}
            className="glass-strong mx-auto w-full max-w-6xl overflow-hidden"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-100 px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700">
                  <Sparkles size={15} />
                </span>
                <div>
                  <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-blue-700/60">
                    Guided presentation
                  </p>
                  <p className="text-[13px] font-semibold text-slate-900">Project Demonstration Mode</p>
                </div>
                <Badge tone="cyan" dot className="ml-2 hidden sm:inline-flex">
                  Simulation
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[9px] text-slate-500">
                  STEP {String(step + 1).padStart(2, "0")} / {demoSteps.length}
                </span>
                <span className="hidden items-center gap-1 rounded-md border border-blue-100 bg-slate-50 px-2 py-1 font-mono text-[8px] text-slate-500 sm:flex">
                  {simClock(useTrafficStore.getState().simTime)} SIM
                </span>
                <button
                  type="button"
                  onClick={handleClose}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-blue-100 bg-blue-50 text-slate-600 transition hover:text-slate-900"
                  aria-label="Exit demo mode"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className="grid max-h-[calc(100vh-150px)] gap-0 overflow-y-auto lg:grid-cols-[1.02fr_1.25fr]">
              <div className="flex flex-col border-b border-blue-100 p-4 sm:p-5 lg:border-b-0 lg:border-r">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-blue-700/70">
                    {String(step + 1).padStart(2, "0")}
                  </span>
                  <div className="h-px flex-1 bg-gradient-to-r from-blue-50 to-transparent" />
                </div>
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <h2 className="mt-3 text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">{content.title}</h2>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-slate-600">{content.body}</p>
                </motion.div>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
                  <DemoStat label="Vehicles" value={String(metrics.activeVehicles)} />
                  <DemoStat label="Congested" value={String(metrics.congestedRoads)} tone="text-orange-700" />
                  <DemoStat label="Efficiency" value={`${efficiency.toFixed(0)}%`} tone="text-emerald-700" />
                  <DemoStat label="Emergency" value={String(metrics.emergencyVehicles)} tone="text-rose-700" />
                </div>

                <div className="mt-4 space-y-2">
                  {step === 5 || step === 10 ? (
                    <ResultCard
                      icon={RouteIcon}
                      title={step === 5 ? "Dijkstra optimal route" : "Recalculated route"}
                      tone="cyan"
                      rows={[
                        ["Path", `${route?.primary.pathNodes.length ?? 0} intersections`],
                        ["Distance", `${route?.primary.totalDistanceKm ?? 0} km`],
                        ["Est. time", `${route?.primary.totalTimeMin ?? 0} min`],
                        ["Segments", `${route?.primary.pathEdges.length ?? 0}`],
                      ]}
                    />
                  ) : null}
                  {step === 6 || step === 7 ? (
                    <ComparisonCard comparison={comparison} />
                  ) : null}
                  {step === 8 ? (
                    <ResultCard
                      icon={Cpu}
                      title="Adaptive signal controller"
                      tone="green"
                      rows={[
                        ["Mode", "Adaptive + green wave"],
                        ["Green range", "20 – 60 s"],
                        ["Intersections", `${metrics.activeSignals}`],
                        ["Signal efficiency", `${metrics.signalEfficiency}%`],
                      ]}
                    />
                  ) : null}
                  {step === 9 && blockedEdge ? (
                    <ResultCard
                      icon={Siren}
                      title="Corridor closed"
                      tone="red"
                      rows={[
                        ["Edge", blockedEdge],
                        [
                          "Road",
                          getSimulator().network.edges.find((edge) => edge.id === blockedEdge)?.name ?? "—",
                        ],
                        ["Action", "Excluded from routing"],
                        ["Vehicles", "Auto-rerouted"],
                      ]}
                    />
                  ) : null}
                  {step >= 11 ? (
                    <ResultCard
                      icon={Siren}
                      title="Emergency priority corridor"
                      tone="red"
                      rows={[
                        ["Unit", mission?.label ?? "Awaiting dispatch"],
                        ["Destination", mission?.destination ?? "—"],
                        ["Progress", mission ? `${Math.round(mission.progress * 100)}%` : "—"],
                        ["Signals", mission ? `${mission.preemptedNodes.length} preempted` : "—"],
                      ]}
                      footer={
                        mission ? (
                          <Progress
                            value={mission.progress * 100}
                            color="#fb7185"
                            height={5}
                            className="mt-2"
                          />
                        ) : null
                      }
                    />
                  ) : null}
                  {step === 13 && baseline ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-400/[0.04] p-3">
                      <p className="font-mono text-[8px] uppercase tracking-[0.18em] text-emerald-700/70">
                        Before / after · measured in this simulation
                      </p>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                        <BeforeAfterCell label="Waiting" before={`${baseline.before.waitingSec.toFixed(0)}s`} after={`${baseline.after.waitingSec.toFixed(0)}s`} />
                        <BeforeAfterCell label="Efficiency" before={`${baseline.before.efficiency.toFixed(0)}%`} after={`${baseline.after.efficiency.toFixed(0)}%`} />
                        <BeforeAfterCell label="Avg speed" before={`${baseline.before.avgSpeed.toFixed(0)}`} after={`${baseline.after.avgSpeed.toFixed(0)}`} />
                      </div>
                      <Button size="sm" variant="primary" className="mt-3 w-full" onClick={handleAnalytics}>
                        <BarChart3 size={12} /> Open analytics dashboard
                      </Button>
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 hidden flex-1 overflow-hidden lg:block">
                  <p className="mb-1.5 font-mono text-[8px] uppercase tracking-[0.18em] text-slate-500">
                    Demonstration timeline
                  </p>
                  <div className="scroll-area max-h-[150px] space-y-1 overflow-y-auto pr-1">
                    {demoSteps.map((item, index) => (
                      <button
                        key={item.title}
                        type="button"
                        onClick={() => goTo(index)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[10px] transition",
                          index === step
                            ? "bg-blue-50 text-blue-700"
                            : index < step
                              ? "text-slate-500 hover:bg-blue-50 hover:text-slate-700"
                              : "text-slate-500 hover:bg-blue-50 hover:text-slate-600",
                        )}
                      >
                        <span
                          className={cn(
                            "grid h-4 w-4 shrink-0 place-items-center rounded-full border font-mono text-[7px]",
                            index < step
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : index === step
                                ? "border-blue-200 bg-blue-50 text-blue-700"
                                : "border-blue-100 text-slate-500",
                          )}
                        >
                          {index < step ? <Check size={8} /> : index + 1}
                        </span>
                        <span className="truncate">{item.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="relative p-3 sm:p-4">
                <NetworkMap
                  height="min(46vh, 390px)"
                  compact
                  showLabels={false}
                  showLegend={false}
                  showControls={false}
                  useGlobalRoute
                  useGlobalMst={false}
                  heatmap={step === 4}
                  className="w-full"
                />
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <MiniDetail label="Graph" value={`V ${getSimulator().network.nodes.length} · E ${getSimulator().network.edges.length}`} />
                  <MiniDetail label="Weather" value={useTrafficStore.getState().config.weather.toUpperCase()} />
                  <MiniDetail
                    label="Sig. mode"
                    value={useTrafficStore.getState().config.coordinatedSignals ? "GREEN WAVE" : useTrafficStore.getState().config.adaptiveSignals ? "ADAPTIVE" : "FIXED"}
                  />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-md border border-blue-200 bg-blue-500/[0.05] px-2 py-1 font-mono text-[8px] uppercase tracking-[0.12em] text-blue-700/70">
                    Emergency route highlighted
                  </span>
                  <span className="rounded-md border border-blue-100 bg-slate-50 px-2 py-1 font-mono text-[8px] uppercase tracking-[0.12em] text-slate-500">
                    All values simulated
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-blue-100 px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => goTo(0)} title="Restart demonstration">
                  <RotateCcw size={12} /> Reset
                </Button>
                <div className="hidden items-center gap-1.5 sm:flex">
                  {demoSteps.map((item, index) => (
                    <button
                      key={`dot-${item.title}`}
                      type="button"
                      onClick={() => goTo(index)}
                      className={cn(
                        "h-1.5 rounded-full transition-all",
                        index === step
                          ? "w-5 bg-blue-600 shadow-[0_0_8px_#2563eb]"
                          : index < step
                            ? "w-1.5 bg-emerald-400"
                            : "w-1.5 bg-slate-100",
                      )}
                      aria-label={`Go to step ${index + 1}`}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="secondary" onClick={() => goTo(step - 1)} disabled={step === 0}>
                  <ChevronLeft size={13} /> Prev
                </Button>
                <Button
                  size="sm"
                  variant={demo.playing ? "success" : "secondary"}
                  onClick={() => setDemoPlaying(!demo.playing)}
                >
                  {demo.playing ? <Pause size={12} /> : <Play size={12} />}
                  {demo.playing ? "Pause" : "Auto-play"}
                </Button>
                <Button size="sm" variant="primary" onClick={() => goTo(step + 1)} disabled={step === demoSteps.length - 1}>
                  Next <ChevronRight size={13} />
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function DemoStat({ label, value, tone = "text-slate-900" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-blue-100 bg-slate-50 px-2.5 py-2">
      <p className="font-mono text-[7.5px] uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className={cn("mt-0.5 font-mono text-[15px] font-semibold tabular-nums", tone)}>{value}</p>
    </div>
  );
}

function MiniDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-blue-100 bg-slate-50 px-2 py-1.5">
      <p className="font-mono text-[7px] uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-0.5 truncate font-mono text-[9.5px] text-slate-700">{value}</p>
    </div>
  );
}

function ResultCard({
  icon: Icon,
  title,
  tone,
  rows,
  footer,
}: {
  icon: typeof RouteIcon;
  title: string;
  tone: "cyan" | "green" | "red";
  rows: Array<[string, string]>;
  footer?: React.ReactNode;
}) {
  const tones = {
    cyan: "border-blue-200 bg-blue-500/[0.04] text-blue-700",
    green: "border-emerald-200 bg-emerald-400/[0.04] text-emerald-700",
    red: "border-rose-200 bg-rose-400/[0.04] text-rose-700",
  };
  return (
    <div className={cn("rounded-xl border p-3", tones[tone])}>
      <div className="flex items-center gap-1.5">
        <Icon size={12} />
        <p className="font-mono text-[8.5px] uppercase tracking-[0.16em]">{title}</p>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-2 text-[10px]">
            <span className="text-slate-500">{label}</span>
            <span className="truncate font-mono text-slate-800">{value}</span>
          </div>
        ))}
      </div>
      {footer}
    </div>
  );
}

function ComparisonCard({ comparison }: { comparison: Comparison | null }) {
  if (!comparison) {
    return (
      <div className="rounded-xl border border-blue-100 bg-slate-50 p-3 text-[10px] text-slate-500">
        Run Dijkstra and A* to generate the comparison.
      </div>
    );
  }
  const rows = [
    {
      name: "Dijkstra",
      color: "#2563eb",
      explored: comparison.dijkstra.explored,
      ms: comparison.dijkstra.executionMs,
      cost: comparison.dijkstra.totalCost,
      time: comparison.dijkstra.totalTimeMin,
    },
    {
      name: "A*",
      color: "#a3e635",
      explored: comparison.astar.explored,
      ms: comparison.astar.executionMs,
      cost: comparison.astar.totalCost,
      time: comparison.astar.totalTimeMin,
    },
  ];
  return (
    <div className="rounded-xl border border-violet-200 bg-violet-400/[0.04] p-3">
      <div className="flex items-center gap-1.5 text-violet-700">
        <Cpu size={12} />
        <p className="font-mono text-[8.5px] uppercase tracking-[0.16em]">Algorithm comparison · same query</p>
      </div>
      <div className="mt-2 overflow-hidden rounded-lg border border-blue-100">
        <table className="w-full text-left">
          <thead className="bg-slate-50 font-mono text-[7.5px] uppercase tracking-[0.12em] text-slate-500">
            <tr>
              <th className="px-2 py-1.5">Algo</th>
              <th className="px-2 py-1.5">Explored</th>
              <th className="px-2 py-1.5">Exec</th>
              <th className="px-2 py-1.5">Cost</th>
              <th className="px-2 py-1.5">Time</th>
            </tr>
          </thead>
          <tbody className="font-mono text-[9.5px] text-slate-700">
            {rows.map((row) => (
              <tr key={row.name} className="border-t border-blue-100">
                <td className="px-2 py-1.5" style={{ color: row.color }}>
                  {row.name}
                </td>
                <td className="px-2 py-1.5">{row.explored}</td>
                <td className="px-2 py-1.5">{row.ms.toFixed(2)} ms</td>
                <td className="px-2 py-1.5">{row.cost.toFixed(1)}</td>
                <td className="px-2 py-1.5">{row.time.toFixed(1)}m</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[9px] leading-relaxed text-slate-500">
        Both algorithms return the same optimal cost. A* typically expands fewer intersections by using the geographic
        heuristic.
      </p>
    </div>
  );
}

function BeforeAfterCell({ label, before, after }: { label: string; before: string; after: string }) {
  return (
    <div>
      <p className="font-mono text-[7px] uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <div className="mt-0.5 flex items-center justify-center gap-1 font-mono text-[10px]">
        <span className="text-slate-500">{before}</span>
        <ChevronRight size={8} className="text-slate-500" />
        <span className="text-emerald-700">{after}</span>
      </div>
    </div>
  );
}
