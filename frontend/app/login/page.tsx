"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { endpoints } from "@/lib/api";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const res = await endpoints.login(username, password);
      window.localStorage.setItem("eagle_token", res.data.access_token);
      router.push("/dashboard");
    } catch {
      setError("Invalid credentials");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <form onSubmit={handleSubmit} className="bg-surface border border-slate-800 rounded-xl p-8 w-96">
        <div className="mb-6">
          <span className="text-xl font-bold text-white">CaseFlow</span>
        </div>
        <label className="block text-sm text-slate-400 mb-1">Username</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 mb-4 text-white focus:outline-none focus:border-blue"
        />
        <label className="block text-sm text-slate-400 mb-1">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 mb-4 text-white focus:outline-none focus:border-blue"
        />
        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        <button type="submit" className="w-full bg-blue text-white font-medium rounded-lg py-2.5 hover:bg-blue/90">
          Sign in
        </button>
      </form>
    </div>
  );
}
