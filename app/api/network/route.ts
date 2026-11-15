import { NextResponse } from "next/server";
import { DEFAULT_NETWORK } from "@/lib/graph/city-data";
import type { CityNetwork } from "@/lib/graph/types";
import { loadNetwork, saveNetwork } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validNetwork(value: unknown): value is CityNetwork {
  if (!value || typeof value !== "object") return false;
  const net = value as CityNetwork;
  return (
    Array.isArray(net.nodes) &&
    Array.isArray(net.edges) &&
    net.nodes.length >= 2 &&
    net.edges.length >= 1 &&
    net.nodes.every((n) => typeof n.id === "string" && typeof n.x === "number" && typeof n.y === "number") &&
    net.edges.every(
      (e) =>
        typeof e.id === "string" &&
        typeof e.from === "string" &&
        typeof e.to === "string" &&
        typeof e.lengthKm === "number" &&
        e.lengthKm > 0,
    )
  );
}

export async function GET() {
  try {
    const stored = loadNetwork();
    if (stored && validNetwork(stored)) {
      return NextResponse.json({ network: stored, source: "database" });
    }
    saveNetwork(DEFAULT_NETWORK);
    return NextResponse.json({ network: DEFAULT_NETWORK, source: "seed" });
  } catch (error) {
    return NextResponse.json(
      { error: "Unable to load network", detail: String(error), network: DEFAULT_NETWORK },
      { status: 200 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { network?: unknown };
    if (!validNetwork(body.network)) {
      return NextResponse.json({ error: "Invalid network payload" }, { status: 400 });
    }
    saveNetwork(body.network);
    return NextResponse.json({ ok: true, nodes: body.network.nodes.length, edges: body.network.edges.length });
  } catch (error) {
    return NextResponse.json({ error: "Unable to save network", detail: String(error) }, { status: 500 });
  }
}
