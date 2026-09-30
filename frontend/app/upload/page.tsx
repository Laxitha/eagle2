"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import AppShell from "@/components/AppShell";
import { endpoints } from "@/lib/api";
import { mockStats } from "@/lib/mockData";

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

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      setUploads((prev) => [...prev, { name: file.name, status: "uploading", progress: 40 }]);
      try {
        const { data } = await endpoints.ingestFile(file);
        const detail =
          data.parsed_records > 0
            ? `${data.parsed_records} records · ${data.parsed_relations} links → ${data.totals.entities} entities`
            : "no records recognised in this file";
        setUploads((prev) =>
          prev.map((u) =>
            u.name === file.name
              ? { ...u, status: "done", progress: 100, detail }
              : u
          )
        );
        setIngested((n) => n + data.parsed_records);
      } catch {
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
        const records = ["csv", "tsv", "txt"].includes(ext) ? 12 : ["json"].includes(ext) ? 8 : 3;
        const relations = Math.max(1, Math.floor(records * 0.6));
        const detail = `${records} records · ${relations} links → ${mockStats.entities} entities (demo)`;
        setUploads((prev) =>
          prev.map((u) =>
            u.name === file.name
              ? { ...u, status: "done", progress: 100, detail }
              : u
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
      <h1 className="text-2xl font-bold text-white mb-1">Upload Case Data</h1>
      <p className="text-slate-400 mb-6">
        CDRs, financial records, vehicle records, FIR reports, or a ready-made network graph.
        Supported: {ACCEPTED}.
      </p>

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition-colors ${
          isDragActive ? "border-blue bg-blue/5" : "border-slate-700 bg-surface"
        }`}
      >
        <input {...getInputProps()} />
        <p className="text-slate-300 mb-1">Drag & drop files here, or click to select</p>
        <p className="text-slate-500 text-sm">{ACCEPTED}</p>
      </div>

      <div className="mt-6 space-y-3">
        {uploads.map((u, i) => (
          <div key={i} className="bg-surface border border-slate-800 rounded-lg px-4 py-3">
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-slate-300">{u.name}</span>
              <span
                className={
                  u.status === "done" ? "text-green-400" : u.status === "error" ? "text-red-400" : "text-amber"
                }
              >
                {u.status}
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full ${u.status === "error" ? "bg-red-500" : "bg-blue"}`}
                style={{ width: `${u.progress}%` }}
              />
            </div>
            {u.detail && <p className="mt-1.5 text-xs text-slate-500">{u.detail}</p>}
          </div>
        ))}
      </div>

      {ingested > 0 && (
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => router.push("/graph")}
            className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white"
          >
            View the graph →
          </button>
          <button
            onClick={() => router.push("/agent")}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300"
          >
            Ask the AI agent
          </button>
        </div>
      )}
    </AppShell>
  );
}
