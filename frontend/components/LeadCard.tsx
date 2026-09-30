"use client";

import { useState } from "react";
import Link from "next/link";
import type { EnrichedLead, EvidenceItem } from "@/lib/mockData";

const RISK_COLORS = {
  critical: { bg: "bg-red-500/15", border: "border-red-500/40", text: "text-red-400", label: "CRITICAL" },
  high: { bg: "bg-orange-500/15", border: "border-orange-500/40", text: "text-orange-400", label: "HIGH" },
  medium: { bg: "bg-amber-500/15", border: "border-amber-500/40", text: "text-amber-400", label: "MEDIUM" },
  low: { bg: "bg-green-500/15", border: "border-green-500/40", text: "text-green-400", label: "LOW" },
};

const EVIDENCE_ICONS: Record<EvidenceItem["type"], string> = {
  cdr: "phone",
  financial: "banknotes",
  witness: "user",
  vehicle: "truck",
  document: "document",
  osint: "globe",
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
      <span className="text-xs text-slate-500 w-20 shrink-0 capitalize">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-400 w-8 text-right">{pct}%</span>
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
    <div className={`bg-surface border rounded-xl overflow-hidden ${risk.border}`}>
      {/* Header */}
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-white font-bold text-sm">
              {lead.entity_name.split(" ").map(n => n[0]).join("")}
            </div>
            <div>
              <div className="text-white font-semibold">{lead.entity_name}</div>
              <div className="text-xs text-slate-500">{lead.entity_id}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${risk.bg} ${risk.text}`}>
              {risk.label}
            </span>
            <div className="text-right">
              <div className="text-amber font-bold text-xl">{(lead.score * 100).toFixed(0)}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Score</div>
            </div>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {lead.cross_case && (
            <span className="inline-block rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-300">
              Cross-case link
            </span>
          )}
          {lead.linked_cases.map(c => (
            <span key={c.id} className="inline-block rounded-full border border-slate-700 bg-slate-800/50 px-2 py-0.5 text-[10px] text-slate-400">
              {c.name}
            </span>
          ))}
          <span className="inline-block rounded-full border border-slate-700 bg-slate-800/50 px-2 py-0.5 text-[10px] text-slate-400">
            {lead.evidence.length} evidence items
          </span>
        </div>

        {/* Summary */}
        <p className="text-sm text-slate-300 mb-3">{lead.reason}</p>

        {/* Action */}
        <div className="bg-blue/5 border border-blue/20 rounded-lg px-3 py-2 mb-3">
          <div className="text-[10px] uppercase tracking-wider text-blue/70 mb-0.5">Recommended Action</div>
          <p className="text-xs text-blue">{lead.recommended_action}</p>
        </div>

        {/* Confidence breakdown mini */}
        <div className="space-y-1.5">
          {Object.entries(lead.confidence_breakdown).map(([k, v]) => (
            <ConfidenceBar key={k} label={k.replace("_", " ")} value={v} />
          ))}
        </div>

        {/* Expand/collapse */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 text-xs text-blue hover:text-blue/80 font-medium"
        >
          {expanded ? "Collapse details" : "Show AI reasoning, evidence & timeline"}
        </button>
      </div>

      {/* Expanded section */}
      {expanded && (
        <div className="border-t border-slate-800">
          {/* Tabs */}
          <div className="flex border-b border-slate-800">
            {(["reasoning", "evidence", "connections", "timeline"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 px-3 py-2.5 text-xs font-medium capitalize transition-colors ${
                  activeTab === tab
                    ? "text-blue border-b-2 border-blue bg-blue/5"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="p-5">
            {/* AI Reasoning */}
            {activeTab === "reasoning" && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-5 h-5 rounded bg-purple-500/20 flex items-center justify-center">
                    <span className="text-purple-400 text-[10px]">AI</span>
                  </div>
                  <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">AI Analysis</span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">{lead.ai_reasoning}</p>
              </div>
            )}

            {/* Evidence */}
            {activeTab === "evidence" && (
              <div className="space-y-3">
                {lead.evidence.map((e, i) => (
                  <div key={i} className="bg-bg rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${EVIDENCE_COLORS[e.type]}`}>
                          {e.type}
                        </span>
                        <span className="text-[10px] text-slate-600">|</span>
                        <span className="text-[10px] text-slate-500">{e.source}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-12 h-1 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${e.confidence >= 0.9 ? "bg-green-500" : e.confidence >= 0.7 ? "bg-amber-500" : "bg-red-500"}`}
                            style={{ width: `${e.confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-500">{(e.confidence * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-300">{e.detail}</p>
                    <p className="text-[10px] text-slate-600 mt-1">{e.date}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Connections */}
            {activeTab === "connections" && (
              <div>
                <div className="space-y-2 mb-4">
                  {lead.connected_entities.map(ce => (
                    <div key={ce.id} className="flex items-center justify-between bg-bg rounded-lg px-3 py-2">
                      <div>
                        <span className="text-sm text-white font-medium">{ce.name}</span>
                        <span className="text-[10px] text-slate-500 ml-2">{ce.type}</span>
                      </div>
                      <span className="text-xs text-slate-400 max-w-[50%] text-right">{ce.relationship}</span>
                    </div>
                  ))}
                </div>
                <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">Linked Cases</div>
                <div className="space-y-2">
                  {lead.linked_cases.map(c => (
                    <div key={c.id} className="bg-bg rounded-lg px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-red-400 font-medium">{c.name}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{c.relevance}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Timeline */}
            {activeTab === "timeline" && (
              <div className="relative pl-4">
                <div className="absolute left-1.5 top-1 bottom-1 w-px bg-slate-700" />
                {lead.timeline.map((t, i) => (
                  <div key={i} className="relative mb-4 last:mb-0">
                    <div className="absolute -left-[10.5px] top-1 w-2.5 h-2.5 rounded-full bg-slate-700 border-2 border-surface" />
                    <div className="text-[10px] text-slate-500 mb-0.5">{t.date}</div>
                    <div className="text-xs text-slate-300">{t.event}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions footer */}
          <div className="border-t border-slate-800 px-5 py-3 flex items-center justify-between">
            <Link href="/graph" className="text-xs text-blue hover:underline">
              View in graph
            </Link>
            <Link href="/agent" className="text-xs text-purple-400 hover:underline">
              Ask AI Agent about this entity
            </Link>
          </div>
        </div>
      )}

      {/* Verify/Reject */}
      <div className="border-t border-slate-800 px-5 py-3">
        {lead.status === "pending" ? (
          <div className="flex gap-2">
            <button
              onClick={() => onVerify(lead.id, true)}
              className="flex-1 bg-green-500/15 text-green-400 text-sm font-medium rounded-lg py-2 hover:bg-green-500/25 transition-colors"
            >
              Verify Lead
            </button>
            <button
              onClick={() => onVerify(lead.id, false)}
              className="flex-1 bg-red-500/10 text-red-400 text-sm font-medium rounded-lg py-2 hover:bg-red-500/20 transition-colors"
            >
              Reject
            </button>
          </div>
        ) : (
          <div
            className={`text-xs font-medium px-3 py-1.5 rounded-lg inline-block ${
              lead.status === "verified" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
            }`}
          >
            {lead.status}
          </div>
        )}
      </div>
    </div>
  );
}
