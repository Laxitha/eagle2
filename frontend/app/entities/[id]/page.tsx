"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import AppShell from "@/components/AppShell";
import GraphView from "@/components/GraphView";
import { mockEdges, mockNodes } from "@/lib/mockData";
import { fetchGraph } from "@/lib/supabaseData";
import type { GraphNode, GraphEdge } from "@/lib/api";

const TIMELINE = [
  { date: "06-02", activity: 1 },
  { date: "06-04", activity: 3 },
  { date: "06-06", activity: 4 },
  { date: "06-10", activity: 2 },
  { date: "06-14", activity: 5 },
  { date: "06-20", activity: 2 },
];

export default function EntityDetailPage({ params }: { params: { id: string } }) {
  const [allNodes, setAllNodes] = useState<GraphNode[]>(mockNodes);
  const [allEdges, setAllEdges] = useState<GraphEdge[]>(mockEdges);

  useEffect(() => {
    fetchGraph()
      .then(({ nodes, edges }) => {
        if (nodes.length > 0) {
          setAllNodes(nodes);
          setAllEdges(edges);
        }
      })
      .catch(() => {});
  }, []);

  const node = allNodes.find((n) => n.id === params.id) ?? allNodes[0];
  const connections = allEdges.filter((e) => e.source === node.id || e.target === node.id);
  const neighborIds = new Set([node.id, ...connections.flatMap((c) => [c.source, c.target])]);
  const miniNodes = allNodes.filter((n) => neighborIds.has(n.id));

  return (
    <AppShell>
      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-2xl font-bold text-white">{node.name}</h1>
        <span className="text-xs px-2 py-1 rounded-full bg-blue/15 text-blue">{node.label}</span>
      </div>
      <p className="text-slate-400 mb-6">{node.id} · {connections.length} connections</p>

      <div className="grid grid-cols-2 gap-5 mb-5">
        <div className="bg-surface border border-slate-800 rounded-xl h-72">
          <GraphView nodes={miniNodes} edges={connections} />
        </div>
        <div className="bg-surface border border-slate-800 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4">Timeline</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={TIMELINE}>
              <CartesianGrid stroke="#1e293b" />
              <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155" }} />
              <Line type="monotone" dataKey="activity" stroke="#3b82f6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-surface border border-slate-800 rounded-xl p-5">
        <h2 className="text-white font-semibold mb-3">Evidence</h2>
        <ul className="space-y-2">
          {connections.map((c, i) => (
            <li key={i} className="flex justify-between text-sm bg-slate-900/50 rounded-lg px-3 py-2">
              <span className="text-slate-300">{c.type} → {c.target === node.id ? c.source : c.target}</span>
              <span className="text-slate-500">confidence {(c.confidence * 100).toFixed(0)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  );
}
