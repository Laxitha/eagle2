import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  const { message } = await req.json();
  if (!message) return NextResponse.json({ error: "No message" }, { status: 400 });

  const q = message.toLowerCase();

  const [entitiesRes, relsRes, risksRes, patternsRes, anomaliesRes, leadsRes] = await Promise.all([
    supabaseAdmin.from("entities").select("id, label, name"),
    supabaseAdmin.from("relationships").select("source_id, target_id, type, confidence"),
    supabaseAdmin.from("risk_analysis").select("*").order("score", { ascending: false }),
    supabaseAdmin.from("patterns").select("*"),
    supabaseAdmin.from("anomalies").select("*"),
    supabaseAdmin.from("leads").select("*").order("score", { ascending: false }),
  ]);

  const entities = entitiesRes.data ?? [];
  const rels = relsRes.data ?? [];
  const risks = risksRes.data ?? [];
  const patterns = patternsRes.data ?? [];
  const anomalies = anomaliesRes.data ?? [];
  const leads = leadsRes.data ?? [];

  const entityNames = entities.map((e) => e.name);
  const mentionedEntity = entities.find(
    (e) => q.includes(e.name.toLowerCase()) || q.includes(e.id.toLowerCase())
  );

  let reply = "";
  let focus: string | undefined;
  let neighbours: { name: string; type: string }[] = [];
  let cases: string[] = [];

  if (mentionedEntity) {
    focus = mentionedEntity.name;
    const conns = rels.filter(
      (r) => r.source_id === mentionedEntity.id || r.target_id === mentionedEntity.id
    );
    neighbours = conns.map((c) => {
      const otherId = c.source_id === mentionedEntity.id ? c.target_id : c.source_id;
      const other = entities.find((e) => e.id === otherId);
      return { name: other?.name ?? otherId, type: c.type };
    });
    const risk = risks.find((r) => r.entity_id === mentionedEntity.id);
    const entityAnomalies = anomalies.filter((a) => a.entity_id === mentionedEntity.id);

    reply = `**${mentionedEntity.name}** (${mentionedEntity.label}) has **${conns.length} connections** in the network.\n\n`;
    if (risk) {
      reply += `**Risk Level:** ${risk.risk_level.toUpperCase()} (score: ${(risk.score * 100).toFixed(0)}%)\n`;
      if (risk.factors?.length) reply += `**Factors:** ${risk.factors.join(", ")}\n\n`;
    }
    if (entityAnomalies.length > 0) {
      reply += `**Anomalies detected:**\n`;
      entityAnomalies.forEach((a) => {
        reply += `- ${a.anomaly} (${a.deviation.toFixed(1)}σ deviation): ${a.explanation}\n`;
      });
    }
  } else if (q.includes("key connector") || q.includes("central") || q.includes("important")) {
    const topRisk = risks[0];
    if (topRisk) {
      focus = topRisk.entity_name;
      reply = `The key connector in the network is **${topRisk.entity_name}** with a risk score of **${(topRisk.score * 100).toFixed(0)}%** (${topRisk.risk_level}).\n\n`;
      if (topRisk.factors?.length) reply += `**Risk factors:** ${topRisk.factors.join(", ")}\n\n`;
      reply += `This entity has the highest centrality and cross-case linkage in the network.`;
    } else {
      reply = `No risk analysis data available yet. Upload case data to generate network analysis.`;
    }
  } else if (q.includes("risk") || q.includes("assessment")) {
    reply = `**Risk Assessment Summary** — ${risks.length} entities analyzed:\n\n`;
    risks.forEach((r) => {
      reply += `- **${r.entity_name}**: ${r.risk_level.toUpperCase()} (${(r.score * 100).toFixed(0)}%)\n`;
    });
  } else if (q.includes("pattern")) {
    reply = `**${patterns.length} patterns detected:**\n\n`;
    patterns.forEach((p) => {
      reply += `- **${p.title}** (${p.severity}): ${p.description}\n`;
    });
  } else if (q.includes("money") || q.includes("financial") || q.includes("trail")) {
    const financialRels = rels.filter((r) => ["TRANSFERRED", "PAID", "RECEIVED"].includes(r.type));
    reply = `**Financial trail analysis** — ${financialRels.length} financial links found:\n\n`;
    financialRels.forEach((r) => {
      const src = entities.find((e) => e.id === r.source_id);
      const tgt = entities.find((e) => e.id === r.target_id);
      reply += `- ${src?.name ?? r.source_id} → ${tgt?.name ?? r.target_id} (${r.type}, confidence: ${(r.confidence * 100).toFixed(0)}%)\n`;
    });
    if (financialRels.length === 0) reply += `No financial transfer records found in the current dataset.`;
  } else if (q.includes("timeline") || q.includes("chronolog")) {
    reply = `**Investigation Timeline:**\n\nThe network contains **${entities.length} entities** connected by **${rels.length} relationships**.\n\n`;
    reply += `**Entity types:** ${[...new Set(entities.map((e) => e.label))].join(", ")}\n`;
    reply += `**Relationship types:** ${[...new Set(rels.map((r) => r.type))].join(", ")}\n\n`;
    reply += `Upload more data or ask about specific entities for detailed timelines.`;
  } else if (q.includes("next step") || q.includes("recommend")) {
    reply = `**Recommended investigative actions:**\n\n`;
    leads.slice(0, 5).forEach((l, i) => {
      reply += `${i + 1}. **${l.entity_name}** — ${l.recommended_action || l.reason} (risk: ${l.risk_level})\n`;
    });
    if (leads.length === 0) reply += `No leads generated yet. Upload case data to start analysis.`;
  } else if (q.includes("network") || q.includes("describe") || q.includes("overview")) {
    reply = `**Network Overview:**\n\n`;
    reply += `- **${entities.length}** entities across types: ${[...new Set(entities.map((e) => e.label))].join(", ")}\n`;
    reply += `- **${rels.length}** relationships: ${[...new Set(rels.map((r) => r.type))].join(", ")}\n`;
    reply += `- **${risks.length}** risk-assessed entities\n`;
    reply += `- **${patterns.length}** patterns detected\n`;
    reply += `- **${anomalies.length}** anomalies flagged\n`;
    reply += `- **${leads.length}** investigative leads generated\n`;
  } else {
    reply = `I analyzed the query against your case data (${entities.length} entities, ${rels.length} relationships).\n\n`;
    if (entities.length > 0) {
      reply += `**Available entities:** ${entityNames.slice(0, 8).join(", ")}${entityNames.length > 8 ? ` and ${entityNames.length - 8} more` : ""}.\n\n`;
      reply += `Try asking about a specific entity by name, or ask about risk assessments, patterns, financial trails, timelines, or recommended next steps.`;
    } else {
      reply += `No case data loaded yet. Upload files on the Upload page to start building the investigation graph.`;
    }
  }

  return NextResponse.json({ reply, focus, neighbours, cases });
}
