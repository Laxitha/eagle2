"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChartBarSquareIcon,
  ShareIcon,
  LightBulbIcon,
  DocumentTextIcon,
  ArrowUpTrayIcon,
  SparklesIcon,
  ArrowRightOnRectangleIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: ChartBarSquareIcon },
  { href: "/upload", label: "Upload", icon: ArrowUpTrayIcon },
  { href: "/agent", label: "AI Agent", icon: SparklesIcon },
  { href: "/graph", label: "Graph", icon: ShareIcon },
  { href: "/leads", label: "Leads", icon: LightBulbIcon },
  { href: "/reports", label: "Reports", icon: DocumentTextIcon },
  { href: "/history", label: "History", icon: ClockIcon },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    window.localStorage.removeItem("caseflow_token");
    window.localStorage.removeItem("caseflow_user");
    router.push("/login");
  };

  return (
    <aside className="w-56 shrink-0 bg-surface/80 backdrop-blur-md border-r border-slate-800/50 h-screen sticky top-0 flex flex-col">
      <div className="px-5 py-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue/10 border border-blue/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-blue" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
            </svg>
          </div>
          <span className="text-base font-semibold tracking-tight text-white">
            Case<span className="text-blue">Flow</span>
          </span>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname?.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 ${
                active
                  ? "bg-blue/10 text-blue border border-blue/15"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.03] border border-transparent"
              }`}
            >
              <Icon className="w-[18px] h-[18px]" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-2">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-slate-500 hover:text-slate-300 hover:bg-white/[0.03] transition-colors w-full"
        >
          <ArrowRightOnRectangleIcon className="w-[18px] h-[18px]" />
          Sign out
        </button>
      </div>

      <div className="px-5 py-3 border-t border-slate-800/50">
        <p className="text-[10px] text-slate-600 tracking-wider uppercase">
          Evidence &rarr; Reason &rarr; Action
        </p>
      </div>
    </aside>
  );
}
