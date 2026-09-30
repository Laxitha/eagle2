"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import StatCard from "@/components/StatCard";
import { endpoints, CaseStats } from "@/lib/api";
import { mockStats, mockRiskAnalysis, mockPatterns, mockEnrichedLeads } from "@/lib/mockData";

export default function DashboardPage() {
  const [stats, setStats] = useState<CaseStats | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    endpoints
      .stats()
      .then((r) => setStats(r.data))
      .catch(() => setStats(mockStats))
      .finally(() => setLoaded(true));
  }, []);

  const empty = loaded && (!stats || stats.records === 0);
  const criticalRisks = mockRiskAnalysis.filter(r => r.risk_level === "critical" || r.risk_level === "high");
  const criticalPatterns = mockPatterns.filter(p => p.severity === "critical");

  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-white mb-1">Dashboard</h1>
      <p className="text-slate-500 text-sm mb-6">
        Evidence → Reason → Action
      </p>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <StatCard label="Entities" value={stats?.entities ?? 0} />
        <StatCard label="Relationships" value={stats?.relationships ?? 0} accent="amber" />
        <StatCard label="Cases" value={stats?.cases ?? 0} />
        <StatCard label="Files" value={stats?.files ?? 0} />
        <StatCard label="Records" value={stats?.records ?? 0} />
      </div>

      {empty ? (
        <div className="bg-surface border border-slate-800 rounded-xl p-8 text-center">
          <h2 className="text-lg font-semibold text-white mb-1">No data yet</h2>
          <p className="text-sm text-slate-400 mb-5">
            Upload case files to build the graph. Nothing is shown until you do.
          </p>
          <Link
            href="/upload"
            className="inline-block rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white"
          >
            Upload case data →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-5">
          {/* Risk Alerts */}
          <div className="bg-surface border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <h2 className="text-sm font-semibold text-white">Risk Alerts</h2>
              </div>
              <Link href="/leads" className="text-xs text-blue hover:underline">View leads →</Link>
            </div>
            <div className="space-y-2">
              {criticalRisks.map(r => {
                const color = r.risk_level === "critical" ? "border-red-500/30 bg-red-500/5" : "border-orange-500/30 bg-orange-500/5";
                const textColor = r.risk_level === "critical" ? "text-red-400" : "text-orange-400";
                return (
                  <div key={r.entity_id} className={`rounded-lg border p-3 ${color}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-white">{r.entity_name}</span>
                      <span className={`text-[10px] font-bold uppercase ${textColor}`}>{r.risk_level}</span>
                    </div>
                    <p className="text-xs text-slate-400">{r.factors[0]}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Critical Patterns */}
          <div className="bg-surface border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-purple-500/20 flex items-center justify-center">
                  <span className="text-purple-400 text-[10px] font-bold">AI</span>
                </div>
                <h2 className="text-sm font-semibold text-white">AI Detected Patterns</h2>
              </div>
              <Link href="/graph" className="text-xs text-blue hover:underline">View graph →</Link>
            </div>
            <div className="space-y-2">
              {mockPatterns.slice(0, 3).map(p => {
                const sevColor = {
                  critical: "border-l-red-500",
                  high: "border-l-orange-500",
                  medium: "border-l-amber-500",
                }[p.severity];
                return (
                  <div key={p.id} className={`border-l-2 rounded-r-lg bg-bg p-3 ${sevColor}`}>
                    <div className="text-xs font-semibold text-white mb-0.5">{p.title}</div>
                    <p className="text-[11px] text-slate-500 line-clamp-2">{p.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Leads */}
          <div className="bg-surface border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white">Top Investigative Leads</h2>
              <Link href="/leads" className="text-xs text-blue hover:underline">All leads →</Link>
            </div>
            <div className="space-y-2">
              {mockEnrichedLeads.slice(0, 3).map(l => {
                const riskColor = {
                  critical: "text-red-400",
                  high: "text-orange-400",
                  medium: "text-amber-400",
                  low: "text-green-400",
                }[l.risk_level];
                return (
                  <div key={l.id} className="flex items-center gap-3 bg-bg rounded-lg p-3">
                    <div className="text-lg font-bold text-amber w-8 text-center">{(l.score * 100).toFixed(0)}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white font-medium">{l.entity_name}</span>
                        <span className={`text-[10px] font-bold uppercase ${riskColor}`}>{l.risk_level}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-1">{l.reason}</p>
                    </div>
                    <div className="text-[10px] text-slate-600">{l.evidence.length} items</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-surface border border-slate-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/upload" className="bg-bg rounded-lg p-4 hover:bg-slate-800/80 transition-colors text-center">
                <div className="text-2xl mb-1">📁</div>
                <div className="text-xs font-medium text-white">Upload Data</div>
                <div className="text-[10px] text-slate-500">CDR, FIR, Financial</div>
              </Link>
              <Link href="/agent" className="bg-bg rounded-lg p-4 hover:bg-slate-800/80 transition-colors text-center">
                <div className="text-2xl mb-1">🤖</div>
                <div className="text-xs font-medium text-white">AI Agent</div>
                <div className="text-[10px] text-slate-500">Ask questions</div>
              </Link>
              <Link href="/graph" className="bg-bg rounded-lg p-4 hover:bg-slate-800/80 transition-colors text-center">
                <div className="text-2xl mb-1">🕸️</div>
                <div className="text-xs font-medium text-white">Knowledge Graph</div>
                <div className="text-[10px] text-slate-500">Explore network</div>
              </Link>
              <Link href="/reports" className="bg-bg rounded-lg p-4 hover:bg-slate-800/80 transition-colors text-center">
                <div className="text-2xl mb-1">📊</div>
                <div className="text-xs font-medium text-white">Reports</div>
                <div className="text-[10px] text-slate-500">Intelligence summary</div>
              </Link>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
