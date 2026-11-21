"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { AlertCircle, CheckCircle2, Info, X, TriangleAlert } from "lucide-react";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";
import { useEffect } from "react";
import { cn } from "@/lib/format";

export function Card({
  children,
  className,
  hover = false,
  glow = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glow?: boolean;
}) {
  return (
    <div className={cn("glass", hover && "glass-hover", glow && "shadow-glow", className)}>{children}</div>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-1.5">{eyebrow}</p> : null}
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
        {subtitle ? <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mb-5 overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-white via-white to-blue-600/[0.03] p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="eyebrow">{eyebrow}</p>
            <span className="rounded-full border border-blue-200 bg-blue-500/[0.07] px-2 py-0.5 font-sans text-[9px] uppercase tracking-[0.18em] text-blue-700/80">
              Live Simulation
            </span>
          </div>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
          <p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-slate-600">{description}</p>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  unit,
  hint,
  icon: Icon,
  accent = "#2563eb",
  delay = 0,
  trend,
}: {
  label: string;
  value: string | number;
  unit?: string;
  hint?: ReactNode;
  icon: LucideIcon;
  accent?: string;
  delay?: number;
  trend?: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: delay * 0.045, ease: [0.22, 1, 0.36, 1] }}
      className="glass glass-hover group relative overflow-hidden p-4"
    >
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full opacity-[0.12] blur-2xl transition group-hover:opacity-25"
        style={{ background: accent }}
      />
      <div className="flex items-start justify-between gap-2">
        <p className="label-xs">{label}</p>
        <span
          className="grid h-8 w-8 place-items-center rounded-lg border"
          style={{ color: accent, borderColor: `${accent}33`, background: `${accent}12` }}
        >
          <Icon size={15} strokeWidth={1.8} />
        </span>
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="metric text-[26px] font-semibold leading-none">{value}</span>
        {unit ? <span className="font-sans text-[11px] text-slate-500">{unit}</span> : null}
      </div>
      <div className="mt-2.5 flex min-h-[16px] items-center justify-between gap-2">
        <span className="truncate text-[10px] text-slate-500">{hint}</span>
        {trend ? <span className="shrink-0 text-[10px] font-medium">{trend}</span> : null}
      </div>
      <div
        className="absolute inset-x-3 bottom-0 h-px opacity-60"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
      />
    </motion.div>
  );
}

export type BadgeTone = "cyan" | "green" | "amber" | "orange" | "red" | "violet" | "slate";

const badgeTones: Record<BadgeTone, string> = {
  cyan: "border-blue-200 bg-blue-500/[0.08] text-blue-700",
  green: "border-emerald-200 bg-emerald-400/[0.08] text-emerald-700",
  amber: "border-amber-200 bg-amber-400/[0.08] text-amber-700",
  orange: "border-orange-200 bg-orange-400/[0.08] text-orange-700",
  red: "border-rose-200 bg-rose-400/[0.08] text-rose-700",
  violet: "border-violet-200 bg-violet-400/[0.08] text-violet-700",
  slate: "border-blue-100 bg-blue-50 text-slate-700",
};

export function Badge({
  children,
  tone = "slate",
  className,
  dot = false,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-sans text-[9.5px] font-medium uppercase tracking-[0.12em]",
        badgeTones[tone],
        className,
      )}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current shadow-[0_0_6px_currentColor]" /> : null}
      {children}
    </span>
  );
}

export function StatusDot({
  tone = "green",
  pulse = true,
  className,
}: {
  tone?: "green" | "amber" | "red" | "cyan" | "slate";
  pulse?: boolean;
  className?: string;
}) {
  const colors = {
    green: "bg-emerald-400",
    amber: "bg-amber-400",
    red: "bg-rose-400",
    cyan: "bg-blue-500",
    slate: "bg-slate-300",
  };
  return (
    <span className={cn("relative flex h-2 w-2 shrink-0", className)}>
      {pulse ? (
        <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", colors[tone])} />
      ) : null}
      <span className={cn("relative inline-flex h-2 w-2 rounded-full", colors[tone])} />
    </span>
  );
}

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "success";
type ButtonSize = "sm" | "md" | "lg" | "icon";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-blue-600 text-white hover:bg-blue-700 shadow-[0_8px_24px_-8px_rgba(37,99,235,0.7)] border border-blue-500/20",
  secondary: "bg-blue-50 text-slate-800 hover:bg-blue-100 border border-blue-100",
  outline: "bg-transparent text-blue-700 hover:bg-blue-50 border border-blue-200",
  ghost: "bg-transparent text-slate-600 hover:bg-blue-50 hover:text-slate-900 border border-transparent",
  danger: "bg-rose-500/[0.12] text-rose-700 hover:bg-rose-500/[0.2] border border-rose-200",
  success: "bg-emerald-500/[0.12] text-emerald-700 hover:bg-emerald-500/[0.2] border border-emerald-200",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[11px] gap-1.5 rounded-lg",
  md: "h-9.5 px-4 text-xs gap-2 rounded-lg",
  lg: "h-11 px-5 text-sm gap-2 rounded-xl",
  icon: "h-8 w-8 rounded-lg",
};

export function Button({
  children,
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      className={cn(
        "inline-flex select-none items-center justify-center font-medium transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:cursor-not-allowed disabled:opacity-40",
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function IconButton({
  label,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return (
    <button
      title={label}
      aria-label={label}
      className={cn(
        "grid h-8 w-8 place-items-center rounded-lg border border-blue-100 bg-blue-50 text-slate-700 transition hover:border-blue-200 hover:bg-blue-100 hover:text-blue-700",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-800">{label}</p>
        {description ? <p className="mt-0.5 text-[10.5px] leading-snug text-slate-500">{description}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full border transition duration-200 disabled:opacity-40",
          checked ? "border-blue-600 bg-blue-600" : "border-blue-200 bg-blue-100",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-[18px] w-[18px] rounded-full shadow transition-all duration-200",
            checked ? "left-[22px] bg-white shadow-[0_2px_8px_rgba(15,23,42,0.25)]" : "left-0.5 bg-white shadow-sm",
          )}
        />
      </button>
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  display,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  display?: string;
  hint?: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="label-xs">{label}</span>
        <span className="font-sans text-[11px] text-blue-700">{display ?? value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full cursor-pointer"
        aria-label={label}
      />
      {hint ? <p className="mt-1 text-[10px] text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="label-xs mb-1.5 block">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[10px] text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn("input-base", props.className)} />;
}

export function Select({
  children,
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select {...props} className={cn("select-base", className)}>
      {children}
    </select>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "sm",
}: {
  options: Array<{ value: T; label: string; icon?: LucideIcon }>;
  value: T;
  onChange: (value: T) => void;
  size?: "xs" | "sm";
}) {
  return (
    <div className="inline-flex rounded-lg border border-blue-100 bg-slate-50 p-0.5">
      {options.map((option) => {
        const Icon = option.icon;
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md font-medium transition",
              size === "xs" ? "px-2 py-1 text-[10px]" : "px-2.5 py-1.5 text-[11px]",
              active
                ? "bg-blue-50 text-blue-700 shadow-[inset_0_0_0_1px_rgba(37,99,235,0.2)]"
                : "text-slate-500 hover:text-slate-800",
            )}
          >
            {Icon ? <Icon size={12} /> : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Progress({
  value,
  color = "#2563eb",
  height = 6,
  className,
  track = "rgba(37,99,235,0.12)",
}: {
  value: number;
  color?: string;
  height?: number;
  className?: string;
  track?: string;
}) {
  return (
    <div
      className={cn("w-full overflow-hidden rounded-full", className)}
      style={{ height, background: track }}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${Math.max(0, Math.min(100, value))}%`,
          background: `linear-gradient(90deg, ${color}aa, ${color})`,
          boxShadow: `0 0 10px ${color}66`,
        }}
      />
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-slate-900/35 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.22 }}
            className={cn("glass-strong my-6 w-full overflow-hidden", wide ? "max-w-5xl" : "max-w-lg")}
          >
            <div className="flex items-start justify-between gap-4 border-b border-blue-100 px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
                {subtitle ? <p className="mt-0.5 text-[11px] text-slate-500">{subtitle}</p> : null}
              </div>
              <IconButton label="Close" onClick={onClose}>
                <X size={14} />
              </IconButton>
            </div>
            <div className="p-5">{children}</div>
            {footer ? (
              <div className="flex justify-end gap-2 border-t border-blue-100 px-5 py-3">{footer}</div>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function SimulationNote({ className }: { className?: string }) {
  return null;
}

export function EmptyState({
  icon: Icon = AlertCircle,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-blue-100 bg-slate-50 px-6 py-10 text-center">
      <span className="mb-3 grid h-10 w-10 place-items-center rounded-full border border-blue-100 bg-slate-50 text-slate-500">
        <Icon size={17} />
      </span>
      <p className="text-xs font-medium text-slate-700">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-[11px] leading-relaxed text-slate-500">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function InlineStat({
  label,
  value,
  tone = "text-slate-900",
}: {
  label: string;
  value: ReactNode;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border border-blue-100 bg-slate-50 px-3 py-2">
      <p className="label-xs">{label}</p>
      <p className={cn("mt-1 font-sans text-sm tabular-nums", tone)}>{value}</p>
    </div>
  );
}

export function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Array<{ id: string; message: string; kind: "info" | "success" | "warning" | "critical" }>;
  onDismiss: (id: string) => void;
}) {
  const icons = {
    info: Info,
    success: CheckCircle2,
    warning: TriangleAlert,
    critical: AlertCircle,
  };
  const tones = {
    info: "border-blue-200 text-blue-700",
    success: "border-emerald-200 text-emerald-700",
    warning: "border-amber-200 text-amber-700",
    critical: "border-rose-200 text-rose-700",
  };
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[90] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = icons[toast.kind];
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, x: 30, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.98 }}
              className={cn(
                "pointer-events-auto flex items-start gap-2.5 rounded-xl border bg-white px-3.5 py-3 shadow-card backdrop-blur-xl",
                tones[toast.kind],
              )}
            >
              <Icon size={15} className="mt-0.5 shrink-0" />
              <p className="flex-1 text-[11.5px] leading-snug">{toast.message}</p>
              <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                className="text-slate-500 transition hover:text-slate-800"
                aria-label="Dismiss notification"
              >
                <X size={13} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
