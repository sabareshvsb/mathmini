"use client";

import { useState } from "react";
import {
  Activity,
  Car,
  CloudRain,
  CloudSun,
  Construction,
  Gauge,
  Pause,
  Play,
  RefreshCcw,
  Route,
  Sparkles,
  Timer,
  TrafficCone,
  TriangleAlert,
  Wind,
  Zap,
} from "lucide-react";
import { useTrafficStore } from "@/lib/store/traffic-store";
import type { Weather } from "@/lib/sim/types";
import { CONGESTION_META, simClock } from "@/lib/format";
import { NetworkMap } from "@/components/network-map";
import { LineChart } from "@/components/charts";
import {
  Badge,
  Button,
  Card,
  Field,
  PageHeader,
  Progress,
  SectionHeader,
  Segmented,
  Select,
  SimulationNote,
  Slider,
  StatCard,
  Toggle,
} from "@/components/ui";

export default function SimulationPage() {
  const network = useTrafficStore((state) => state.network);
  const roads = useTrafficStore((state) => state.roads);
  const config = useTrafficStore((state) => state.config);
  const metrics = useTrafficStore((state) => state.metrics);
  const history = useTrafficStore((state) => state.history);
  const running = useTrafficStore((state) => state.running);
  const simTime = useTrafficStore((state) => state.simTime);
  const showHeatmap = useTrafficStore((state) => state.showHeatmap);
  const toggleOption = useTrafficStore((state) => state.toggleOption);
  const toggle = useTrafficStore((state) => state.toggle);
  const reset = useTrafficStore((state) => state.reset);
  const setSpeed = useTrafficStore((state) => state.setSpeed);
  const setSpawnRate = useTrafficStore((state) => state.setSpawnRate);
  const setMaxVehicles = useTrafficStore((state) => state.setMaxVehicles);
  const setWeather = useTrafficStore((state) => state.setWeather);
  const setAutoReroute = useTrafficStore((state) => state.setAutoReroute);
  const setPublicTransportPriority = useTrafficStore((state) => state.setPublicTransportPriority);
  const spawnBurst = useTrafficStore((state) => state.spawnBurst);
  const generateCongestion = useTrafficStore((state) => state.generateCongestion);
  const reportAccident = useTrafficStore((state) => state.reportAccident);
  const closeRoad = useTrafficStore((state) => state.closeRoad);
  const setRoadDensity = useTrafficStore((state) => state.setRoadDensity);
  const openDemo = useTrafficStore((state) => state.openDemo);
  const [edgeId, setEdgeId] = useState(network.edges[0]?.id ?? "");

  const recent = history.slice(-60);
  const labels = recent.map((point) => simClock(point.wallTime / 1000).slice(0, 5));
  const road = roads[edgeId];
  const selectedEdge = network.edges.find((edge) => edge.id === edgeId);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Simulation"
        title="Traffic simulation studio"
        description="Drive the local traffic engine: control demand, weather, speed and routing policy, then inject congestion or incidents to observe how the graph-based network responds."
        actions={
          <>
            <Button size="sm" variant="outline" onClick={openDemo}>
              <Sparkles size={12} /> Demo scenario
            </Button>
            <Button size="sm" variant="secondary" onClick={reset}>
              <RefreshCcw size={12} /> Reset
            </Button>
            <Button size="sm" variant={running ? "success" : "primary"} onClick={toggle}>
              {running ? <Pause size={12} /> : <Play size={12} />}
              {running ? "Pause" : "Run"}
            </Button>
          </>
        }
      >
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Mini label="Engine" value={running ? "LIVE" : "PAUSED"} tone={running ? "text-emerald-700" : "text-amber-700"} />
          <Mini label="Sim clock" value={simClock(simTime)} />
          <Mini label="Speed" value={`${config.speedMultiplier}×`} />
          <Mini label="Vehicles" value={String(metrics.activeVehicles)} />
          <Mini label="Weather" value={config.weather.toUpperCase()} />
          <Mini label="Seed" value={config.spawnRate.toFixed(0) + "/min"} />
        </div>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Active vehicles" value={metrics.activeVehicles} icon={Car} accent="#2563eb" hint={`Max ${config.maxVehicles}`} />
        <StatCard label="Completed trips" value={metrics.completedTrips} icon={Route} accent="#34d399" hint={`${metrics.totalRouteTrips} routed`} delay={1} />
        <StatCard label="Average speed" value={metrics.avgSpeedKmh.toFixed(0)} unit="km/h" icon={Gauge} accent="#a78bfa" hint="Traffic-adjusted" delay={2} />
        <StatCard label="Avg waiting" value={metrics.avgWaitingSec.toFixed(0)} unit="s" icon={Timer} accent="#fbbf24" hint="Per simulated vehicle" delay={3} />
        <StatCard label="Throughput" value={metrics.throughputPerHour} unit="/h" icon={Activity} accent="#fb7185" hint="Simulated completions" delay={4} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <Card className="p-4">
            <SectionHeader eyebrow="Engine controls" title="Simulation parameters" />
            <div className="mt-3 space-y-3">
              <Slider
                label="Simulation speed"
                value={config.speedMultiplier}
                min={0.25}
                max={6}
                step={0.25}
                onChange={setSpeed}
                display={`${config.speedMultiplier}×`}
                hint="Multiplier applied to simulation time."
              />
              <Slider
                label="Vehicle spawn rate"
                value={config.spawnRate}
                min={2}
                max={80}
                step={1}
                onChange={setSpawnRate}
                display={`${config.spawnRate}/min`}
              />
              <Slider
                label="Maximum vehicles"
                value={config.maxVehicles}
                min={40}
                max={800}
                step={20}
                onChange={setMaxVehicles}
                display={String(config.maxVehicles)}
              />
              <div>
                <p className="label-xs mb-1.5">Weather model</p>
                <Segmented<Weather>
                  value={config.weather}
                  onChange={setWeather}
                  options={[
                    { value: "clear", label: "Clear", icon: CloudSun },
                    { value: "rain", label: "Rain", icon: CloudRain },
                    { value: "storm", label: "Storm", icon: Wind },
                    { value: "fog", label: "Fog", icon: CloudSun },
                  ]}
                />
              </div>
              <Toggle
                checked={config.autoReroute}
                onChange={setAutoReroute}
                label="Automatic rerouting"
                description="Vehicles respond to congestion and incidents."
              />
              <Toggle
                checked={config.publicTransportPriority}
                onChange={setPublicTransportPriority}
                label="Transit priority"
                description="Buses receive a routing and signal bias."
              />
              <Toggle
                checked={showHeatmap}
                onChange={() => toggleOption("showHeatmap")}
                label="Congestion heatmap"
                description="Show density glow on the map."
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button size="sm" variant="secondary" onClick={() => spawnBurst(30)}>
                <Zap size={11} /> +30 vehicles
              </Button>
              <Button size="sm" variant="secondary" onClick={() => generateCongestion(8)}>
                <TrafficCone size={11} /> Traffic surge
              </Button>
            </div>
          </Card>

          <Card className="p-4">
            <SectionHeader eyebrow="Incident injection" title="Road-level controls" />
            <div className="mt-3 space-y-3">
              <Field label="Select road segment">
                <Select value={edgeId} onChange={(event) => setEdgeId(event.target.value)}>
                  {network.edges.map((edge) => (
                    <option key={edge.id} value={edge.id}>
                      {edge.id} · {edge.name}
                    </option>
                  ))}
                </Select>
              </Field>
              {road && selectedEdge ? (
                <div className="rounded-lg border border-blue-100 bg-slate-50 px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[9px] text-slate-500">Live density</span>
                    <Badge tone={CONGESTION_META[road.level].tone}>{road.level}</Badge>
                  </div>
                  <Progress value={road.density * 100} color={CONGESTION_META[road.level].color} height={5} className="mt-1.5" />
                  <Slider
                    label="Manual density override"
                    value={Math.round(road.density * 100)}
                    min={0}
                    max={100}
                    onChange={(value) => setRoadDensity(selectedEdge.id, value / 100)}
                    display={`${Math.round(road.density * 100)}%`}
                    hint="Overrides traffic demand for 120 simulated seconds."
                  />
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant="danger" onClick={() => reportAccident(edgeId)}>
                  <TriangleAlert size={11} /> Accident
                </Button>
                <Button size="sm" variant="danger" onClick={() => closeRoad(edgeId)}>
                  <Construction size={11} /> Close road
                </Button>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100 px-4 py-3">
              <SectionHeader eyebrow="Live state" title="Simulation map" className="flex-1" />
              <div className="flex items-center gap-1.5">
                <Badge tone="cyan" dot>
                  {metrics.activeVehicles} vehicles
                </Badge>
                <Badge tone={metrics.congestedRoads > 10 ? "orange" : "green"}>{metrics.congestedRoads} congested</Badge>
              </div>
            </div>
            <NetworkMap height="clamp(340px, 46vh, 540px)" heatmap={showHeatmap} useGlobalRoute />
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-4">
              <SectionHeader eyebrow="Flow telemetry" title="Speed and congestion" />
              <LineChart
                className="mt-3"
                height={190}
                labels={labels}
                series={[
                  { name: "Avg speed", color: "#2563eb", values: recent.map((point) => point.avgSpeedKmh), fill: true },
                  { name: "Congestion %", color: "#fb923c", values: recent.map((point) => point.congestion) },
                ]}
                min={0}
              />
            </Card>
            <Card className="p-4">
              <SectionHeader eyebrow="Demand" title="Vehicle population and waiting" />
              <LineChart
                className="mt-3"
                height={190}
                labels={labels}
                series={[
                  { name: "Vehicles", color: "#a78bfa", values: recent.map((point) => point.vehicles), fill: true },
                  { name: "Waiting (s)", color: "#fbbf24", values: recent.map((point) => point.waitingSec) },
                ]}
                min={0}
              />
            </Card>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-4">
          <SectionHeader
            eyebrow="Network effect"
            title="Corridor density distribution"
            subtitle="Segments currently above the moderate threshold, sorted by simulated load."
          />
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {Object.values(roads)
              .sort((a, b) => b.density - a.density)
              .slice(0, 12)
              .map((item) => {
                const edge = network.edges.find((entry) => entry.id === item.edgeId);
                return (
                  <div key={item.edgeId} className="rounded-lg border border-blue-100 bg-slate-50 px-2.5 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate font-mono text-[9px] text-slate-600">
                        {item.edgeId} · {edge?.name ?? "Road"}
                      </span>
                      <span className="font-mono text-[9px]" style={{ color: CONGESTION_META[item.level].color }}>
                        {(item.density * 100).toFixed(0)}%
                      </span>
                    </div>
                    <Progress value={item.density * 100} color={CONGESTION_META[item.level].color} height={4} className="mt-1" />
                  </div>
                );
              })}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <SectionHeader eyebrow="Engine state" title="What is running" />
            <div className="mt-3 space-y-2 text-[10.5px]">
              <Row label="Graph" value={`${network.nodes.length} V · ${network.edges.length} E`} />
              <Row label="Signals" value={`${metrics.activeSignals} controllers`} />
              <Row label="Incidents" value={`${metrics.blockedRoads} closures`} />
              <Row label="Reroutes" value={`${metrics.reroutes} this run`} />
              <Row label="Weather factor" value={config.weather} />
              <Row label="Snapshot" value="every 20 s to SQLite" />
            </div>
          </Card>
          <SimulationNote />
        </div>
      </div>
    </div>
  );
}

function Mini({ label, value, tone = "text-slate-800" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-blue-100 bg-slate-50 px-2.5 py-2">
      <p className="font-mono text-[7.5px] uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className={`mt-0.5 font-mono text-[10.5px] ${tone}`}>{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-blue-100 pb-1.5 last:border-0 last:pb-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-mono capitalize text-slate-700">{value}</span>
    </div>
  );
}
