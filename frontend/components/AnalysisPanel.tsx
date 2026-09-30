"use client";

import { useState } from "react";
import {
  mockRiskAnalysis,
  mockPatterns,
  mockAnomalies,
  type RiskAnalysis,
  type PatternDetection,
  type AnomalyDetection,
} from "@/lib/mockData";

const RISK_COLORS = {
  critical: "text-red-400 bg-red-500/15",
  high: "text-orange-400 bg-orange-500/15",
  medium: "text-amber-400 bg-amber-500/15",
  low: "text-green-400 bg-green-500/15",
};

const SEVERITY_COLORS = {
  critical: "border-red-500/40 bg-red-500/5",
  high: "border-orange-500/40 bg-orange-500/5",
  medium: "border-amber-500/40 bg-amber-500/5",
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

  return (
    <div className="w-80 shrink-0 bg-surface border border-slate-800 rounded-xl flex flex-col max-h-[600px]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-purple-500/20 flex items-center justify-center">
            <span className="text-purple-400 text-[10px] font-bold">AI</span>
          </div>
          <span className="text-sm font-semibold text-white">AI-Powered Analysis</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800">
        {([
          { key: "risk", label: "Risk Scoring" },
          { key: "patterns", label: "Patterns" },
          { key: "anomalies", label: "Anomalies" },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 px-2 py-2 text-[11px] font-medium transition-colors ${
              tab === t.key
                ? "text-purple-400 border-b-2 border-purple-400 bg-purple-500/5"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {tab === "risk" && mockRiskAnalysis.map(r => (
          <button
            key={r.entity_id}
            onClick={() => onHighlightEntity?.(r.entity_id)}
            className="w-full text-left bg-bg rounded-lg p-3 hover:bg-slate-800/80 transition-colors"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm text-white font-medium">{r.entity_name}</span>
              <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${RISK_COLORS[r.risk_level]}`}>
                {r.risk_level}
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mb-2">
              <div
                className={`h-full rounded-full ${
                  r.score >= 0.8 ? "bg-red-500" : r.score >= 0.6 ? "bg-orange-500" : r.score >= 0.4 ? "bg-amber-500" : "bg-green-500"
                }`}
                style={{ width: `${r.score * 100}%` }}
              />
            </div>
            <ul className="space-y-0.5">
              {r.factors.map((f, i) => (
                <li key={i} className="text-[11px] text-slate-400 flex items-start gap-1.5">
                  <span className="text-slate-600 mt-0.5">•</span>
                  {f}
                </li>
              ))}
            </ul>
          </button>
        ))}

        {tab === "patterns" && mockPatterns.map(p => (
          <div key={p.id} className={`rounded-lg border p-3 ${SEVERITY_COLORS[p.severity]}`}>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-5 h-5 rounded bg-slate-800 flex items-center justify-center">
                <span className="text-[10px] font-bold text-slate-400">{PATTERN_ICONS[p.type]}</span>
              </div>
              <span className="text-xs font-semibold text-white">{p.title}</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed mb-2">{p.description}</p>
            <div className="flex flex-wrap gap-1">
              {p.entities_involved.map(eid => {
                const entity = mockRiskAnalysis.find(r => r.entity_id === eid);
                return (
                  <button
                    key={eid}
                    onClick={() => onHighlightEntity?.(eid)}
                    className="text-[10px] text-blue hover:text-blue/80 bg-blue/10 rounded px-1.5 py-0.5"
                  >
                    {entity?.entity_name ?? eid}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {tab === "anomalies" && mockAnomalies.map(a => (
          <button
            key={a.id}
            onClick={() => onHighlightEntity?.(a.entity_id)}
            className="w-full text-left bg-bg rounded-lg p-3 border border-amber-500/20 hover:bg-slate-800/80 transition-colors"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm text-white font-medium">{a.entity_name}</span>
              <span className="text-[10px] font-bold text-amber bg-amber-500/15 px-1.5 py-0.5 rounded">
                {a.deviation.toFixed(1)}σ
              </span>
            </div>
            <div className="text-[11px] font-medium text-amber-400 mb-1">{a.anomaly}</div>
            <p className="text-[11px] text-slate-400 leading-relaxed">{a.explanation}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
