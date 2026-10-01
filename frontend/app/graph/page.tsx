"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import GraphView from "@/components/GraphView";
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
  const [showAnalysis, setShowAnalysis] = useState(true);

  useEffect(() => {
    fetchGraph()
      .then(({ nodes: n, edges: e }) => {
        setNodes(n);
        setEdges(e);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const filteredNodes = useMemo(
    () =>
      nodes.filter(
        (n) =>
          activeTypes.has(n.label) &&
          (search === "" || n.name.toLowerCase().includes(search.toLowerCase()))
      ),
    [nodes, search, activeTypes]
  );
  const visibleIds = new Set(filteredNodes.map((n) => n.id));
  const filteredEdges = edges.filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target));
  const selectedNode = nodes.find((n) => n.id === selectedId) ?? null;

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
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search entities..."
            className="bg-white/[0.03] border border-slate-800/60 rounded-lg px-3 py-1.5 text-xs text-white w-52 focus:outline-none focus:border-blue/40 placeholder:text-slate-600 transition-colors"
          />
        </div>
      </div>

      <div className="flex gap-1.5 mb-4 flex-wrap">
        {TYPES.map((t) => (
          <button
            key={t}
            onClick={() => toggleType(t)}
            className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
              activeTypes.has(t) ? "border-blue/30 text-blue bg-blue/[0.06]" : "border-slate-800/60 text-slate-600"
            }`}
          >
            {t}
          </button>
        ))}
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
          <div className="flex-1 card h-[600px] overflow-hidden">
            <GraphView nodes={filteredNodes} edges={filteredEdges} onNodeClick={setSelectedId} />
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
