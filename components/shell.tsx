"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  BarChart3,
  Car,
  ChevronRight,
  Clock,
  FlaskConical,
  Gauge,
  LayoutDashboard,
  LogIn,
  Map,
  Menu,
  Network,
  Pause,
  Play,
  Route,
  Settings,
  Shield,
  Siren,
  Sparkles,
  TrafficCone,
  Wifi,
  WifiOff,
  X,
  Eye,
  Radio,
} from "lucide-react";
import { useTrafficStore } from "@/lib/store/traffic-store";
import { simClock, cn } from "@/lib/format";
import { LiveEngine } from "./live-engine";
import { DemoMode } from "./demo-mode";
import { Button, StatusDot, ToastViewport } from "./ui";

const NAV_GROUPS = [
  {
    label: "Command",
    items: [
      { href: "/overview", label: "Overview", icon: LayoutDashboard },
      { href: "/map", label: "Live Traffic Map", icon: Map },
      { href: "/network", label: "Graph Network", icon: Network },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { href: "/optimize", label: "Route Optimization", icon: Route },
      { href: "/signals", label: "Signal Management", icon: TrafficCone },
      { href: "/lab", label: "Algorithm Laboratory", icon: FlaskConical },
      { href: "/analytics", label: "Analytics & Reports", icon: BarChart3 },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/simulation", label: "Traffic Simulation", icon: Car },
      { href: "/emergency", label: "Emergency Management", icon: Siren },
    ],
  },
  {
    label: "System",
    items: [{ href: "/admin", label: "Admin Settings", icon: Settings }],
  },
];

const PAGE_META: Record<string, { title: string; eyebrow: string }> = {
  "/overview": { title: "Command Center", eyebrow: "Overview" },
  "/map": { title: "Live Traffic Map", eyebrow: "Network Operations" },
  "/network": { title: "Graph Network", eyebrow: "Topology" },
  "/optimize": { title: "Route Optimization", eyebrow: "Routing Engine" },
  "/signals": { title: "Signal Management", eyebrow: "Adaptive Control" },
  "/simulation": { title: "Traffic Simulation", eyebrow: "Simulation" },
  "/emergency": { title: "Emergency Management", eyebrow: "Priority Corridors" },
  "/lab": { title: "Algorithm Laboratory", eyebrow: "Graph Algorithms" },
  "/analytics": { title: "Analytics & Reports", eyebrow: "Measurement" },
  "/admin": { title: "Admin Settings", eyebrow: "Administration" },
  "/login": { title: "Operator Sign In", eyebrow: "Authentication" },
};

function BrandMark() {
  return (
    <div className="relative grid h-10 w-10 place-items-center">
      <svg viewBox="0 0 48 48" className="h-10 w-10">
        <defs>
          <linearGradient id="brand-stroke" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1d4ed8" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
        </defs>
        <path d="M24 3 42.5 13.5v21L24 45 5.5 34.5v-21L24 3Z" fill="rgba(37,99,235,0.06)" stroke="url(#brand-stroke)" strokeWidth="1.4" />
        <path d="M16 34 24 13l8 21" fill="none" stroke="#1d4ed8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="24" cy="13" r="2.4" fill="#1d4ed8" />
        <circle cx="16" cy="34" r="2.2" fill="#34d399" />
        <circle cx="32" cy="34" r="2.2" fill="#34d399" />
        <path d="M18 24h12" stroke="#2563eb" strokeWidth="1" strokeDasharray="2 2" opacity="0.8" />
      </svg>
      <span className="absolute inset-0 rounded-full bg-blue-50 blur-lg" />
    </div>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const running = useTrafficStore((state) => state.running);
  const syncStatus = useTrafficStore((state) => state.syncStatus);
  const metrics = useTrafficStore((state) => state.metrics);
  const auth = useTrafficStore((state) => state.auth);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-[76px] shrink-0 items-center gap-3 border-b border-blue-100 px-4">
        <BrandMark />
        <div className="min-w-0">
          <p className="font-sans text-[13px] font-semibold tracking-[0.14em] text-slate-900">BENGALURU</p>
          <p className="truncate font-sans text-[8px] uppercase tracking-[0.22em] text-blue-700/60">
            Traffic Control OS
          </p>
        </div>
      </div>

      <div className="scroll-area flex-1 overflow-y-auto px-3 py-4">
        <p className="mb-2 px-2 font-sans text-[8px] uppercase tracking-[0.2em] text-slate-500">
          Smart City · Graph Theory
        </p>
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-3">
            <p className="mb-1.5 px-3 font-sans text-[8px] uppercase tracking-[0.22em] text-slate-500/80">
              {group.label}
            </p>
            <nav className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn("nav-item group", active && "nav-item-active")}
                  >
                    {active ? (
                      <motion.span
                        layoutId="sidebar-active"
                        className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full bg-blue-600 shadow-[0_0_8px_#2563eb]"
                      />
                    ) : null}
                    <Icon
                      size={15}
                      strokeWidth={1.7}
                      className={cn("shrink-0 transition", active ? "text-blue-700" : "text-slate-500 group-hover:text-slate-700")}
                    />
                    <span className="truncate">{item.label}</span>
                    {item.href === "/emergency" && metrics.emergencyVehicles > 0 ? (
                      <span className="ml-auto grid h-4 min-w-4 place-items-center rounded-full bg-rose-50 px-1 font-sans text-[8px] text-rose-700">
                        {metrics.emergencyVehicles}
                      </span>
                    ) : null}
                    {active ? <ChevronRight size={11} className="ml-auto text-blue-600/60" /> : null}
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}

        <Link
          href="/login"
          onClick={onNavigate}
          className="mt-2 flex items-center gap-2.5 rounded-xl border border-blue-100 bg-slate-50 px-3 py-2.5 transition hover:border-blue-200 hover:bg-blue-500/[0.04]"
        >
          <span className="grid h-7 w-7 place-items-center rounded-full border border-blue-100 bg-blue-50 text-slate-600">
            {auth.role === "admin" ? <Shield size={13} /> : auth.role === "viewer" ? <Eye size={13} /> : <LogIn size={13} />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[11px] font-medium text-slate-700">
              {auth.name ?? "Operator sign in"}
            </span>
            <span className="block font-sans text-[8px] uppercase tracking-[0.14em] text-slate-500">
              {auth.role ?? "guest session"}
            </span>
          </span>
          <ChevronRight size={12} className="text-slate-500" />
        </Link>
      </div>

      <div className="shrink-0 border-t border-blue-100 p-3">
        <div className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-600/[0.05] to-transparent p-3">
          <div className="flex items-center justify-between">
            <span className="font-sans text-[8px] uppercase tracking-[0.18em] text-slate-500">System status</span>
            <StatusDot tone={running ? "green" : "amber"} />
          </div>
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center justify-between text-[9.5px]">
              <span className="flex items-center gap-1.5 text-slate-500">
                <Gauge size={10} /> Engine
              </span>
              <span className={running ? "text-emerald-700" : "text-amber-700"}>{running ? "Running" : "Paused"}</span>
            </div>
            <div className="flex items-center justify-between text-[9.5px]">
              <span className="flex items-center gap-1.5 text-slate-500">
                {syncStatus === "connected" ? <Wifi size={10} /> : <WifiOff size={10} />} Live sync
              </span>
              <span className={syncStatus === "connected" ? "text-blue-700" : "text-slate-500"}>
                {syncStatus === "connected" ? "Linked" : syncStatus === "connecting" ? "Connecting" : "Offline"}
              </span>
            </div>
            <div className="flex items-center justify-between text-[9.5px]">
              <span className="flex items-center gap-1.5 text-slate-500">
                <Radio size={10} /> Signals
              </span>
              <span className="text-slate-700">{metrics.activeSignals} active</span>
            </div>
          </div>
        </div>
        <p className="mt-2 px-1 text-center font-sans text-[7.5px] uppercase tracking-[0.16em] text-slate-400">
          Simulation data · academic build
        </p>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const sidebarOpen = useTrafficStore((state) => state.sidebarOpen);
  const setSidebarOpen = useTrafficStore((state) => state.setSidebarOpen);
  const simTime = useTrafficStore((state) => state.simTime);
  const running = useTrafficStore((state) => state.running);
  const toggle = useTrafficStore((state) => state.toggle);
  const syncStatus = useTrafficStore((state) => state.syncStatus);
  const peers = useTrafficStore((state) => state.peers);
  const openDemo = useTrafficStore((state) => state.openDemo);
  const auth = useTrafficStore((state) => state.auth);
  const toasts = useTrafficStore((state) => state.toasts);
  const dismissToast = useTrafficStore((state) => state.dismissToast);
  const meta = PAGE_META[pathname] ?? { title: "Bengaluru", eyebrow: "Traffic Control" };

  return (
    <>
      <LiveEngine />

      <aside className="fixed inset-y-0 left-0 z-50 hidden w-[268px] border-r border-slate-200 bg-white lg:block">
        <SidebarContent />
      </aside>

      <AnimatePresence>
        {sidebarOpen ? (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-slate-900/35 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: -290 }}
              animate={{ x: 0 }}
              exit={{ x: -290 }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="fixed inset-y-0 left-0 z-[60] w-[280px] border-r border-blue-100 bg-white backdrop-blur-2xl lg:hidden"
            >
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-lg border border-blue-100 bg-blue-50 text-slate-600"
                aria-label="Close navigation"
              >
                <X size={14} />
              </button>
              <SidebarContent onNavigate={() => setSidebarOpen(false)} />
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      <div className="relative z-10 min-h-screen lg:pl-[268px]">
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex h-[64px] items-center gap-3 px-4 sm:px-5 lg:px-6">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-blue-100 bg-blue-50 text-slate-700 lg:hidden"
              aria-label="Open navigation"
            >
              <Menu size={16} />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="hidden font-sans text-[8px] uppercase tracking-[0.2em] text-blue-700/50 sm:block">
                  {meta.eyebrow}
                </p>
                <ChevronRight size={9} className="hidden text-slate-400 sm:block" />
                <p className="font-sans text-[8px] uppercase tracking-[0.16em] text-slate-500">Bengaluru</p>
              </div>
              <h1 className="truncate text-[14px] font-semibold tracking-tight text-slate-900">{meta.title}</h1>
            </div>

            <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
              <div className="hidden items-center gap-1.5 rounded-lg border border-blue-100 bg-slate-50 px-2.5 py-1.5 md:flex">
                <Clock size={12} className="text-blue-700/70" />
                <span className="font-sans text-[11px] tabular-nums text-slate-800">{simClock(simTime)}</span>
                <span className="font-sans text-[7.5px] uppercase tracking-wider text-slate-500">sim</span>
              </div>

              <button
                type="button"
                onClick={toggle}
                className={cn(
                  "hidden items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-sans text-[9px] uppercase tracking-[0.12em] transition sm:flex",
                  running
                    ? "border-emerald-200 bg-emerald-400/[0.07] text-emerald-700 hover:bg-emerald-400/[0.12]"
                    : "border-amber-200 bg-amber-400/[0.07] text-amber-700 hover:bg-amber-400/[0.12]",
                )}
                title={running ? "Pause simulation" : "Resume simulation"}
              >
                <StatusDot tone={running ? "green" : "amber"} pulse={running} />
                {running ? <Pause size={10} /> : <Play size={10} />}
                {running ? "Live" : "Paused"}
              </button>

              <div
                className={cn(
                  "hidden items-center gap-1.5 rounded-lg border px-2.5 py-1.5 lg:flex",
                  syncStatus === "connected"
                    ? "border-blue-200 bg-blue-500/[0.06] text-blue-700"
                    : "border-blue-100 bg-slate-50 text-slate-500",
                )}
                title="WebSocket live telemetry"
              >
                {syncStatus === "connected" ? <Wifi size={11} /> : <WifiOff size={11} />}
                <span className="font-sans text-[8.5px] uppercase tracking-[0.12em]">
                  {syncStatus === "connected" ? `Sync · ${Math.max(1, peers)}` : "Offline"}
                </span>
              </div>

              <Button size="sm" variant="outline" onClick={openDemo} className="hidden sm:inline-flex">
                <Sparkles size={12} />
                Demo Mode
              </Button>

              <Link
                href="/login"
                className="flex items-center gap-1.5 rounded-lg border border-blue-100 bg-slate-50 px-2 py-1.5 transition hover:border-blue-200 hover:bg-blue-500/[0.06]"
                title={auth.name ? `${auth.name} · ${auth.role}` : "Operator sign in"}
              >
                <span className="grid h-6 w-6 place-items-center rounded-full border border-blue-200 bg-blue-500/[0.08] font-sans text-[9px] font-semibold text-blue-700">
                  {auth.name ? auth.name.slice(0, 2).toUpperCase() : "OP"}
                </span>
                <span className="hidden text-[10px] font-medium text-slate-700 xl:block">
                  {auth.role === "admin" ? "Admin" : auth.role === "viewer" ? "Viewer" : "Sign in"}
                </span>
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-3 overflow-x-auto border-t border-blue-100 px-4 py-1.5 sm:hidden">
            <span className="font-sans text-[9px] text-slate-500">{simClock(simTime)}</span>
            <span className="h-1 w-1 rounded-full bg-slate-200" />
            <span className={cn("font-sans text-[9px]", running ? "text-emerald-700" : "text-amber-700")}>
              {running ? "SIMULATION LIVE" : "PAUSED"}
            </span>
            <button type="button" onClick={openDemo} className="ml-auto inline-flex items-center gap-1 font-sans text-[9px] text-blue-700">
              <Sparkles size={10} /> Demo
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1680px] px-3.5 py-4 sm:px-5 sm:py-5 lg:px-6">{children}</main>

        <footer className="mx-auto flex w-full max-w-[1680px] flex-wrap items-center justify-between gap-2 px-4 pb-6 pt-2 text-[11px] text-slate-500 sm:px-6">
          <span className="font-sans uppercase tracking-[0.16em]">
            Smart City Traffic Management using Graph Theory
          </span>
          <span className="flex items-center gap-1.5">
            <Activity size={9} /> Simulation only · no live city data
          </span>
        </footer>
      </div>

      <DemoMode />
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
