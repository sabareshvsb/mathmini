"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Database,
  Download,
  HardDrive,
  Lock,
  Plus,
  RefreshCcw,
  Save,
  Server,
  Shield,
  ShieldAlert,
  Trash2,
  UserRound,
  Wifi,
} from "lucide-react";
import { getSimulator, useTrafficStore } from "@/lib/store/traffic-store";
import type { FleetUnit, Weather } from "@/lib/sim/types";
import { simClock } from "@/lib/format";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  SectionHeader,
  Segmented,
  Select,
  SimulationNote,
  Slider,
  StatCard,
  Toggle,
} from "@/components/ui";

interface Health {
  ok?: boolean;
  service?: string;
  time?: string;
  websocket?: string;
  database?: Record<string, unknown>;
  disclaimer?: string;
}

export default function AdminPage() {
  const auth = useTrafficStore((state) => state.auth);
  const network = useTrafficStore((state) => state.network);
  const config = useTrafficStore((state) => state.config);
  const fleet = useTrafficStore((state) => state.fleet);
  const metrics = useTrafficStore((state) => state.metrics);
  const simTime = useTrafficStore((state) => state.simTime);
  const syncStatus = useTrafficStore((state) => state.syncStatus);
  const saveConfig = useTrafficStore((state) => state.saveConfig);
  const setSpawnRate = useTrafficStore((state) => state.setSpawnRate);
  const setMaxVehicles = useTrafficStore((state) => state.setMaxVehicles);
  const setWeather = useTrafficStore((state) => state.setWeather);
  const setTiming = useTrafficStore((state) => state.setTiming);
  const setAdaptiveSignals = useTrafficStore((state) => state.setAdaptiveSignals);
  const setCoordinatedSignals = useTrafficStore((state) => state.setCoordinatedSignals);
  const setAutoReroute = useTrafficStore((state) => state.setAutoReroute);
  const setPublicTransportPriority = useTrafficStore((state) => state.setPublicTransportPriority);
  const addFleetUnit = useTrafficStore((state) => state.addFleetUnit);
  const removeFleetUnit = useTrafficStore((state) => state.removeFleetUnit);
  const reset = useTrafficStore((state) => state.reset);
  const resetNetwork = useTrafficStore((state) => state.resetNetwork);
  const logout = useTrafficStore((state) => state.logout);
  const pushToast = useTrafficStore((state) => state.pushToast);
  const [health, setHealth] = useState<Health | null>(null);
  const [busy, setBusy] = useState(false);
  const [unit, setUnit] = useState<{ label: string; type: FleetUnit["type"]; baseNode: string; callsign: string }>({
    label: "",
    type: "ambulance",
    baseNode: "J01",
    callsign: "",
  });

  useEffect(() => {
    if (auth.role !== "admin") return;
    fetch("/api/health")
      .then((response) => response.json())
      .then((data) => setHealth(data as Health))
      .catch(() => setHealth(null));
  }, [auth.role]);

  async function saveNetwork() {
    setBusy(true);
    try {
      const response = await fetch("/api/network", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ network }),
      });
      if (!response.ok) throw new Error("save failed");
      pushToast("Network saved to SQLite", "success");
    } catch {
      pushToast("Unable to persist network", "critical");
    } finally {
      setBusy(false);
    }
  }

  async function pushSnapshot() {
    setBusy(true);
    try {
      const response = await fetch("/api/simulation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(getSimulator().getSnapshot()),
      });
      if (!response.ok) throw new Error("snapshot failed");
      pushToast("Simulation snapshot stored", "success");
    } catch {
      pushToast("Unable to store snapshot", "critical");
    } finally {
      setBusy(false);
    }
  }

  function refreshHealth() {
    fetch("/api/health")
      .then((response) => response.json())
      .then((data) => {
        setHealth(data as Health);
        pushToast("System health refreshed", "info");
      })
      .catch(() => pushToast("Health endpoint unavailable", "warning"));
  }

  function addUnit() {
    if (!unit.label.trim() || !unit.callsign.trim()) return;
    addFleetUnit({
      label: unit.label.trim(),
      type: unit.type,
      baseNode: unit.baseNode,
      callsign: unit.callsign.trim(),
    });
    setUnit({ ...unit, label: "", callsign: "" });
    pushToast("Fleet unit registered", "success");
  }

  function downloadConfig() {
    const blob = new Blob([JSON.stringify({ network, config, fleet }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "bengaluru-config.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (!auth.checked) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">Checking session…</p>
      </div>
    );
  }

  if (auth.role !== "admin") {
    return (
      <div className="space-y-4">
        <PageHeader
          eyebrow="Administration"
          title="Admin settings"
          description="Restricted area for network configuration, fleet registration and system health."
        />
        <Card className="mx-auto max-w-lg p-6 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-amber-200 bg-amber-400/[0.07] text-amber-700">
            <Lock size={20} />
          </span>
          <h2 className="mt-3 text-sm font-semibold text-slate-900">Administrator access required</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
            {auth.role === "viewer"
              ? "You are signed in as a viewer. Configuration changes require an administrator session."
              : "Sign in with the administrator demo account to manage the simulation."}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Link href="/login">
              <Button size="sm" variant="primary">
                <UserRound size={12} /> Sign in
              </Button>
            </Link>
            <Link href="/overview">
              <Button size="sm" variant="ghost">
                Back to command center
              </Button>
            </Link>
          </div>
          <p className="mt-3 font-mono text-[8.5px] uppercase tracking-[0.14em] text-slate-500">
            Demo administrator: admin / admin123
          </p>
        </Card>
        <SimulationNote />
      </div>
    );
  }

  const dbEntries = Object.entries(health?.database ?? {});

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Administration"
        title="System administration"
        description="Configure simulation parameters, manage the emergency fleet, persist the graph network and inspect local service health. Changes apply only to this local demonstration environment."
        actions={
          <>
            <Badge tone="green" dot>
              {auth.name}
            </Badge>
            <Button size="sm" variant="secondary" onClick={refreshHealth}>
              <RefreshCcw size={12} /> Refresh health
            </Button>
            <Button size="sm" variant="ghost" onClick={logout}>
              Sign out
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Session role" value="Admin" icon={Shield} accent="#34d399" hint={auth.name ?? "Administrator"} />
        <StatCard label="Database" value={health?.ok ? "Online" : "Unknown"} icon={Database} accent="#2563eb" hint="node:sqlite WAL" delay={1} />
        <StatCard label="Live sync" value={syncStatus} icon={Wifi} accent="#a78bfa" hint={health?.websocket ?? "ws://localhost:4001"} delay={2} />
        <StatCard label="Fleet units" value={fleet.length} icon={ShieldAlert} accent="#fbbf24" hint={`${fleet.filter((item) => item.status === "idle").length} idle`} delay={3} />
        <StatCard label="Sim clock" value={simClock(simTime)} icon={Activity} accent="#fb7185" hint="Local simulation time" delay={4} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Card className="p-4">
          <SectionHeader
            eyebrow="Simulation configuration"
            title="Engine parameters"
            actions={<Badge tone="cyan">applies immediately</Badge>}
          />
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Slider label="Spawn rate" value={config.spawnRate} min={2} max={80} onChange={setSpawnRate} display={`${config.spawnRate}/min`} />
            <Slider label="Maximum vehicles" value={config.maxVehicles} min={40} max={800} step={20} onChange={setMaxVehicles} display={String(config.maxVehicles)} />
            <div>
              <p className="label-xs mb-1.5">Weather</p>
              <Segmented<Weather>
                value={config.weather}
                onChange={setWeather}
                size="xs"
                options={[
                  { value: "clear", label: "Clear" },
                  { value: "rain", label: "Rain" },
                  { value: "storm", label: "Storm" },
                  { value: "fog", label: "Fog" },
                ]}
              />
            </div>
            <div>
              <p className="label-xs mb-1.5">Signal green durations</p>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  value={config.timing.low}
                  min={10}
                  onChange={(event) => setTiming({ low: Number(event.target.value) })}
                  aria-label="Low density green"
                />
                <Input
                  type="number"
                  value={config.timing.veryHeavy}
                  min={20}
                  onChange={(event) => setTiming({ veryHeavy: Number(event.target.value) })}
                  aria-label="Very heavy green"
                />
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Toggle checked={config.adaptiveSignals} onChange={setAdaptiveSignals} label="Adaptive signals" description="Density-based green time." />
            <Toggle checked={config.coordinatedSignals} onChange={setCoordinatedSignals} label="Green wave" description="Corridor coordination." />
            <Toggle checked={config.autoReroute} onChange={setAutoReroute} label="Auto reroute" description="Vehicles avoid congestion." />
            <Toggle checked={config.publicTransportPriority} onChange={setPublicTransportPriority} label="Transit priority" description="Bias for bus corridors." />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => saveConfig({})}>
              <Save size={12} /> Save configuration
            </Button>
            <Button size="sm" variant="ghost" onClick={downloadConfig}>
              <Download size={12} /> Export config
            </Button>
            <Button size="sm" variant="ghost" onClick={reset}>
              <RefreshCcw size={12} /> Reset simulation
            </Button>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <SectionHeader
              eyebrow="Persistence"
              title="Local data services"
              actions={<Badge tone={health?.ok ? "green" : "amber"}>{health?.ok ? "healthy" : "unknown"}</Badge>}
            />
            <div className="mt-3 space-y-1.5 text-[10px]">
              <Row label="API service" value={health?.service ?? "Bengaluru Traffic API"} />
              <Row label="WebSocket" value={health?.websocket ?? "ws://localhost:4001"} />
              <Row label="Database" value="SQLite · node:sqlite" />
              {dbEntries.map(([key, value]) => (
                <Row
                  key={key}
                  label={key}
                  value={typeof value === "object" ? JSON.stringify(value) : String(value)}
                />
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button size="sm" variant="secondary" onClick={saveNetwork} disabled={busy}>
                <HardDrive size={11} /> Save network
              </Button>
              <Button size="sm" variant="secondary" onClick={pushSnapshot} disabled={busy}>
                <Server size={11} /> Push snapshot
              </Button>
            </div>
            <p className="mt-2 text-[9px] leading-relaxed text-slate-500">
              The network and periodic telemetry snapshots are stored in <span className="font-mono">data/bengaluru-traffic.db</span>.
              The WebSocket relay is an optional secondary process.
            </p>
          </Card>

          <Card className="p-4">
            <SectionHeader
              eyebrow="Danger zone"
              title="Destructive actions"
              actions={<Badge tone="red">admin only</Badge>}
            />
            <div className="mt-3 space-y-2">
              <Button size="sm" variant="danger" className="w-full justify-start" onClick={resetNetwork}>
                <Trash2 size={12} /> Restore sample city network
              </Button>
              <Button
                size="sm"
                variant="danger"
                className="w-full justify-start"
                onClick={() => {
                  reset();
                  pushToast("Simulation reset to baseline scenario", "warning");
                }}
              >
                <RefreshCcw size={12} /> Reset simulation baseline
              </Button>
              <Button size="sm" variant="danger" className="w-full justify-start" onClick={logout}>
                <Lock size={12} /> End administrator session
              </Button>
            </div>
            <p className="mt-2 text-[9px] leading-relaxed text-slate-500">
              Restoring the network replaces custom nodes and edges with the deterministic 30-intersection sample graph.
            </p>
          </Card>
        </div>
      </div>

      <Card className="p-4">
        <SectionHeader
          eyebrow="Emergency fleet"
          title="Registered response units"
          actions={<Badge tone="slate">{fleet.length} units</Badge>}
        />
        <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_340px]">
          <div className="grid gap-2 sm:grid-cols-2">
            {fleet.map((item) => (
              <div key={item.id} className="flex items-center gap-2.5 rounded-lg border border-blue-100 bg-slate-50 px-3 py-2">
                <span className="grid h-7 w-7 place-items-center rounded-md border border-blue-100 bg-slate-50 font-mono text-[8px] text-slate-600">
                  {item.id.slice(-2)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[10.5px] text-slate-700">{item.label}</p>
                  <p className="font-mono text-[8px] text-slate-500">
                    {item.type} · {item.callsign} · base {item.baseNode}
                  </p>
                </div>
                <Badge tone={item.status === "idle" ? "green" : "red"}>{item.status}</Badge>
                <button
                  type="button"
                  onClick={() => removeFleetUnit(item.id)}
                  className="text-slate-500 transition hover:text-rose-700"
                  aria-label={`Remove ${item.label}`}
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
            {fleet.length === 0 ? (
              <EmptyState icon={ShieldAlert} title="No units registered" description="Add an emergency unit using the form." />
            ) : null}
          </div>
          <div className="rounded-xl border border-blue-100 bg-slate-50 p-3">
            <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-slate-500">Register unit</p>
            <div className="mt-2 space-y-2">
              <Field label="Label">
                <Input value={unit.label} onChange={(event) => setUnit({ ...unit, label: event.target.value })} placeholder="Ambulance A-310" />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Type">
                  <Select value={unit.type} onChange={(event) => setUnit({ ...unit, type: event.target.value as FleetUnit["type"] })}>
                    <option value="ambulance">Ambulance</option>
                    <option value="fire">Fire</option>
                    <option value="police">Police</option>
                  </Select>
                </Field>
                <Field label="Callsign">
                  <Input value={unit.callsign} onChange={(event) => setUnit({ ...unit, callsign: event.target.value })} placeholder="MEDIC-310" />
                </Field>
              </div>
              <Field label="Base intersection">
                <Select value={unit.baseNode} onChange={(event) => setUnit({ ...unit, baseNode: event.target.value })}>
                  {network.nodes.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.id} · {node.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button size="sm" variant="primary" className="w-full" onClick={addUnit} disabled={!unit.label.trim() || !unit.callsign.trim()}>
                <Plus size={12} /> Add unit
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="flex items-start gap-2 p-3 text-[10px] leading-relaxed text-slate-500">
          <Shield size={14} className="mt-0.5 shrink-0 text-emerald-700/70" />
          Sessions are stored in browser localStorage for demonstration only. Viewer accounts are read-only in the
          administration area but may explore the simulation.
        </Card>
        <Card className="flex items-start gap-2 p-3 text-[10px] leading-relaxed text-slate-500">
          <Database size={14} className="mt-0.5 shrink-0 text-blue-700/70" />
          {metrics.activeVehicles} simulated vehicles · {metrics.totalRoads} roads · snapshot state at {simClock(simTime)}.
          {health?.disclaimer ?? ""}
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-blue-100 pb-1.5 last:border-0 last:pb-0">
      <span className="capitalize text-slate-500">{label.replace(/([A-Z])/g, " $1")}</span>
      <span className="max-w-[58%] truncate font-mono text-slate-700">{value}</span>
    </div>
  );
}
