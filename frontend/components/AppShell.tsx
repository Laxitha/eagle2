"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "./Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const token = window.localStorage.getItem("caseflow_token");
    if (!token) {
      router.replace("/login");
    } else {
      setAuthed(true);
    }
  }, [router]);

  if (!authed) return null;

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 p-7 overflow-x-hidden animate-[fadeIn_0.3s_ease-out]">
        {children}
      </main>
    </div>
  );
}
