import { NextResponse } from "next/server";
import { recordReport } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ReportBody {
  range?: "daily" | "weekly" | "monthly";
  hourlyVolume?: number[];
  hourlyCongestion?: number[];
  daily?: Array<{ label: string; volume: number; congestion: number; waiting: number }>;
  monthly?: Array<{ label: string; volume: number; congestion: number; waiting: number }>;
  metrics?: Record<string, number>;
}

function escape(value: unknown): string {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: unknown[][]): string {
  return rows.map((row) => row.map(escape).join(",")).join("\r\n");
}

export async function GET() {
  return NextResponse.json({
    message: "POST simulation analytics to generate a CSV report.",
    example: { range: "daily", hourlyVolume: [1200], hourlyCongestion: [55] },
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ReportBody;
    const range = body.range ?? "daily";
    let rows: unknown[][];
    if (range === "daily") {
      rows = [["Hour", "Vehicle Volume", "Congestion Index (%)", "Flow Efficiency (%)"]];
      for (let hour = 0; hour < 24; hour++) {
        const congestion = Number(body.hourlyCongestion?.[hour] ?? 0);
        rows.push([
          `${String(hour).padStart(2, "0")}:00`,
          Math.round(Number(body.hourlyVolume?.[hour] ?? 0)),
          congestion.toFixed(1),
          Math.max(0, 100 - congestion).toFixed(1),
        ]);
      }
    } else if (range === "weekly") {
      rows = [["Day", "Simulated Volume", "Congestion Index", "Avg Waiting (s)"]];
      for (const day of body.daily ?? []) {
        rows.push([day.label, day.volume, day.congestion, day.waiting]);
      }
    } else {
      rows = [["Day", "Simulated Volume", "Congestion Index", "Avg Waiting (s)"]];
      for (const day of body.monthly ?? []) {
        rows.push([day.label, day.volume, day.congestion, day.waiting]);
      }
    }
    const metrics = body.metrics ?? {};
    rows.push([]);
    rows.push(["Report generated", new Date().toISOString()]);
    rows.push(["Data classification", "SIMULATION DATA — not real-world measured traffic"]);
    rows.push(["Active vehicles", metrics.activeVehicles ?? 0]);
    rows.push(["Flow efficiency (%)", metrics.flowEfficiency ?? 0]);
    rows.push(["Average waiting time (s)", metrics.avgWaitingSec ?? 0]);
    const csv = toCsv(rows);
    recordReport(range, rows.length);
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="bengaluru-${range}-report.csv"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "Unable to generate report", detail: String(error) }, { status: 500 });
  }
}
