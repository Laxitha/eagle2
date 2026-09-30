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

export interface EvidenceItem {
  type: "cdr" | "financial" | "witness" | "vehicle" | "document" | "osint";
  source: string;
  detail: string;
  date: string;
  confidence: number;
}

export interface EnrichedLead extends CaseLead {
  risk_level: "critical" | "high" | "medium" | "low";
  evidence: EvidenceItem[];
  connected_entities: { id: string; name: string; type: string; relationship: string }[];
  linked_cases: { id: string; name: string; relevance: string }[];
  ai_reasoning: string;
  confidence_breakdown: { network: number; cross_case: number; evidence: number; temporal: number; anomaly: number };
  timeline: { date: string; event: string }[];
}

export const mockEnrichedLeads: EnrichedLead[] = [
  {
    id: "lead-1", entity_id: "UENT-0002", entity_name: "Suresh Reddy",
    score: 0.87, status: "pending", cross_case: true,
    risk_level: "critical",
    reason: "Bridges narcotics case FIR-101 and financial fraud case FIR-104 via phone calls and bank transfers. Central node connecting 3 separate investigations.",
    recommended_action: "Cross-reference open cases — this entity appears in multiple investigations. Prioritize CDR analysis for the last 90 days.",
    ai_reasoning: "Entity resolution identified Suresh Reddy as the sole bridge node connecting all three active cases. Graph analysis shows betweenness centrality of 0.91 — removing this node splits the network into 3 disconnected components. Financial flow analysis detected ₹4.2L transferred from Account 9123...780 to Account 9988...655 within 48 hours of CDR spikes between UENT-0001 and UENT-0002. Pattern matches known hawala routing: small-denomination splits across 6 transactions, all below ₹50K reporting threshold. Temporal analysis shows call frequency increased 340% in the 2 weeks preceding each FIR filing date.",
    confidence_breakdown: { network: 0.93, cross_case: 0.88, evidence: 0.91, temporal: 0.82, anomaly: 0.78 },
    evidence: [
      { type: "cdr", source: "CDR-BNG-2024-0891", detail: "47 calls to Ravi Kumar (+91 98765 43210) over 14 days, avg duration 8.2 min", date: "2024-01-15", confidence: 0.95 },
      { type: "financial", source: "FIN-TX-44291", detail: "₹4.2L transferred to Account 9988...655 (Arun Nair) in 6 split transactions", date: "2024-01-17", confidence: 0.92 },
      { type: "cdr", source: "CDR-HYD-2024-1102", detail: "12 calls to Arun Nair from Hyderabad tower, same day as bank transfers", date: "2024-01-17", confidence: 0.88 },
      { type: "witness", source: "WIT-FIR101-03", detail: "Identified by witness as frequent visitor to warehouse (FIR-101 location)", date: "2024-01-20", confidence: 0.72 },
      { type: "vehicle", source: "ANPR-KA01AB1234", detail: "Vehicle KA-01-AB-1234 (registered to Ravi Kumar) spotted near suspect's residence 3 times", date: "2024-01-22", confidence: 0.85 },
    ],
    connected_entities: [
      { id: "UENT-0001", name: "Ravi Kumar", type: "Person", relationship: "47 calls, co-accused in FIR-101" },
      { id: "UENT-0003", name: "Arun Nair", type: "Person", relationship: "Bank transfer recipient, FIR-109 suspect" },
      { id: "UENT-0005", name: "Rajesh Gupta", type: "Person", relationship: "5 calls, FIR-104 co-accused" },
      { id: "ACC-SURESH", name: "Account 9123...780", type: "Account", relationship: "Primary account, source of transfers" },
    ],
    linked_cases: [
      { id: "FIR-101", name: "FIR-101 Narcotics", relevance: "Direct — phone contact with prime suspect Ravi Kumar" },
      { id: "FIR-104", name: "FIR-104 Financial Fraud", relevance: "Direct — named accused, account flagged by bank" },
      { id: "FIR-109", name: "FIR-109 Smuggling", relevance: "Indirect — funds transferred to FIR-109 suspect Arun Nair" },
    ],
    timeline: [
      { date: "2024-01-10", event: "First CDR spike — 12 calls to Ravi Kumar in 24 hrs" },
      { date: "2024-01-15", event: "Call frequency to Ravi Kumar reaches 47 over 14 days" },
      { date: "2024-01-17", event: "₹4.2L transferred to Arun Nair's account in 6 splits" },
      { date: "2024-01-17", event: "12 calls to Arun Nair from Hyderabad cell tower" },
      { date: "2024-01-20", event: "Witness places Suresh at FIR-101 warehouse location" },
      { date: "2024-01-22", event: "Ravi Kumar's vehicle spotted near Suresh's residence" },
      { date: "2024-01-25", event: "FIR-104 filed — Suresh named as accused" },
    ],
  },
  {
    id: "lead-2", entity_id: "UENT-0001", entity_name: "Ravi Kumar",
    score: 0.79, status: "pending", cross_case: true,
    risk_level: "high",
    reason: "Network hub with 6 direct connections. Vehicle KA-01-AB-1234 spotted near two case locations. High-duration calls to financial-fraud suspect.",
    recommended_action: "Investigate immediate contacts — this entity is a network hub with connections to 4 other persons of interest.",
    ai_reasoning: "Ravi Kumar functions as the network's primary communication hub with 6 direct edges — the highest degree centrality in the graph. PageRank analysis ranks him #2. CDR analysis reveals a distinctive pattern: calls to Suresh Reddy cluster between 11 PM–2 AM, suggesting deliberate timing to avoid detection. ANPR data places vehicle KA-01-AB-1234 at both the FIR-101 warehouse and Suresh Reddy's residence within the same 48-hour window. Entity resolution linked 3 phone numbers to this individual using phonetic matching on name variants (\"R. Kumar\", \"Ravi K.\", \"Kumar Ravi\").",
    confidence_breakdown: { network: 0.85, cross_case: 0.72, evidence: 0.88, temporal: 0.74, anomaly: 0.65 },
    evidence: [
      { type: "cdr", source: "CDR-BNG-2024-0891", detail: "47 calls to Suresh Reddy, primarily between 11 PM–2 AM", date: "2024-01-15", confidence: 0.95 },
      { type: "vehicle", source: "ANPR-KA01AB1234", detail: "Vehicle at FIR-101 warehouse (Jan 18) and Suresh's residence (Jan 20)", date: "2024-01-20", confidence: 0.90 },
      { type: "document", source: "FIR-101-ACCUSED", detail: "Named as prime accused in FIR-101 (Narcotics)", date: "2024-01-12", confidence: 1.0 },
      { type: "cdr", source: "CDR-BNG-2024-0903", detail: "3 phone numbers resolved to same individual via NLP entity resolution", date: "2024-01-14", confidence: 0.82 },
    ],
    connected_entities: [
      { id: "UENT-0002", name: "Suresh Reddy", type: "Person", relationship: "47 late-night calls, financial co-suspect" },
      { id: "UENT-0004", name: "Farooq Ahmed", type: "Person", relationship: "Known associate, 8 calls" },
      { id: "PH-001", name: "+91 98765 43210", type: "Phone", relationship: "Primary phone" },
      { id: "VEH-001", name: "KA-01-AB-1234", type: "Vehicle", relationship: "Registered owner" },
    ],
    linked_cases: [
      { id: "FIR-101", name: "FIR-101 Narcotics", relevance: "Direct — prime accused" },
      { id: "FIR-104", name: "FIR-104 Financial Fraud", relevance: "Indirect — connected to accused Suresh Reddy via calls" },
    ],
    timeline: [
      { date: "2024-01-12", event: "Named as prime accused in FIR-101" },
      { date: "2024-01-14", event: "Entity resolution links 3 phone numbers to this individual" },
      { date: "2024-01-15", event: "CDR analysis flags 47 calls to Suresh Reddy" },
      { date: "2024-01-18", event: "Vehicle spotted at FIR-101 warehouse" },
      { date: "2024-01-20", event: "Vehicle spotted near Suresh Reddy's residence" },
    ],
  },
  {
    id: "lead-3", entity_id: "UENT-0003", entity_name: "Arun Nair",
    score: 0.74, status: "pending", cross_case: false,
    risk_level: "high",
    reason: "Received ₹4.2L from Suresh Reddy's account in split transactions below reporting threshold. Linked to smuggling case FIR-109.",
    recommended_action: "Trace financial flow — bank transfer pattern matches known hawala routing. Freeze Account 9988...655 pending investigation.",
    ai_reasoning: "Financial pattern analysis flagged Account 9988...655 as a potential money laundering endpoint. The ₹4.2L was received in exactly 6 transactions of ₹49,500 each — a structuring pattern designed to stay below the ₹50,000 reporting threshold. The transfers originated from Suresh Reddy's account within 3 hours, and CDR data shows 12 calls between the two on the same day. Arun Nair is the sole suspect in FIR-109 (Smuggling) and this financial link to FIR-104 (Financial Fraud) via Suresh Reddy suggests the smuggling operation may be funded through the fraud proceeds.",
    confidence_breakdown: { network: 0.68, cross_case: 0.71, evidence: 0.89, temporal: 0.64, anomaly: 0.72 },
    evidence: [
      { type: "financial", source: "FIN-TX-44291", detail: "Received ₹4.2L in 6 transactions of ₹49,500 each (structuring pattern)", date: "2024-01-17", confidence: 0.94 },
      { type: "cdr", source: "CDR-HYD-2024-1102", detail: "12 calls from Suresh Reddy on same day as transfers", date: "2024-01-17", confidence: 0.88 },
      { type: "document", source: "FIR-109-ACCUSED", detail: "Sole accused in FIR-109 (Smuggling)", date: "2024-02-01", confidence: 1.0 },
    ],
    connected_entities: [
      { id: "UENT-0002", name: "Suresh Reddy", type: "Person", relationship: "Fund source, 12 calls" },
      { id: "ACC-ARUN", name: "Account 9988...655", type: "Account", relationship: "Primary account, received structured transfers" },
      { id: "UENT-0006", name: "Deepa Krishnan", type: "Person", relationship: "Visited same location" },
    ],
    linked_cases: [
      { id: "FIR-109", name: "FIR-109 Smuggling", relevance: "Direct — sole accused" },
      { id: "FIR-104", name: "FIR-104 Financial Fraud", relevance: "Indirect — received funds from FIR-104 accused" },
    ],
    timeline: [
      { date: "2024-01-17", event: "₹4.2L received from Suresh Reddy in 6 split transactions" },
      { date: "2024-01-17", event: "12 calls from Suresh Reddy (Hyderabad tower)" },
      { date: "2024-02-01", event: "FIR-109 filed — named as sole accused" },
    ],
  },
  {
    id: "lead-4", entity_id: "UENT-0004", entity_name: "Farooq Ahmed",
    score: 0.62, status: "pending", cross_case: false,
    risk_level: "medium",
    reason: "Known associate of Ravi Kumar. Met with Deepa Krishnan who appears in a separate case. Low-confidence meeting suggests concealed relationship.",
    recommended_action: "Interview as a secondary witness — may have information about the Ravi Kumar / Deepa Krishnan connection.",
    ai_reasoning: "Farooq Ahmed appears as a peripheral node with only 2 direct connections, but anomaly detection flagged the edge to Deepa Krishnan (confidence 0.65) as unusually low — suggesting an indirect or deliberately concealed relationship. Deepa Krishnan is linked to FIR-109 through Arun Nair, while Farooq is linked to FIR-101 through Ravi Kumar. If this MET relationship is confirmed, it would create a second cross-case bridge independent of Suresh Reddy, potentially indicating a wider organized network.",
    confidence_breakdown: { network: 0.52, cross_case: 0.48, evidence: 0.55, temporal: 0.45, anomaly: 0.82 },
    evidence: [
      { type: "cdr", source: "CDR-BNG-2024-0912", detail: "8 calls to Ravi Kumar over 30 days", date: "2024-01-25", confidence: 0.80 },
      { type: "osint", source: "SOCINT-FB-0042", detail: "Social media check-in at same location as Deepa Krishnan (confidence: 0.65)", date: "2024-01-19", confidence: 0.65 },
      { type: "document", source: "FIR-101-WITNESS", detail: "Named as known associate in FIR-101 witness statement", date: "2024-01-12", confidence: 0.78 },
    ],
    connected_entities: [
      { id: "UENT-0001", name: "Ravi Kumar", type: "Person", relationship: "8 calls, known associate" },
      { id: "UENT-0006", name: "Deepa Krishnan", type: "Person", relationship: "Possible meeting (low confidence)" },
    ],
    linked_cases: [
      { id: "FIR-101", name: "FIR-101 Narcotics", relevance: "Indirect — associate of prime accused Ravi Kumar" },
    ],
    timeline: [
      { date: "2024-01-12", event: "Named as known associate in FIR-101 witness statement" },
      { date: "2024-01-19", event: "Possible meeting with Deepa Krishnan (social media)" },
      { date: "2024-01-25", event: "8 calls to Ravi Kumar flagged by CDR analysis" },
    ],
  },
];

export const mockCaseLeads: CaseLead[] = mockEnrichedLeads.map(({ id, entity_id, entity_name, score, reason, recommended_action, status, cross_case }) => ({
  id, entity_id, entity_name, score, reason, recommended_action, status, cross_case,
}));

export const mockStats: CaseStats = { entities: 17, relationships: 20, cases: 3, files: 4, records: 42 };

export interface RiskAnalysis {
  entity_id: string;
  entity_name: string;
  risk_level: "critical" | "high" | "medium" | "low";
  score: number;
  factors: string[];
}

export interface PatternDetection {
  id: string;
  type: "structuring" | "timing" | "geographic" | "communication" | "financial";
  title: string;
  description: string;
  severity: "critical" | "high" | "medium";
  entities_involved: string[];
}

export interface AnomalyDetection {
  id: string;
  entity_id: string;
  entity_name: string;
  anomaly: string;
  deviation: number;
  explanation: string;
}

export const mockRiskAnalysis: RiskAnalysis[] = [
  { entity_id: "UENT-0002", entity_name: "Suresh Reddy", risk_level: "critical", score: 0.91, factors: ["Bridges all 3 cases", "Hawala-pattern transfers", "340% call spike before FIR dates"] },
  { entity_id: "UENT-0001", entity_name: "Ravi Kumar", risk_level: "high", score: 0.82, factors: ["Highest degree centrality", "Late-night call pattern", "Vehicle at 2 case locations"] },
  { entity_id: "UENT-0003", entity_name: "Arun Nair", risk_level: "high", score: 0.76, factors: ["Structured deposits below threshold", "Sole smuggling suspect", "Financial link to fraud case"] },
  { entity_id: "UENT-0004", entity_name: "Farooq Ahmed", risk_level: "medium", score: 0.58, factors: ["Concealed relationship detected", "Cross-case link potential"] },
  { entity_id: "UENT-0006", entity_name: "Deepa Krishnan", risk_level: "medium", score: 0.52, factors: ["Connected to 2 suspects in different cases", "Low-confidence meeting flagged"] },
  { entity_id: "UENT-0005", entity_name: "Rajesh Gupta", risk_level: "low", score: 0.35, factors: ["Peripheral node", "Single case connection"] },
];

export const mockPatterns: PatternDetection[] = [
  { id: "pat-1", type: "structuring", title: "Transaction Structuring", description: "6 transactions of exactly ₹49,500 — designed to stay below ₹50,000 reporting threshold. Classic hawala routing pattern.", severity: "critical", entities_involved: ["UENT-0002", "UENT-0003"] },
  { id: "pat-2", type: "timing", title: "Late-Night Communication Cluster", description: "47 calls between Ravi Kumar and Suresh Reddy clustered between 11 PM–2 AM over 14 days. Timing suggests deliberate evasion of normal business-hour monitoring.", severity: "high", entities_involved: ["UENT-0001", "UENT-0002"] },
  { id: "pat-3", type: "geographic", title: "Multi-Location Convergence", description: "Vehicle KA-01-AB-1234 detected at FIR-101 warehouse and suspect residence within 48 hours. Cell tower data confirms same-day presence at both locations.", severity: "high", entities_involved: ["UENT-0001", "UENT-0002"] },
  { id: "pat-4", type: "communication", title: "CDR Spike Before FIR Filing", description: "Call frequency between suspects increased 340% in the 2 weeks before each FIR filing date — consistent with coordination before anticipated law enforcement action.", severity: "medium", entities_involved: ["UENT-0001", "UENT-0002", "UENT-0003"] },
];

export const mockAnomalies: AnomalyDetection[] = [
  { id: "UENT-0004", entity_id: "UENT-0004", entity_name: "Farooq Ahmed", anomaly: "Low-confidence cross-case edge", deviation: 2.3, explanation: "The MET relationship with Deepa Krishnan (conf: 0.65) is 2.3 standard deviations below the average edge confidence in this network. This could indicate a deliberately concealed connection." },
  { id: "UENT-0002", entity_id: "UENT-0002", entity_name: "Suresh Reddy", anomaly: "Transaction amount clustering", deviation: 3.1, explanation: "All 6 outbound transactions are within ₹500 of each other and cluster just below the reporting threshold. Probability of this pattern occurring naturally is < 0.2%." },
];

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
