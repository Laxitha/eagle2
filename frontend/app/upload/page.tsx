"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import AppShell from "@/components/AppShell";
import { endpoints } from "@/lib/api";
import { mockStats, mockIngestionHistory, type IngestionHistoryItem } from "@/lib/mockData";
import { fetchIngestions } from "@/lib/supabaseData";

type UploadState = {
  name: string;
  status: "uploading" | "done" | "error";
  progress: number;
  detail?: string;
};

const ACCEPTED = ".csv, .tsv, .txt, .json, .gml, .graphml, .xml, .pdf";

export default function UploadPage() {
  const router = useRouter();
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [ingested, setIngested] = useState(0);
  const [recentHistory, setRecentHistory] = useState<IngestionHistoryItem[]>(mockIngestionHistory.slice(0, 5));

  useEffect(() => {
    fetchIngestions()
      .then((data) => {
        if (data.length > 0) setRecentHistory(data.slice(0, 5));
      })
      .catch(() => {});
  }, []);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      setUploads((prev) => [...prev, { name: file.name, status: "uploading", progress: 40 }]);

      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      let parsed = false;

      try {
        const resp = await endpoints.ingestFile(file);
        if (resp?.data) {
          const { data } = resp;
          const detail =
            data.parsed_records > 0
              ? `${data.parsed_records} records · ${data.parsed_relations} links → ${data.totals.entities} entities`
              : "no records recognised in this file";
          setUploads((prev) =>
            prev.map((u) =>
              u.name === file.name ? { ...u, status: "done", progress: 100, detail } : u
            )
          );
          setIngested((n) => n + data.parsed_records);
          parsed = true;
        }
      } catch (_) {
        // backend unreachable — fall through to demo mode
      }

      if (!parsed) {
        const records = ["csv", "tsv", "txt"].includes(ext) ? 12 : ["json"].includes(ext) ? 8 : 3;
        const relations = Math.max(1, Math.floor(records * 0.6));
        const detail = `${records} records · ${relations} links → ${mockStats.entities} entities (demo)`;
        setUploads((prev) =>
          prev.map((u) =>
            u.name === file.name ? { ...u, status: "done", progress: 100, detail } : u
          )
        );
        setIngested((n) => n + records);
      }
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "text/tab-separated-values": [".tsv"],
      "text/plain": [".txt"],
      "application/json": [".json"],
      "application/xml": [".xml"],
      "application/pdf": [".pdf"],
      "application/octet-stream": [".gml", ".graphml"],
    },
  });

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white tracking-tight">Upload Case Data</h1>
        <p className="text-slate-600 text-xs mt-0.5">
          CDRs, financial records, vehicle records, FIR reports, or a ready-made network graph.
        </p>
      </div>

      <div
        {...getRootProps()}
        className={`border border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
          isDragActive ? "border-blue/50 bg-blue/[0.03]" : "border-slate-800/60 bg-white/[0.01] hover:border-slate-700"
        }`}
      >
        <input {...getInputProps()} />
        <div className="text-2xl text-slate-600 mb-2">{"↑"}</div>
        <p className="text-sm text-slate-400 mb-0.5">Drag & drop files here, or click to select</p>
        <p className="text-[11px] text-slate-600">{ACCEPTED}</p>
      </div>

      {/* Current uploads */}
      {uploads.length > 0 && (
        <div className="mt-5 space-y-2">
          {uploads.map((u, i) => (
            <div key={i} className="card px-4 py-3">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-300">{u.name}</span>
                <span
                  className={
                    u.status === "done" ? "text-emerald-400" : u.status === "error" ? "text-red-400" : "text-amber"
                  }
                >
                  {u.status}
                </span>
              </div>
              <div className="w-full h-1 bg-slate-800/60 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${u.status === "error" ? "bg-red-500" : "bg-blue"}`}
                  style={{ width: `${u.progress}%` }}
                />
              </div>
              {u.detail && <p className="mt-1.5 text-[11px] text-slate-600">{u.detail}</p>}
            </div>
          ))}
        </div>
      )}

      {ingested > 0 && (
        <div className="mt-5 flex gap-2">
          <button
            onClick={() => router.push("/graph")}
            className="rounded-lg bg-blue px-4 py-2 text-xs font-medium text-white"
          >
            View the graph &rarr;
          </button>
          <button
            onClick={() => router.push("/agent")}
            className="rounded-lg border border-slate-800/60 px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
          >
            Ask the AI agent
          </button>
        </div>
      )}

      {/* Recent ingestion history */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Recent Ingestions</h2>
          <button
            onClick={() => router.push("/history")}
            className="text-[11px] text-blue hover:underline"
          >
            View all history &rarr;
          </button>
        </div>
        <div className="space-y-1.5">
          {recentHistory.map((h) => {
            const statusColor = {
              ingested: "text-blue",
              verified: "text-emerald-400",
              rejected: "text-red-400",
            }[h.status] ?? "text-slate-400";

            return (
              <div key={h.id} className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-white/[0.02] border border-slate-800/30">
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-slate-300 truncate block">{h.filename}</span>
                </div>
                <span className={`text-[10px] font-bold uppercase ${statusColor}`}>{h.status}</span>
                <span className="text-[10px] text-slate-600">{h.records} rec</span>
                <span className="text-[10px] text-slate-700">{h.date}</span>
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
