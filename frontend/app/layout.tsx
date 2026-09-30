import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CaseFlow — Investigation Platform",
  description: "Evidence → Reason → Action",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-bg text-slate-200 antialiased">{children}</body>
    </html>
  );
}
