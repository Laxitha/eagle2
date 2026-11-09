"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import GraphView, { ENTITY_COLORS } from "@/components/GraphView";
import EntityPanel from "@/components/EntityPanel";
import AnalysisPanel from "@/components/AnalysisPanel";
import type { GraphEdge, GraphNode } from "@/lib/api";
import { fetchGraph } from "@/lib/supabaseData";

const TYPES = ["Person", "Phone", "Case", "Vehicle", "Account", "Location"] as const;

export default function GraphPage() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set(TYPES));
  const [showAnalysis, setShowAnalysis] = useState(false);
  // "all", "demo" (seeded data with no source file), or one uploaded file name
  const [source, setSource] = useState<string>("all");

  useEffect(() => {
    fetchGraph()
      .then(({ nodes: n, edges: e }) => {
        setNodes(n);
        setEdges(e);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const sources = useMemo(() => {
    const files = new Map<string, number>();
    let demo = 0;
    for (const n of nodes) {
      if (n.source) files.set(n.source, (files.get(n.source) ?? 0) + 1);
      else demo++;
    }
    return { files: Array.from(files.entries()).sort((a, b) => b[1] - a[1]), demo };
  }, [nodes]);

  // Default to uploaded data only, once there is some: the seeded demo
  // cluster otherwise sits tangled in among real cases.
  useEffect(() => {
    if (loaded && source === "all" && sources.files.length && sources.demo) setSource("uploads");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const filteredNodes = useMemo(
    () =>
      nodes.filter(
        (n) =>
          activeTypes.has(n.label) &&
          (source === "all" ||
            (source === "uploads" && !!n.source) ||
            (source === "demo" && !n.source) ||
            n.source === source)
      ),
    [nodes, activeTypes, source]
  );
  const visibleIds = useMemo(() => new Set(filteredNodes.map((n) => n.id)), [filteredNodes]);
  const filteredEdges = useMemo(
    () => edges.filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target)),
    [edges, visibleIds]
  );
  // Search highlights matches in place rather than removing their context.
  const highlightIds = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    return new Set(filteredNodes.filter((n) => n.name.toLowerCase().includes(q)).map((n) => n.id));
  }, [search, filteredNodes]);
  const selectedNode = nodes.find((n) => n.id === selectedId) ?? null;
  const typeCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const n of nodes) {
      if (source === "all" || (source === "uploads" && n.source) || (source === "demo" && !n.source) || n.source === source)
        c[n.label] = (c[n.label] ?? 0) + 1;
    }
    return c;
  }, [nodes, source]);

  const toggleType = (t: string) =>
    setActiveTypes((prev) => {
      const next = new Set(prev);
      next.has(t) ? next.delete(t) : next.add(t);
      return next;
    });

  const handleHighlightEntity = (entityId: string) => {
    setSelectedId(entityId);
  };

  const empty = loaded && nodes.length === 0;

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-white tracking-tight">Knowledge Graph</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAnalysis(!showAnalysis)}
            className={`flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg border transition-colors ${
              showAnalysis
                ? "border-purple-500/30 text-purple-400 bg-purple-500/[0.06]"
                : "border-slate-800/60 text-slate-600 hover:text-slate-400"
            }`}
          >
            <span className="text-[9px] font-bold">AI</span>
            Analysis
          </button>
          <select
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              setSelectedId(null);
            }}
            className="bg-white/[0.03] border border-slate-800/60 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue/40"
          >
            <option value="all">All data</option>
            {sources.files.length > 0 && <option value="uploads">All uploaded files</option>}
            {sources.files.map(([f, n]) => (
              <option key={f} value={f}>
                {f} ({n})
              </option>
            ))}
            {sources.demo > 0 && <option value="demo">Demo data ({sources.demo})</option>}
          </select>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search entities..."
            className="bg-white/[0.03] border border-slate-800/60 rounded-lg px-3 py-1.5 text-xs text-white w-52 focus:outline-none focus:border-blue/40 placeholder:text-slate-600 transition-colors"
          />
        </div>
      </div>

      <div className="flex gap-1.5 mb-4 flex-wrap">
        {TYPES.filter((t) => typeCounts[t]).map((t) => (
          <button
            key={t}
            onClick={() => toggleType(t)}
            title={activeTypes.has(t) ? `Hide ${t}` : `Show ${t}`}
            className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
              activeTypes.has(t) ? "border-slate-700 text-slate-200 bg-white/[0.03]" : "border-slate-800/60 text-slate-600 line-through"
            }`}
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: ENTITY_COLORS[t], opacity: activeTypes.has(t) ? 1 : 0.3 }}
            />
            {t}
            <span className="text-slate-500">{typeCounts[t]}</span>
          </button>
        ))}
        <span className="ml-auto self-center text-[11px] text-slate-600">
          {highlightIds
            ? `${highlightIds.size} match${highlightIds.size === 1 ? "" : "es"}`
            : "Click a node to focus on its connections · scroll to zoom for all names"}
        </span>
      </div>

      {empty ? (
        <div className="card h-[600px] flex flex-col items-center justify-center">
          <p className="text-slate-400 mb-1">The graph is empty.</p>
          <p className="text-xs text-slate-600 mb-5">Upload case files to build the network.</p>
          <Link href="/upload" className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white">
            Upload case data &rarr;
          </Link>
        </div>
      ) : (
        <div className="flex gap-3">
          <div className="flex-1 card h-[calc(100vh-220px)] min-h-[520px] overflow-hidden">
            <GraphView
              nodes={filteredNodes}
              edges={filteredEdges}
              selectedId={selectedId}
              highlightIds={highlightIds}
              onNodeClick={(id) => setSelectedId((cur) => (cur === id ? null : id))}
              onBackgroundClick={() => setSelectedId(null)}
            />
          </div>
          {showAnalysis && (
            <AnalysisPanel onHighlightEntity={handleHighlightEntity} />
          )}
          {selectedNode && !showAnalysis && (
            <EntityPanel
              node={selectedNode}
              edges={edges}
              nodes={nodes}
              onClose={() => setSelectedId(null)}
            />
          )}
        </div>
      )}

      {selectedNode && showAnalysis && (
        <div className="mt-3">
          <EntityPanel
            node={selectedNode}
            edges={edges}
            nodes={nodes}
            onClose={() => setSelectedId(null)}
          />
        </div>
      )}
    </AppShell>
  );
}
