"use client";

import { useMemo, useState } from "react";
import {
  GitBranch,
  Network as NetworkIcon,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Waypoints,
} from "lucide-react";
import { useTrafficStore } from "@/lib/store/traffic-store";
import { networkStats } from "@/lib/graph/city-data";
import type { MstResult } from "@/lib/graph/types";
import { NetworkMap } from "@/components/network-map";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  Modal,
  PageHeader,
  SectionHeader,
  Select,
  SimulationNote,
  StatCard,
} from "@/components/ui";

export default function NetworkPage() {
  const network = useTrafficStore((state) => state.network);
  const source = useTrafficStore((state) => state.source);
  const destination = useTrafficStore((state) => state.destination);
  const mstEdges = useTrafficStore((state) => state.mstEdges);
  const addNode = useTrafficStore((state) => state.addNode);
  const removeNode = useTrafficStore((state) => state.removeNode);
  const addEdge = useTrafficStore((state) => state.addEdge);
  const removeEdge = useTrafficStore((state) => state.removeEdge);
  const runMst = useTrafficStore((state) => state.runMst);
  const resetNetwork = useTrafficStore((state) => state.resetNetwork);
  const setSource = useTrafficStore((state) => state.setSource);
  const setDestination = useTrafficStore((state) => state.setDestination);
  const [mst, setMst] = useState<MstResult | null>(null);
  const [nodeOpen, setNodeOpen] = useState(false);
  const [edgeOpen, setEdgeOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [nodeForm, setNodeForm] = useState({ name: "", district: "Central" });
  const [edgeForm, setEdgeForm] = useState({
    from: source,
    to: destination,
    name: "",
    lengthKm: 1.2,
    speedLimit: 50,
    lanes: 2,
    baseDemand: 0.4,
  });

  const stats = useMemo(() => {
    const base = networkStats(network);
    const possible = Math.max(1, (base.vertices * (base.vertices - 1)) / 2);
    return { ...base, density: base.edges / possible };
  }, [network]);
  const degrees = useMemo(() => {
    const map = new Map<string, number>();
    for (const node of network.nodes) map.set(node.id, 0);
    for (const edge of network.edges) {
      map.set(edge.from, (map.get(edge.from) ?? 0) + 1);
      map.set(edge.to, (map.get(edge.to) ?? 0) + 1);
    }
    return map;
  }, [network]);

  const filteredNodes = network.nodes.filter((node) => {
    if (!query.trim()) return true;
    const text = `${node.id} ${node.name} ${node.district}`.toLowerCase();
    return text.includes(query.trim().toLowerCase());
  });

  function submitNode() {
    if (!nodeForm.name.trim()) return;
    addNode({ name: nodeForm.name, district: nodeForm.district });
    setNodeForm({ name: "", district: "Central" });
    setNodeOpen(false);
  }

  function submitEdge() {
    const ok = addEdge({
      from: edgeForm.from,
      to: edgeForm.to,
      name: edgeForm.name,
      lengthKm: Number(edgeForm.lengthKm),
      speedLimit: Number(edgeForm.speedLimit),
      lanes: Number(edgeForm.lanes),
      baseDemand: Number(edgeForm.baseDemand),
    });
    if (ok) {
      setEdgeForm({ ...edgeForm, name: "" });
      setEdgeOpen(false);
    }
  }

  function compute(kind: "kruskal" | "prim") {
    setMst(runMst(kind));
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Topology"
        title="Graph network editor"
        description="Bengaluru is a weighted undirected graph G = (V, E). Inspect vertices and edges, add or remove road segments, and compute a minimum spanning tree over the current road costs."
        actions={
          <>
            <Button size="sm" variant="secondary" onClick={() => setNodeOpen(true)}>
              <Plus size={12} /> Intersection
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setEdgeOpen(true)}>
              <Plus size={12} /> Road
            </Button>
            <Button size="sm" variant="ghost" onClick={resetNetwork}>
              <RotateCcw size={12} /> Restore sample
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Intersections" value={stats.vertices} unit="V" icon={NetworkIcon} accent="#2563eb" hint="Graph vertices" />
        <StatCard label="Road segments" value={stats.edges} unit="E" icon={GitBranch} accent="#34d399" hint="Undirected edges" delay={1} />
        <StatCard label="Average degree" value={stats.avgDegree.toFixed(2)} icon={Waypoints} accent="#a78bfa" hint="Connectivity measure" delay={2} />
        <StatCard label="Graph density" value={stats.density.toFixed(3)} icon={Sparkles} accent="#fbbf24" hint="Actual / possible edges" delay={3} />
        <StatCard
          label="Connected parts"
          value={mst?.components ?? "—"}
          icon={NetworkIcon}
          accent="#fb923c"
          hint="Via MST union-find"
          delay={4}
        />
        <StatCard
          label="MST cost"
          value={mst ? mst.totalWeight.toFixed(1) : "—"}
          unit={mst ? "km" : undefined}
          icon={GitBranch}
          accent="#fb7185"
          hint={mst ? `${mst.edges.length} selected roads` : "Run Kruskal or Prim"}
          delay={5}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100 px-4 py-3">
            <SectionHeader eyebrow="Graph view" title="City topology" className="flex-1" />
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone="cyan">{network.nodes.length} vertices</Badge>
              <Badge tone="green">{network.edges.length} edges</Badge>
              {mst ? <Badge tone="violet">{mst.algorithm} MST</Badge> : null}
            </div>
          </div>
          <NetworkMap height="clamp(380px, 54vh, 620px)" useGlobalMst showLabels />
          <div className="flex flex-wrap items-center gap-2 border-t border-blue-100 px-4 py-2.5">
            <Button size="sm" variant="outline" onClick={() => compute("kruskal")}>
              <GitBranch size={12} /> Kruskal MST
            </Button>
            <Button size="sm" variant="outline" onClick={() => compute("prim")}>
              <GitBranch size={12} /> Prim MST
            </Button>
            {mst ? (
              <span className="font-mono text-[9px] text-slate-500">
                {mst.edges.length} roads · {mst.totalWeight} km · {mst.executionMs} ms
              </span>
            ) : (
              <span className="font-mono text-[9px] text-slate-500">MST edges highlighted in emerald</span>
            )}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <SectionHeader
              eyebrow="Vertices"
              title="Intersection registry"
              actions={
                <Button size="sm" variant="ghost" onClick={() => setNodeOpen(true)}>
                  <Plus size={11} /> Add
                </Button>
              }
            />
            <div className="relative mt-3">
              <Search size={12} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search ID, name or district"
                className="pl-7"
              />
            </div>
            <div className="scroll-area mt-2 max-h-[300px] space-y-1 overflow-y-auto pr-1">
              {filteredNodes.map((node) => (
                <div
                  key={node.id}
                  className="group flex items-center gap-2 rounded-lg border border-blue-100 bg-slate-50 px-2.5 py-1.5"
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-blue-200 bg-blue-500/[0.07] font-mono text-[8px] text-blue-700">
                    {node.id}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[10.5px] text-slate-700">{node.name}</p>
                    <p className="font-mono text-[8px] text-slate-500">
                      {node.district} · degree {degrees.get(node.id) ?? 0}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSource(node.id)}
                    className="shrink-0 font-mono text-[8px] text-blue-700/70 opacity-0 transition hover:text-blue-700 group-hover:opacity-100"
                    title="Set as origin"
                  >
                    A
                  </button>
                  <button
                    type="button"
                    onClick={() => setDestination(node.id)}
                    className="shrink-0 font-mono text-[8px] text-violet-700/70 opacity-0 transition hover:text-violet-700 group-hover:opacity-100"
                    title="Set as destination"
                  >
                    B
                  </button>
                  <button
                    type="button"
                    onClick={() => removeNode(node.id)}
                    className="shrink-0 text-slate-500 transition hover:text-rose-700"
                    aria-label={`Remove ${node.id}`}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <SectionHeader eyebrow="Union-find / cut" title={mst ? `${mst.algorithm} result` : "Minimum spanning tree"} />
            {mst ? (
              <>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                  <Mini label="Roads" value={mst.edges.length} />
                  <Mini label="Cost" value={`${mst.totalWeight} km`} />
                  <Mini label="Components" value={mst.components} />
                </div>
                <div className="scroll-area mt-2 max-h-[120px] space-y-0.5 overflow-y-auto pr-1 font-mono text-[8.5px] text-slate-500">
                  {mst.log.slice(-12).map((line, index) => (
                    <p key={index} className="truncate">
                      {line}
                    </p>
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-2 text-[10.5px] leading-relaxed text-slate-500">
                Kruskal sorts all roads by length and unions components; Prim grows a cheapest-edge tree from one seed.
                Both produce a minimum connected backbone over the same weighted graph.
              </p>
            )}
          </Card>
        </div>
      </div>

      <Card className="p-4">
        <SectionHeader
          eyebrow="Edge registry"
          title="Road segments"
          subtitle="Each edge stores length, speed limit, lanes and base demand. Live congestion modifies its effective routing weight."
          actions={<Badge tone="slate">{network.edges.length} edges</Badge>}
        />
        <div className="scroll-area mt-3 max-h-[360px] overflow-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead className="sticky top-0 bg-white font-mono text-[8px] uppercase tracking-[0.12em] text-slate-500 backdrop-blur">
              <tr>
                <th className="px-2 py-2">ID</th>
                <th className="px-2 py-2">Road</th>
                <th className="px-2 py-2">From → To</th>
                <th className="px-2 py-2">Corridor</th>
                <th className="px-2 py-2 text-right">Length</th>
                <th className="px-2 py-2 text-right">Limit</th>
                <th className="px-2 py-2 text-right">Lanes</th>
                <th className="px-2 py-2 text-right">Demand</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {network.edges.map((edge) => (
                <tr key={edge.id} className="border-t border-blue-100 text-[10px] text-slate-600 hover:bg-blue-50">
                  <td className="px-2 py-1.5 font-mono text-blue-700/80">{edge.id}</td>
                  <td className="px-2 py-1.5">{edge.name}</td>
                  <td className="px-2 py-1.5 font-mono text-slate-500">
                    {edge.from} → {edge.to}
                  </td>
                  <td className="px-2 py-1.5">{edge.corridor}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{edge.lengthKm} km</td>
                  <td className="px-2 py-1.5 text-right font-mono">{edge.speedLimit}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{edge.lanes}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{(edge.baseDemand * 100).toFixed(0)}%</td>
                  <td className="px-2 py-1.5 text-right">
                    <button
                      type="button"
                      onClick={() => removeEdge(edge.id)}
                      className="text-slate-500 transition hover:text-rose-700"
                      aria-label={`Remove ${edge.id}`}
                    >
                      <Trash2 size={11} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
        <SimulationNote />
        <div className="flex items-center gap-1.5 rounded-lg border border-blue-100 bg-slate-50 px-3 py-2 font-mono text-[8.5px] text-slate-500">
          {mstEdges?.length ? `${mstEdges.length} MST edges highlighted on map` : "MST overlay is currently empty"}
        </div>
      </div>

      <Modal
        open={nodeOpen}
        onClose={() => setNodeOpen(false)}
        title="Add intersection"
        subtitle="A new vertex will be placed on the city plan and persisted to the SQLite network store."
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setNodeOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" onClick={submitNode} disabled={!nodeForm.name.trim()}>
              <Plus size={12} /> Create intersection
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Intersection name">
            <Input
              value={nodeForm.name}
              onChange={(event) => setNodeForm({ ...nodeForm, name: event.target.value })}
              placeholder="e.g. Harbour Link Junction"
              autoFocus
            />
          </Field>
          <Field label="District">
            <Select value={nodeForm.district} onChange={(event) => setNodeForm({ ...nodeForm, district: event.target.value })}>
              {["Central", "North", "North East", "East", "South East", "South", "South West", "West", "North West"].map((district) => (
                <option key={district} value={district}>
                  {district}
                </option>
              ))}
            </Select>
          </Field>
          <p className="rounded-lg border border-amber-200 bg-amber-400/[0.04] px-3 py-2 text-[10px] leading-relaxed text-amber-700/60">
            Coordinates are generated deterministically from the graph canvas so the node participates immediately in
            routing and simulation.
          </p>
        </div>
      </Modal>

      <Modal
        open={edgeOpen}
        onClose={() => setEdgeOpen(false)}
        title="Add road segment"
        subtitle="The edge is added as a bidirectional weighted connection between two intersections."
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setEdgeOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" onClick={submitEdge}>
              <Plus size={12} /> Open road
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="From intersection">
            <Select value={edgeForm.from} onChange={(event) => setEdgeForm({ ...edgeForm, from: event.target.value })}>
              {network.nodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.id} · {node.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="To intersection">
            <Select value={edgeForm.to} onChange={(event) => setEdgeForm({ ...edgeForm, to: event.target.value })}>
              {network.nodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.id} · {node.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Road name" className="sm:col-span-2">
            <Input
              value={edgeForm.name}
              onChange={(event) => setEdgeForm({ ...edgeForm, name: event.target.value })}
              placeholder="e.g. Harbour Connector"
            />
          </Field>
          <Field label="Length (km)">
            <Input
              type="number"
              min={0.1}
              step={0.1}
              value={edgeForm.lengthKm}
              onChange={(event) => setEdgeForm({ ...edgeForm, lengthKm: Number(event.target.value) })}
            />
          </Field>
          <Field label="Speed limit (km/h)">
            <Input
              type="number"
              min={15}
              step={5}
              value={edgeForm.speedLimit}
              onChange={(event) => setEdgeForm({ ...edgeForm, speedLimit: Number(event.target.value) })}
            />
          </Field>
          <Field label="Lanes">
            <Input
              type="number"
              min={1}
              max={8}
              value={edgeForm.lanes}
              onChange={(event) => setEdgeForm({ ...edgeForm, lanes: Number(event.target.value) })}
            />
          </Field>
          <Field label="Base demand (0–1)">
            <Input
              type="number"
              min={0.05}
              max={1}
              step={0.05}
              value={edgeForm.baseDemand}
              onChange={(event) => setEdgeForm({ ...edgeForm, baseDemand: Number(event.target.value) })}
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-blue-100 bg-slate-50 px-2 py-1.5">
      <p className="font-mono text-[7.5px] uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-0.5 font-mono text-[10.5px] text-slate-700">{value}</p>
    </div>
  );
}

