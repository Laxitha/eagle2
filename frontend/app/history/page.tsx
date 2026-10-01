"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import type { IngestionHistoryItem } from "@/lib/mockData";
import { fetchIngestions } from "@/lib/supabaseData";

const FILTERS = ["All", "Ingested", "Verified", "Rejected"] as const;

export default function HistoryPage() {
  const [filter, setFilter] = useState<typeof FILTERS[number]>("All");
  const [history, setHistory] = useState<IngestionHistoryItem[]>([]);

  useEffect(() => {
    fetchIngestions()
      .then((data) => {
        setHistory(data);
      })
      .catch(() => {});
  }, []);

  const items = history.filter(
    (h) => filter === "All" || h.status.toLowerCase() === filter.toLowerCase()
  );

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Data History</h1>
          <p className="text-slate-500 text-sm">
            Previously ingested, verified, and processed datasets
          </p>
        </div>
        <div className="flex items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                filter === f
                  ? "border-blue/30 text-blue bg-blue/10"
                  : "border-slate-800 text-slate-500 hover:text-slate-300"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {items.map((h) => {
          const statusColor = {
            ingested: "text-blue bg-blue/10 border-blue/20",
            verified: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
            rejected: "text-red-400 bg-red-500/10 border-red-500/20",
          }[h.status.toLowerCase()] ?? "text-slate-400 bg-slate-800 border-slate-700";

          const typeIcon = {
            cdr: "phone",
            financial: "banknotes",
            fir: "document",
            vehicle: "truck",
            osint: "globe",
          }[h.type] ?? "document";

          return (
            <div
              key={h.id}
              className="card px-5 py-4 flex items-center gap-4 animate-[fadeIn_0.2s_ease-out]"
            >
              <div className="w-10 h-10 rounded-lg bg-slate-800/80 flex items-center justify-center shrink-0">
                <span className="text-lg">
                  {typeIcon === "phone" ? "\u{1F4DE}" : typeIcon === "banknotes" ? "\u{1F4B3}" : typeIcon === "truck" ? "\u{1F69A}" : typeIcon === "globe" ? "\u{1F310}" : "\u{1F4C4}"}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium text-white truncate">{h.filename}</span>
                  <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${statusColor}`}>
                    {h.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 truncate">{h.detail}</p>
              </div>

              <div className="text-right shrink-0">
                <div className="text-xs text-slate-400">{h.records} records</div>
                <div className="text-[10px] text-slate-600">{h.date}</div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="text-xs text-slate-500">
                  {h.entities} entities &middot; {h.relationships} links
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {items.length === 0 && (
        <div className="card p-12 text-center">
          <p className="text-slate-400 mb-1">No entries match this filter.</p>
          <p className="text-xs text-slate-600">Try selecting a different filter above.</p>
        </div>
      )}
    </AppShell>
  );
}
