"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { endpoints } from "@/lib/api";
import { demoAgentChat } from "@/lib/mockData";

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
  "Risk assessment for all entities",
  "Trace the money trail",
  "Give me the full timeline",
  "Tell me about Suresh Reddy",
  "What patterns were detected?",
  "Recommended next steps",
  "Describe the network",
];

let _id = 1;

function renderText(t: string) {
  const parts = t.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i} className="text-white font-medium">
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
    <div className="mt-3 rounded-lg border border-slate-800/50 bg-white/[0.02] p-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          {d.focus ? `${d.focus} — connections` : "Connections"}
        </span>
        <Link href="/graph" className="text-[10px] text-blue hover:underline">
          View in graph &rarr;
        </Link>
      </div>
      {d.cases && d.cases.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {d.cases.map((c) => (
            <span key={c} className="rounded-full border border-red-500/20 bg-red-500/[0.06] px-2 py-0.5 text-[10px] text-red-300">
              {c}
            </span>
          ))}
        </div>
      )}
      {hasNbrs && (
        <div className="mt-2 space-y-1">
          {d.neighbours!.map((n, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="text-slate-300">{n.name}</span>
              <span className="text-[10px] text-slate-600">{n.type}</span>
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
        "I'm CaseFlow's AI investigation agent. I have access to your uploaded case data — **17 entities** across **3 active investigations** connected by **20 relationships**.\n\nI can analyze entities, trace financial flows, identify patterns, assess risks, and recommend investigative actions. Ask me anything about the cases, or try one of the suggestions below.",
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

    // Simulate typing delay for realism
    await new Promise(r => setTimeout(r, 600 + Math.random() * 800));

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
      const demo = demoAgentChat(msg);
      setMessages((m) => [
        ...m,
        {
          id: _id++,
          role: "assistant",
          text: demo.reply,
          details: { focus: demo.focus, neighbours: demo.neighbours, cases: demo.cases },
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-180px)] max-w-3xl flex-col rounded-xl border border-slate-800/50 bg-surface/60 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-800/50">
        <div className="w-6 h-6 rounded-lg bg-blue/10 flex items-center justify-center">
          <span className="text-blue text-[10px] font-bold">{"✦"}</span>
        </div>
        <span className="text-xs font-medium text-slate-300">CaseFlow AI Agent</span>
        <span className="text-[10px] text-slate-600 ml-auto">3 cases &middot; 17 entities &middot; 20 links</span>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[75%] rounded-2xl rounded-br-sm bg-blue/90 px-4 py-2.5 text-sm text-white"
                  : "max-w-[88%] rounded-2xl rounded-bl-sm bg-white/[0.03] border border-slate-800/40 px-4 py-3 text-sm text-slate-300"
              }
            >
              <div className="whitespace-pre-wrap leading-relaxed">{renderText(m.text)}</div>
              {m.details && <DetailsBlock d={m.details} />}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-white/[0.03] border border-slate-800/40 px-4 py-3 text-sm text-slate-500">
              <span className="inline-flex gap-1 items-center">
                <span className="text-[10px] text-blue mr-1">{"✦"}</span>
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500" style={{ animationDelay: "0ms" }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500" style={{ animationDelay: "120ms" }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500" style={{ animationDelay: "240ms" }} />
              </span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-1.5 px-5 pb-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="rounded-full border border-slate-800/60 px-3 py-1 text-[11px] text-slate-500 hover:border-blue/40 hover:text-slate-300 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-slate-800/50 p-3">
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
            placeholder="Ask about entities, cases, risks, patterns, evidence..."
            className="max-h-32 flex-1 resize-none rounded-lg border border-slate-800/60 bg-white/[0.02] px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-blue/40 transition-colors"
          />
          <button
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
            className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white disabled:opacity-30 transition-opacity"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
