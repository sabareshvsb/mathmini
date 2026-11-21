"use client";

import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  Car,
  Clock,
  Gauge,
  Pause,
  Play,
  Route as RouteIcon,
  Siren,
  Sparkles,
  TrafficCone,
  TrendingUp,
  Waypoints,
} from "lucide-react";
import { useTrafficStore } from "@/lib/store/traffic-store";
import { VEHICLE_META, formatNumber, simClock } from "@/lib/format";
import { NetworkMap } from "@/components/network-map";
import { BarChart, Donut, Gauge as GaugeChart, LineChart } from "@/components/charts";
import {
  Badge,
  Button,
  Card,
  PageHeader,
  Progress,
  SectionHeader,
  SimulationNote,
  StatCard,
  StatusDot,
} from "@/components/ui";

export default function OverviewPage() {
  const metrics = useTrafficStore((state) => state.metrics);
  const network = useTrafficStore((state) => state.network);
  const history = useTrafficStore((state) => state.history);
  const logs = useTrafficStore((state) => state.logs);
  const incidents = useTrafficStore((state) => state.incidents);
  const missions = useTrafficStore((state) => state.missions);
  const signals = useTrafficStore((state) => state.signals);
  const analytics = useTrafficStore((state) => state.analytics);
  const config = useTrafficStore((state) => state.config);
  const running = useTrafficStore((state) => state.running);
  const simTime = useTrafficStore((state) => state.simTime);
  const toggle = useTrafficStore((state) => state.toggle);
  const openDemo = useTrafficStore((state) => state.openDemo);
  const start = useTrafficStore((state) => state.start);

  const activeMissions = missions.filter((mission) => mission.status === "enroute");
  const activeIncidents = incidents.filter((incident) => incident.active);
  const recentHistory = history.slice(-46);
  const labels = recentHistory.map((point) => simClock(point.wallTime / 1000).slice(0, 5));
  const signalList = Object.values(signals)
    .sort((a, b) => b.queue - a.queue)
    .slice(0, 5);
  const utilization = [...analytics.roadUtilization].sort((a, b) => b.utilizationPct - a.utilizationPct).slice(0, 6);
  const congestionData = [
    { label: "Low", value: metrics.congestionDistribution.low, color: "#34d399" },
    { label: "Moderate", value: metrics.congestionDistribution.moderate, color: "#fbbf24" },
    { label: "Heavy", value: metrics.congestionDistribution.heavy, color: "#fb923c" },
    { label: "Severe", value: metrics.congestionDistribution.severe, color: "#f87171" },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Bengaluru Command Center"
        title="Live city traffic overview"
        description="A single operational picture of the simulated road network: vehicle flow, congestion, adaptive signals and emergency corridors, all driven by graph algorithms running locally."
        actions={
          <>
            <Button size="sm" variant="outline" onClick={openDemo}>
              <Sparkles size={12} /> Guided demo
            </Button>
            <Button size="sm" variant={running ? "success" : "primary"} onClick={running ? toggle : start}>
              {running ? <Pause size={12} /> : <Play size={12} />}
              {running ? "Pause engine" : "Start engine"}
            </Button>
          </>
        }
      >
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center gap-2.5 rounded-lg border border-blue-100 bg-slate-50 px-3 py-2">
            <StatusDot tone={running ? "green" : "amber"} />
            <div>
              <p className="font-sans text-[8px] uppercase tracking-[0.16em] text-slate-500">Engine</p>
              <p className="text-[11px] text-slate-700">
                {running ? "Streaming live simulation" : "Simulation paused"}
              </p>
            </div>
            <span className="ml-auto font-sans text-[10px] text-blue-700">{simClock(simTime)}</span>
          </div>
          <div className="flex items-center gap-2.5 rounded-lg border border-blue-100 bg-slate-50 px-3 py-2">
            <TrafficCone size={14} className="text-blue-700/70" />
            <div>
              <p className="font-sans text-[8px] uppercase tracking-[0.16em] text-slate-500">Signal plan</p>
              <p className="text-[11px] text-slate-700">
                {config.coordinatedSignals ? "Coordinated green wave" : config.adaptiveSignals ? "Adaptive demand" : "Fixed cycle"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-lg border border-blue-100 bg-slate-50 px-3 py-2">
            <Activity size={14} className="text-emerald-700/70" />
            <div>
              <p className="font-sans text-[8px] uppercase tracking-[0.16em] text-slate-500">Weather model</p>
              <p className="text-[11px] capitalize text-slate-700">{config.weather} conditions</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-lg border border-blue-100 bg-slate-50 px-3 py-2">
            <Siren size={14} className="text-rose-700/70" />
            <div>
              <p className="font-sans text-[8px] uppercase tracking-[0.16em] text-slate-500">Priority missions</p>
              <p className="text-[11px] text-slate-700">{activeMissions.length} active corridor{activeMissions.length === 1 ? "" : "s"}</p>
            </div>
          </div>
        </div>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Active vehicles"
          value={formatNumber(metrics.activeVehicles)}
          unit="units"
          icon={Car}
          accent="#2563eb"
          hint={`${metrics.completedTrips} trips completed`}
          trend={<span className="text-blue-700">{metrics.vehiclesPerType.car} cars</span>}
        />
        <StatCard
          label="Flow efficiency"
          value={metrics.flowEfficiency.toFixed(0)}
          unit="%"
          icon={Gauge}
          accent="#34d399"
          hint="Network-wide simulated throughput"
          delay={1}
        />
        <StatCard
          label="Average speed"
          value={metrics.avgSpeedKmh.toFixed(0)}
          unit="km/h"
          icon={TrendingUp}
          accent="#a78bfa"
          hint={`Throughput ${metrics.throughputPerHour}/h`}
          delay={2}
        />
        <StatCard
          label="Congested roads"
          value={metrics.congestedRoads}
          unit={`/ ${metrics.totalRoads}`}
          icon={TrafficCone}
          accent="#fb923c"
          hint={`${metrics.blockedRoads} blocked segments`}
          delay={3}
        />
        <StatCard
          label="Emergency units"
          value={metrics.emergencyVehicles}
          unit="active"
          icon={Siren}
          accent="#fb7185"
          hint={`${missions.length} missions logged`}
          delay={4}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.65fr_1fr]">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100 px-4 py-3">
            <SectionHeader eyebrow="Real-time simulation" title="Network operations map" className="flex-1" />
            <div className="flex items-center gap-1.5">
              <Badge tone="cyan" dot>
                Live graph
              </Badge>
              <Link href="/map">
                <Button size="sm" variant="ghost">
                  Open full map <ArrowUpRight size={12} />
                </Button>
              </Link>
            </div>
          </div>
          <NetworkMap height="clamp(320px, 48vh, 540px)" useGlobalRoute />
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <SectionHeader
              eyebrow="Congestion index"
              title="Road state distribution"
              actions={<Badge tone={metrics.flowEfficiency > 65 ? "green" : "amber"}>{metrics.flowEfficiency > 65 ? "Healthy" : "Elevated"}</Badge>}
            />
            <div className="mt-3">
              <Donut
                data={congestionData}
                centerLabel="roads"
                centerValue={String(metrics.totalRoads)}
                size={138}
                thickness={15}
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-blue-100 bg-slate-50 px-2.5 py-2">
                <p className="font-sans text-[8px] uppercase tracking-[0.14em] text-slate-500">Avg waiting</p>
                <p className="mt-0.5 font-sans text-sm text-slate-800">{metrics.avgWaitingSec.toFixed(0)}s</p>
              </div>
              <div className="rounded-lg border border-blue-100 bg-slate-50 px-2.5 py-2">
                <p className="font-sans text-[8px] uppercase tracking-[0.14em] text-slate-500">Signal state</p>
                <p className="mt-0.5 font-sans text-sm text-emerald-700">{metrics.signalEfficiency}%</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <SectionHeader eyebrow="Adaptive control" title="Signal queue hotspots" />
            <div className="mt-3 space-y-2.5">
              {signalList.map((signal) => {
                const node = network.nodes.find((entry) => entry.id === signal.nodeId);
                return (
                  <div key={signal.nodeId}>
                    <div className="flex items-center justify-between gap-2 text-[10.5px]">
                      <span className="min-w-0 truncate text-slate-700">
                        <span className="font-sans text-slate-500">{signal.nodeId}</span> {node?.name ?? "Intersection"}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5 font-sans">
                        <span
                          className={
                            signal.phase === "GREEN"
                              ? "text-emerald-700"
                              : signal.phase === "YELLOW"
                                ? "text-amber-700"
                                : "text-rose-700"
                          }
                        >
                          {signal.phase}
                        </span>
                        <span className="text-slate-500">{signal.remaining}s</span>
                      </span>
                    </div>
                    <Progress
                      value={(signal.queue / Math.max(1, metrics.activeVehicles * 0.35)) * 100}
                      color={signal.queue > 14 ? "#fb923c" : "#2563eb"}
                      height={4}
                      className="mt-1"
                    />
                  </div>
                );
              })}
            </div>
            <Link href="/signals" className="mt-3 block">
              <Button size="sm" variant="ghost" className="w-full">
                Open signal management <ArrowUpRight size={12} />
              </Button>
            </Link>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <SectionHeader
            eyebrow="Simulated telemetry"
            title="Network flow trend"
            subtitle="Rolling samples from the local simulation engine — congestion index and average speed over recent simulated minutes."
            actions={<Badge tone="violet">{recentHistory.length} samples</Badge>}
          />
          <LineChart
            className="mt-3"
            height={200}
            labels={labels}
            series={[
              {
                name: "Avg speed (km/h)",
                color: "#2563eb",
                values: recentHistory.map((point) => point.avgSpeedKmh),
                fill: true,
              },
              {
                name: "Congestion index",
                color: "#fb923c",
                values: recentHistory.map((point) => point.congestion),
              },
            ]}
            min={0}
            unit="simulated"
          />
        </Card>

        <Card className="p-4">
          <SectionHeader eyebrow="Fleet mix" title="Vehicles in network" />
          <div className="mt-3 grid grid-cols-2 gap-2">
            {Object.entries(metrics.vehiclesPerType).map(([type, value]) => {
              const meta = VEHICLE_META[type as keyof typeof VEHICLE_META];
              return (
                <div key={type} className="rounded-lg border border-blue-100 bg-slate-50 px-2.5 py-2">
                  <p className="flex items-center gap-1.5 font-sans text-[8px] uppercase tracking-[0.12em] text-slate-500">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
                    {meta.label}
                  </p>
                  <p className="mt-0.5 font-sans text-sm text-slate-800">{value}</p>
                </div>
              );
            })}
          </div>
          <div className="mt-3">
            <BarChart
              labels={analytics.hourlyVolume.map((_, index) => `${index}`)}
              values={analytics.hourlyVolume}
              height={96}
              color="#a78bfa"
              highlightIndex={new Date().getHours()}
            />
            <p className="mt-1 text-center font-sans text-[8px] uppercase tracking-[0.14em] text-slate-500">
              Simulated 24-hour volume profile
            </p>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-4">
          <SectionHeader
            eyebrow="Operations"
            title="Active incidents"
            actions={<Badge tone={activeIncidents.length ? "red" : "green"}>{activeIncidents.length} active</Badge>}
          />
          <div className="mt-3 space-y-2">
            {activeIncidents.length === 0 ? (
              <p className="rounded-lg border border-dashed border-blue-100 px-3 py-6 text-center text-[11px] text-slate-500">
                No simulated incidents on the network.
              </p>
            ) : (
              activeIncidents.slice(0, 4).map((incident) => (
                <div key={incident.id} className="rounded-lg border border-rose-200 bg-rose-400/[0.04] px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-medium text-rose-700">{incident.note}</p>
                    <Badge tone="red">{incident.kind}</Badge>
                  </div>
                  <p className="mt-0.5 font-sans text-[9px] text-slate-500">
                    {incident.edgeId} · started {simClock(incident.startedAt)}
                  </p>
                </div>
              ))
            )}
          </div>
          <Link href="/simulation" className="mt-3 block">
            <Button size="sm" variant="ghost" className="w-full">
              Simulation controls <ArrowUpRight size={12} />
            </Button>
          </Link>
        </Card>

        <Card className="p-4">
          <SectionHeader
            eyebrow="Priority corridors"
            title="Emergency missions"
            actions={<Badge tone={activeMissions.length ? "red" : "slate"}>{activeMissions.length} enroute</Badge>}
          />
          <div className="mt-3 space-y-2">
            {activeMissions.length === 0 ? (
              <p className="rounded-lg border border-dashed border-blue-100 px-3 py-6 text-center text-[11px] text-slate-500">
                Fleet idle. Dispatch from the emergency console.
              </p>
            ) : (
              activeMissions.slice(0, 3).map((mission) => (
                <div key={mission.id} className="rounded-lg border border-blue-100 bg-slate-50 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[11px] font-medium text-slate-800">{mission.label}</p>
                    <span className="font-sans text-[9px] text-rose-700">{Math.round(mission.progress * 100)}%</span>
                  </div>
                  <p className="font-sans text-[9px] text-slate-500">
                    {mission.origin} → {mission.destination} · ETA {Math.max(0, Math.round(mission.etaSec / 60))} min
                  </p>
                  <Progress value={mission.progress * 100} color="#fb7185" height={4} className="mt-1.5" />
                </div>
              ))
            )}
          </div>
          <Link href="/emergency" className="mt-3 block">
            <Button size="sm" variant="ghost" className="w-full">
              Emergency console <ArrowUpRight size={12} />
            </Button>
          </Link>
        </Card>

        <Card className="p-4">
          <SectionHeader
            eyebrow="Event stream"
            title="Operations log"
            actions={<span className="font-sans text-[9px] text-slate-500">{logs.length} events</span>}
          />
          <div className="scroll-area mt-3 max-h-[196px] space-y-1.5 overflow-y-auto pr-1">
            {logs.slice(0, 10).map((log) => (
              <div key={log.id} className="flex items-start gap-2 text-[10px]">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: log.severity === "critical" ? "#fb7185" : log.severity === "warning" ? "#fbbf24" : log.severity === "success" ? "#34d399" : "#2563eb" }} />
                <div className="min-w-0">
                  <p className="text-slate-600">{log.message}</p>
                  <p className="font-sans text-[8px] text-slate-500">
                    {simClock(log.simSec)} · {log.kind}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-4">
          <SectionHeader
            eyebrow="Graph analytics"
            title="Most utilised corridors"
            subtitle="Average simulated density per road segment, derived from the current graph state."
            actions={
              <Link href="/analytics">
                <Button size="sm" variant="ghost">
                  Analytics <ArrowUpRight size={12} />
                </Button>
              </Link>
            }
          />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {utilization.map((road) => (
              <div key={road.edgeId}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate text-[11px] text-slate-700">{road.name}</span>
                  <span className="font-sans text-[10px] text-slate-600">{road.utilizationPct.toFixed(0)}%</span>
                </div>
                <Progress
                  value={road.utilizationPct}
                  color={
                    road.density > 0.8 ? "#f87171" : road.density > 0.6 ? "#fb923c" : road.density > 0.4 ? "#fbbf24" : "#34d399"
                  }
                  height={5}
                  className="mt-1"
                />
                <p className="mt-0.5 font-sans text-[8px] text-slate-500">
                  {road.from} ↔ {road.to} · {road.vehicles} vehicles
                </p>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="flex flex-col items-center p-4">
            <SectionHeader eyebrow="Composite score" title="Simulation health" className="w-full" />
            <GaugeChart value={metrics.flowEfficiency} label="Flow efficiency" size={190} />
            <p className="mt-1 max-w-[240px] text-center text-[10px] leading-relaxed text-slate-500">
              Composite of speed, waiting time and network distribution. Calculated entirely from simulated values.
            </p>
          </Card>
          <SimulationNote />
        </div>
      </div>

      <div className="grid gap-2 text-[9px] text-slate-500 sm:grid-cols-3">
        <span className="flex items-center gap-1.5">
          <Waypoints size={10} /> {metrics.totalIntersections} intersections · {metrics.totalRoads} road segments
        </span>
        <span className="flex items-center gap-1.5">
          <RouteIcon size={10} /> Dijkstra routing · {metrics.reroutes} simulated reroutes
        </span>
        <span className="flex items-center gap-1.5">
          <Clock size={10} /> Snapshot every 20 s · last {simClock(simTime)} sim time
        </span>
      </div>
    </div>
  );
}


