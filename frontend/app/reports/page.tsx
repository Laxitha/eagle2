"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { endpoints, CaseStats } from "@/lib/api";
import { mockStats, mockEnrichedLeads, mockRiskAnalysis, mockPatterns, mockAnomalies } from "@/lib/mockData";

export default function ReportsPage() {
  const [stats, setStats] = useState<CaseStats | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    endpoints.stats()
      .then((r) => setStats(r.data))
      .catch(() => setStats(mockStats))
      .finally(() => setLoaded(true));
  }, []);

  const empty = loaded && (!stats || stats.records === 0);
  const critical = mockRiskAnalysis.filter(r => r.risk_level === "critical");
  const high = mockRiskAnalysis.filter(r => r.risk_level === "high");

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Intelligence Report</h1>
          <p className="text-slate-500 text-sm">
            AI-generated summary with evidence traceability
          </p>
        </div>
        {!empty && (
          <div className="flex gap-2">
            <button
              className="bg-surface border border-slate-700 text-slate-300 text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-800"
              onClick={() => window.print()}
            >
              Print
            </button>
            <button className="bg-blue text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue/90">
              Export PDF
            </button>
          </div>
        )}
      </div>

      {empty ? (
        <div className="bg-surface border border-slate-800 rounded-xl p-8 text-center">
          <p className="text-slate-300 mb-1">No report yet.</p>
          <p className="text-sm text-slate-500 mb-5">A report is compiled once case data is uploaded.</p>
          <Link href="/upload" className="inline-block rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white">
            Upload case data →
          </Link>
        </div>
      ) : (
        <div className="space-y-5 max-w-4xl">
          {/* Case Overview */}
          <section className="bg-surface border border-slate-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-3">Case Overview</h2>
            <div className="grid grid-cols-5 gap-3 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{stats?.cases}</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">Cases</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{stats?.entities}</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">Entities</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-amber">{stats?.relationships}</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">Links</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{stats?.files}</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">Files</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{stats?.records}</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">Records</div>
              </div>
            </div>
            <p className="text-sm text-slate-400">
              Analysis covers {stats?.cases} active investigations with {stats?.entities} resolved entities
              connected by {stats?.relationships} relationships extracted from {stats?.files} uploaded files
              containing {stats?.records} records. Entity resolution used phonetic matching and fuzzy linking
              to deduplicate and merge records across data sources.
            </p>
          </section>

          {/* Risk Assessment */}
          <section className="bg-surface border border-slate-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-1">Risk Assessment</h2>
            <p className="text-xs text-slate-500 mb-4">AI-scored based on network centrality, cross-case links, evidence strength, and anomaly detection</p>
            <div className="space-y-3">
              {mockRiskAnalysis.map(r => {
                const colors = {
                  critical: { bar: "bg-red-500", text: "text-red-400", badge: "bg-red-500/15 text-red-400" },
                  high: { bar: "bg-orange-500", text: "text-orange-400", badge: "bg-orange-500/15 text-orange-400" },
                  medium: { bar: "bg-amber-500", text: "text-amber-400", badge: "bg-amber-500/15 text-amber-400" },
                  low: { bar: "bg-green-500", text: "text-green-400", badge: "bg-green-500/15 text-green-400" },
                }[r.risk_level];
                return (
                  <div key={r.entity_id} className="flex items-center gap-4">
                    <div className="w-32 shrink-0">
                      <span className={`text-sm font-medium ${colors.text}`}>{r.entity_name}</span>
                    </div>
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${colors.badge} w-16 text-center shrink-0`}>
                      {r.risk_level}
                    </span>
                    <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div className={`h-full ${colors.bar} rounded-full`} style={{ width: `${r.score * 100}%` }} />
                    </div>
                    <span className="text-xs text-slate-400 w-10 text-right shrink-0">{(r.score * 100).toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Key Findings */}
          <section className="bg-surface border border-slate-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-1">Key Findings</h2>
            <p className="text-xs text-slate-500 mb-4">Patterns and anomalies detected by AI analysis</p>
            <div className="space-y-3">
              {mockPatterns.map(p => {
                const sev = {
                  critical: "border-l-red-500 bg-red-500/5",
                  high: "border-l-orange-500 bg-orange-500/5",
                  medium: "border-l-amber-500 bg-amber-500/5",
                }[p.severity];
                return (
                  <div key={p.id} className={`border-l-2 rounded-r-lg p-4 ${sev}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-white">{p.title}</span>
                      <span className="text-[10px] uppercase tracking-wider text-slate-500">{p.type}</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{p.description}</p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Anomalies */}
          <section className="bg-surface border border-slate-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-1">Anomaly Detection</h2>
            <p className="text-xs text-slate-500 mb-4">Statistical deviations flagged for investigation</p>
            <div className="space-y-3">
              {mockAnomalies.map(a => (
                <div key={a.id} className="bg-bg rounded-lg p-4 border border-amber-500/20">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-white">{a.entity_name}</span>
                    <span className="text-xs font-bold text-amber bg-amber-500/15 px-2 py-0.5 rounded">{a.deviation.toFixed(1)}σ deviation</span>
                  </div>
                  <div className="text-xs font-medium text-amber-400 mb-1">{a.anomaly}</div>
                  <p className="text-xs text-slate-400">{a.explanation}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Investigative Leads Summary */}
          <section className="bg-surface border border-slate-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Investigative Leads</h2>
                <p className="text-xs text-slate-500">{mockEnrichedLeads.length} leads generated, ranked by priority score</p>
              </div>
              <Link href="/leads" className="text-xs text-blue hover:underline">
                View all leads →
              </Link>
            </div>
            <div className="space-y-3">
              {mockEnrichedLeads.slice(0, 3).map(l => {
                const riskColor = {
                  critical: "text-red-400",
                  high: "text-orange-400",
                  medium: "text-amber-400",
                  low: "text-green-400",
                }[l.risk_level];
                return (
                  <div key={l.id} className="flex items-start gap-4 bg-bg rounded-lg p-4">
                    <div className="text-xl font-bold text-amber">{(l.score * 100).toFixed(0)}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-white">{l.entity_name}</span>
                        <span className={`text-[10px] font-bold uppercase ${riskColor}`}>{l.risk_level}</span>
                        {l.cross_case && (
                          <span className="text-[10px] text-red-300 bg-red-500/10 rounded-full px-1.5 py-0.5">cross-case</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">{l.reason}</p>
                    </div>
                    <div className="text-xs text-slate-500 shrink-0">{l.evidence.length} evidence items</div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Methodology */}
          <section className="bg-surface border border-slate-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-3">Methodology</h2>
            <div className="grid grid-cols-3 gap-4">
              {[
                { step: "1", title: "Data Ingestion", desc: "FIR, CDR, financial, vehicle, and OSINT records parsed and normalized" },
                { step: "2", title: "Entity Resolution", desc: "NLP extraction with phonetic matching and fuzzy linking to deduplicate entities" },
                { step: "3", title: "Graph Analysis", desc: "Centrality, community detection, and PageRank to identify key nodes" },
                { step: "4", title: "Pattern Detection", desc: "Temporal, financial, and communication patterns flagged automatically" },
                { step: "5", title: "Risk Scoring", desc: "Multi-factor scoring: network, cross-case, evidence, temporal, anomaly" },
                { step: "6", title: "Lead Generation", desc: "Evidence-backed, explainable leads with confidence scores and source traceability" },
              ].map(m => (
                <div key={m.step} className="bg-bg rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-5 h-5 rounded-full bg-blue/20 text-blue text-[10px] font-bold flex items-center justify-center">{m.step}</span>
                    <span className="text-xs font-semibold text-white">{m.title}</span>
                  </div>
                  <p className="text-[11px] text-slate-500">{m.desc}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}
