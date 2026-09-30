"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import GraphView from "@/components/GraphView";
import EntityPanel from "@/components/EntityPanel";
import { endpoints, GraphEdge, GraphNode } from "@/lib/api";
import { mockNodes, mockEdges as mockEdgesData } from "@/lib/mockData";

const TYPES = ["Person", "Phone", "Case", "Vehicle", "Account", "Location"] as const;

export default function GraphPage() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set(TYPES));

  useEffect(() => {
    endpoints
      .graph()
      .then((r) => {
        setNodes(r.data.nodes || []);
        setEdges(r.data.edges || []);
      })
      .catch(() => {
        setNodes(mockNodes);
        setEdges(mockEdgesData);
      })
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

  const empty = loaded && nodes.length === 0;

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-white">Knowledge Graph</h1>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search entities..."
          className="bg-surface border border-slate-800 rounded-lg px-3 py-2 text-sm text-white w-64 focus:outline-none focus:border-blue"
        />
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {TYPES.map((t) => (
          <button
            key={t}
            onClick={() => toggleType(t)}
            className={`text-xs px-3 py-1.5 rounded-full border ${
              activeTypes.has(t) ? "border-blue text-blue bg-blue/10" : "border-slate-700 text-slate-500"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {empty ? (
        <div className="bg-surface border border-slate-800 rounded-xl h-[600px] flex flex-col items-center justify-center">
          <p className="text-slate-300 mb-1">The graph is empty.</p>
          <p className="text-sm text-slate-500 mb-5">Upload case files to build the network.</p>
          <Link href="/upload" className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white">
            Upload case data →
          </Link>
        </div>
      ) : (
        <div className="flex gap-5">
          <div className="flex-1 bg-surface border border-slate-800 rounded-xl h-[600px]">
            <GraphView nodes={filteredNodes} edges={filteredEdges} onNodeClick={setSelectedId} />
          </div>
          {selectedNode && (
            <EntityPanel
              node={selectedNode}
              edges={edges}
              nodes={nodes}
              onClose={() => setSelectedId(null)}
            />
          )}
        </div>
      )}
    </AppShell>
  );
}
