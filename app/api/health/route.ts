import { NextResponse } from "next/server";
import { databaseStats } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const stats = databaseStats();
    return NextResponse.json({
      ok: true,
      service: "Nova City Traffic API",
      time: new Date().toISOString(),
      websocket: `ws://localhost:${process.env.WS_PORT ?? 4001}`,
      database: stats,
      disclaimer: "All traffic data is simulated for academic demonstration.",
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
