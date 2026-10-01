"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import StatCard from "@/components/StatCard";
import type { CaseStats } from "@/lib/api";
import { mockStats, mockRiskAnalysis, mockPatterns, mockEnrichedLeads } from "@/lib/mockData";
import type { RiskAnalysis, PatternDetection, EnrichedLead } from "@/lib/mockData";
import { fetchStats, fetchRiskAnalysis, fetchPatterns, fetchLeads } from "@/lib/supabaseData";

export default function DashboardPage() {
  const [stats, setStats] = useState<CaseStats | null>(null);
  const [risks, setRisks] = useState<RiskAnalysis[]>(mockRiskAnalysis);
  const [patterns, setPatterns] = useState<PatternDetection[]>(mockPatterns);
  const [leads, setLeads] = useState<EnrichedLead[]>(mockEnrichedLeads);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchStats().catch(() => null),
      fetchRiskAnalysis().catch(() => []),
      fetchPatterns().catch(() => []),
      fetchLeads().catch(() => []),
    ]).then(([s, r, p, l]) => {
      setStats(s ?? mockStats);
      if (r.length > 0) setRisks(r);
      if (p.length > 0) setPatterns(p);
      if (l.length > 0) setLeads(l);
      setLoaded(true);
    });
  }, []);

  const empty = loaded && (!stats || stats.records === 0);
  const criticalRisks = risks.filter(r => r.risk_level === "critical" || r.risk_level === "high");

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white tracking-tight">Dashboard</h1>
        <p className="text-slate-600 text-xs mt-0.5">Evidence &rarr; Reason &rarr; Action</p>
      </div>

      <div className="grid grid-cols-5 gap-3 mb-6">
        <StatCard label="Entities" value={stats?.entities ?? 0} />
        <StatCard label="Relationships" value={stats?.relationships ?? 0} accent="amber" />
        <StatCard label="Cases" value={stats?.cases ?? 0} accent="red" />
        <StatCard label="Files" value={stats?.files ?? 0} accent="purple" />
        <StatCard label="Records" value={stats?.records ?? 0} accent="green" />
      </div>

      {empty ? (
        <div className="card p-10 text-center">
          <h2 className="text-base font-semibold text-white mb-1">No data yet</h2>
          <p className="text-sm text-slate-500 mb-5">
            Upload case files to build the graph.
          </p>
          <Link
            href="/upload"
            className="inline-block rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white"
          >
            Upload case data &rarr;
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {/* Risk Alerts */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Risk Alerts</h2>
              </div>
              <Link href="/leads" className="text-[11px] text-blue hover:underline">View leads &rarr;</Link>
            </div>
            <div className="space-y-2">
              {criticalRisks.map(r => {
                const color = r.risk_level === "critical" ? "border-red-500/20 bg-red-500/[0.03]" : "border-orange-500/20 bg-orange-500/[0.03]";
                const textColor = r.risk_level === "critical" ? "text-red-400" : "text-orange-400";
                return (
                  <div key={r.entity_id} className={`rounded-lg border p-3 ${color}`}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-sm font-medium text-white">{r.entity_name}</span>
                      <span className={`text-[10px] font-bold uppercase ${textColor}`}>{r.risk_level}</span>
                    </div>
                    <p className="text-[11px] text-slate-500">{r.factors[0]}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Critical Patterns */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-purple-500/10 flex items-center justify-center">
                  <span className="text-purple-400 text-[9px] font-bold">AI</span>
                </div>
                <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">AI Patterns</h2>
              </div>
              <Link href="/graph" className="text-[11px] text-blue hover:underline">View graph &rarr;</Link>
            </div>
            <div className="space-y-2">
              {patterns.slice(0, 3).map(p => {
                const sevColor = {
                  critical: "border-l-red-500/60",
                  high: "border-l-orange-500/60",
                  medium: "border-l-amber-500/60",
                }[p.severity];
                return (
                  <div key={p.id} className={`border-l-2 rounded-r-lg bg-white/[0.02] p-3 ${sevColor}`}>
                    <div className="text-xs font-medium text-white mb-0.5">{p.title}</div>
                    <p className="text-[11px] text-slate-600 line-clamp-2">{p.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Leads */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Top Leads</h2>
              <Link href="/leads" className="text-[11px] text-blue hover:underline">All leads &rarr;</Link>
            </div>
            <div className="space-y-2">
              {leads.slice(0, 3).map(l => {
                const riskColor = {
                  critical: "text-red-400",
                  high: "text-orange-400",
                  medium: "text-amber-400",
                  low: "text-green-400",
                }[l.risk_level];
                return (
                  <div key={l.id} className="flex items-center gap-3 bg-white/[0.02] rounded-lg p-3">
                    <div className="text-base font-bold text-amber w-7 text-center">{(l.score * 100).toFixed(0)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white font-medium">{l.entity_name}</span>
                        <span className={`text-[10px] font-bold uppercase ${riskColor}`}>{l.risk_level}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 truncate">{l.reason}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card p-5">
            <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { href: "/upload", label: "Upload Data", sub: "CDR, FIR, Financial", icon: "\u{2191}" },
                { href: "/agent", label: "AI Agent", sub: "Ask questions", icon: "\u{2726}" },
                { href: "/graph", label: "Knowledge Graph", sub: "Explore network", icon: "\u{25CE}" },
                { href: "/reports", label: "Reports", sub: "Intelligence summary", icon: "\u{25A3}" },
              ].map(a => (
                <Link key={a.href} href={a.href} className="bg-white/[0.02] rounded-lg p-3.5 hover:bg-white/[0.04] transition-colors border border-transparent hover:border-slate-800/60">
                  <div className="text-lg text-blue mb-1.5">{a.icon}</div>
                  <div className="text-xs font-medium text-white">{a.label}</div>
                  <div className="text-[10px] text-slate-600">{a.sub}</div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
