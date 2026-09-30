"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartBarSquareIcon,
  ShareIcon,
  FolderIcon,
  LightBulbIcon,
  DocumentTextIcon,
  ArrowUpTrayIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: ChartBarSquareIcon },
  { href: "/upload", label: "Upload", icon: ArrowUpTrayIcon },
  { href: "/agent", label: "AI Agent", icon: SparklesIcon },
  { href: "/graph", label: "Graph", icon: ShareIcon },
  { href: "/leads", label: "Leads", icon: LightBulbIcon },
  { href: "/reports", label: "Reports", icon: DocumentTextIcon },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 bg-surface border-r border-slate-800 h-screen sticky top-0 flex flex-col">
      <div className="px-5 py-6">
        <span className="text-lg font-bold tracking-wide text-white">CaseFlow</span>
      </div>
      <nav className="flex-1 px-3 space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname?.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-blue/15 text-blue"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <Icon className="w-5 h-5" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-4 text-xs text-slate-500 flex items-center gap-1.5">
        <FolderIcon className="w-4 h-4" /> Evidence → Reason → Action
      </div>
    </aside>
  );
}
