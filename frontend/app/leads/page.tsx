"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import LeadCard from "@/components/LeadCard";
import { endpoints, CaseLead } from "@/lib/api";
import { mockCaseLeads } from "@/lib/mockData";

export default function LeadsPage() {
  const [leads, setLeads] = useState<CaseLead[]>([]);
  const [loaded, setLoaded] = useState(false);

  const fetchLeads = useCallback(() => {
    endpoints
      .leads()
      .then((r) => setLeads(r.data.leads || []))
      .catch(() => setLeads(mockCaseLeads))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    fetchLeads();
    const interval = setInterval(fetchLeads, 5000);
    return () => clearInterval(interval);
  }, [fetchLeads]);

  const onVerify = (id: string, approved: boolean) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === id ? { ...l, status: approved ? "verified" : "rejected" } : l))
    );
    endpoints.verifyLead2(id, approved).catch(() => {});
  };

  const empty = loaded && leads.length === 0;

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-white">Investigative Leads</h1>
        {leads.length > 0 && (
          <button
            onClick={fetchLeads}
            className="text-xs text-slate-400 hover:text-white border border-slate-700 rounded-lg px-3 py-1.5 transition-colors"
          >
            Refresh
          </button>
        )}
      </div>
      <p className="text-slate-400 mb-6">Ranked by priority score. Verify to confirm, reject to dismiss.</p>

      {empty ? (
        <div className="bg-surface border border-slate-800 rounded-xl p-8 text-center">
          <p className="text-slate-300 mb-1">No leads yet.</p>
          <p className="text-sm text-slate-500 mb-5">
            Leads are generated automatically when case data is uploaded and processed on the workbench.
            Upload files first, then return here to see ranked leads.
          </p>
          <Link href="/upload" className="inline-block rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white">
            Upload case data &rarr;
          </Link>
        </div>
      ) : (
        <>
          <div className="flex gap-3 mb-6">
            <div className="bg-surface border border-slate-800 rounded-lg px-4 py-2">
              <span className="text-xs text-slate-500 block">Total</span>
              <span className="text-lg font-bold text-white">{leads.length}</span>
            </div>
            <div className="bg-surface border border-slate-800 rounded-lg px-4 py-2">
              <span className="text-xs text-slate-500 block">Pending</span>
              <span className="text-lg font-bold text-amber">{leads.filter((l) => l.status === "pending").length}</span>
            </div>
            <div className="bg-surface border border-slate-800 rounded-lg px-4 py-2">
              <span className="text-xs text-slate-500 block">Verified</span>
              <span className="text-lg font-bold text-green-400">{leads.filter((l) => l.status === "verified").length}</span>
            </div>
            <div className="bg-surface border border-slate-800 rounded-lg px-4 py-2">
              <span className="text-xs text-slate-500 block">Cross-case</span>
              <span className="text-lg font-bold text-red-400">{leads.filter((l) => l.cross_case).length}</span>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {leads.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                onVerify={onVerify}
              />
            ))}
          </div>
        </>
      )}
    </AppShell>
  );
}
