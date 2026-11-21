"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  AlarmClock,
  Bus,
  Gauge,
  Hand,
  Radio,
  Timer,
  TrafficCone,
  Waves,
} from "lucide-react";
import { useTrafficStore } from "@/lib/store/traffic-store";
import { cn } from "@/lib/format";
import { NetworkMap } from "@/components/network-map";
import {
  Badge,
  Button,
  Card,
  PageHeader,
  Progress,
  SectionHeader,
  Segmented,
  SimulationNote,
  Slider,
  StatCard,
  Toggle,
} from "@/components/ui";

type Plan = "fixed" | "adaptive" | "coordinated";

export default function SignalsPage() {
  const network = useTrafficStore((state) => state.network);
  const signals = useTrafficStore((state) => state.signals);
  const config = useTrafficStore((state) => state.config);
  const metrics = useTrafficStore((state) => state.metrics);
  const selectedNode = useTrafficStore((state) => state.selectedNode);
  const setSelectedNode = useTrafficStore((state) => state.setSelectedNode);
  const setAdaptiveSignals = useTrafficStore((state) => state.setAdaptiveSignals);
  const setCoordinatedSignals = useTrafficStore((state) => state.setCoordinatedSignals);
  const setPublicTransportPriority = useTrafficStore((state) => state.setPublicTransportPriority);
  const setTiming = useTrafficStore((state) => state.setTiming);
  const requestPedestrian = useTrafficStore((state) => state.requestPedestrian);
  const [focus, setFocus] = useState<"queue" | "density">("queue");

  const plan: Plan = config.coordinatedSignals ? "coordinated" : config.adaptiveSignals ? "adaptive" : "fixed";
  const list = useMemo(() => {
    const items = Object.values(signals);
    return items.sort((a, b) => (focus === "queue" ? b.queue - a.queue : b.incomingDensity - a.incomingDensity));
  }, [signals, focus]);

  const preempted = list.filter((signal) => signal.mode === "preempted").length;
  const pedestrianCount = list.filter((signal) => signal.mode === "pedestrian").length;
  const avgQueue = list.reduce((sum, signal) => sum + signal.queue, 0) / Math.max(1, list.length);
  const activeGreen = list.filter((signal) => signal.phase === "GREEN").length;
  const nodeName = (id: string) => network.nodes.find((node) => node.id === id)?.name ?? id;
  const selectedSignal = selectedNode ? signals[selectedNode] : null;

  function applyPlan(next: Plan) {
    if (next === "fixed") {
      setCoordinatedSignals(false);
      setAdaptiveSignals(false);
    } else if (next === "adaptive") {
      setCoordinatedSignals(false);
      setAdaptiveSignals(true);
    } else {
      setAdaptiveSignals(false);
      setCoordinatedSignals(true);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Adaptive Control"
        title="Signal management"
        description="Signal timings respond to incoming simulated density, corridor coordination phases adjacent junctions into a green wave, and emergency corridors temporarily preempt local plans."
        actions={
          <Segmented
            value={plan}
            onChange={applyPlan}
            options={[
              { value: "fixed", label: "Fixed" },
              { value: "adaptive", label: "Adaptive" },
              { value: "coordinated", label: "Green wave" },
            ]}
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Active signals" value={metrics.activeSignals} icon={TrafficCone} accent="#2563eb" hint="Signalised intersections" />
        <StatCard label="Green phase" value={activeGreen} unit={`/ ${list.length}`} icon={Activity} accent="#34d399" hint="Currently serving traffic" delay={1} />
        <StatCard label="Average queue" value={avgQueue.toFixed(1)} unit="veh" icon={AlarmClock} accent="#fbbf24" hint="Across all approaches" delay={2} />
        <StatCard label="Preempted" value={preempted} icon={Waves} accent="#fb7185" hint="Emergency priority active" delay={3} />
        <StatCard label="Pedestrian" value={pedestrianCount} icon={Hand} accent="#a78bfa" hint="Crossing phase requested" delay={4} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100 px-4 py-3">
            <SectionHeader eyebrow="Signal network" title="Intersection control map" className="flex-1" />
            <Badge tone={plan === "coordinated" ? "green" : plan === "adaptive" ? "cyan" : "slate"}>
              {plan === "coordinated" ? "Green wave" : plan === "adaptive" ? "Adaptive" : "Fixed cycle"}
            </Badge>
          </div>
          <NetworkMap
            height="clamp(360px, 52vh, 580px)"
            onNodeClick={(nodeId) => setSelectedNode(nodeId)}
            showVehicleLayer={false}
          />
          {selectedSignal ? (
            <div className="border-t border-blue-100 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-sans text-[8px] uppercase tracking-[0.16em] text-blue-700/60">Selected signal</p>
                  <p className="text-[12px] font-medium text-slate-900">
                    {selectedSignal.nodeId} · {nodeName(selectedSignal.nodeId)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={selectedSignal.mode === "preempted" ? "red" : selectedSignal.mode === "pedestrian" ? "violet" : "cyan"}>
                    {selectedSignal.mode}
                  </Badge>
                  <Button size="sm" variant="secondary" onClick={() => requestPedestrian(selectedSignal.nodeId)}>
                    <Hand size={11} /> Pedestrian
                  </Button>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                <SignalStat label="Phase" value={selectedSignal.phase} />
                <SignalStat label="Remaining" value={`${selectedSignal.remaining}s`} />
                <SignalStat label="Green" value={`${selectedSignal.greenDuration}s`} />
                <SignalStat label="Queue" value={selectedSignal.queue} />
                <SignalStat label="Density" value={`${(selectedSignal.incomingDensity * 100).toFixed(0)}%`} />
              </div>
            </div>
          ) : (
            <div className="border-t border-blue-100 px-4 py-2.5 text-center font-sans text-[9px] text-slate-500">
              Select an intersection on the map to open its signal controller
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <SectionHeader eyebrow="Controller" title="Adaptive settings" />
            <div className="mt-3 space-y-3">
              <Toggle
                checked={config.adaptiveSignals}
                onChange={setAdaptiveSignals}
                label="Demand-responsive timing"
                description="Green time scales with incoming density (20–60 s)."
              />
              <Toggle
                checked={config.coordinatedSignals}
                onChange={setCoordinatedSignals}
                label="Corridor coordination"
                description="Offsets adjacent signals into a green wave."
              />
              <Toggle
                checked={config.publicTransportPriority}
                onChange={setPublicTransportPriority}
                label="Public transport priority"
                description="Buses receive extended green on their corridor."
              />
            </div>
            {config.publicTransportPriority ? (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-400/[0.04] px-2.5 py-2 text-[10px] text-amber-700/70">
                <Bus size={12} /> Transit priority bias is applied to simulated bus routes.
              </div>
            ) : null}
          </Card>

          <Card className="p-4">
            <SectionHeader
              eyebrow="Green-time table"
              title="Density thresholds"
              actions={<Badge tone="cyan">seconds</Badge>}
            />
            <div className="mt-3 space-y-3">
              <Slider label="Low density" value={config.timing.low} min={10} max={40} onChange={(value) => setTiming({ low: value })} display={`${config.timing.low}s`} />
              <Slider label="Moderate" value={config.timing.moderate} min={15} max={50} onChange={(value) => setTiming({ moderate: value })} display={`${config.timing.moderate}s`} />
              <Slider label="Heavy" value={config.timing.heavy} min={20} max={60} onChange={(value) => setTiming({ heavy: value })} display={`${config.timing.heavy}s`} />
              <Slider label="Very heavy" value={config.timing.veryHeavy} min={25} max={75} onChange={(value) => setTiming({ veryHeavy: value })} display={`${config.timing.veryHeavy}s`} />
              <Slider label="Yellow interval" value={config.timing.yellow} min={2} max={8} onChange={(value) => setTiming({ yellow: value })} display={`${config.timing.yellow}s`} />
            </div>
          </Card>

          <SimulationNote />
        </div>
      </div>

      <Card className="p-4">
        <SectionHeader
          eyebrow="Intersection registry"
          title="Live signal controller states"
          subtitle="Queue length is the simulated number of vehicles waiting at an approach. Mode shows which control policy currently owns the phase."
          actions={
            <Segmented
              size="xs"
              value={focus}
              onChange={setFocus}
              options={[
                { value: "queue", label: "Queue" },
                { value: "density", label: "Density" },
              ]}
            />
          }
        />
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((signal) => (
            <button
              key={signal.nodeId}
              type="button"
              onClick={() => setSelectedNode(signal.nodeId)}
              className={cn(
                "rounded-xl border p-3 text-left transition",
                selectedNode === signal.nodeId
                  ? "border-blue-200 bg-blue-500/[0.05]"
                  : "border-blue-100 bg-slate-50 hover:border-blue-200 hover:bg-blue-50",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      signal.phase === "GREEN"
                        ? "bg-emerald-400 shadow-[0_0_8px_#34d399]"
                        : signal.phase === "YELLOW"
                          ? "bg-amber-400 shadow-[0_0_8px_#fbbf24]"
                          : "bg-rose-400 shadow-[0_0_8px_#fb7185]",
                    )}
                  />
                  <span className="font-sans text-[9px] text-blue-700/80">{signal.nodeId}</span>
                  <span className="truncate text-[10.5px] text-slate-700">{nodeName(signal.nodeId)}</span>
                </div>
                <span className="font-sans text-[9px] text-slate-500">{signal.remaining}s</span>
              </div>
              <div className="mt-2 grid grid-cols-4 gap-1.5 text-center">
                <MiniStat label="Phase" value={signal.phase.slice(0, 1)} tone={signal.phase === "GREEN" ? "text-emerald-700" : signal.phase === "YELLOW" ? "text-amber-700" : "text-rose-700"} />
                <MiniStat label="Queue" value={signal.queue} />
                <MiniStat label="Green" value={`${signal.greenDuration}s`} />
                <MiniStat label="Mode" value={signal.mode.slice(0, 4)} />
              </div>
              <div className="mt-2">
                <Progress
                  value={(signal.remaining / Math.max(1, signal.phase === "GREEN" ? signal.greenDuration : signal.redDuration)) * 100}
                  color={signal.phase === "GREEN" ? "#34d399" : signal.phase === "YELLOW" ? "#fbbf24" : "#fb7185"}
                  height={3}
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between font-sans text-[7.5px] uppercase tracking-[0.1em] text-slate-500">
                <span>cycle {signal.cycle}s</span>
                <span>offset {signal.offset}s</span>
              </div>
            </button>
          ))}
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="flex items-start gap-2 p-3 text-[10px] leading-relaxed text-slate-500">
          <Radio size={14} className="mt-0.5 shrink-0 text-blue-700/70" />
          Signal phases are advanced by the local simulation clock. No real controllers or city infrastructure are
          connected.
        </Card>
        <Card className="flex items-start gap-2 p-3 text-[10px] leading-relaxed text-slate-500">
          <Timer size={14} className="mt-0.5 shrink-0 text-amber-700/70" />
          Green durations are bounded between 20 and 60 seconds in adaptive mode; fixed mode uses the configured table.
        </Card>
        <Card className="flex items-start gap-2 p-3 text-[10px] leading-relaxed text-slate-500">
          <Gauge size={14} className="mt-0.5 shrink-0 text-emerald-700/70" />
          Signal efficiency reports the share of phase time that served at least one queued simulated vehicle.
        </Card>
      </div>
    </div>
  );
}

function SignalStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-blue-100 bg-slate-50 px-2 py-1.5">
      <p className="font-sans text-[7.5px] uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-0.5 font-sans text-[10px] text-slate-700">{value}</p>
    </div>
  );
}

function MiniStat({ label, value, tone = "text-slate-700" }: { label: string; value: string | number; tone?: string }) {
  return (
    <div>
      <p className="font-sans text-[7px] uppercase tracking-[0.1em] text-slate-500">{label}</p>
      <p className={cn("font-sans text-[9.5px]", tone)}>{value}</p>
    </div>
  );
}

