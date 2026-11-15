"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogIn,
  Shield,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useTrafficStore } from "@/lib/store/traffic-store";
import { Badge, Button, Card, Field, Input, PageHeader, SectionHeader, SimulationNote } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const auth = useTrafficStore((state) => state.auth);
  const login = useTrafficStore((state) => state.login);
  const logout = useTrafficStore((state) => state.logout);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const ok = login(username, password);
    if (!ok) {
      setError("Invalid credentials. Use one of the demo accounts listed below.");
      return;
    }
    router.push(username.trim().toLowerCase() === "admin" ? "/admin" : "/overview");
  }

  if (auth.role) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <PageHeader eyebrow="Authentication" title="Operator session" description="You are signed in to the Nova City traffic control demonstration." />
        <Card className="p-6 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-300">
            <ShieldCheck size={24} />
          </span>
          <h2 className="mt-3 text-base font-semibold text-slate-100">{auth.name}</h2>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-300/70">{auth.role} session</p>
          <p className="mx-auto mt-2 max-w-md text-[11px] leading-relaxed text-slate-500">
            {auth.role === "admin"
              ? "Full access to configuration, fleet registration, network persistence and destructive actions."
              : "Read-only exploration of the simulation, routing lab and analytics. Administration requires an admin session."}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link href="/overview">
              <Button size="sm" variant="primary">
                Open command center <ArrowRight size={12} />
              </Button>
            </Link>
            {auth.role === "admin" ? (
              <Link href="/admin">
                <Button size="sm" variant="secondary">
                  <Shield size={12} /> Admin settings
                </Button>
              </Link>
            ) : null}
            <Button size="sm" variant="ghost" onClick={logout}>
              Sign out
            </Button>
          </div>
        </Card>
        <SimulationNote />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader
        eyebrow="Authentication"
        title="Operator sign in"
        description="Choose a demo role to explore role-based access inside the traffic management system. Credentials are stored locally and grant no access to real infrastructure."
      />

      <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
        <Card className="p-5">
          <SectionHeader eyebrow="Session" title="Sign in to Nova City" />
          <form onSubmit={submit} className="mt-4 space-y-3">
            <Field label="Username">
              <div className="relative">
                <UserRound size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <Input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="admin or viewer"
                  autoComplete="username"
                  className="pl-8"
                  required
                />
              </div>
            </Field>
            <Field label="Password">
              <div className="relative">
                <KeyRound size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <Input
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="pl-8 pr-9"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-300"
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
            </Field>
            {error ? (
              <p className="rounded-lg border border-rose-400/20 bg-rose-400/[0.06] px-3 py-2 text-[10.5px] text-rose-200">
                {error}
              </p>
            ) : null}
            <Button type="submit" variant="primary" className="w-full">
              <LogIn size={13} /> Sign in
            </Button>
            <p className="text-center text-[9.5px] text-slate-600">
              Authentication is simulated for this academic project.
            </p>
          </form>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <SectionHeader eyebrow="Demo accounts" title="Choose a role" />
            <div className="mt-3 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setUsername("admin");
                  setPassword("admin123");
                  setError("");
                }}
                className="flex w-full items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5 text-left transition hover:border-emerald-400/25 hover:bg-emerald-400/[0.04]"
              >
                <span className="grid h-8 w-8 place-items-center rounded-lg border border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-300">
                  <Shield size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-slate-200">Administrator</p>
                  <p className="font-mono text-[8.5px] text-slate-600">admin / admin123</p>
                </div>
                <Badge tone="green">full access</Badge>
              </button>
              <button
                type="button"
                onClick={() => {
                  setUsername("viewer");
                  setPassword("viewer123");
                  setError("");
                }}
                className="flex w-full items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5 text-left transition hover:border-cyan-400/25 hover:bg-cyan-400/[0.04]"
              >
                <span className="grid h-8 w-8 place-items-center rounded-lg border border-cyan-400/20 bg-cyan-400/[0.07] text-cyan-300">
                  <Eye size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-slate-200">Operations viewer</p>
                  <p className="font-mono text-[8.5px] text-slate-600">viewer / viewer123</p>
                </div>
                <Badge tone="cyan">read-only</Badge>
              </button>
            </div>
            <p className="mt-3 text-[9px] leading-relaxed text-slate-600">
              Click a card to prefill the form, then press sign in. You can also explore the simulation without an
              account; only administration is gated.
            </p>
          </Card>

          <Card className="p-4">
            <SectionHeader eyebrow="Access matrix" title="Role capabilities" />
            <div className="mt-2 space-y-1.5 text-[10px]">
              {[
                ["Command center and live map", true, true],
                ["Route optimisation and lab", true, true],
                ["Simulation and incidents", true, true],
                ["Signal and fleet configuration", true, false],
                ["Network persistence and reports", true, false],
              ].map(([label, admin, viewer]) => (
                <div key={String(label)} className="flex items-center justify-between gap-2 border-b border-white/[0.04] pb-1.5 last:border-0 last:pb-0">
                  <span className="text-slate-500">{label as string}</span>
                  <span className="flex items-center gap-3 font-mono text-[8.5px]">
                    <span className={admin ? "text-emerald-300" : "text-slate-600"}>{admin ? "admin ✓" : "admin —"}</span>
                    <span className={viewer ? "text-cyan-300" : "text-slate-600"}>{viewer ? "viewer ✓" : "viewer —"}</span>
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <SimulationNote />
          <p className="flex items-center justify-center gap-1.5 text-[9px] text-slate-600">
            <Lock size={10} /> No real credentials are transmitted or validated by a server.
          </p>
        </div>
      </div>
    </div>
  );
}
