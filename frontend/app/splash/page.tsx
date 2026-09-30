"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function SplashPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<"logo" | "fade">("logo");

  useEffect(() => {
    const token = window.localStorage.getItem("caseflow_token");
    if (!token) { router.replace("/login"); return; }

    const t1 = setTimeout(() => setPhase("fade"), 1800);
    const t2 = setTimeout(() => router.replace("/dashboard"), 2400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [router]);

  return (
    <div className={`min-h-screen bg-[#060a13] flex items-center justify-center transition-opacity duration-600 ${phase === "fade" ? "opacity-0" : "opacity-100"}`}>
      {/* Radial glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[500px] h-[500px] rounded-full bg-blue/[0.06] blur-[100px] animate-pulse" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-5 animate-[fadeUp_0.8s_ease-out]">
        {/* Shield icon */}
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue/20 to-blue/5 border border-blue/20 flex items-center justify-center backdrop-blur-sm">
          <svg className="w-10 h-10 text-blue" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
          </svg>
        </div>

        {/* Title */}
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-white">
            Case<span className="text-blue">Flow</span>
          </h1>
          <p className="text-sm text-slate-500 mt-2 tracking-widest uppercase">
            Investigation Intelligence
          </p>
        </div>

        {/* Loading bar */}
        <div className="w-48 h-0.5 bg-slate-800 rounded-full overflow-hidden mt-2">
          <div className="h-full bg-gradient-to-r from-blue/60 to-blue rounded-full animate-[loadBar_1.8s_ease-in-out]" />
        </div>
      </div>
    </div>
  );
}
