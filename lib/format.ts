import type { CongestionLevel } from "./sim/types";

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function formatNumber(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return "—";
  const fixed = value.toFixed(decimals);
  const [integer, fraction] = fixed.split(".");
  const sign = integer.startsWith("-") ? "-" : "";
  const digits = sign ? integer.slice(1) : integer;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}${grouped}${fraction ? `.${fraction}` : ""}`;
}

export function simClock(seconds: number): string {
  const total = ((seconds % 86400) + 86400) % 86400;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function shortClock(seconds: number): string {
  const total = ((seconds % 86400) + 86400) % 86400;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatMinutes(minutes: number, decimals = 1): string {
  if (!Number.isFinite(minutes)) return "—";
  if (minutes < 1) return `${Math.round(minutes * 60)}s`;
  return `${minutes.toFixed(decimals)} min`;
}

export function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds)) return "—";
  if (seconds <= 0) return "arrived";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

export function percent(value: number, decimals = 0): string {
  return `${value.toFixed(decimals)}%`;
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export type Tone = "cyan" | "green" | "amber" | "orange" | "red" | "violet" | "slate";

export const TONE_HEX: Record<Tone, string> = {
  cyan: "#22d3ee",
  green: "#34d399",
  amber: "#fbbf24",
  orange: "#fb923c",
  red: "#f87171",
  violet: "#a78bfa",
  slate: "#94a3b8",
};

export const CONGESTION_META: Record<
  CongestionLevel,
  { label: string; color: string; tone: Tone; range: string }
> = {
  low: { label: "Low", color: "#34d399", tone: "green", range: "0–39%" },
  moderate: { label: "Moderate", color: "#fbbf24", tone: "amber", range: "40–61%" },
  heavy: { label: "Heavy", color: "#fb923c", tone: "orange", range: "62–79%" },
  severe: { label: "Severe", color: "#f87171", tone: "red", range: "80–100%" },
  blocked: { label: "Blocked", color: "#ef4444", tone: "red", range: "closed" },
};

export const VEHICLE_META = {
  car: { label: "Cars", color: "#38bdf8" },
  bus: { label: "Buses", color: "#fbbf24" },
  truck: { label: "Trucks", color: "#a78bfa" },
  motorcycle: { label: "Motorcycles", color: "#34d399" },
  emergency: { label: "Emergency", color: "#fb7185" },
} as const;

export function distanceLabel(km: number): string {
  return `${km.toFixed(2)} km`;
}

export function safePercentChange(before: number, after: number): number {
  if (before === 0) return 0;
  return ((after - before) / before) * 100;
}

export function severityColor(severity: string): string {
  switch (severity) {
    case "success":
      return "#34d399";
    case "warning":
      return "#fbbf24";
    case "critical":
      return "#fb7185";
    default:
      return "#22d3ee";
  }
}
