"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import LeadCard from "@/components/LeadCard";
import { endpoints } from "@/lib/api";
import { mockEnrichedLeads, type EnrichedLead } from "@/lib/mockData";

export default function LeadsPage() {
  const [leads, setLeads] = useState<EnrichedLead[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<"all" | "critical" | "high" | "medium" | "cross_case">("all");

  const fetchLeads = useCallback(() => {
    endpoints
      .leads()
      .then((r) => {
        const apiLeads = r.data.leads || [];
        const enriched: EnrichedLead[] = apiLeads.map((l: any) => {
          const mock = mockEnrichedLeads.find(m => m.entity_id === l.entity_id);
          return mock ? { ...mock, ...l } : { ...mockEnrichedLeads[0], ...l };
        });
        setLeads(enriched);
      })
      .catch(() => setLeads(mockEnrichedLeads))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const onVerify = (id: string, approved: boolean) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === id ? { ...l, status: approved ? "verified" : "rejected" } : l))
    );
    endpoints.verifyLead2(id, approved).catch(() => {});
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
      <div className="flex items-center justify-between mb-1">
        <div>
          <h1 className="text-2xl font-bold text-white">Investigative Leads</h1>
          <p className="text-slate-500 text-sm">AI-generated, evidence-backed, explainable</p>
        </div>
        {leads.length > 0 && (
          <button
            onClick={fetchLeads}
            className="text-xs text-slate-400 hover:text-white border border-slate-700 rounded-lg px-3 py-1.5 transition-colors"
          >
            Refresh
          </button>
        )}
      </div>

      {empty ? (
        <div className="bg-surface border border-slate-800 rounded-xl p-8 text-center mt-6">
          <p className="text-slate-300 mb-1">No leads yet.</p>
          <p className="text-sm text-slate-500 mb-5">
            Leads are generated automatically when case data is uploaded and analyzed.
          </p>
          <Link href="/upload" className="inline-block rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white">
            Upload case data &rarr;
          </Link>
        </div>
      ) : (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-5 gap-3 my-5">
            <div className="bg-surface border border-slate-800 rounded-lg px-4 py-3">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 block">Total</span>
              <span className="text-2xl font-bold text-white">{leads.length}</span>
            </div>
            <div className="bg-surface border border-red-500/20 rounded-lg px-4 py-3">
              <span className="text-[10px] uppercase tracking-wider text-red-400/70 block">Critical</span>
              <span className="text-2xl font-bold text-red-400">{criticalCount}</span>
            </div>
            <div className="bg-surface border border-orange-500/20 rounded-lg px-4 py-3">
              <span className="text-[10px] uppercase tracking-wider text-orange-400/70 block">High Risk</span>
              <span className="text-2xl font-bold text-orange-400">{highCount}</span>
            </div>
            <div className="bg-surface border border-amber-500/20 rounded-lg px-4 py-3">
              <span className="text-[10px] uppercase tracking-wider text-amber-400/70 block">Pending</span>
              <span className="text-2xl font-bold text-amber">{pendingCount}</span>
            </div>
            <div className="bg-surface border border-red-500/20 rounded-lg px-4 py-3">
              <span className="text-[10px] uppercase tracking-wider text-red-400/70 block">Cross-Case</span>
              <span className="text-2xl font-bold text-red-400">{crossCaseCount}</span>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-2 mb-5">
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
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  filter === f.key
                    ? "border-blue text-blue bg-blue/10"
                    : "border-slate-700 text-slate-500 hover:text-slate-300"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Lead cards */}
          <div className="space-y-5">
            {filtered.map((lead) => (
              <LeadCard key={lead.id} lead={lead} onVerify={onVerify} />
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-8 text-slate-500 text-sm">
              No leads match this filter.
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
