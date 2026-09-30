"use client";

import { useState } from "react";
import Link from "next/link";
import type { EnrichedLead, EvidenceItem } from "@/lib/mockData";

const RISK_COLORS = {
  critical: { bg: "bg-red-500/10", border: "border-red-500/20", text: "text-red-400", label: "CRITICAL" },
  high: { bg: "bg-orange-500/10", border: "border-orange-500/20", text: "text-orange-400", label: "HIGH" },
  medium: { bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-400", label: "MEDIUM" },
  low: { bg: "bg-green-500/10", border: "border-green-500/20", text: "text-green-400", label: "LOW" },
};

const EVIDENCE_COLORS: Record<EvidenceItem["type"], string> = {
  cdr: "text-green-400",
  financial: "text-purple-400",
  witness: "text-blue-400",
  vehicle: "text-orange-400",
  document: "text-slate-400",
  osint: "text-cyan-400",
};

function ConfidenceBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? "bg-red-500" : pct >= 60 ? "bg-orange-500" : pct >= 40 ? "bg-amber-500" : "bg-green-500";
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-slate-600 w-16 shrink-0 capitalize">{label}</span>
      <div className="flex-1 h-1 bg-slate-800/60 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-slate-500 w-7 text-right">{pct}%</span>
    </div>
  );
}

export default function LeadCard({
  lead,
  onVerify,
}: {
  lead: EnrichedLead;
  onVerify: (id: string, approved: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"reasoning" | "evidence" | "connections" | "timeline">("reasoning");
  const risk = RISK_COLORS[lead.risk_level];

  return (
    <div className="card overflow-hidden" style={{ borderColor: risk.border.includes('red') ? 'rgba(239,68,68,0.2)' : risk.border.includes('orange') ? 'rgba(249,115,22,0.2)' : risk.border.includes('amber') ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.2)' }}>
      {/* Header */}
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-slate-800/60 flex items-center justify-center text-white font-semibold text-xs">
              {lead.entity_name.split(" ").map(n => n[0]).join("")}
            </div>
            <div>
              <div className="text-white font-medium text-sm">{lead.entity_name}</div>
              <div className="text-[10px] text-slate-600">{lead.entity_id}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${risk.bg} ${risk.text} ${risk.border}`}>
              {risk.label}
            </span>
            <div className="text-right">
              <div className="text-amber font-bold text-lg">{(lead.score * 100).toFixed(0)}</div>
              <div className="text-[9px] text-slate-600 uppercase tracking-wider">Score</div>
            </div>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mb-3">
          {lead.cross_case && (
            <span className="inline-block rounded-full border border-red-500/20 bg-red-500/[0.06] px-2 py-0.5 text-[9px] font-medium text-red-300">
              Cross-case
            </span>
          )}
          {lead.linked_cases.map(c => (
            <span key={c.id} className="inline-block rounded-full border border-slate-800/60 bg-white/[0.02] px-2 py-0.5 text-[9px] text-slate-500">
              {c.name}
            </span>
          ))}
          <span className="inline-block rounded-full border border-slate-800/60 bg-white/[0.02] px-2 py-0.5 text-[9px] text-slate-500">
            {lead.evidence.length} evidence
          </span>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed mb-3">{lead.reason}</p>

        {/* Action */}
        <div className="bg-blue/[0.04] border border-blue/15 rounded-lg px-3 py-2 mb-3">
          <div className="text-[9px] uppercase tracking-wider text-blue/60 mb-0.5">Recommended Action</div>
          <p className="text-[11px] text-blue/90">{lead.recommended_action}</p>
        </div>

        {/* Confidence breakdown */}
        <div className="space-y-1">
          {Object.entries(lead.confidence_breakdown).map(([k, v]) => (
            <ConfidenceBar key={k} label={k.replace("_", " ")} value={v} />
          ))}
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 text-[11px] text-blue hover:text-blue/80 font-medium"
        >
          {expanded ? "Collapse details" : "Show AI reasoning, evidence & timeline"}
        </button>
      </div>

      {/* Expanded section */}
      {expanded && (
        <div className="border-t border-slate-800/40">
          <div className="flex border-b border-slate-800/40">
            {(["reasoning", "evidence", "connections", "timeline"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 px-3 py-2 text-[11px] font-medium capitalize transition-colors ${
                  activeTab === tab
                    ? "text-blue border-b border-blue/60"
                    : "text-slate-600 hover:text-slate-400"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="p-5">
            {activeTab === "reasoning" && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-5 h-5 rounded bg-purple-500/10 flex items-center justify-center">
                    <span className="text-purple-400 text-[9px] font-bold">AI</span>
                  </div>
                  <span className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider">AI Analysis</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{lead.ai_reasoning}</p>
              </div>
            )}

            {activeTab === "evidence" && (
              <div className="space-y-2">
                {lead.evidence.map((e, i) => (
                  <div key={i} className="bg-white/[0.02] rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-bold uppercase tracking-wider ${EVIDENCE_COLORS[e.type]}`}>{e.type}</span>
                        <span className="text-[9px] text-slate-700">|</span>
                        <span className="text-[9px] text-slate-600">{e.source}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-10 h-1 bg-slate-800/60 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${e.confidence >= 0.9 ? "bg-green-500" : e.confidence >= 0.7 ? "bg-amber-500" : "bg-red-500"}`}
                            style={{ width: `${e.confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-[9px] text-slate-600">{(e.confidence * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-300">{e.detail}</p>
                    <p className="text-[9px] text-slate-700 mt-0.5">{e.date}</p>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "connections" && (
              <div>
                <div className="space-y-1.5 mb-4">
                  {lead.connected_entities.map(ce => (
                    <div key={ce.id} className="flex items-center justify-between bg-white/[0.02] rounded-lg px-3 py-2">
                      <div>
                        <span className="text-xs text-white font-medium">{ce.name}</span>
                        <span className="text-[9px] text-slate-600 ml-2">{ce.type}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 max-w-[50%] text-right">{ce.relationship}</span>
                    </div>
                  ))}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-slate-600 mb-1.5">Linked Cases</div>
                <div className="space-y-1.5">
                  {lead.linked_cases.map(c => (
                    <div key={c.id} className="bg-white/[0.02] rounded-lg px-3 py-2">
                      <span className="text-xs text-red-400 font-medium">{c.name}</span>
                      <p className="text-[10px] text-slate-500 mt-0.5">{c.relevance}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "timeline" && (
              <div className="relative pl-4">
                <div className="absolute left-1.5 top-1 bottom-1 w-px bg-slate-800/60" />
                {lead.timeline.map((t, i) => (
                  <div key={i} className="relative mb-3.5 last:mb-0">
                    <div className="absolute -left-[10.5px] top-1 w-2 h-2 rounded-full bg-slate-700 border-2 border-bg" />
                    <div className="text-[9px] text-slate-600 mb-0.5">{t.date}</div>
                    <div className="text-[11px] text-slate-400">{t.event}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-slate-800/40 px-5 py-2.5 flex items-center justify-between">
            <Link href="/graph" className="text-[11px] text-blue hover:underline">View in graph</Link>
            <Link href="/agent" className="text-[11px] text-purple-400 hover:underline">Ask AI Agent</Link>
          </div>
        </div>
      )}

      {/* Verify/Reject */}
      <div className="border-t border-slate-800/40 px-5 py-2.5">
        {lead.status === "pending" ? (
          <div className="flex gap-2">
            <button
              onClick={() => onVerify(lead.id, true)}
              className="flex-1 bg-green-500/[0.08] text-green-400 text-xs font-medium rounded-lg py-1.5 hover:bg-green-500/15 transition-colors border border-green-500/15"
            >
              Verify Lead
            </button>
            <button
              onClick={() => onVerify(lead.id, false)}
              className="flex-1 bg-red-500/[0.06] text-red-400 text-xs font-medium rounded-lg py-1.5 hover:bg-red-500/10 transition-colors border border-red-500/15"
            >
              Reject
            </button>
          </div>
        ) : (
          <div
            className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg inline-block border ${
              lead.status === "verified" ? "bg-green-500/[0.06] text-green-400 border-green-500/15" : "bg-red-500/[0.06] text-red-400 border-red-500/15"
            }`}
          >
            {lead.status}
          </div>
        )}
      </div>
    </div>
  );
}
