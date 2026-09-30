export default function StatCard({
  label,
  value,
  accent = "blue",
  icon,
}: {
  label: string;
  value: number | string;
  accent?: "blue" | "amber" | "green" | "red" | "purple";
  icon?: React.ReactNode;
}) {
  const colors = {
    blue: "text-blue",
    amber: "text-amber",
    green: "text-emerald-400",
    red: "text-red-400",
    purple: "text-purple-400",
  };
  const glows = {
    blue: "bg-blue/5",
    amber: "bg-amber-500/5",
    green: "bg-emerald-500/5",
    red: "bg-red-500/5",
    purple: "bg-purple-500/5",
  };

  return (
    <div className="card px-5 py-4 group">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">{label}</span>
        {icon && <span className={`w-7 h-7 rounded-lg ${glows[accent]} flex items-center justify-center`}>{icon}</span>}
      </div>
      <div className={`text-2xl font-bold ${colors[accent]}`}>
        {value}
      </div>
    </div>
  );
}
