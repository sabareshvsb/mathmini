"use client";

import { useId } from "react";
import { cn, formatNumber } from "@/lib/format";

export interface ChartSeries {
  name: string;
  color: string;
  values: number[];
  fill?: boolean;
  dashed?: boolean;
}

export function LineChart({
  series,
  labels,
  height = 220,
  min,
  max,
  unit = "",
  className,
  yTicks = 4,
  formatter,
}: {
  series: ChartSeries[];
  labels?: string[];
  height?: number;
  min?: number;
  max?: number;
  unit?: string;
  className?: string;
  yTicks?: number;
  formatter?: (value: number) => string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const width = 720;
  const pad = { left: 46, right: 14, top: 16, bottom: 28 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const all = series.flatMap((s) => s.values).filter((v) => Number.isFinite(v));
  const dataMin = min ?? Math.min(0, ...all);
  const dataMax = max ?? Math.max(1, ...all) * 1.08;
  const span = Math.max(0.001, dataMax - dataMin);
  const maxLen = Math.max(1, ...series.map((s) => s.values.length));
  const x = (index: number) => pad.left + (maxLen === 1 ? plotW / 2 : (index / (maxLen - 1)) * plotW);
  const y = (value: number) => pad.top + plotH - ((value - dataMin) / span) * plotH;
  const tickValues = Array.from({ length: yTicks + 1 }, (_, i) => dataMin + (span * i) / yTicks);
  const format = formatter ?? ((value: number) => formatNumber(value, value >= 100 ? 0 : 1));
  const labelIndices = (() => {
    if (!labels?.length) return [];
    const step = Math.max(1, Math.ceil(labels.length / 7));
    const result: number[] = [];
    for (let i = 0; i < labels.length; i += step) result.push(i);
    if (!result.includes(labels.length - 1)) result.push(labels.length - 1);
    return result;
  })();

  function pathFor(values: number[]) {
    if (!values.length) return "";
    return values
      .map((value, index) => `${index === 0 ? "M" : "L"} ${x(index).toFixed(2)} ${y(value).toFixed(2)}`)
      .join(" ");
  }

  return (
    <div className={cn("w-full", className)}>
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        {series.map((item) => (
          <span key={item.name} className="inline-flex items-center gap-1.5 text-[10px] text-slate-500">
            <span className="h-1.5 w-3 rounded-full" style={{ background: item.color }} />
            {item.name}
          </span>
        ))}
        {unit ? <span className="ml-auto font-sans text-[9px] text-slate-500">{unit}</span> : null}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full overflow-visible" role="img" aria-label="Line chart">
        <defs>
          {series.map((item, index) =>
            item.fill ? (
              <linearGradient key={item.name} id={`${uid}-area-${index}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={item.color} stopOpacity="0.24" />
                <stop offset="100%" stopColor={item.color} stopOpacity="0" />
              </linearGradient>
            ) : null,
          )}
        </defs>
        {tickValues.map((value, index) => (
          <g key={index}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={y(value)}
              y2={y(value)}
              stroke="rgba(37,99,235,0.12)"
              strokeDasharray={index === 0 ? "0" : "3 5"}
            />
            <text x={pad.left - 8} y={y(value) + 3} textAnchor="end" className="fill-slate-500" fontSize="8.5">
              {format(value)}
            </text>
          </g>
        ))}
        {series.map((item, index) => (
          <g key={item.name}>
            {item.fill ? (
              <path
                d={`${pathFor(item.values)} L ${x(item.values.length - 1)} ${pad.top + plotH} L ${x(0)} ${
                  pad.top + plotH
                } Z`}
                fill={`url(#${uid}-area-${index})`}
              />
            ) : null}
            <path
              d={pathFor(item.values)}
              fill="none"
              stroke={item.color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={item.dashed ? "5 5" : undefined}
              style={{ filter: `drop-shadow(0 0 5px ${item.color}55)` }}
            />
            {item.values.length ? (
              <circle
                cx={x(item.values.length - 1)}
                cy={y(item.values[item.values.length - 1])}
                r="2.8"
                fill={item.color}
                stroke="#ffffff"
                strokeWidth="1.4"
              />
            ) : null}
          </g>
        ))}
        {(labels ?? []).map((label, index) =>
          labelIndices.includes(index) ? (
            <text
              key={`${label}-${index}`}
              x={x(index)}
              y={height - 8}
              textAnchor={index === 0 ? "start" : index === maxLen - 1 ? "end" : "middle"}
              className="fill-slate-500"
              fontSize="8.5"
            >
              {label}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  );
}

export function BarChart({
  labels,
  values,
  color = "#2563eb",
  height = 170,
  className,
  highlightIndex,
  formatter,
  unit = "",
}: {
  labels: string[];
  values: number[];
  color?: string;
  height?: number;
  className?: string;
  highlightIndex?: number;
  formatter?: (value: number) => string;
  unit?: string;
}) {
  const max = Math.max(1, ...values);
  const format = formatter ?? ((value: number) => formatNumber(value));
  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-end gap-[3px]" style={{ height }}>
        {values.map((value, index) => {
          const pct = Math.max(2, (value / max) * 100);
          const active = highlightIndex === index;
          return (
            <div key={`${labels[index]}-${index}`} className="group flex h-full flex-1 flex-col justify-end">
              <div
                className="relative w-full rounded-t-[3px] transition-all duration-500"
                style={{
                  height: `${pct}%`,
                  background: active
                    ? "linear-gradient(180deg, #fbbf24, #f59e0b)"
                    : `linear-gradient(180deg, ${color}, ${color}33)`,
                  boxShadow: active ? "0 0 14px #fbbf2466" : `0 0 10px ${color}22`,
                }}
                title={`${labels[index]}: ${format(value)}${unit}`}
              >
                <span className="pointer-events-none absolute inset-x-0 -top-5 hidden text-center font-sans text-[8.5px] text-slate-700 group-hover:block">
                  {format(value)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-[3px]">
        {labels.map((label, index) => (
          <span
            key={`${label}-l-${index}`}
            className={cn(
              "flex-1 truncate text-center font-sans text-[7.5px]",
              highlightIndex === index ? "text-amber-700" : "text-slate-500",
            )}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Donut({
  data,
  size = 148,
  thickness = 16,
  centerLabel,
  centerValue,
  className,
}: {
  data: Array<{ label: string; value: number; color: string }>;
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
  className?: string;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className={cn("flex items-center gap-4", className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#dbeafe"
            strokeWidth={thickness}
          />
          {data.map((item) => {
            const fraction = total ? item.value / total : 0;
            const length = Math.max(0, fraction * circumference - 2);
            const dash = `${length} ${circumference - length}`;
            const element = (
              <circle
                key={item.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={item.color}
                strokeWidth={thickness}
                strokeDasharray={dash}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
                style={{ filter: `drop-shadow(0 0 4px ${item.color}55)` }}
              />
            );
            offset += fraction * circumference;
            return element;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-sans text-xl font-semibold text-slate-900">{centerValue ?? total}</span>
          <span className="mt-0.5 font-sans text-[8px] uppercase tracking-[0.16em] text-slate-500">
            {centerLabel ?? "total"}
          </span>
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        {data.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-2 text-[10.5px]">
            <span className="flex min-w-0 items-center gap-1.5 text-slate-600">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: item.color }} />
              <span className="truncate">{item.label}</span>
            </span>
            <span className="shrink-0 font-sans text-slate-700">
              {item.value}
              <span className="ml-1.5 text-[8.5px] text-slate-500">
                {total ? `${Math.round((item.value / total) * 100)}%` : "0%"}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Gauge({
  value,
  label,
  size = 180,
  color,
  suffix = "%",
}: {
  value: number;
  label: string;
  size?: number;
  color?: string;
  suffix?: string;
}) {
  const v = Math.max(0, Math.min(100, value));
  const tint = color ?? (v >= 70 ? "#34d399" : v >= 45 ? "#fbbf24" : "#fb7185");
  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <svg viewBox="0 0 200 118" width={size} height={(size * 118) / 200}>
        <defs>
          <linearGradient id={`gauge-${tint.slice(1)}`} x1="0" x2="1">
            <stop offset="0%" stopColor={tint} stopOpacity="0.55" />
            <stop offset="100%" stopColor={tint} />
          </linearGradient>
        </defs>
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="#dbeafe"
          strokeWidth="12"
          strokeLinecap="round"
          pathLength={100}
        />
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke={tint}
          strokeWidth="12"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${v} 100`}
          style={{ filter: `drop-shadow(0 0 8px ${tint}77)`, transition: "stroke-dasharray .6s ease" }}
        />
        <text x="100" y="82" textAnchor="middle" className="fill-slate-900" fontSize="26" fontWeight="600" fontFamily="monospace">
          {v.toFixed(0)}
          <tspan fontSize="12" fill="#64748b">
            {suffix}
          </tspan>
        </text>
        <text x="100" y="98" textAnchor="middle" className="fill-slate-500" fontSize="8" letterSpacing="1.6">
          {label.toUpperCase()}
        </text>
      </svg>
    </div>
  );
}

export function Sparkline({
  values,
  color = "#2563eb",
  width = 100,
  height = 28,
  className,
}: {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
  className?: string;
}) {
  if (values.length < 2) return <div style={{ width, height }} className={className} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(0.001, max - min);
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - ((value - min) / span) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 3px ${color}88)` }}
      />
    </svg>
  );
}

export function BarList({
  items,
  max,
  className,
  formatter,
}: {
  items: Array<{ label: string; value: number; display?: string; color?: string; sub?: string }>;
  max?: number;
  className?: string;
  formatter?: (value: number) => string;
}) {
  const ceiling = max ?? Math.max(1, ...items.map((item) => item.value));
  return (
    <div className={cn("space-y-2.5", className)}>
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="min-w-0 truncate text-[11px] text-slate-700">{item.label}</span>
            <span className="shrink-0 font-sans text-[10.5px] text-slate-600">
              {item.display ?? (formatter ? formatter(item.value) : formatNumber(item.value))}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-blue-50">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.max(1, Math.min(100, (item.value / ceiling) * 100))}%`,
                background: `linear-gradient(90deg, ${item.color ?? "#2563eb"}66, ${item.color ?? "#2563eb"})`,
              }}
            />
          </div>
          {item.sub ? <p className="mt-0.5 text-[9px] text-slate-500">{item.sub}</p> : null}
        </div>
      ))}
    </div>
  );
}
