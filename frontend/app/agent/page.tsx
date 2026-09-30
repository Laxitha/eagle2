import AppShell from "@/components/AppShell";
import AgentConsole from "@/components/AgentConsole";

export default function AgentPage() {
  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-white mb-1">AI Agent</h1>
      <p className="text-slate-400 mb-4">
        Ask about the case files you've uploaded — who connects to whom, who the key figure is, or
        anyone by name (even a partial or different spelling). Answers come from your data, not samples.
      </p>
      <AgentConsole />
    </AppShell>
  );
}
