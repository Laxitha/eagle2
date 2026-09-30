"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import StatCard from "@/components/StatCard";
import { endpoints, CaseStats } from "@/lib/api";
import { mockStats } from "@/lib/mockData";

export default function DashboardPage() {
  const [stats, setStats] = useState<CaseStats | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    endpoints
      .stats()
      .then((r) => setStats(r.data))
      .catch(() => setStats(mockStats))
      .finally(() => setLoaded(true));
  }, []);

  const empty = loaded && (!stats || stats.records === 0);

  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-white mb-1">Dashboard</h1>
      <p className="text-slate-400 mb-6">
        Turning fragmented intelligence into Evidence → Reason → Action.
      </p>

      <div className="grid grid-cols-3 gap-5 mb-8">
        <StatCard label="Entities" value={stats?.entities ?? 0} />
        <StatCard label="Relationships" value={stats?.relationships ?? 0} accent="amber" />
        <StatCard label="Cases" value={stats?.cases ?? 0} />
      </div>

      {empty ? (
        <div className="bg-surface border border-slate-800 rounded-xl p-8 text-center">
          <h2 className="text-lg font-semibold text-white mb-1">No data yet</h2>
          <p className="text-sm text-slate-400 mb-5">
            Upload case files to build the graph. Nothing is shown until you do.
          </p>
          <Link
            href="/upload"
            className="inline-block rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white"
          >
            Upload case data →
          </Link>
        </div>
      ) : (
        <div className="bg-surface border border-slate-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-2">
            {stats?.files} file(s) ingested · {stats?.records} records
          </h2>
          <ol className="list-decimal list-inside text-sm text-slate-400 space-y-1">
            <li>
              Explore the network on the <Link href="/graph" className="text-blue hover:underline">Graph</Link> page.
            </li>
            <li>
              Ask the <Link href="/agent" className="text-blue hover:underline">AI Agent</Link> to find the connector.
            </li>
            <li>
              Review ranked <Link href="/leads" className="text-blue hover:underline">Leads</Link> and verify them.
            </li>
          </ol>
        </div>
      )}
    </AppShell>
  );
}
