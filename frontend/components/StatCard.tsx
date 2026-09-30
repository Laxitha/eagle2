export default function StatCard({
  label,
  value,
  accent = "blue",
}: {
  label: string;
  value: number | string;
  accent?: "blue" | "amber";
}) {
  return (
    <div className="bg-surface border border-slate-800 rounded-xl px-6 py-5">
      <div className="text-sm text-slate-400">{label}</div>
      <div
        className={`text-3xl font-bold mt-1 ${
          accent === "amber" ? "text-amber" : "text-blue"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
