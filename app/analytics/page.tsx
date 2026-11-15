"use client";

import { useState } from "react";
import {
  ArrowDownToLine,
  BarChart3,
  CalendarDays,
  Clock,
  Database,
  Gauge,
  LineChart as LineChartIcon,
  TrendingUp,
} from "lucide-react";
import { useTrafficStore } from "@/lib/store/traffic-store";
import { percent, simClock, TONE_HEX } from "@/lib/format";
import { BarChart, BarList, Donut, LineChart } from "@/components/charts";
import {
  Badge,
  Button,
  Card,
  PageHeader,
  Progress,
  SectionHeader,
  Segmented,
  SimulationNote,
  StatCard,
} from "@/components/ui";

type Range = "daily" | "weekly" | "monthly";

export default function AnalyticsPage() {
  const analytics = useTrafficStore((state) => state.analytics);
  const metrics = useTrafficStore((state) => state.metrics);
  const history = useTrafficStore((state) => state.history);
  const baseline = useTrafficStore((state) => state.baseline);
  const captureBaseline = useTrafficStore((state) => state.captureBaseline);
  const compareBaseline = useTrafficStore((state) => state.compareBaseline);
  const pushToast = useTrafficStore((state) => state.pushToast);
  const [range, setRange] = useState<Range>("daily");
  const [exporting, setExporting] = useState(false);

  const hourlyLabels = Array.from({ length: 24 }, (_, index) => `${String(index).padStart(2, "0")}`);
  const forecastLabels = Array.from({ length: analytics.forecast.length }, (_, index) => `+${(index + 1) * 15}m`);
  const dataset = range === "daily" ? analytics.daily : analytics.monthly;
  const congestionData = [
    { label: "Low", value: metrics.congestionDistribution.low, color: TONE_HEX.green },
    { label: "Moderate", value: metrics.congestionDistribution.moderate, color: TONE_HEX.amber },
    { label: "Heavy", value: metrics.congestionDistribution.heavy, color: TONE_HEX.orange },
    { label: "Severe", value: metrics.congestionDistribution.severe, color: TONE_HEX.red },
  ];
  const recentWaiting = history.slice(-40).map((point) => point.waitingSec);

  async function exportCsv() {
    setExporting(true);
    try {
      const response = await fetch("/api/reports/csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          range,
          hourlyVolume: analytics.hourlyVolume,
          hourlyCongestion: analytics.hourlyCongestion,
          daily: analytics.daily,
          monthly: analytics.monthly,
          metrics: {
            activeVehicles: metrics.activeVehicles,
            flowEfficiency: metrics.flowEfficiency,
            avgWaitingSec: metrics.avgWaitingSec,
            avgSpeedKmh: metrics.avgSpeedKmh,
          },
        }),
      });
      if (!response.ok) throw new Error("Report failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `bengaluru-${range}-report.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      pushToast(`Simulated ${range} CSV report exported`, "success");
    } catch {
      pushToast("Unable to generate CSV report", "critical");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Measurement"
        title="Analytics and reports"
        description="Simulated volume, congestion, waiting time and optimisation outcomes across 24-hour, weekly and monthly profiles. All values are produced by the local engine and clearly classified as simulation data."
        actions={
          <>
            <Segmented
              value={range}
              onChange={setRange}
              options={[
                { value: "daily", label: "Daily" },
                { value: "weekly", label: "Weekly" },
                { value: "monthly", label: "Monthly" },
              ]}
            />
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={exporting}>
              <ArrowDownToLine size={12} /> {exporting ? "Generating…" : "Export CSV"}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Flow efficiency" value={metrics.flowEfficiency.toFixed(0)} unit="%" icon={Gauge} accent="#34d399" hint="Composite simulation score" />
        <StatCard label="Avg waiting" value={metrics.avgWaitingSec.toFixed(0)} unit="s" icon={Clock} accent="#fbbf24" hint="Per vehicle" delay={1} />
        <StatCard label="Throughput" value={metrics.throughputPerHour} unit="/h" icon={TrendingUp} accent="#2563eb" hint="Completed trips / hour" delay={2} />
        <StatCard label="Congested roads" value={metrics.congestedRoads} icon={BarChart3} accent="#fb923c" hint={`${metrics.blockedRoads} blocked`} delay={3} />
        <StatCard label="Reroutes" value={metrics.reroutes} icon={LineChartIcon} accent="#a78bfa" hint="Dynamic route changes" delay={4} />
        <StatCard label="Completed trips" value={metrics.completedTrips} icon={CalendarDays} accent="#fb7185" hint={`${metrics.totalRouteTrips} routed`} delay={5} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card className="p-4">
          <SectionHeader
            eyebrow="24-hour profile"
            title="Simulated hourly volume"
            subtitle="Synthetic demand curve with morning and evening peaks, generated deterministically for the demonstration scenario."
            actions={<Badge tone="cyan">{analytics.seededHours ? "seeded profile" : "live profile"}</Badge>}
          />
          <BarChart
            className="mt-4"
            labels={hourlyLabels}
            values={analytics.hourlyVolume}
            height={190}
            color="#2563eb"
            highlightIndex={new Date().getHours()}
          />
        </Card>

        <Card className="p-4">
          <SectionHeader eyebrow="Distribution" title="Road congestion states" />
          <div className="mt-4">
            <Donut
              data={congestionData}
              centerLabel="segments"
              centerValue={String(metrics.totalRoads)}
              size={150}
              thickness={16}
            />
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-slate-500">
            {metrics.congestedRoads} of {metrics.totalRoads} segments exceed the moderate density threshold in the
            current simulated snapshot.
          </p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <SectionHeader
            eyebrow="Congestion index"
            title="Hourly load profile"
            actions={<Badge tone="orange">percent</Badge>}
          />
          <LineChart
            className="mt-3"
            height={200}
            labels={hourlyLabels}
            series={[
              {
                name: "Congestion index",
                color: "#fb923c",
                values: analytics.hourlyCongestion,
                fill: true,
              },
              {
                name: "Flow efficiency",
                color: "#34d399",
                values: analytics.hourlyCongestion.map((value) => Math.max(0, 100 - value)),
              },
            ]}
            min={0}
            max={100}
            unit="% simulated"
          />
        </Card>

        <Card className="p-4">
          <SectionHeader
            eyebrow={range === "weekly" ? "Weekly" : range === "daily" ? "Daily" : "Monthly"}
            title="Volume, congestion and waiting"
            actions={<Badge tone="violet">{dataset.length} samples</Badge>}
          />
          <BarChart
            className="mt-3"
            labels={dataset.map((entry) => entry.label)}
            values={dataset.map((entry) => entry.volume)}
            height={140}
            color="#a78bfa"
          />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-blue-100 bg-slate-50 px-2.5 py-2">
              <p className="font-mono text-[8px] uppercase tracking-[0.12em] text-slate-500">Average congestion</p>
              <p className="mt-0.5 font-mono text-sm text-orange-700">
                {percent(dataset.reduce((sum, entry) => sum + entry.congestion, 0) / Math.max(1, dataset.length))}
              </p>
            </div>
            <div className="rounded-lg border border-blue-100 bg-slate-50 px-2.5 py-2">
              <p className="font-mono text-[8px] uppercase tracking-[0.12em] text-slate-500">Average waiting</p>
              <p className="mt-0.5 font-mono text-sm text-amber-700">
                {(dataset.reduce((sum, entry) => sum + entry.waiting, 0) / Math.max(1, dataset.length)).toFixed(0)}s
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
        <Card className="p-4">
          <SectionHeader
            eyebrow="Short-term forecast"
            title="Next 15-minute windows"
            subtitle="A moving-average projection from the simulation history — indicative only."
            actions={<Badge tone="slate">projection</Badge>}
          />
          <LineChart
            className="mt-3"
            height={180}
            labels={forecastLabels}
            series={[{ name: "Projected vehicles", color: "#3b82f6", values: analytics.forecast, dashed: true }]}
            min={0}
          />
          <div className="mt-3">
            <BarList
              items={[
                { label: "Current vehicles", value: metrics.activeVehicles, color: "#2563eb" },
                { label: "Projected peak", value: Math.max(0, ...analytics.forecast), color: "#3b82f6" },
                { label: "Waiting (rolling)", value: recentWaiting[recentWaiting.length - 1] ?? 0, color: "#fbbf24", display: `${(recentWaiting[recentWaiting.length - 1] ?? 0).toFixed(0)}s` },
              ]}
              max={Math.max(metrics.activeVehicles, ...analytics.forecast, 1)}
            />
          </div>
        </Card>

        <Card className="p-4">
          <SectionHeader
            eyebrow="Before / after"
            title="Intervention comparison"
            subtitle="Capture a baseline, apply a signal or routing intervention, then compare the measured simulated state."
            actions={
              <>
                <Button size="sm" variant="secondary" onClick={captureBaseline}>
                  Capture
                </Button>
                <Button size="sm" variant="primary" onClick={compareBaseline} disabled={!baseline}>
                  Compare
                </Button>
              </>
            }
          />
          {baseline ? (
            <div className="mt-3 space-y-2.5">
              <div className="grid grid-cols-[1fr_auto_auto] gap-2 rounded-lg border border-blue-100 bg-slate-50 px-3 py-2 font-mono text-[8px] uppercase tracking-[0.12em] text-slate-500">
                <span>Metric</span>
                <span className="text-right">Before</span>
                <span className="text-right">After</span>
              </div>
              {[
                { label: "Avg waiting", before: `${baseline.before.waitingSec.toFixed(0)}s`, after: `${baseline.after.waitingSec.toFixed(0)}s`, good: baseline.after.waitingSec <= baseline.before.waitingSec },
                { label: "Flow efficiency", before: `${baseline.before.efficiency.toFixed(0)}%`, after: `${baseline.after.efficiency.toFixed(0)}%`, good: baseline.after.efficiency >= baseline.before.efficiency },
                { label: "Avg speed", before: `${baseline.before.avgSpeed.toFixed(0)} km/h`, after: `${baseline.after.avgSpeed.toFixed(0)} km/h`, good: baseline.after.avgSpeed >= baseline.before.avgSpeed },
                { label: "Congested roads", before: String(baseline.before.congested), after: String(baseline.after.congested), good: baseline.after.congested <= baseline.before.congested },
              ].map((row) => (
                <div key={row.label} className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-blue-100 pb-1.5 text-[10px] last:border-0">
                  <span className="text-slate-500">{row.label}</span>
                  <span className="text-right font-mono text-slate-500">{row.before}</span>
                  <span className={`text-right font-mono ${row.good ? "text-emerald-700" : "text-rose-700"}`}>{row.after}</span>
                </div>
              ))}
              <div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-500">Efficiency delta</span>
                  <span className="font-mono text-emerald-700">
                    {(baseline.after.efficiency - baseline.before.efficiency >= 0 ? "+" : "") +
                      (baseline.after.efficiency - baseline.before.efficiency).toFixed(1)}%
                  </span>
                </div>
                <Progress
                  value={Math.min(100, Math.max(0, baseline.after.efficiency))}
                  color="#34d399"
                  height={6}
                  className="mt-1"
                />
              </div>
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-dashed border-blue-100 px-4 py-8 text-center">
              <p className="text-[10.5px] text-slate-500">
                No baseline captured. Use <span className="text-blue-700">Capture</span> before applying signal or
                routing changes.
              </p>
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <SectionHeader
            eyebrow="Road utilisation"
            title="Busiest corridors"
            actions={<Badge tone="cyan">top 10</Badge>}
          />
          <BarList
            className="mt-3"
            items={[...analytics.roadUtilization]
              .sort((a, b) => b.utilizationPct - a.utilizationPct)
              .slice(0, 10)
              .map((road) => ({
                label: `${road.edgeId} · ${road.name}`,
                value: road.utilizationPct,
                display: `${road.utilizationPct.toFixed(0)}%`,
                color: road.density > 0.8 ? TONE_HEX.red : road.density > 0.6 ? TONE_HEX.orange : road.density > 0.4 ? TONE_HEX.amber : TONE_HEX.green,
                sub: `${road.from} ↔ ${road.to} · ${road.vehicles} vehicles`,
              }))}
            max={100}
          />
        </Card>

        <Card className="p-4">
          <SectionHeader
            eyebrow="Intersection performance"
            title="Signal efficiency by junction"
            actions={<Badge tone="violet">live</Badge>}
          />
          <div className="scroll-area mt-3 max-h-[330px] overflow-y-auto">
            <table className="w-full border-collapse text-left">
              <thead className="sticky top-0 bg-white font-mono text-[8px] uppercase tracking-[0.12em] text-slate-500 backdrop-blur">
                <tr>
                  <th className="px-2 py-1.5">Junction</th>
                  <th className="px-2 py-1.5 text-right">Queue</th>
                  <th className="px-2 py-1.5 text-right">Green</th>
                  <th className="px-2 py-1.5 text-right">Throughput</th>
                  <th className="px-2 py-1.5 text-right">Efficiency</th>
                </tr>
              </thead>
              <tbody>
                {[...analytics.intersectionPerformance]
                  .sort((a, b) => b.efficiency - a.efficiency)
                  .slice(0, 14)
                  .map((entry) => (
                    <tr key={entry.nodeId} className="border-t border-blue-100 text-[10px] text-slate-600">
                      <td className="px-2 py-1.5">
                        <span className="font-mono text-blue-700/70">{entry.nodeId}</span>{" "}
                        <span className="text-slate-500">{entry.name}</span>
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono">{entry.queue}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{entry.greenDuration}s</td>
                      <td className="px-2 py-1.5 text-right font-mono">{entry.throughput}</td>
                      <td className="px-2 py-1.5 text-right font-mono text-emerald-700">{entry.efficiency}%</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <SectionHeader
          eyebrow="Optimisation history"
          title="Routing outcomes"
          subtitle="Each optimization stores the distance-route baseline and the traffic-aware time saving for the same origin-destination pair."
          actions={<Badge tone="slate">{analytics.optimizationStats.length} queries</Badge>}
        />
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead className="font-mono text-[8px] uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-2 py-2">Query</th>
                <th className="px-2 py-2">Mode</th>
                <th className="px-2 py-2 text-right">Distance</th>
                <th className="px-2 py-2 text-right">Time</th>
                <th className="px-2 py-2 text-right">Saved vs baseline</th>
                <th className="px-2 py-2 text-right">Congestion avoided</th>
                <th className="px-2 py-2 text-right">Algorithm</th>
              </tr>
            </thead>
            <tbody>
              {analytics.optimizationStats.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-2 py-6 text-center text-[10.5px] text-slate-500">
                    No routing queries yet — run an optimization from the routing or demo console.
                  </td>
                </tr>
              ) : (
                analytics.optimizationStats.map((stat) => (
                  <tr key={stat.id} className="border-t border-blue-100 text-[10px] text-slate-600">
                    <td className="px-2 py-1.5 font-mono">
                      {stat.source} → {stat.destination}
                    </td>
                    <td className="px-2 py-1.5 capitalize">{stat.mode}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{stat.distanceKm} km</td>
                    <td className="px-2 py-1.5 text-right font-mono">{stat.timeMin} min</td>
                    <td className="px-2 py-1.5 text-right font-mono text-emerald-700">+{stat.timeSavedMin} min</td>
                    <td className="px-2 py-1.5 text-right font-mono">{stat.congestionAvoided.toFixed(2)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-slate-500">{stat.algorithm}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
        <SimulationNote />
        <div className="flex items-center gap-2 rounded-lg border border-blue-100 bg-slate-50 px-3 py-2 text-[9px] text-slate-500">
          <Database size={12} /> Reports are recorded locally in SQLite · snapshot {simClock(history[history.length - 1]?.wallTime ?? 0)}
        </div>
      </div>
</div>
  );
}

