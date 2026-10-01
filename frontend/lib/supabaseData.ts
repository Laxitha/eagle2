import { supabase } from "./supabase";
import type { CaseStats, GraphNode, GraphEdge } from "./api";
import type { EnrichedLead, RiskAnalysis, PatternDetection, AnomalyDetection, IngestionHistoryItem } from "./mockData";

export async function fetchStats(): Promise<CaseStats> {
  const { data, error } = await supabase.from("case_stats").select("*").single();
  if (error || !data) throw error;
  return {
    cases: Number(data.cases),
    entities: Number(data.entities),
    relationships: Number(data.relationships),
    files: Number(data.files),
    records: Number(data.records),
  };
}

export async function fetchGraph(): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
  const [nodesRes, edgesRes] = await Promise.all([
    supabase.from("entities").select("id, label, name"),
    supabase.from("relationships").select("source_id, target_id, type, confidence"),
  ]);
  if (nodesRes.error) throw nodesRes.error;
  if (edgesRes.error) throw edgesRes.error;

  const nodes: GraphNode[] = (nodesRes.data ?? []).map((e: any) => ({
    id: e.id,
    label: e.label,
    name: e.name,
  }));

  const edges: GraphEdge[] = (edgesRes.data ?? []).map((r: any) => ({
    source: r.source_id,
    target: r.target_id,
    type: r.type,
    confidence: Number(r.confidence),
  }));

  return { nodes, edges };
}

export async function fetchLeads(): Promise<EnrichedLead[]> {
  const { data, error } = await supabase.from("leads_enriched").select("*");
  if (error) throw error;
  if (!data || data.length === 0) return [];

  return data.map((l: any) => ({
    id: l.id,
    entity_id: l.entity_id,
    entity_name: l.entity_name,
    score: Number(l.score),
    status: l.status,
    cross_case: l.cross_case ?? false,
    risk_level: l.risk_level,
    reason: l.reason,
    recommended_action: l.recommended_action ?? "",
    ai_reasoning: l.ai_reasoning ?? "",
    confidence_breakdown: l.confidence_breakdown ?? {},
    evidence: (l.evidence_items ?? []).map((e: any) => ({
      type: e.type,
      source: e.source,
      detail: e.detail,
      date: e.date,
      confidence: Number(e.confidence),
    })),
    connected_entities: (l.connected_entities ?? []).map((c: any) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      relationship: c.relationship,
    })),
    linked_cases: (l.linked_cases ?? []).map((c: any) => ({
      id: c.id,
      name: c.name,
      relevance: c.relevance,
    })),
    timeline: (l.timeline ?? []).map((t: any) => ({
      date: t.date,
      event: t.event,
    })),
  }));
}

export async function fetchRiskAnalysis(): Promise<RiskAnalysis[]> {
  const { data, error } = await supabase
    .from("risk_analysis")
    .select("*")
    .order("score", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    entity_id: r.entity_id,
    entity_name: r.entity_name,
    risk_level: r.risk_level,
    score: Number(r.score),
    factors: r.factors ?? [],
  }));
}

export async function fetchPatterns(): Promise<PatternDetection[]> {
  const { data, error } = await supabase.from("patterns").select("*");
  if (error) throw error;
  return (data ?? []).map((p: any) => ({
    id: p.id,
    type: p.type,
    title: p.title,
    description: p.description,
    severity: p.severity,
    entities_involved: p.entities_involved ?? [],
  }));
}

export async function fetchAnomalies(): Promise<AnomalyDetection[]> {
  const { data, error } = await supabase.from("anomalies").select("*");
  if (error) throw error;
  return (data ?? []).map((a: any) => ({
    id: a.id,
    entity_id: a.entity_id,
    entity_name: a.entity_name,
    anomaly: a.anomaly,
    deviation: Number(a.deviation),
    explanation: a.explanation,
  }));
}

export async function fetchIngestions(): Promise<IngestionHistoryItem[]> {
  const { data, error } = await supabase
    .from("ingestions")
    .select("*")
    .order("date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((h: any) => ({
    id: h.id,
    filename: h.filename,
    type: h.type,
    status: h.status,
    records: h.records,
    entities: h.entities,
    relationships: h.relationships,
    detail: h.detail ?? "",
    date: h.date?.split("T")[0] ?? "",
    verifiedBy: h.verified_by ?? undefined,
  }));
}

export async function verifyLead(id: string, approved: boolean): Promise<void> {
  await supabase
    .from("leads")
    .update({ status: approved ? "verified" : "rejected", updated_at: new Date().toISOString() })
    .eq("id", id);
}
