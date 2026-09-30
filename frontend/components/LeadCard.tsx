"use client";

import type { CaseLead } from "@/lib/api";

export default function LeadCard({
  lead,
  onVerify,
}: {
  lead: CaseLead;
  onVerify: (id: string, approved: boolean) => void;
}) {
  return (
    <div className="bg-surface border border-slate-800 rounded-xl p-5">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="text-white font-semibold">{lead.entity_name}</div>
          <div className="text-xs text-slate-500">{lead.entity_id}</div>
        </div>
        <div className="text-right">
          <div className="text-amber font-bold text-lg">{(lead.score * 100).toFixed(0)}</div>
          <div className="text-xs text-slate-500">priority score</div>
        </div>
      </div>

      {lead.cross_case && (
        <span className="inline-block rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[11px] text-red-300 mb-2">
          Cross-case link
        </span>
      )}

      <div className="text-xs uppercase tracking-wide text-slate-500 mt-3 mb-1">Why?</div>
      <p className="text-sm text-slate-300">{lead.reason}</p>

      <div className="text-xs uppercase tracking-wide text-slate-500 mt-3 mb-1">Recommended Action</div>
      <p className="text-sm text-slate-300">{lead.recommended_action}</p>

      {lead.status === "pending" ? (
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => onVerify(lead.id, true)}
            className="flex-1 bg-blue/15 text-blue text-sm font-medium rounded-lg py-2 hover:bg-blue/25 transition-colors"
          >
            Verify
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
          className={`mt-4 text-xs font-medium px-3 py-1.5 rounded-lg inline-block ${
            lead.status === "verified" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
          }`}
        >
          {lead.status}
        </div>
      )}
    </div>
  );
}
