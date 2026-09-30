"use client";

import type { GraphEdge, GraphNode } from "@/lib/api";

export default function EntityPanel({
  node,
  edges,
  nodes,
  onClose,
}: {
  node: GraphNode;
  edges: GraphEdge[];
  nodes: GraphNode[];
  onClose: () => void;
}) {
  const connections = edges.filter((e) => e.source === node.id || e.target === node.id);
  const nodeById = Object.fromEntries(nodes.map((n) => [n.id, n]));

  return (
    <div className="w-80 shrink-0 bg-surface border border-slate-800 rounded-xl p-5 h-fit sticky top-8">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs uppercase tracking-wide text-slate-500">{node.label}</span>
        <button onClick={onClose} className="text-slate-500 hover:text-white text-sm">✕</button>
      </div>
      <h3 className="text-lg font-semibold text-white mb-4">{node.name}</h3>

      <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">
        Connections ({connections.length})
      </div>
      <ul className="space-y-2 mb-4">
        {connections.map((c, i) => {
          const otherId = c.source === node.id ? c.target : c.source;
          const other = nodeById[otherId];
          return (
            <li key={i} className="text-sm flex items-center justify-between bg-slate-900/50 rounded-lg px-3 py-2">
              <span className="text-slate-300">{other?.name ?? otherId}</span>
              <span className="text-blue text-xs">{c.type}</span>
            </li>
          );
        })}
        {connections.length === 0 && (
          <li className="text-sm text-slate-500">No connections found.</li>
        )}
      </ul>
    </div>
  );
}
