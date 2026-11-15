import { NextResponse } from "next/server";
import { DEFAULT_NETWORK } from "@/lib/graph/city-data";
import {
  alternativeRoutes,
  comparePathAlgorithms,
  dijkstra,
  emptyContext,
  kruskal,
  prim,
} from "@/lib/graph/algorithms";
import type { CityNetwork, RouteWeights, WeightContext, WeightMode } from "@/lib/graph/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RequestBody {
  action?: "shortest" | "compare" | "mst" | "alternatives";
  network?: CityNetwork;
  source?: string;
  target?: string;
  mode?: WeightMode;
  weights?: RouteWeights;
  density?: Record<string, number>;
  blocked?: Record<string, boolean>;
  incident?: Record<string, boolean>;
  signalDelayMin?: Record<string, number>;
  algorithm?: "kruskal" | "prim";
}

function networkFrom(body: RequestBody): CityNetwork {
  const network = body.network;
  if (!network?.nodes?.length || !network?.edges?.length) return DEFAULT_NETWORK;
  return network;
}

function contextFrom(body: RequestBody): WeightContext {
  const ctx = emptyContext();
  for (const [id, density] of Object.entries(body.density ?? {})) {
    ctx.density[id] = Number(density);
  }
  for (const [id, blocked] of Object.entries(body.blocked ?? {})) {
    ctx.blocked[id] = Boolean(blocked);
  }
  for (const [id, incident] of Object.entries(body.incident ?? {})) {
    ctx.incident[id] = Boolean(incident);
  }
  for (const [id, delay] of Object.entries(body.signalDelayMin ?? {})) {
    ctx.signalDelayMin[id] = Number(delay);
  }
  return ctx;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const network = networkFrom(body);
    const source = body.source ?? network.nodes[0].id;
    const target = body.target ?? network.nodes[network.nodes.length - 1].id;
    const mode = body.mode ?? "time";
    const ctx = contextFrom(body);
    const action = body.action ?? "shortest";

    if (action === "mst") {
      const [k, p] = [kruskal(network, ctx), prim(network, network.nodes[0].id, ctx)];
      return NextResponse.json({
        action,
        kruskal: k,
        prim: p,
        graph: { nodes: network.nodes.length, edges: network.edges.length },
      });
    }

    if (action === "alternatives") {
      const primary = dijkstra(network, source, target, { mode, ctx, weights: body.weights });
      const alternatives = alternativeRoutes(network, source, target, { mode, ctx, weights: body.weights }, 2);
      return NextResponse.json({ action, primary, alternatives });
    }

    if (action === "compare") {
      const result = comparePathAlgorithms(network, source, target, { mode, ctx, weights: body.weights });
      return NextResponse.json({ action, result, graph: { nodes: network.nodes.length, edges: network.edges.length } });
    }

    const result = dijkstra(network, source, target, { mode, ctx, weights: body.weights });
    return NextResponse.json({ action: "shortest", result });
  } catch (error) {
    return NextResponse.json({ error: "Algorithm execution failed", detail: String(error) }, { status: 500 });
  }
}
