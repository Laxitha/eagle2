"use client";

import { useEffect, useState } from "react";
import {
  mockRiskAnalysis,
  mockPatterns,
  mockAnomalies,
  type RiskAnalysis,
  type PatternDetection,
  type AnomalyDetection,
} from "@/lib/mockData";
import { fetchRiskAnalysis, fetchPatterns, fetchAnomalies } from "@/lib/supabaseData";

const RISK_COLORS = {
  critical: "text-red-400 bg-red-500/10 border-red-500/20",
  high: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  medium: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  low: "text-green-400 bg-green-500/10 border-green-500/20",
};

const SEVERITY_COLORS = {
  critical: "border-red-500/20 bg-red-500/[0.03]",
  high: "border-orange-500/20 bg-orange-500/[0.03]",
  medium: "border-amber-500/20 bg-amber-500/[0.03]",
};

const PATTERN_ICONS: Record<PatternDetection["type"], string> = {
  structuring: "$",
  timing: "T",
  geographic: "G",
  communication: "C",
  financial: "F",
};

export default function AnalysisPanel({
  onHighlightEntity,
}: {
  onHighlightEntity?: (id: string) => void;
}) {
  const [tab, setTab] = useState<"risk" | "patterns" | "anomalies">("risk");
  const [risks, setRisks] = useState<RiskAnalysis[]>(mockRiskAnalysis);
  const [patterns, setPatterns] = useState<PatternDetection[]>(mockPatterns);
  const [anomaliesData, setAnomaliesData] = useState<AnomalyDetection[]>(mockAnomalies);

  useEffect(() => {
    Promise.all([
      fetchRiskAnalysis().catch(() => []),
      fetchPatterns().catch(() => []),
      fetchAnomalies().catch(() => []),
    ]).then(([r, p, a]) => {
      if (r.length > 0) setRisks(r);
      if (p.length > 0) setPatterns(p);
      if (a.length > 0) setAnomaliesData(a);
    });
  }, []);

  return (
    <div className="w-72 shrink-0 card flex flex-col max-h-[600px]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800/40">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-purple-500/10 flex items-center justify-center">
            <span className="text-purple-400 text-[9px] font-bold">AI</span>
          </div>
          <span className="text-xs font-semibold text-slate-300">Analysis</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800/40">
        {([
          { key: "risk", label: "Risk" },
          { key: "patterns", label: "Patterns" },
          { key: "anomalies", label: "Anomalies" },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 px-2 py-2 text-[10px] font-medium transition-colors ${
              tab === t.key
                ? "text-purple-400 border-b border-purple-400/60"
                : "text-slate-600 hover:text-slate-400"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
        {tab === "risk" && risks.map(r => (
          <button
            key={r.entity_id}
            onClick={() => onHighlightEntity?.(r.entity_id)}
            className="w-full text-left bg-white/[0.02] rounded-lg p-2.5 hover:bg-white/[0.04] transition-colors"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-white font-medium">{r.entity_name}</span>
              <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${RISK_COLORS[r.risk_level]}`}>
                {r.risk_level}
              </span>
            </div>
            <div className="w-full h-1 bg-slate-800/60 rounded-full overflow-hidden mb-1.5">
              <div
                className={`h-full rounded-full ${
                  r.score >= 0.8 ? "bg-red-500" : r.score >= 0.6 ? "bg-orange-500" : r.score >= 0.4 ? "bg-amber-500" : "bg-green-500"
                }`}
                style={{ width: `${r.score * 100}%` }}
              />
            </div>
            <ul className="space-y-0.5">
              {r.factors.map((f, i) => (
                <li key={i} className="text-[10px] text-slate-500 flex items-start gap-1">
                  <span className="text-slate-700 mt-0.5">&bull;</span>
                  {f}
                </li>
              ))}
            </ul>
          </button>
        ))}

        {tab === "patterns" && patterns.map(p => (
          <div key={p.id} className={`rounded-lg border p-2.5 ${SEVERITY_COLORS[p.severity]}`}>
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-4 h-4 rounded bg-slate-800/60 flex items-center justify-center">
                <span className="text-[9px] font-bold text-slate-500">{PATTERN_ICONS[p.type]}</span>
              </div>
              <span className="text-[11px] font-semibold text-white">{p.title}</span>
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed mb-1.5">{p.description}</p>
            <div className="flex flex-wrap gap-1">
              {p.entities_involved.map(eid => {
                const entity = risks.find(r => r.entity_id === eid);
                return (
                  <button
                    key={eid}
                    onClick={() => onHighlightEntity?.(eid)}
                    className="text-[9px] text-blue hover:text-blue/80 bg-blue/[0.06] rounded px-1.5 py-0.5 border border-blue/15"
                  >
                    {entity?.entity_name ?? eid}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {tab === "anomalies" && anomaliesData.map(a => (
          <button
            key={a.id}
            onClick={() => onHighlightEntity?.(a.entity_id)}
            className="w-full text-left bg-white/[0.02] rounded-lg p-2.5 border border-amber-500/15 hover:bg-white/[0.04] transition-colors"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-white font-medium">{a.entity_name}</span>
              <span className="text-[9px] font-bold text-amber bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                {a.deviation.toFixed(1)}&sigma;
              </span>
            </div>
            <div className="text-[10px] font-medium text-amber-400 mb-0.5">{a.anomaly}</div>
            <p className="text-[10px] text-slate-500 leading-relaxed">{a.explanation}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
