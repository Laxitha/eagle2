"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { endpoints, CaseStats, CaseLead } from "@/lib/api";
import { mockStats, mockCaseLeads } from "@/lib/mockData";

export default function ReportsPage() {
  const [stats, setStats] = useState<CaseStats | null>(null);
  const [leads, setLeads] = useState<CaseLead[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([endpoints.stats(), endpoints.leads()])
      .then(([s, l]) => {
        setStats(s.data);
        setLeads(l.data.leads || []);
      })
      .catch(() => {
        setStats(mockStats);
        setLeads(mockCaseLeads);
      })
      .finally(() => setLoaded(true));
  }, []);

  const empty = loaded && (!stats || stats.records === 0);
  const top = leads[0];

  const sections = stats
    ? [
        {
          title: "Case Overview",
          body: `${stats.cases} case(s), ${stats.entities} resolved entities, ${stats.relationships} relationships across ${stats.files} uploaded file(s).`,
        },
        {
          title: "Network Analysis",
          body: top
            ? `${top.entity_name} scores highest (${(top.score * 100).toFixed(0)}). ${top.reason}`
            : "No network hub identified yet.",
        },
        {
          title: "Investigative Leads",
          body: `${leads.length} lead(s) generated, ranked by priority score.`,
        },
        { title: "Investigator Notes", body: "Pending manual review." },
      ]
    : [];

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Intelligence Report</h1>
          <p className="text-slate-400 text-sm">
            {stats?.cases ?? 0} cases · {stats?.entities ?? 0} entities · {stats?.relationships ?? 0} relationships
          </p>
        </div>
        {!empty && (
          <button className="bg-blue text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue/90">
            Export PDF
          </button>
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
        <div className="space-y-4">
          {sections.map((s) => (
            <div key={s.title} className="bg-surface border border-slate-800 rounded-xl p-5">
              <h2 className="text-white font-semibold mb-2">{s.title}</h2>
              <p className="text-sm text-slate-400">{s.body}</p>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
