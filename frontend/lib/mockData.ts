import type { CaseLead, CaseStats, GraphEdge, GraphNode, Lead, PriorityEntity } from "./api";

export const mockNodes: GraphNode[] = [
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

export const mockEdges: GraphEdge[] = [
  { source: "UENT-0001", target: "UENT-0002", type: "CALLED", confidence: 0.95 },
  { source: "UENT-0002", target: "UENT-0003", type: "TRANSFERRED", confidence: 0.9 },
  { source: "UENT-0001", target: "FIR-101", type: "LINKED_TO", confidence: 1.0 },
  { source: "UENT-0002", target: "FIR-104", type: "LINKED_TO", confidence: 1.0 },
  { source: "UENT-0003", target: "FIR-109", type: "LINKED_TO", confidence: 1.0 },
  { source: "UENT-0001", target: "UENT-0004", type: "CONTACTED", confidence: 0.8 },
  { source: "UENT-0002", target: "UENT-0005", type: "CONTACTED", confidence: 0.7 },
  { source: "UENT-0003", target: "UENT-0006", type: "VISITED", confidence: 0.75 },
  { source: "UENT-0002", target: "ACC-SURESH", type: "OWNED", confidence: 1.0 },
  { source: "UENT-0003", target: "ACC-ARUN", type: "OWNED", confidence: 1.0 },
  { source: "ACC-SURESH", target: "ACC-ARUN", type: "TRANSFERRED", confidence: 0.9 },
  { source: "UENT-0001", target: "PH-001", type: "OWNS", confidence: 1.0 },
  { source: "UENT-0002", target: "PH-002", type: "OWNS", confidence: 1.0 },
  { source: "UENT-0003", target: "PH-003", type: "OWNS", confidence: 1.0 },
  { source: "UENT-0004", target: "FIR-101", type: "LINKED_TO", confidence: 0.85 },
  { source: "UENT-0005", target: "FIR-104", type: "LINKED_TO", confidence: 0.8 },
  { source: "UENT-0001", target: "VEH-001", type: "OWNED", confidence: 0.9 },
  { source: "UENT-0001", target: "LOC-001", type: "VISITED", confidence: 0.85 },
  { source: "UENT-0003", target: "LOC-002", type: "VISITED", confidence: 0.8 },
  { source: "UENT-0004", target: "UENT-0006", type: "MET", confidence: 0.65 },
];

export const mockPriority: PriorityEntity[] = [
  { entity_id: "UENT-0002", score: 0.87, breakdown: { network: 0.9, cross_case: 0.66, evidence: 0.9, temporal: 0.8, diversity: 0.75, anomaly: 0.6 } },
  { entity_id: "UENT-0001", score: 0.79, breakdown: { network: 0.8, cross_case: 0.66, evidence: 0.9, temporal: 0.7, diversity: 0.5, anomaly: 0.4 } },
  { entity_id: "UENT-0003", score: 0.74, breakdown: { network: 0.7, cross_case: 0.66, evidence: 0.9, temporal: 0.6, diversity: 0.5, anomaly: 0.3 } },
];

export const mockLeads: Lead[] = [
  { id: "lead-1", entity_id: "UENT-0002", score: 0.87, reason: "Bridges narcotics case FIR-101 and smuggling case FIR-109 via calls and transfers.", recommended_action: "Cross-reference open cases — this entity appears in multiple investigations.", status: "pending" },
  { id: "lead-2", entity_id: "UENT-0001", score: 0.79, reason: "Repeated high-duration calls to a financial-fraud suspect.", recommended_action: "Investigate immediate contacts — this entity is a network hub.", status: "pending" },
];

export const mockCaseLeads: CaseLead[] = [
  {
    id: "lead-1", entity_id: "UENT-0002", entity_name: "Suresh Reddy",
    score: 0.87, reason: "Bridges narcotics case FIR-101 and financial fraud case FIR-104 via phone calls and bank transfers. Central node connecting 3 separate investigations.",
    recommended_action: "Cross-reference open cases — this entity appears in multiple investigations. Prioritize CDR analysis for the last 90 days.",
    status: "pending", cross_case: true,
  },
  {
    id: "lead-2", entity_id: "UENT-0001", entity_name: "Ravi Kumar",
    score: 0.79, reason: "Repeated high-duration calls to Suresh Reddy (financial-fraud suspect). Vehicle KA-01-AB-1234 spotted near two case locations.",
    recommended_action: "Investigate immediate contacts — this entity is a network hub with connections to 4 other persons of interest.",
    status: "pending", cross_case: true,
  },
  {
    id: "lead-3", entity_id: "UENT-0003", entity_name: "Arun Nair",
    score: 0.74, reason: "Received bank transfer from Suresh Reddy's account. Linked to smuggling case FIR-109.",
    recommended_action: "Trace financial flow — bank transfer from Account 9123...780 to 9988...655 matches the timeline of smuggling activity.",
    status: "pending", cross_case: false,
  },
  {
    id: "lead-4", entity_id: "UENT-0004", entity_name: "Farooq Ahmed",
    score: 0.62, reason: "Known associate of Ravi Kumar. Met with Deepa Krishnan who appears in a separate case.",
    recommended_action: "Interview as a secondary witness — may have information about the Ravi Kumar / Deepa Krishnan connection.",
    status: "pending", cross_case: false,
  },
];

export const mockStats: CaseStats = { entities: 17, relationships: 20, cases: 3, files: 4, records: 42 };

const DEMO_RESPONSES: Record<string, { reply: string; focus?: string; neighbours?: { name: string; type: string }[]; cases?: string[] }> = {
  "who's the key connector?": {
    reply: "**Suresh Reddy** is the key connector in this network. He bridges all three cases (FIR-101, FIR-104, FIR-109) through phone calls with Ravi Kumar and bank transfers to Arun Nair. His priority score is **0.87** — the highest in the dataset.\n\nHe's the only person who connects the narcotics investigation to both the financial fraud and smuggling cases. Removing him from the graph would split the network into 3 disconnected components.",
    focus: "Suresh Reddy",
    neighbours: [
      { name: "Ravi Kumar", type: "CALLED" },
      { name: "Arun Nair", type: "TRANSFERRED" },
      { name: "Rajesh Gupta", type: "CONTACTED" },
      { name: "Account 9123...780", type: "OWNED" },
    ],
    cases: ["FIR-101 Narcotics", "FIR-104 Financial Fraud", "FIR-109 Smuggling"],
  },
  "describe the network": {
    reply: "The network contains **6 people**, **3 cases**, **2 bank accounts**, **3 phones**, **1 vehicle**, and **2 locations** connected by **20 relationships**.\n\n**Structure:** One large connected component links all three cases through Suresh Reddy (the bridge). Ravi Kumar → Suresh Reddy → Arun Nair forms the hidden connector chain across FIR-101, FIR-104, and FIR-109.\n\n**Key patterns:**\n• Financial flow: Account 9123...780 (Suresh) → Account 9988...655 (Arun) — ₹ transfer with 0.9 confidence\n• Cross-case calls: Ravi (narcotics) ↔ Suresh (fraud) — 0.95 confidence\n• Geographic overlap: Bangalore and Hyderabad locations visited by suspects from different cases",
    focus: "Network Overview",
    neighbours: [
      { name: "Suresh Reddy", type: "Hub (5 connections)" },
      { name: "Ravi Kumar", type: "Hub (6 connections)" },
      { name: "Arun Nair", type: "Bridge (4 connections)" },
    ],
    cases: ["FIR-101 Narcotics", "FIR-104 Financial Fraud", "FIR-109 Smuggling"],
  },
  "risk assessment": {
    reply: "**High Risk Entities:**\n\n1. **Suresh Reddy** (Score: 0.87) — Cross-case bridge connecting all 3 investigations. Bank account shows suspicious transfers. RISK: If not apprehended, financial trail may go cold.\n\n2. **Ravi Kumar** (Score: 0.79) — Network hub with 6 connections. Vehicle KA-01-AB-1234 spotted near case locations. RISK: High mobility, possible flight risk.\n\n3. **Arun Nair** (Score: 0.74) — Receiving end of financial transfers from Suresh Reddy. RISK: May be laundering proceeds from narcotics through smuggling network.\n\n**Anomalies detected:**\n• Farooq Ahmed ↔ Deepa Krishnan meeting (confidence 0.65) — unusually low confidence suggests an indirect or concealed relationship worth investigating.",
  },
  "how many people are there?": {
    reply: "There are **6 people** in the current dataset:\n\n1. **Ravi Kumar** — linked to FIR-101 (Narcotics), 6 connections\n2. **Suresh Reddy** — linked to FIR-104 (Financial Fraud), 5 connections\n3. **Arun Nair** — linked to FIR-109 (Smuggling), 4 connections\n4. **Farooq Ahmed** — linked to FIR-101, 2 connections\n5. **Rajesh Gupta** — linked to FIR-104, 1 connection\n6. **Deepa Krishnan** — linked to FIR-109, 2 connections\n\nTotal entities across all types: **17** (6 people, 3 phones, 3 cases, 2 accounts, 2 locations, 1 vehicle).",
  },
};

export function demoAgentChat(message: string): { reply: string; focus?: string; neighbours?: { name: string; type: string }[]; cases?: string[] } {
  const lower = message.toLowerCase().trim();
  for (const [key, val] of Object.entries(DEMO_RESPONSES)) {
    if (lower.includes(key) || key.includes(lower)) return val;
  }
  if (lower.includes("connect") || lower.includes("bridge") || lower.includes("link")) return DEMO_RESPONSES["who's the key connector?"];
  if (lower.includes("network") || lower.includes("graph") || lower.includes("overview")) return DEMO_RESPONSES["describe the network"];
  if (lower.includes("risk") || lower.includes("danger") || lower.includes("anomal")) return DEMO_RESPONSES["risk assessment"];
  if (lower.includes("how many") || lower.includes("count") || lower.includes("people") || lower.includes("person")) return DEMO_RESPONSES["how many people are there?"];
  return {
    reply: `Based on the uploaded case data, I can see **17 entities** across 3 cases. The network is centered around **Suresh Reddy**, who bridges FIR-101 (Narcotics), FIR-104 (Financial Fraud), and FIR-109 (Smuggling).\n\nTry asking me:\n• "Who's the key connector?"\n• "Describe the network"\n• "Risk assessment"\n• "How many people are there?"`,
  };
}
