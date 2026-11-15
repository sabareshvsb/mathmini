import { NextResponse } from "next/server";
import { insertSnapshot, loadSnapshots } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ snapshots: loadSnapshots(60) });
  } catch (error) {
    return NextResponse.json({ error: "Unable to read simulation history", detail: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (!body || typeof body.simTime !== "number" || !body.metrics) {
      return NextResponse.json({ error: "Invalid simulation snapshot" }, { status: 400 });
    }
    insertSnapshot(body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Unable to store snapshot", detail: String(error) }, { status: 500 });
  }
}
