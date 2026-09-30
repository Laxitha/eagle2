"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { endpoints } from "@/lib/api";

interface Details {
  focus?: string;
  neighbours?: { name: string; type: string }[];
  cases?: string[];
}
interface Msg {
  id: number;
  role: "user" | "assistant";
  text: string;
  details?: Details;
}

const SUGGESTIONS = [
  "Who's the key connector?",
  "Who does the top person connect to?",
  "How many people are there?",
  "List everyone",
];

let _id = 1;

function renderText(t: string) {
  // simple **bold** support
  const parts = t.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i} className="text-white">
        {p.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}

function DetailsBlock({ d }: { d: Details }) {
  const hasNbrs = d.neighbours && d.neighbours.length > 0;
  if (!hasNbrs && !(d.cases && d.cases.length)) return null;
  return (
    <div className="mt-3 rounded-lg border border-slate-800 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {d.focus ? `${d.focus} — connections` : "Connections"}
        </span>
        <Link href="/graph" className="text-xs text-blue hover:underline">
          View in graph →
        </Link>
      </div>
      {d.cases && d.cases.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {d.cases.map((c) => (
            <span key={c} className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[11px] text-red-300">
              {c}
            </span>
          ))}
        </div>
      )}
      {hasNbrs && (
        <div className="mt-2 space-y-1">
          {d.neighbours!.map((n, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-slate-200">{n.name}</span>
              <span className="text-[11px] uppercase tracking-wide text-slate-500">{n.type}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AgentConsole() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: 0,
      role: "assistant",
      text:
        "Hi — I answer questions about the case files you upload. Ask me who the key connector is, who a person links to, or how many people are involved. If nothing's uploaded yet, add files on the Upload page first.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const msg = text.trim();
    if (!msg || loading) return;
    setInput("");
    setMessages((m) => [...m, { id: _id++, role: "user", text: msg }]);
    setLoading(true);
    try {
      const { data } = await endpoints.agentChat(msg);
      setMessages((m) => [
        ...m,
        {
          id: _id++,
          role: "assistant",
          text: data.reply,
          details: { focus: data.focus, neighbours: data.neighbours, cases: data.cases },
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { id: _id++, role: "assistant", text: "I couldn't reach the agent service. Is the backend running on :8010?" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-220px)] max-w-3xl flex-col rounded-xl border border-slate-800 bg-surface">
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[80%] rounded-2xl rounded-br-sm bg-blue px-4 py-2.5 text-sm text-white"
                  : "max-w-[88%] rounded-2xl rounded-bl-sm bg-bg px-4 py-2.5 text-sm text-slate-200"
              }
            >
              <p className="whitespace-pre-wrap">{renderText(m.text)}</p>
              {m.details && <DetailsBlock d={m.details} />}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-bg px-4 py-2.5 text-sm text-slate-500">
              <span className="inline-flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500" style={{ animationDelay: "0ms" }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500" style={{ animationDelay: "120ms" }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500" style={{ animationDelay: "240ms" }} />
              </span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-2 px-5 pb-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400 hover:border-blue hover:text-slate-200"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="border-t border-slate-800 p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder="Message the agent…  (e.g. Who's the key connector?)"
            className="max-h-32 flex-1 resize-none rounded-lg border border-slate-700 bg-bg px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue"
          />
          <button
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
            className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
