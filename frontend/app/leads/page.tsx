"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import LeadCard from "@/components/LeadCard";
import { mockEnrichedLeads, type EnrichedLead } from "@/lib/mockData";
import { fetchLeads, verifyLead } from "@/lib/supabaseData";

export default function LeadsPage() {
  const [leads, setLeads] = useState<EnrichedLead[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<"all" | "critical" | "high" | "medium" | "cross_case">("all");

  const loadLeads = useCallback(() => {
    fetchLeads()
      .then((data) => {
        setLeads(data.length > 0 ? data : mockEnrichedLeads);
      })
      .catch(() => setLeads(mockEnrichedLeads))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  const onVerify = (id: string, approved: boolean) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === id ? { ...l, status: approved ? "verified" : "rejected" } : l))
    );
    verifyLead(id, approved).catch(() => {});
  };

  const filtered = leads.filter(l => {
    if (filter === "all") return true;
    if (filter === "cross_case") return l.cross_case;
    return l.risk_level === filter;
  });

  const empty = loaded && leads.length === 0;

  const criticalCount = leads.filter(l => l.risk_level === "critical").length;
  const highCount = leads.filter(l => l.risk_level === "high").length;
  const crossCaseCount = leads.filter(l => l.cross_case).length;
  const pendingCount = leads.filter(l => l.status === "pending").length;

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">Investigative Leads</h1>
          <p className="text-slate-600 text-xs mt-0.5">AI-generated, evidence-backed, explainable</p>
        </div>
        {leads.length > 0 && (
          <button
            onClick={loadLeads}
            className="text-[11px] text-slate-500 hover:text-slate-300 border border-slate-800/60 rounded-lg px-3 py-1.5 transition-colors"
          >
            Refresh
          </button>
        )}
      </div>

      {empty ? (
        <div className="card p-10 text-center">
          <p className="text-slate-300 mb-1">No leads yet.</p>
          <p className="text-xs text-slate-600 mb-5">
            Leads are generated automatically when case data is uploaded and analyzed.
          </p>
          <Link href="/upload" className="inline-block rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white">
            Upload case data &rarr;
          </Link>
        </div>
      ) : (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-5 gap-2.5 mb-5">
            {[
              { label: "Total", value: leads.length, color: "text-white", border: "border-slate-800/40" },
              { label: "Critical", value: criticalCount, color: "text-red-400", border: "border-red-500/15" },
              { label: "High Risk", value: highCount, color: "text-orange-400", border: "border-orange-500/15" },
              { label: "Pending", value: pendingCount, color: "text-amber", border: "border-amber-500/15" },
              { label: "Cross-Case", value: crossCaseCount, color: "text-red-400", border: "border-red-500/15" },
            ].map(s => (
              <div key={s.label} className={`card px-4 py-3 !border-${s.border.split('-').slice(1).join('-')}`} style={{ borderColor: s.border.includes('red') ? 'rgba(239,68,68,0.15)' : s.border.includes('orange') ? 'rgba(249,115,22,0.15)' : s.border.includes('amber') ? 'rgba(245,158,11,0.15)' : undefined }}>
                <span className="text-[10px] uppercase tracking-wider text-slate-600 block">{s.label}</span>
                <span className={`text-xl font-bold ${s.color}`}>{s.value}</span>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex gap-1.5 mb-5">
            {([
              { key: "all", label: "All Leads" },
              { key: "critical", label: "Critical" },
              { key: "high", label: "High Risk" },
              { key: "medium", label: "Medium" },
              { key: "cross_case", label: "Cross-Case" },
            ] as const).map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`text-[11px] px-3 py-1.5 rounded-lg border transition-colors ${
                  filter === f.key
                    ? "border-blue/30 text-blue bg-blue/[0.06]"
                    : "border-slate-800/60 text-slate-600 hover:text-slate-400"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Lead cards */}
          <div className="space-y-4">
            {filtered.map((lead) => (
              <LeadCard key={lead.id} lead={lead} onVerify={onVerify} />
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-8 text-slate-600 text-xs">
              No leads match this filter.
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
