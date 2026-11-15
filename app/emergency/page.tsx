"use client";

import { useState } from "react";
import {
  Ambulance,
  Flame,
  MapPin,
  Radio,
  Route as RouteIcon,
  Shield,
  Siren,
  Timer,
  TrafficCone,
  TriangleAlert,
} from "lucide-react";
import { useTrafficStore } from "@/lib/store/traffic-store";
import type { FleetUnit } from "@/lib/sim/types";
import { formatEta, simClock } from "@/lib/format";
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
  Select,
  SimulationNote,
  StatCard,
} from "@/components/ui";

const TYPE_ICON = {
  ambulance: Ambulance,
  fire: Flame,
  police: Shield,
} as const;

export default function EmergencyPage() {
  const network = useTrafficStore((state) => state.network);
  const fleet = useTrafficStore((state) => state.fleet);
  const missions = useTrafficStore((state) => state.missions);
  const signals = useTrafficStore((state) => state.signals);
  const logs = useTrafficStore((state) => state.logs);
  const metrics = useTrafficStore((state) => state.metrics);
  const dispatchEmergency = useTrafficStore((state) => state.dispatchEmergency);
  const recallMission = useTrafficStore((state) => state.recallMission);
  const [fleetId, setFleetId] = useState(fleet.find((unit) => unit.status === "idle")?.id ?? fleet[0]?.id ?? "");
  const [destination, setDestination] = useState("J30");

  const active = missions.filter((mission) => mission.status === "enroute");
  const idle = fleet.filter((unit) => unit.status === "idle");
  const preemptedSignals = Object.values(signals).filter((signal) => signal.mode === "preempted").length;
  const avgResponse =
    missions.filter((mission) => mission.responseSec).reduce((sum, mission) => sum + (mission.responseSec ?? 0), 0) /
    Math.max(1, missions.filter((mission) => mission.responseSec).length);
  const emergencyLogs = logs.filter((log) => log.kind === "emergency").slice(0, 10);
  const nodeName = (id: string) => network.nodes.find((node) => node.id === id)?.name ?? id;
  const activeFleet = fleet.find((unit) => unit.id === fleetId);

  function dispatch() {
    if (!fleetId) return;
    dispatchEmergency(fleetId, destination);
    const nextIdle = fleet.find((unit) => unit.status === "idle" && unit.id !== fleetId);
    if (nextIdle) setFleetId(nextIdle.id);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Priority Corridors"
        title="Emergency management"
        description="Dispatch simulated ambulances, fire engines and police units with priority routing. Signals along the corridor are preempted to green and restored to adaptive control after the vehicle passes."
        actions={
          <>
            <Badge tone={active.length ? "red" : "green"} dot>
              {active.length ? `${active.length} active mission${active.length === 1 ? "" : "s"}` : "Fleet idle"}
            </Badge>
            <Button size="sm" variant="danger" onClick={dispatch} disabled={!idle.length}>
              <Siren size={12} /> Dispatch unit
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Active missions" value={active.length} icon={Siren} accent="#fb7185" hint={`${missions.length} total logged`} />
        <StatCard label="Fleet available" value={`${idle.length}/${fleet.length}`} icon={Ambulance} accent="#34d399" hint="Idle response units" delay={1} />
        <StatCard label="Preempted signals" value={preemptedSignals} icon={TrafficCone} accent="#fbbf24" hint="Forced green phases" delay={2} />
        <StatCard label="Emergency vehicles" value={metrics.emergencyVehicles} icon={RouteIcon} accent="#a78bfa" hint="In the network now" delay={3} />
        <StatCard label="Avg response" value={Number.isFinite(avgResponse) ? avgResponse.toFixed(0) : "—"} unit="s" icon={Timer} accent="#2563eb" hint="Completed simulated calls" delay={4} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100 px-4 py-3">
            <SectionHeader eyebrow="Priority overlay" title="Emergency corridor map" className="flex-1" />
            <div className="flex items-center gap-1.5">
              <Badge tone="red" dot>
                {active.length} enroute
              </Badge>
              <Badge tone="cyan">Signals preempted</Badge>
            </div>
          </div>
          <NetworkMap height="clamp(380px, 54vh, 620px)" />
          <div className="grid gap-2 border-t border-blue-100 px-4 py-3 sm:grid-cols-3">
            <Mini label="Priority route" value={`${active.reduce((sum, mission) => sum + mission.routeEdges.length, 0)} segments`} />
            <Mini label="Intersections cleared" value={String(active.reduce((sum, mission) => sum + mission.preemptedNodes.length, 0))} />
            <Mini label="Average ETA" value={active.length ? formatEta(active.reduce((sum, mission) => sum + mission.etaSec, 0) / active.length) : "—"} />
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <SectionHeader eyebrow="Dispatch" title="Create priority mission" />
            <div className="mt-3 space-y-3">
              <Field label="Available unit">
                <Select value={fleetId} onChange={(event) => setFleetId(event.target.value)} disabled={!idle.length}>
                  {fleet.map((unit) => (
                    <option key={unit.id} value={unit.id} disabled={unit.status === "enroute"}>
                      {unit.label} · {unit.callsign} {unit.status === "enroute" ? "(enroute)" : ""}
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
              {activeFleet ? (
                <div className="rounded-lg border border-blue-100 bg-slate-50 px-3 py-2 text-[10px]">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Origin base</span>
                    <span className="font-mono text-slate-700">
                      {activeFleet.baseNode} · {nodeName(activeFleet.baseNode)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-slate-500">Status</span>
                    <span className={activeFleet.status === "idle" ? "text-emerald-700" : "text-rose-700"}>
                      {activeFleet.status}
                    </span>
                  </div>
                </div>
              ) : null}
              <Button variant="danger" className="w-full" onClick={dispatch} disabled={!idle.length}>
                <Siren size={13} /> Dispatch with priority corridor
              </Button>
              <p className="text-[9.5px] leading-relaxed text-slate-500">
                The fastest available route is computed with Dijkstra using emergency weights. All signals on the route
                are forced green while the unit approaches.
              </p>
            </div>
          </Card>

          <Card className="p-4">
            <SectionHeader eyebrow="Response fleet" title="Units" actions={<Badge tone="slate">{fleet.length}</Badge>} />
            <div className="mt-3 space-y-2">
              {fleet.map((unit) => {
                const Icon = TYPE_ICON[unit.type] ?? Ambulance;
                return (
                  <button
                    key={unit.id}
                    type="button"
                    onClick={() => unit.status === "idle" && setFleetId(unit.id)}
                    className="flex w-full items-center gap-2.5 rounded-lg border border-blue-100 bg-slate-50 px-2.5 py-2 text-left transition hover:border-blue-200"
                  >
                    <span className="grid h-7 w-7 place-items-center rounded-md border border-blue-100 bg-slate-50 text-slate-600">
                      <Icon size={13} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[10.5px] text-slate-700">{unit.label}</p>
                      <p className="font-mono text-[8px] text-slate-500">
                        {unit.callsign} · base {unit.baseNode}
                      </p>
                    </div>
                    <Badge tone={unit.status === "idle" ? "green" : "red"}>{unit.status}</Badge>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card className="p-4">
          <SectionHeader
            eyebrow="Mission log"
            title="Emergency responses"
            actions={<Badge tone={active.length ? "red" : "slate"}>{active.length} active</Badge>}
          />
          <div className="mt-3 space-y-2">
            {missions.length === 0 ? (
              <EmptyState
                icon={Siren}
                title="No missions dispatched"
                description="Select an idle unit and a destination to create the first simulated priority corridor."
              />
            ) : (
              missions.slice(0, 8).map((mission) => {
                const Icon = TYPE_ICON[mission.type] ?? Ambulance;
                return (
                  <div
                    key={mission.id}
                    className={`rounded-xl border px-3 py-2.5 ${
                      mission.status === "enroute"
                        ? "border-rose-200 bg-rose-400/[0.04]"
                        : "border-blue-100 bg-slate-50"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="grid h-6 w-6 place-items-center rounded-md border border-blue-100 bg-slate-50 text-rose-700">
                        <Icon size={12} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-medium text-slate-800">
                          {mission.label} <span className="font-mono text-[9px] text-slate-500">· {mission.id}</span>
                        </p>
                        <p className="font-mono text-[8.5px] text-slate-500">
                          {mission.origin} → {mission.destination} · {mission.routeEdges.length} segments ·{" "}
                          {mission.preemptedNodes.length} signals
                        </p>
                      </div>
                      <Badge tone={mission.status === "enroute" ? "red" : "green"}>{mission.status}</Badge>
                      {mission.status === "enroute" ? (
                        <Button size="sm" variant="ghost" onClick={() => recallMission(mission.id)}>
                          Recall
                        </Button>
                      ) : null}
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <Progress
                        value={mission.progress * 100}
                        color={mission.status === "enroute" ? "#fb7185" : "#34d399"}
                        height={4}
                        className="flex-1"
                      />
                      <span className="font-mono text-[9px] text-slate-500">
                        {mission.status === "enroute" ? `ETA ${formatEta(mission.etaSec)}` : `${mission.progress * 100}%`}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-[8px] text-slate-500">
                      <span>dispatched {simClock(mission.startedAt)}</span>
                      <span>baseline {mission.baselineTimeMin.toFixed(1)} min</span>
                      <span className="text-emerald-700/70">priority {mission.estimatedTimeMin.toFixed(1)} min</span>
                      {mission.responseSec ? <span>response {mission.responseSec}s</span> : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <SectionHeader eyebrow="Preemption" title="How priority works" />
            <ol className="mt-3 space-y-2 text-[10px] leading-relaxed text-slate-500">
              <li className="flex gap-2">
                <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full border border-rose-200 bg-rose-50 font-mono text-[7px] text-rose-700">1</span>
                Emergency weight context is built with a higher congestion penalty and incident avoidance.
              </li>
              <li className="flex gap-2">
                <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full border border-rose-200 bg-rose-50 font-mono text-[7px] text-rose-700">2</span>
                Dijkstra returns the fastest available corridor from the unit&apos;s base intersection.
              </li>
              <li className="flex gap-2">
                <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full border border-rose-200 bg-rose-50 font-mono text-[7px] text-rose-700">3</span>
                Signals on the route switch to preempted green and restore their adaptive plan after the pass.
              </li>
              <li className="flex gap-2">
                <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full border border-rose-200 bg-rose-50 font-mono text-[7px] text-rose-700">4</span>
                On arrival the mission is marked complete, the unit returns to idle, and response time is recorded.
              </li>
            </ol>
          </Card>

          <Card className="p-4">
            <SectionHeader eyebrow="Radio log" title="Emergency events" />
            <div className="scroll-area mt-3 max-h-[190px] space-y-1.5 overflow-y-auto pr-1">
              {emergencyLogs.length === 0 ? (
                <p className="text-[10px] text-slate-500">No emergency events yet.</p>
              ) : (
                emergencyLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-2 text-[10px]">
                    <Radio size={10} className="mt-0.5 shrink-0 text-rose-700/70" />
                    <div className="min-w-0">
                      <p className="text-slate-600">{log.message}</p>
                      <p className="font-mono text-[8px] text-slate-500">{simClock(log.simSec)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <SimulationNote />
        </div>
      </div>

      <div className="grid gap-2 text-[9px] text-slate-500 sm:grid-cols-3">
        <span className="flex items-center gap-1.5">
          <MapPin size={10} /> Destination {destination} · {nodeName(destination)}
        </span>
        <span className="flex items-center gap-1.5">
          <TriangleAlert size={10} /> All missions are simulated; no emergency services are contacted.
        </span>
        <span className="flex items-center gap-1.5">
          <Radio size={10} /> {preemptedSignals} signal controllers currently preempted
        </span>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-blue-100 bg-slate-50 px-2 py-1.5">
      <p className="font-mono text-[7.5px] uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-0.5 truncate font-mono text-[9.5px] text-slate-700">{value}</p>
    </div>
  );
}
