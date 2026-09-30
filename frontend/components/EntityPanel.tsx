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
    <div className="w-72 shrink-0 card p-4 h-fit sticky top-8">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wider text-slate-600">{node.label}</span>
        <button onClick={onClose} className="text-slate-600 hover:text-white text-xs transition-colors">&times;</button>
      </div>
      <h3 className="text-sm font-semibold text-white mb-3">{node.name}</h3>

      <div className="text-[10px] uppercase tracking-wider text-slate-600 mb-1.5">
        Connections ({connections.length})
      </div>
      <ul className="space-y-1">
        {connections.map((c, i) => {
          const otherId = c.source === node.id ? c.target : c.source;
          const other = nodeById[otherId];
          return (
            <li key={i} className="text-xs flex items-center justify-between bg-white/[0.02] rounded-lg px-3 py-1.5">
              <span className="text-slate-300">{other?.name ?? otherId}</span>
              <span className="text-blue text-[10px]">{c.type}</span>
            </li>
          );
        })}
        {connections.length === 0 && (
          <li className="text-xs text-slate-600">No connections found.</li>
        )}
      </ul>
    </div>
  );
}
