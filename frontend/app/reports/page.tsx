"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import type { CaseStats } from "@/lib/api";
import { mockStats, mockEnrichedLeads, mockRiskAnalysis, mockPatterns, mockAnomalies } from "@/lib/mockData";
import type { EnrichedLead, RiskAnalysis, PatternDetection, AnomalyDetection } from "@/lib/mockData";
import { fetchStats, fetchLeads, fetchRiskAnalysis, fetchPatterns, fetchAnomalies } from "@/lib/supabaseData";

export default function ReportsPage() {
  const [stats, setStats] = useState<CaseStats | null>(null);
  const [risks, setRisks] = useState<RiskAnalysis[]>(mockRiskAnalysis);
  const [patterns, setPatterns] = useState<PatternDetection[]>(mockPatterns);
  const [anomalies, setAnomalies] = useState<AnomalyDetection[]>(mockAnomalies);
  const [leads, setLeads] = useState<EnrichedLead[]>(mockEnrichedLeads);
  const [loaded, setLoaded] = useState(false);
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      fetchStats().catch(() => null),
      fetchRiskAnalysis().catch(() => []),
      fetchPatterns().catch(() => []),
      fetchAnomalies().catch(() => []),
      fetchLeads().catch(() => []),
    ]).then(([s, r, p, a, l]) => {
      setStats(s ?? mockStats);
      if (r.length > 0) setRisks(r);
      if (p.length > 0) setPatterns(p);
      if (a.length > 0) setAnomalies(a);
      if (l.length > 0) setLeads(l);
      setLoaded(true);
    });
  }, []);

  const empty = loaded && (!stats || stats.records === 0);

  const handleExportPDF = async () => {
    if (!reportRef.current || exporting) return;
    setExporting(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const el = reportRef.current;
      const canvas = await html2canvas(el, {
        scale: 2,
        backgroundColor: "#060a13",
        useCORS: true,
        logging: false,
      });

      const imgW = 210;
      const pageH = 297;
      const imgH = (canvas.height * imgW) / canvas.width;
      const pdf = new jsPDF("p", "mm", "a4");
      let y = 0;

      while (y < imgH) {
        if (y > 0) pdf.addPage();
        pdf.addImage(
          canvas.toDataURL("image/png"),
          "PNG",
          0,
          -y,
          imgW,
          imgH
        );
        y += pageH;
      }

      pdf.save(`CaseFlow_Intelligence_Report_${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (err) {
      console.error("PDF export failed:", err);
      alert("PDF export failed. Please try printing instead (Ctrl+P).");
    } finally {
      setExporting(false);
    }
  };

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6 no-print">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">Intelligence Report</h1>
          <p className="text-slate-600 text-xs mt-0.5">AI-generated summary with evidence traceability</p>
        </div>
        {!empty && (
          <div className="flex gap-2">
            <button
              className="border border-slate-800 text-slate-400 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-white/[0.03] transition-colors"
              onClick={() => window.print()}
            >
              Print
            </button>
            <button
              className="bg-blue text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-blue/90 transition-colors disabled:opacity-50"
              onClick={handleExportPDF}
              disabled={exporting}
            >
              {exporting ? "Exporting..." : "Export PDF"}
            </button>
          </div>
        )}
      </div>

      {empty ? (
        <div className="card p-10 text-center">
          <p className="text-slate-300 mb-1">No report yet.</p>
          <p className="text-sm text-slate-500 mb-5">A report is compiled once case data is uploaded.</p>
          <Link href="/upload" className="inline-block rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white">
            Upload case data &rarr;
          </Link>
        </div>
      ) : (
        <div ref={reportRef} className="space-y-4 max-w-4xl">
          {/* Case Overview */}
          <section className="card p-5">
            <h2 className="text-sm font-semibold text-white mb-3">Case Overview</h2>
            <div className="grid grid-cols-5 gap-3 mb-4">
              {[
                { label: "Cases", value: stats?.cases, color: "text-white" },
                { label: "Entities", value: stats?.entities, color: "text-white" },
                { label: "Links", value: stats?.relationships, color: "text-amber" },
                { label: "Files", value: stats?.files, color: "text-white" },
                { label: "Records", value: stats?.records, color: "text-white" },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-[10px] text-slate-600 uppercase tracking-wider">{s.label}</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Analysis covers {stats?.cases} active investigations with {stats?.entities} resolved entities
              connected by {stats?.relationships} relationships extracted from {stats?.files} uploaded files
              containing {stats?.records} records. Entity resolution used phonetic matching and fuzzy linking
              to deduplicate and merge records across data sources.
            </p>
          </section>

          {/* Risk Assessment */}
          <section className="card p-5">
            <h2 className="text-sm font-semibold text-white mb-1">Risk Assessment</h2>
            <p className="text-[11px] text-slate-600 mb-4">AI-scored based on network centrality, cross-case links, evidence strength, and anomaly detection</p>
            <div className="space-y-2.5">
              {risks.map(r => {
                const colors = {
                  critical: { bar: "bg-red-500", text: "text-red-400", badge: "bg-red-500/10 text-red-400 border-red-500/20" },
                  high: { bar: "bg-orange-500", text: "text-orange-400", badge: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
                  medium: { bar: "bg-amber-500", text: "text-amber-400", badge: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
                  low: { bar: "bg-green-500", text: "text-green-400", badge: "bg-green-500/10 text-green-400 border-green-500/20" },
                }[r.risk_level];
                return (
                  <div key={r.entity_id} className="flex items-center gap-3">
                    <div className="w-28 shrink-0">
                      <span className={`text-xs font-medium ${colors.text}`}>{r.entity_name}</span>
                    </div>
                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${colors.badge} w-14 text-center shrink-0`}>
                      {r.risk_level}
                    </span>
                    <div className="flex-1 h-1.5 bg-slate-800/60 rounded-full overflow-hidden">
                      <div className={`h-full ${colors.bar} rounded-full`} style={{ width: `${r.score * 100}%` }} />
                    </div>
                    <span className="text-[11px] text-slate-500 w-8 text-right shrink-0">{(r.score * 100).toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Key Findings */}
          <section className="card p-5">
            <h2 className="text-sm font-semibold text-white mb-1">Key Findings</h2>
            <p className="text-[11px] text-slate-600 mb-4">Patterns and anomalies detected by AI analysis</p>
            <div className="space-y-2.5">
              {patterns.map(p => {
                const sev = {
                  critical: "border-l-red-500/50 bg-red-500/[0.02]",
                  high: "border-l-orange-500/50 bg-orange-500/[0.02]",
                  medium: "border-l-amber-500/50 bg-amber-500/[0.02]",
                }[p.severity];
                return (
                  <div key={p.id} className={`border-l-2 rounded-r-lg p-3.5 ${sev}`}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-semibold text-white">{p.title}</span>
                      <span className="text-[9px] uppercase tracking-wider text-slate-600">{p.type}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">{p.description}</p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Anomalies */}
          <section className="card p-5">
            <h2 className="text-sm font-semibold text-white mb-1">Anomaly Detection</h2>
            <p className="text-[11px] text-slate-600 mb-4">Statistical deviations flagged for investigation</p>
            <div className="space-y-2.5">
              {anomalies.map(a => (
                <div key={a.id} className="bg-white/[0.02] rounded-lg p-3.5 border border-amber-500/15">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-white">{a.entity_name}</span>
                    <span className="text-[10px] font-bold text-amber bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">{a.deviation.toFixed(1)}&sigma; deviation</span>
                  </div>
                  <div className="text-[11px] font-medium text-amber-400 mb-0.5">{a.anomaly}</div>
                  <p className="text-[11px] text-slate-500">{a.explanation}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Investigative Leads Summary */}
          <section className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-white">Investigative Leads</h2>
                <p className="text-[11px] text-slate-600">{leads.length} leads generated, ranked by priority score</p>
              </div>
              <Link href="/leads" className="text-[11px] text-blue hover:underline no-print">
                View all leads &rarr;
              </Link>
            </div>
            <div className="space-y-2.5">
              {leads.slice(0, 3).map(l => {
                const riskColor = {
                  critical: "text-red-400",
                  high: "text-orange-400",
                  medium: "text-amber-400",
                  low: "text-green-400",
                }[l.risk_level];
                return (
                  <div key={l.id} className="flex items-start gap-3 bg-white/[0.02] rounded-lg p-3.5">
                    <div className="text-lg font-bold text-amber">{(l.score * 100).toFixed(0)}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-medium text-white">{l.entity_name}</span>
                        <span className={`text-[9px] font-bold uppercase ${riskColor}`}>{l.risk_level}</span>
                        {l.cross_case && (
                          <span className="text-[9px] text-red-300 bg-red-500/10 rounded-full px-1.5 py-0.5 border border-red-500/20">cross-case</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">{l.reason}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Methodology */}
          <section className="card p-5">
            <h2 className="text-sm font-semibold text-white mb-3">Methodology</h2>
            <div className="grid grid-cols-3 gap-3">
              {[
                { step: "1", title: "Data Ingestion", desc: "FIR, CDR, financial, vehicle, and OSINT records parsed and normalized" },
                { step: "2", title: "Entity Resolution", desc: "NLP extraction with phonetic matching and fuzzy linking to deduplicate entities" },
                { step: "3", title: "Graph Analysis", desc: "Centrality, community detection, and PageRank to identify key nodes" },
                { step: "4", title: "Pattern Detection", desc: "Temporal, financial, and communication patterns flagged automatically" },
                { step: "5", title: "Risk Scoring", desc: "Multi-factor scoring: network, cross-case, evidence, temporal, anomaly" },
                { step: "6", title: "Lead Generation", desc: "Evidence-backed, explainable leads with confidence scores and source traceability" },
              ].map(m => (
                <div key={m.step} className="bg-white/[0.02] rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-5 h-5 rounded-full bg-blue/10 text-blue text-[10px] font-bold flex items-center justify-center border border-blue/20">{m.step}</span>
                    <span className="text-[11px] font-semibold text-white">{m.title}</span>
                  </div>
                  <p className="text-[10px] text-slate-600">{m.desc}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}
