"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password");
      return;
    }
    setLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 600));
      window.localStorage.setItem("caseflow_token", "demo-token");
      window.localStorage.setItem("caseflow_user", username);
      router.push("/splash");
    } catch {
      setError("Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#060a13] relative overflow-hidden">
      {/* Background grid */}
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: "linear-gradient(rgba(59,130,246,.4) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,.4) 1px, transparent 1px)",
        backgroundSize: "48px 48px",
      }} />

      {/* Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-blue/[0.04] rounded-full blur-[120px]" />

      <div className="relative z-10 w-full max-w-sm px-4 animate-[fadeUp_0.6s_ease-out]">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue/10 border border-blue/15 mb-4">
            <svg className="w-7 h-7 text-blue" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-white tracking-tight">
            Case<span className="text-blue">Flow</span>
          </h1>
          <p className="text-xs text-slate-600 mt-1">Investigation Intelligence Platform</p>
        </div>

        {/* Card */}
        <form onSubmit={handleSubmit} className="card p-7">
          <h2 className="text-sm font-semibold text-white mb-0.5">Sign in</h2>
          <p className="text-xs text-slate-600 mb-5">Enter your credentials to access the workbench</p>

          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Username</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                autoFocus
                className="w-full bg-white/[0.03] border border-slate-800/60 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue/40 transition-colors"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full bg-white/[0.03] border border-slate-800/60 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue/40 transition-colors"
              />
            </div>
          </div>

          {error && (
            <div className="mt-3 text-xs text-red-400 bg-red-500/[0.06] border border-red-500/15 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-5 bg-blue text-white font-medium rounded-lg py-2 text-sm hover:bg-blue/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Signing in...
              </>
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        <p className="text-center text-[10px] text-slate-700 mt-5 tracking-wider uppercase">
          Evidence &rarr; Reason &rarr; Action
        </p>
      </div>
    </div>
  );
}
