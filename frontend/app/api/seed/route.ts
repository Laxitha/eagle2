import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

const ENTITIES = [
  { id: "UENT-0001", label: "Person", name: "Ravi Kumar" },
  { id: "UENT-0002", label: "Person", name: "Suresh Reddy" },
  { id: "UENT-0003", label: "Person", name: "Arun Nair" },
  { id: "UENT-0004", label: "Person", name: "Farooq Ahmed" },
  { id: "UENT-0005", label: "Person", name: "Rajesh Gupta" },
  { id: "UENT-0006", label: "Person", name: "Deepa Krishnan" },
  { id: "PH-001", label: "Phone", name: "+91 98765 43210" },
  { id: "PH-002", label: "Phone", name: "+91 87654 32109" },
  { id: "PH-003", label: "Phone", name: "+91 76543 21098" },
  { id: "FIR-101", label: "Case", name: "FIR-101 Narcotics" },
  { id: "FIR-104", label: "Case", name: "FIR-104 Financial Fraud" },
  { id: "FIR-109", label: "Case", name: "FIR-109 Smuggling" },
  { id: "VEH-001", label: "Vehicle", name: "KA-01-AB-1234" },
  { id: "ACC-SURESH", label: "Account", name: "9123...780" },
  { id: "ACC-ARUN", label: "Account", name: "9988...655" },
  { id: "LOC-001", label: "Location", name: "Bangalore, KA" },
  { id: "LOC-002", label: "Location", name: "Hyderabad, TS" },
];

const RELATIONSHIPS_DATA = [
  { source_id: "UENT-0001", target_id: "UENT-0002", type: "CALLED", confidence: 0.95 },
  { source_id: "UENT-0002", target_id: "UENT-0003", type: "TRANSFERRED", confidence: 0.9 },
  { source_id: "UENT-0001", target_id: "FIR-101", type: "LINKED_TO", confidence: 1.0 },
  { source_id: "UENT-0002", target_id: "FIR-104", type: "LINKED_TO", confidence: 1.0 },
  { source_id: "UENT-0003", target_id: "FIR-109", type: "LINKED_TO", confidence: 1.0 },
  { source_id: "UENT-0001", target_id: "UENT-0004", type: "CONTACTED", confidence: 0.8 },
  { source_id: "UENT-0002", target_id: "UENT-0005", type: "CONTACTED", confidence: 0.7 },
  { source_id: "UENT-0003", target_id: "UENT-0006", type: "VISITED", confidence: 0.75 },
  { source_id: "UENT-0002", target_id: "ACC-SURESH", type: "OWNED", confidence: 1.0 },
  { source_id: "UENT-0003", target_id: "ACC-ARUN", type: "OWNED", confidence: 1.0 },
  { source_id: "ACC-SURESH", target_id: "ACC-ARUN", type: "TRANSFERRED", confidence: 0.9 },
  { source_id: "UENT-0001", target_id: "PH-001", type: "OWNS", confidence: 1.0 },
  { source_id: "UENT-0002", target_id: "PH-002", type: "OWNS", confidence: 1.0 },
  { source_id: "UENT-0003", target_id: "PH-003", type: "OWNS", confidence: 1.0 },
  { source_id: "UENT-0004", target_id: "FIR-101", type: "LINKED_TO", confidence: 0.85 },
  { source_id: "UENT-0005", target_id: "FIR-104", type: "LINKED_TO", confidence: 0.8 },
  { source_id: "UENT-0001", target_id: "VEH-001", type: "OWNED", confidence: 0.9 },
  { source_id: "UENT-0001", target_id: "LOC-001", type: "VISITED", confidence: 0.85 },
  { source_id: "UENT-0003", target_id: "LOC-002", type: "VISITED", confidence: 0.8 },
  { source_id: "UENT-0004", target_id: "UENT-0006", type: "MET", confidence: 0.65 },
];

const RISK_ANALYSIS = [
  { id: "risk-01", entity_id: "UENT-0002", entity_name: "Suresh Reddy", risk_level: "critical", score: 0.91, factors: ["Bridges all 3 cases", "Hawala-pattern transfers", "340% call spike before FIR dates"] },
  { id: "risk-02", entity_id: "UENT-0001", entity_name: "Ravi Kumar", risk_level: "high", score: 0.82, factors: ["Highest degree centrality", "Late-night call pattern", "Vehicle at 2 case locations"] },
  { id: "risk-03", entity_id: "UENT-0003", entity_name: "Arun Nair", risk_level: "high", score: 0.76, factors: ["Structured deposits below threshold", "Sole smuggling suspect", "Financial link to fraud case"] },
  { id: "risk-04", entity_id: "UENT-0004", entity_name: "Farooq Ahmed", risk_level: "medium", score: 0.58, factors: ["Concealed relationship detected", "Cross-case link potential"] },
  { id: "risk-05", entity_id: "UENT-0006", entity_name: "Deepa Krishnan", risk_level: "medium", score: 0.52, factors: ["Connected to 2 suspects in different cases", "Low-confidence meeting flagged"] },
  { id: "risk-06", entity_id: "UENT-0005", entity_name: "Rajesh Gupta", risk_level: "low", score: 0.35, factors: ["Peripheral node", "Single case connection"] },
];

const PATTERNS = [
  { id: "pat-1", type: "structuring", title: "Transaction Structuring", description: "6 transactions of exactly 49,500 — designed to stay below 50,000 reporting threshold. Classic hawala routing pattern.", severity: "critical", entities_involved: ["UENT-0002", "UENT-0003"] },
  { id: "pat-2", type: "timing", title: "Late-Night Communication Cluster", description: "47 calls between Ravi Kumar and Suresh Reddy clustered between 11 PM-2 AM over 14 days.", severity: "high", entities_involved: ["UENT-0001", "UENT-0002"] },
  { id: "pat-3", type: "geographic", title: "Multi-Location Convergence", description: "Vehicle KA-01-AB-1234 detected at FIR-101 warehouse and suspect residence within 48 hours.", severity: "high", entities_involved: ["UENT-0001", "UENT-0002"] },
  { id: "pat-4", type: "communication", title: "CDR Spike Before FIR Filing", description: "Call frequency between suspects increased 340% in the 2 weeks before each FIR filing date.", severity: "medium", entities_involved: ["UENT-0001", "UENT-0002", "UENT-0003"] },
];

const ANOMALIES = [
  { id: "anom-01", entity_id: "UENT-0004", entity_name: "Farooq Ahmed", anomaly: "Low-confidence cross-case edge", deviation: 2.3, explanation: "The MET relationship with Deepa Krishnan (conf: 0.65) is 2.3 standard deviations below the average edge confidence in this network." },
  { id: "anom-02", entity_id: "UENT-0002", entity_name: "Suresh Reddy", anomaly: "Transaction amount clustering", deviation: 3.1, explanation: "All 6 outbound transactions cluster just below the reporting threshold. Probability of this pattern occurring naturally is < 0.2%." },
];

const LEADS = [
  {
    id: "lead-1", entity_id: "UENT-0002", entity_name: "Suresh Reddy", score: 0.87,
    reason: "Bridges narcotics case FIR-101 and financial fraud case FIR-104 via phone calls and bank transfers. Central node connecting 3 separate investigations.",
    recommended_action: "Cross-reference open cases — this entity appears in multiple investigations. Prioritize CDR analysis for the last 90 days.",
    status: "pending", risk_level: "critical", cross_case: true,
    ai_reasoning: "Entity resolution identified Suresh Reddy as the sole bridge node connecting all three active cases. Graph analysis shows betweenness centrality of 0.91. Financial flow analysis detected structured transfers below reporting threshold.",
    confidence_breakdown: { network: 0.93, cross_case: 0.88, evidence: 0.91, temporal: 0.82, anomaly: 0.78 },
    evidence: [
      { type: "cdr", source: "CDR-BNG-2024-0891", detail: "47 calls to Ravi Kumar over 14 days, avg duration 8.2 min", date: "2024-01-15", confidence: 0.95 },
      { type: "financial", source: "FIN-TX-44291", detail: "4.2L transferred to Arun Nair in 6 split transactions", date: "2024-01-17", confidence: 0.92 },
      { type: "witness", source: "WIT-FIR101-03", detail: "Identified by witness as frequent visitor to warehouse", date: "2024-01-20", confidence: 0.72 },
    ],
    connected_entities: [
      { id: "UENT-0001", name: "Ravi Kumar", type: "Person", relationship: "47 calls, co-accused in FIR-101" },
      { id: "UENT-0003", name: "Arun Nair", type: "Person", relationship: "Bank transfer recipient" },
      { id: "UENT-0005", name: "Rajesh Gupta", type: "Person", relationship: "5 calls, FIR-104 co-accused" },
    ],
    linked_cases: [
      { id: "FIR-101", name: "FIR-101 Narcotics", relevance: "Direct — phone contact with prime suspect" },
      { id: "FIR-104", name: "FIR-104 Financial Fraud", relevance: "Direct — named accused" },
      { id: "FIR-109", name: "FIR-109 Smuggling", relevance: "Indirect — funds transferred to suspect" },
    ],
    timeline: [
      { date: "2024-01-10", event: "First CDR spike — 12 calls to Ravi Kumar in 24 hrs" },
      { date: "2024-01-17", event: "4.2L transferred to Arun Nair in 6 splits" },
      { date: "2024-01-25", event: "FIR-104 filed — Suresh named as accused" },
    ],
  },
  {
    id: "lead-2", entity_id: "UENT-0001", entity_name: "Ravi Kumar", score: 0.79,
    reason: "Network hub with 6 direct connections. Vehicle KA-01-AB-1234 spotted near two case locations.",
    recommended_action: "Investigate immediate contacts — this entity is a network hub with connections to 4 other persons of interest.",
    status: "pending", risk_level: "high", cross_case: true,
    ai_reasoning: "Ravi Kumar functions as the network's primary communication hub with 6 direct edges — the highest degree centrality in the graph. CDR analysis reveals calls cluster between 11 PM-2 AM.",
    confidence_breakdown: { network: 0.85, cross_case: 0.72, evidence: 0.88, temporal: 0.74, anomaly: 0.65 },
    evidence: [
      { type: "cdr", source: "CDR-BNG-2024-0891", detail: "47 calls to Suresh Reddy, primarily between 11 PM-2 AM", date: "2024-01-15", confidence: 0.95 },
      { type: "vehicle", source: "ANPR-KA01AB1234", detail: "Vehicle at FIR-101 warehouse and Suresh's residence within 48hrs", date: "2024-01-20", confidence: 0.90 },
      { type: "document", source: "FIR-101-ACCUSED", detail: "Named as prime accused in FIR-101 (Narcotics)", date: "2024-01-12", confidence: 1.0 },
    ],
    connected_entities: [
      { id: "UENT-0002", name: "Suresh Reddy", type: "Person", relationship: "47 late-night calls" },
      { id: "UENT-0004", name: "Farooq Ahmed", type: "Person", relationship: "Known associate, 8 calls" },
      { id: "VEH-001", name: "KA-01-AB-1234", type: "Vehicle", relationship: "Registered owner" },
    ],
    linked_cases: [
      { id: "FIR-101", name: "FIR-101 Narcotics", relevance: "Direct — prime accused" },
      { id: "FIR-104", name: "FIR-104 Financial Fraud", relevance: "Indirect — connected to accused via calls" },
    ],
    timeline: [
      { date: "2024-01-12", event: "Named as prime accused in FIR-101" },
      { date: "2024-01-15", event: "CDR analysis flags 47 calls to Suresh Reddy" },
      { date: "2024-01-18", event: "Vehicle spotted at FIR-101 warehouse" },
    ],
  },
  {
    id: "lead-3", entity_id: "UENT-0003", entity_name: "Arun Nair", score: 0.74,
    reason: "Received structured transfers below reporting threshold. Linked to smuggling case FIR-109.",
    recommended_action: "Trace financial flow — bank transfer pattern matches known hawala routing. Freeze Account 9988...655.",
    status: "pending", risk_level: "high", cross_case: false,
    ai_reasoning: "Financial pattern analysis flagged Account 9988...655 as a potential money laundering endpoint. 6 transactions of 49,500 each — structuring below the 50,000 threshold.",
    confidence_breakdown: { network: 0.68, cross_case: 0.71, evidence: 0.89, temporal: 0.64, anomaly: 0.72 },
    evidence: [
      { type: "financial", source: "FIN-TX-44291", detail: "Received 4.2L in 6 transactions of 49,500 each", date: "2024-01-17", confidence: 0.94 },
      { type: "cdr", source: "CDR-HYD-2024-1102", detail: "12 calls from Suresh Reddy on same day as transfers", date: "2024-01-17", confidence: 0.88 },
    ],
    connected_entities: [
      { id: "UENT-0002", name: "Suresh Reddy", type: "Person", relationship: "Fund source, 12 calls" },
      { id: "ACC-ARUN", name: "Account 9988...655", type: "Account", relationship: "Primary account" },
    ],
    linked_cases: [
      { id: "FIR-109", name: "FIR-109 Smuggling", relevance: "Direct — sole accused" },
      { id: "FIR-104", name: "FIR-104 Financial Fraud", relevance: "Indirect — received funds from accused" },
    ],
    timeline: [
      { date: "2024-01-17", event: "4.2L received from Suresh Reddy in 6 split transactions" },
      { date: "2024-02-01", event: "FIR-109 filed — named as sole accused" },
    ],
  },
  {
    id: "lead-4", entity_id: "UENT-0004", entity_name: "Farooq Ahmed", score: 0.62,
    reason: "Known associate of Ravi Kumar. Met with Deepa Krishnan who appears in a separate case.",
    recommended_action: "Interview as a secondary witness — may have info about the Ravi Kumar / Deepa Krishnan connection.",
    status: "pending", risk_level: "medium", cross_case: false,
    ai_reasoning: "Farooq Ahmed is a peripheral node with only 2 direct connections, but anomaly detection flagged the edge to Deepa Krishnan (confidence 0.65) as unusually low.",
    confidence_breakdown: { network: 0.52, cross_case: 0.48, evidence: 0.55, temporal: 0.45, anomaly: 0.82 },
    evidence: [
      { type: "cdr", source: "CDR-BNG-2024-0912", detail: "8 calls to Ravi Kumar over 30 days", date: "2024-01-25", confidence: 0.80 },
      { type: "osint", source: "SOCINT-FB-0042", detail: "Social media check-in at same location as Deepa Krishnan", date: "2024-01-19", confidence: 0.65 },
    ],
    connected_entities: [
      { id: "UENT-0001", name: "Ravi Kumar", type: "Person", relationship: "8 calls, known associate" },
      { id: "UENT-0006", name: "Deepa Krishnan", type: "Person", relationship: "Possible meeting (low confidence)" },
    ],
    linked_cases: [
      { id: "FIR-101", name: "FIR-101 Narcotics", relevance: "Indirect — associate of prime accused" },
    ],
    timeline: [
      { date: "2024-01-12", event: "Named as known associate in FIR-101 witness statement" },
      { date: "2024-01-19", event: "Possible meeting with Deepa Krishnan (social media)" },
    ],
  },
];

const INGESTIONS = [
  { id: "ing-1", filename: "CDR_Bangalore_Jan2024.csv", type: "cdr", status: "verified", records: 1247, entities: 8, relationships: 12, detail: "Call detail records — Bangalore region, 14-day window.", date: "2024-01-15" },
  { id: "ing-2", filename: "FIR-101_Narcotics.pdf", type: "fir", status: "verified", records: 3, entities: 4, relationships: 6, detail: "First Information Report — narcotics seizure at warehouse.", date: "2024-01-12" },
  { id: "ing-3", filename: "Bank_Transactions_SureshReddy.json", type: "financial", status: "verified", records: 89, entities: 3, relationships: 8, detail: "Bank statements — Account 9123...780.", date: "2024-01-17" },
  { id: "ing-4", filename: "ANPR_KA_Region.csv", type: "vehicle", status: "ingested", records: 342, entities: 5, relationships: 4, detail: "ANPR captures — Karnataka region.", date: "2024-01-22" },
];

export async function POST() {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const results: Record<string, string> = {};

  const entRes = await supabaseAdmin.from("entities").upsert(ENTITIES, { onConflict: "id" });
  results.entities = entRes.error ? `error: ${entRes.error.message}` : `${ENTITIES.length} upserted`;

  await supabaseAdmin.from("relationships").delete().neq("id", "");
  const rels = RELATIONSHIPS_DATA.map(r => ({ id: randomUUID(), ...r }));
  const relRes = await supabaseAdmin.from("relationships").insert(rels);
  results.relationships = relRes.error ? `error: ${relRes.error.message}` : `${rels.length} inserted`;

  const riskRes = await supabaseAdmin.from("risk_analysis").upsert(RISK_ANALYSIS, { onConflict: "id" });
  results.risk_analysis = riskRes.error ? `error: ${riskRes.error.message}` : `${RISK_ANALYSIS.length} upserted`;

  const patRes = await supabaseAdmin.from("patterns").upsert(PATTERNS, { onConflict: "id" });
  results.patterns = patRes.error ? `error: ${patRes.error.message}` : `${PATTERNS.length} upserted`;

  const anomRes = await supabaseAdmin.from("anomalies").upsert(ANOMALIES, { onConflict: "id" });
  results.anomalies = anomRes.error ? `error: ${anomRes.error.message}` : `${ANOMALIES.length} upserted`;

  const leadRes = await supabaseAdmin.from("leads").upsert(LEADS, { onConflict: "id" });
  results.leads = leadRes.error ? `error: ${leadRes.error.message}` : `${LEADS.length} upserted`;

  const ingRes = await supabaseAdmin.from("ingestions").upsert(INGESTIONS, { onConflict: "id" });
  results.ingestions = ingRes.error ? `error: ${ingRes.error.message}` : `${INGESTIONS.length} upserted`;

  const hasErrors = Object.values(results).some((v) => v.startsWith("error"));

  return NextResponse.json(
    { message: hasErrors ? "Seeded with some errors" : "Database seeded successfully", results },
    { status: hasErrors ? 207 : 200 }
  );
}
