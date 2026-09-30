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

export interface IngestionHistoryItem {
  id: string;
  filename: string;
  type: "cdr" | "financial" | "fir" | "vehicle" | "osint";
  status: "ingested" | "verified" | "rejected";
  records: number;
  entities: number;
  relationships: number;
  detail: string;
  date: string;
  verifiedBy?: string;
}

export const mockIngestionHistory: IngestionHistoryItem[] = [
  { id: "ing-1", filename: "CDR_Bangalore_Jan2024.csv", type: "cdr", status: "verified", records: 1247, entities: 8, relationships: 12, detail: "Call detail records — Bangalore region, 14-day window. Extracted 47 high-frequency call pairs.", date: "2024-01-15", verifiedBy: "Officer Sharma" },
  { id: "ing-2", filename: "FIR-101_Narcotics.pdf", type: "fir", status: "verified", records: 3, entities: 4, relationships: 6, detail: "First Information Report — narcotics seizure at warehouse. Named 2 accused, 2 witnesses.", date: "2024-01-12", verifiedBy: "Officer Sharma" },
  { id: "ing-3", filename: "Bank_Transactions_SureshReddy.json", type: "financial", status: "verified", records: 89, entities: 3, relationships: 8, detail: "Bank statements — Account 9123...780. Flagged 6 structured transactions below reporting threshold.", date: "2024-01-17", verifiedBy: "Officer Patel" },
  { id: "ing-4", filename: "ANPR_KA_Region.csv", type: "vehicle", status: "ingested", records: 342, entities: 5, relationships: 4, detail: "ANPR captures — Karnataka region, Jan 2024. Matched 1 vehicle to FIR-101 locations.", date: "2024-01-22" },
  { id: "ing-5", filename: "FIR-104_FinancialFraud.pdf", type: "fir", status: "verified", records: 5, entities: 3, relationships: 4, detail: "First Information Report — financial fraud. Suresh Reddy named as primary accused.", date: "2024-01-25", verifiedBy: "Officer Sharma" },
  { id: "ing-6", filename: "CDR_Hyderabad_Jan2024.csv", type: "cdr", status: "ingested", records: 856, entities: 6, relationships: 9, detail: "Call detail records — Hyderabad region. Cross-referenced with Bangalore CDR for inter-city patterns.", date: "2024-01-17" },
  { id: "ing-7", filename: "Social_Media_Scrape.json", type: "osint", status: "rejected", records: 15, entities: 2, relationships: 1, detail: "Social media check-ins — low confidence matches. Rejected: insufficient corroboration.", date: "2024-01-19" },
  { id: "ing-8", filename: "FIR-109_Smuggling.pdf", type: "fir", status: "verified", records: 4, entities: 2, relationships: 3, detail: "First Information Report — smuggling operation. Arun Nair named as sole accused.", date: "2024-02-01", verifiedBy: "Officer Patel" },
  { id: "ing-9", filename: "Witness_Statements_FIR101.pdf", type: "fir", status: "ingested", records: 7, entities: 3, relationships: 5, detail: "Witness depositions for FIR-101. 3 witnesses identify Suresh Reddy at warehouse location.", date: "2024-01-20" },
  { id: "ing-10", filename: "Bank_Transactions_ArunNair.json", type: "financial", status: "verified", records: 67, entities: 2, relationships: 3, detail: "Bank statements — Account 9988...655. Confirmed structured deposit pattern matching Suresh Reddy's transfers.", date: "2024-01-18", verifiedBy: "Officer Patel" },
];

type AgentResponse = { reply: string; focus?: string; neighbours?: { name: string; type: string }[]; cases?: string[] };

function analyzeEntity(name: string): AgentResponse | null {
  const lower = name.toLowerCase();
  const lead = mockEnrichedLeads.find(l => l.entity_name.toLowerCase().includes(lower));
  const risk = mockRiskAnalysis.find(r => r.entity_name.toLowerCase().includes(lower));
  if (!lead && !risk) return null;

  if (lead) {
    return {
      reply: `Here's my analysis of **${lead.entity_name}**:\n\n**Risk Level:** ${lead.risk_level.toUpperCase()} (Score: ${(lead.score * 100).toFixed(0)}/100)\n\n**Summary:** ${lead.reason}\n\n**AI Analysis:**\n${lead.ai_reasoning}\n\n**Evidence (${lead.evidence.length} items):**\n${lead.evidence.map(e => `- [${e.type.toUpperCase()}] ${e.detail} (${e.date}, confidence: ${(e.confidence * 100).toFixed(0)}%)`).join("\n")}\n\n**Connected to:** ${lead.connected_entities.map(c => `${c.name} (${c.relationship})`).join(", ")}\n\n**Linked Cases:** ${lead.linked_cases.map(c => `${c.name} — ${c.relevance}`).join("; ")}\n\n**Recommended Action:** ${lead.recommended_action}`,
      focus: lead.entity_name,
      neighbours: lead.connected_entities.map(c => ({ name: c.name, type: c.relationship.split(",")[0] })),
      cases: lead.linked_cases.map(c => c.name),
    };
  }

  return {
    reply: `**${risk!.entity_name}** — Risk Level: **${risk!.risk_level.toUpperCase()}** (Score: ${(risk!.score * 100).toFixed(0)}%)\n\n**Risk Factors:**\n${risk!.factors.map(f => `- ${f}`).join("\n")}\n\nThis entity has a ${risk!.risk_level} risk classification based on multi-factor analysis including network centrality, cross-case connections, evidence strength, temporal patterns, and anomaly detection.`,
    focus: risk!.entity_name,
  };
}

export function demoAgentChat(message: string): AgentResponse {
  const lower = message.toLowerCase().trim();

  // Entity-specific queries
  const entityNames = ["suresh", "ravi", "arun", "farooq", "rajesh", "deepa"];
  for (const name of entityNames) {
    if (lower.includes(name)) {
      const result = analyzeEntity(name);
      if (result) return result;
    }
  }

  // Key connector / bridge analysis
  if (lower.includes("connect") || lower.includes("bridge") || lower.includes("key") || lower.includes("central") || lower.includes("important")) {
    return {
      reply: "I've analyzed the network topology to identify the most critical nodes.\n\n**Primary Bridge Node: Suresh Reddy**\n- Betweenness centrality: 0.91 (highest in network)\n- Bridges all 3 active investigations: FIR-101, FIR-104, FIR-109\n- Removing this node splits the network into 3 disconnected components\n\n**Why this matters:** Suresh Reddy is the only entity connecting the narcotics investigation (FIR-101) to both the financial fraud (FIR-104) and smuggling (FIR-109) cases. The connection is established through:\n1. **Phone calls** — 47 calls to Ravi Kumar (FIR-101 prime accused)\n2. **Bank transfers** — ₹4.2L to Arun Nair (FIR-109 sole accused)\n3. **Direct involvement** — Named accused in FIR-104\n\n**Secondary hub: Ravi Kumar**\n- Degree centrality: 6 connections (highest)\n- PageRank: #2 in network\n- Functions as the communications hub with late-night call patterns suggesting evasion tactics\n\n**Recommendation:** Prioritize surveillance on the Suresh Reddy → Arun Nair financial channel. If this link is disrupted, the cross-case funding mechanism collapses.",
      focus: "Suresh Reddy",
      neighbours: [
        { name: "Ravi Kumar", type: "47 calls (CALLED)" },
        { name: "Arun Nair", type: "₹4.2L (TRANSFERRED)" },
        { name: "Rajesh Gupta", type: "5 calls (CONTACTED)" },
      ],
      cases: ["FIR-101 Narcotics", "FIR-104 Financial Fraud", "FIR-109 Smuggling"],
    };
  }

  // Network overview
  if (lower.includes("network") || lower.includes("graph") || lower.includes("overview") || lower.includes("describe") || lower.includes("summary") || lower.includes("tell me about") || lower.includes("what do we have")) {
    return {
      reply: "Here's a comprehensive overview of the intelligence network:\n\n**Scale:** 17 entities across 6 types — 6 persons, 3 phone numbers, 3 cases, 2 bank accounts, 2 locations, 1 vehicle — connected by 20 verified relationships.\n\n**Network Structure:**\nThe graph forms one large connected component with a clear hub-and-spoke pattern:\n- **Core triangle:** Ravi Kumar ↔ Suresh Reddy ↔ Arun Nair\n- **Periphery:** Farooq Ahmed, Rajesh Gupta, Deepa Krishnan connected via single edges\n\n**Cross-Case Intelligence:**\nThe three FIRs appeared independent at filing but graph analysis reveals they're interconnected:\n- FIR-101 (Narcotics) ↔ FIR-104 (Financial Fraud) — linked through Ravi-Suresh calls\n- FIR-104 ↔ FIR-109 (Smuggling) — linked through Suresh-Arun bank transfers\n- This suggests an organized network where narcotics proceeds are laundered through financial fraud and reinvested in smuggling\n\n**Key Patterns Detected:**\n1. Transaction structuring (₹49,500 × 6 — below reporting threshold)\n2. Late-night communication cluster (11 PM–2 AM)\n3. CDR spike 340% before each FIR filing date\n4. Multi-location convergence via ANPR data\n\n**Data Sources:** 4 files ingested (CDR, financial, FIR, ANPR) containing 42 total records.",
      focus: "Network Overview",
      neighbours: [
        { name: "Suresh Reddy", type: "Bridge (centrality: 0.91)" },
        { name: "Ravi Kumar", type: "Hub (degree: 6)" },
        { name: "Arun Nair", type: "Financial endpoint" },
      ],
      cases: ["FIR-101 Narcotics", "FIR-104 Financial Fraud", "FIR-109 Smuggling"],
    };
  }

  // Risk assessment
  if (lower.includes("risk") || lower.includes("danger") || lower.includes("threat") || lower.includes("priority") || lower.includes("urgent")) {
    return {
      reply: "**Threat Assessment — Ranked by Multi-Factor Risk Score:**\n\n**1. CRITICAL — Suresh Reddy** (91/100)\nFactors: Bridges all 3 cases, hawala-pattern transfers, 340% CDR spike before FIR dates\nImmediate risk: Financial evidence degrades over time. Bank may release frozen account without court order.\n\n**2. HIGH — Ravi Kumar** (82/100)\nFactors: Highest degree centrality (6 connections), late-night evasion patterns, vehicle at 2 case locations\nImmediate risk: High mobility — vehicle KA-01-AB-1234 detected across Karnataka. Possible flight risk.\n\n**3. HIGH — Arun Nair** (76/100)\nFactors: Structured deposits below threshold, sole smuggling suspect, financial link to fraud case\nImmediate risk: Account 9988...655 still active. Recommend freeze pending investigation.\n\n**4. MEDIUM — Farooq Ahmed** (58/100)\nFactors: Concealed relationship detected with Deepa Krishnan (0.65 confidence edge)\nNote: If confirmed, this creates a second cross-case bridge independent of Suresh Reddy.\n\n**5. MEDIUM — Deepa Krishnan** (52/100)\nFactors: Connected to suspects in 2 different cases, low-confidence meeting flagged\n\n**6. LOW — Rajesh Gupta** (35/100)\nFactors: Peripheral node, single case connection\n\n**Anomalies flagged:**\n- Farooq-Deepa meeting: 2.3σ below average edge confidence\n- Suresh's transaction clustering: 3.1σ deviation, <0.2% probability of natural occurrence",
    };
  }

  // Financial analysis
  if (lower.includes("money") || lower.includes("financ") || lower.includes("transfer") || lower.includes("bank") || lower.includes("hawala") || lower.includes("launder") || lower.includes("transaction")) {
    return {
      reply: "**Financial Flow Analysis:**\n\nI've traced the money trail through the network:\n\n**Primary Channel:**\nAccount 9123...780 (Suresh Reddy) → Account 9988...655 (Arun Nair)\n- **Amount:** ₹4,20,000 total\n- **Method:** 6 transactions of ₹49,500 each — classic structuring to stay below the ₹50,000 reporting threshold\n- **Timing:** All 6 transactions executed within a 3-hour window on Jan 17, 2024\n- **Confidence:** 92% (corroborated by CDR showing 12 simultaneous calls)\n\n**Pattern Classification:** Hawala routing\n- Probability of natural occurrence: <0.2% (3.1σ deviation)\n- Matches known money laundering typology: split-and-transfer below CTR threshold\n\n**Cross-Case Implication:**\nThe financial link between Suresh (FIR-104 Financial Fraud accused) and Arun (FIR-109 Smuggling accused) suggests narcotics proceeds from FIR-101 may be funding the smuggling operation through this channel.\n\n**Recommended Actions:**\n1. Freeze Account 9988...655 immediately\n2. Request 6-month transaction history for both accounts\n3. Check for additional structured transactions with other accounts\n4. Coordinate with financial intelligence unit for STR filing",
      focus: "Financial Flow",
      neighbours: [
        { name: "Account 9123...780", type: "Source (Suresh)" },
        { name: "Account 9988...655", type: "Destination (Arun)" },
      ],
      cases: ["FIR-104 Financial Fraud", "FIR-109 Smuggling"],
    };
  }

  // Phone / CDR analysis
  if (lower.includes("call") || lower.includes("phone") || lower.includes("cdr") || lower.includes("communication")) {
    return {
      reply: "**Communication Pattern Analysis:**\n\n**Hottest link: Ravi Kumar ↔ Suresh Reddy**\n- 47 calls over 14 days (avg 3.4 calls/day)\n- Average duration: 8.2 minutes\n- **Timing anomaly:** 78% of calls between 11 PM–2 AM\n- This late-night clustering is consistent with deliberate evasion of business-hour monitoring\n\n**Cross-city coordination: Suresh Reddy ↔ Arun Nair**\n- 12 calls on Jan 17 alone (same day as bank transfers)\n- All routed through Hyderabad cell tower (Suresh was in Hyderabad, not Bangalore)\n- Suggests coordination of financial transfers in real-time\n\n**Entity Resolution:**\nNLP analysis resolved 3 phone numbers to Ravi Kumar using phonetic matching:\n- +91 98765 43210 (primary)\n- 2 additional numbers linked via name variants (\"R. Kumar\", \"Ravi K.\")\n\n**Key Pattern:**\nCall frequency between all suspects increased **340%** in the 2 weeks before each FIR filing date — consistent with coordination in anticipation of law enforcement action.\n\n**CDR Spike Timeline:**\n- Jan 10: Spike begins (12 calls in 24h to Ravi Kumar)\n- Jan 15: Peak activity (47 calls over 14 days)\n- Jan 17: Cross-city calls + financial transfers\n- Jan 25: FIR-104 filed",
      focus: "Communication Analysis",
      neighbours: [
        { name: "+91 98765 43210", type: "Ravi Kumar's primary" },
        { name: "+91 87654 32109", type: "Suresh Reddy's primary" },
        { name: "+91 76543 21098", type: "Arun Nair's primary" },
      ],
    };
  }

  // Case-specific queries
  if (lower.includes("fir-101") || lower.includes("narcotic") || lower.includes("drug")) {
    return {
      reply: "**FIR-101 — Narcotics Investigation:**\n\n**Status:** Active investigation\n**Filed:** Jan 12, 2024\n**Location:** Warehouse, Bangalore\n\n**Accused:**\n- **Ravi Kumar** (Prime accused) — Named in FIR, vehicle spotted at warehouse\n- **Farooq Ahmed** (Known associate) — Named in witness statement\n\n**Network Connections:**\n- Ravi Kumar connects to FIR-104 through calls with Suresh Reddy\n- This makes FIR-101 the origin point of the financial trail\n\n**Evidence:**\n- CDR: 47 calls between Ravi and Suresh in case-relevant period\n- ANPR: Vehicle KA-01-AB-1234 at warehouse (Jan 18) and Suresh's residence (Jan 20)\n- Witness: 3 depositions placing Suresh at warehouse\n\n**AI Assessment:**\nThis narcotics case appears to be the operational front of a larger network. Financial proceeds likely flow through FIR-104 (fraud) and are reinvested in FIR-109 (smuggling). Investigating FIR-101 in isolation would miss 60% of the network.",
      focus: "FIR-101 Narcotics",
      cases: ["FIR-101 Narcotics"],
      neighbours: [
        { name: "Ravi Kumar", type: "Prime accused" },
        { name: "Farooq Ahmed", type: "Known associate" },
        { name: "Suresh Reddy", type: "Cross-case link" },
      ],
    };
  }

  if (lower.includes("fir-104") || lower.includes("fraud")) {
    return {
      reply: "**FIR-104 — Financial Fraud Investigation:**\n\n**Status:** Active investigation\n**Filed:** Jan 25, 2024\n\n**Accused:**\n- **Suresh Reddy** (Primary accused) — Account flagged by bank\n- **Rajesh Gupta** (Co-accused) — 5 calls from Suresh\n\n**Key Evidence:**\n- 6 structured transactions of ₹49,500 (below ₹50K threshold)\n- Total: ₹4.2L transferred to Arun Nair's account\n- All transactions within 3-hour window\n\n**Cross-Case Links:**\n- Suresh bridges this case to FIR-101 (via calls with Ravi Kumar) and FIR-109 (via transfers to Arun Nair)\n- This is the financial hub of the entire network",
      focus: "FIR-104 Financial Fraud",
      cases: ["FIR-104 Financial Fraud"],
    };
  }

  if (lower.includes("fir-109") || lower.includes("smuggl")) {
    return {
      reply: "**FIR-109 — Smuggling Investigation:**\n\n**Status:** Active investigation\n**Filed:** Feb 1, 2024\n\n**Accused:**\n- **Arun Nair** (Sole accused)\n\n**Key Evidence:**\n- Received ₹4.2L from Suresh Reddy in structured transactions\n- CDR: 12 calls from Suresh on transfer day\n- Account 9988...655 shows structured deposit pattern\n\n**Cross-Case Links:**\n- Funded by FIR-104 proceeds through Suresh Reddy\n- Indirect link to FIR-101 narcotics network\n- Deepa Krishnan visited same location as Arun Nair",
      focus: "FIR-109 Smuggling",
      cases: ["FIR-109 Smuggling"],
    };
  }

  // Pattern / anomaly questions
  if (lower.includes("pattern") || lower.includes("anomal") || lower.includes("unusual") || lower.includes("suspicious") || lower.includes("strange")) {
    return {
      reply: "**Detected Patterns & Anomalies:**\n\nI've identified 4 significant patterns and 2 statistical anomalies:\n\n**Patterns:**\n\n1. **Transaction Structuring** (CRITICAL)\n6 transactions of exactly ₹49,500 — designed to stay below the ₹50,000 CTR threshold. This is a textbook hawala routing pattern. Entities: Suresh Reddy → Arun Nair.\n\n2. **Late-Night Communication Cluster** (HIGH)\n47 calls between Ravi Kumar and Suresh Reddy, 78% between 11 PM–2 AM. This timing pattern is consistent with deliberate evasion of monitoring.\n\n3. **Multi-Location Convergence** (HIGH)\nVehicle KA-01-AB-1234 detected at FIR-101 warehouse AND suspect's residence within 48 hours. Cell tower data corroborates.\n\n4. **Pre-FIR CDR Spike** (MEDIUM)\nCall frequency increased 340% in the 2 weeks before each FIR filing date — coordination before anticipated enforcement.\n\n**Anomalies:**\n\n1. **Low-confidence cross-case edge** (2.3σ)\nFarooq Ahmed ↔ Deepa Krishnan meeting has confidence 0.65, which is 2.3 standard deviations below average. This suggests a deliberately concealed relationship.\n\n2. **Transaction amount clustering** (3.1σ)\nSuresh Reddy's 6 outbound transactions cluster within ₹500 of each other, just below the threshold. Probability of natural occurrence: <0.2%.",
    };
  }

  // Timeline questions
  if (lower.includes("timeline") || lower.includes("when") || lower.includes("chronolog") || lower.includes("sequence") || lower.includes("order")) {
    return {
      reply: "**Case Timeline — Chronological Sequence:**\n\n**Jan 10, 2024** — CDR spike begins. 12 calls from Suresh Reddy to Ravi Kumar in 24 hours.\n\n**Jan 12, 2024** — FIR-101 (Narcotics) filed. Ravi Kumar named as prime accused. Farooq Ahmed identified as known associate in witness statements.\n\n**Jan 14, 2024** — Entity resolution links 3 phone numbers to Ravi Kumar using phonetic matching on name variants.\n\n**Jan 15, 2024** — Call frequency hits peak: 47 calls between Ravi and Suresh over 14 days.\n\n**Jan 17, 2024** — Critical day. ₹4.2L transferred from Suresh to Arun in 6 structured transactions. 12 calls between them from Hyderabad tower.\n\n**Jan 18, 2024** — Vehicle KA-01-AB-1234 spotted at FIR-101 warehouse.\n\n**Jan 19, 2024** — Social media places Farooq and Deepa at same location (low confidence).\n\n**Jan 20, 2024** — Witness places Suresh at warehouse. Vehicle spotted near Suresh's residence.\n\n**Jan 22, 2024** — ANPR captures vehicle KA-01-AB-1234 near Suresh Reddy's residence.\n\n**Jan 25, 2024** — FIR-104 (Financial Fraud) filed. Suresh named as accused.\n\n**Feb 1, 2024** — FIR-109 (Smuggling) filed. Arun Nair named as sole accused.\n\n**Key insight:** The narcotics operation (FIR-101) preceded the financial transactions by 5 days, and the smuggling case (FIR-109) followed 2 weeks later. This timeline supports the hypothesis that narcotics → fraud → smuggling represents a sequential funding chain.",
    };
  }

  // Recommendations / next steps
  if (lower.includes("recommend") || lower.includes("what should") || lower.includes("next step") || lower.includes("action") || lower.includes("suggest") || lower.includes("advise")) {
    return {
      reply: "**Recommended Investigative Actions — Priority Order:**\n\n**Immediate (24-48 hours):**\n1. **Freeze Account 9988...655** (Arun Nair) — structured deposits still incoming\n2. **Pull 6-month transaction history** for both flagged accounts\n3. **Request tower dump** for Hyderabad cell tower (Jan 17) — identify other devices present during transfer coordination\n\n**Short-term (1 week):**\n4. **Surveillance on Suresh Reddy** — he's the bridge node; his communications reveal the full network\n5. **Interview Farooq Ahmed** as secondary witness — he may have intel on the Ravi-Deepa connection\n6. **Verify Farooq-Deepa meeting** — if confirmed (currently 0.65 confidence), it creates a second cross-case bridge\n\n**Medium-term (2-4 weeks):**\n7. **File STR** (Suspicious Transaction Report) with FIU for both accounts\n8. **Cross-reference ANPR data** with other case locations\n9. **Request mutual legal assistance** if any entity has inter-state accounts\n\n**Strategic:**\n10. **Consolidate all 3 FIRs** under a single investigation — treating them separately loses 60% of the network intelligence\n\n**Risk if delayed:** Financial evidence degrades fastest. Bank records beyond 6 months require court orders. Suresh Reddy's vehicle mobility suggests potential flight risk.",
    };
  }

  // Evidence questions
  if (lower.includes("evidence") || lower.includes("proof") || lower.includes("source")) {
    return {
      reply: "**Evidence Summary — By Source Type:**\n\n**CDR (Call Detail Records):** 3 datasets\n- Bangalore region: 1,247 records → 47 high-frequency call pairs identified\n- Hyderabad region: 856 records → cross-city coordination patterns\n- Key finding: 340% call spike before FIR dates\n\n**Financial Records:** 2 datasets\n- Suresh Reddy's account: 89 transactions → 6 flagged as structured\n- Arun Nair's account: 67 transactions → matching structured deposits confirmed\n- Key finding: ₹4.2L hawala-pattern transfer\n\n**FIR Documents:** 3 reports\n- FIR-101 (Narcotics): 2 accused, 2 witnesses\n- FIR-104 (Financial Fraud): Suresh Reddy primary accused\n- FIR-109 (Smuggling): Arun Nair sole accused\n\n**Vehicle/ANPR:** 342 captures\n- 1 vehicle (KA-01-AB-1234) matched to 2 case locations\n\n**Witness Statements:** 7 records\n- 3 witnesses place Suresh at FIR-101 warehouse\n\n**OSINT:** 15 records (1 rejected — insufficient corroboration)\n- Social media check-in matched Farooq-Deepa (0.65 confidence)\n\n**Total: 42 records across 4 verified files, producing 17 entities and 20 relationships.**",
    };
  }

  // Count queries
  if (lower.includes("how many") || lower.includes("count") || lower.includes("number") || lower.includes("total")) {
    return {
      reply: "**Dataset Summary:**\n\n**Entities: 17 total**\n- 6 persons (Ravi Kumar, Suresh Reddy, Arun Nair, Farooq Ahmed, Rajesh Gupta, Deepa Krishnan)\n- 3 phone numbers\n- 3 cases (FIR-101, FIR-104, FIR-109)\n- 2 bank accounts\n- 2 locations (Bangalore, Hyderabad)\n- 1 vehicle (KA-01-AB-1234)\n\n**Relationships: 20 verified edges**\n- CALLED: 3 edges\n- TRANSFERRED: 2 edges\n- LINKED_TO: 5 edges\n- OWNED/OWNS: 5 edges\n- CONTACTED: 2 edges\n- VISITED: 3 edges\n\n**Cases: 3 active FIRs**\n- All interconnected through Suresh Reddy\n\n**Data Sources: 4 files, 42 records processed**",
    };
  }

  // Default — intelligent contextual response
  return {
    reply: `I've analyzed your question against the case data. Here's what I can tell you:\n\nThe current dataset contains **17 entities** connected by **20 relationships** across **3 active investigations**. The network is centered around **Suresh Reddy** (risk score: 91/100), who bridges FIR-101 (Narcotics), FIR-104 (Financial Fraud), and FIR-109 (Smuggling).\n\nThe most significant finding is a **₹4.2L structured transfer** pattern between Suresh Reddy and Arun Nair — 6 transactions of ₹49,500 each, designed to stay below the ₹50,000 reporting threshold.\n\nI can dive deeper into any of these areas:\n- **Entity analysis** — ask about any person by name\n- **Financial flow** — trace the money trail\n- **Communication patterns** — CDR analysis and timing anomalies\n- **Risk assessment** — threat levels and recommended actions\n- **Timeline** — chronological sequence of events\n- **Evidence** — source traceability for every finding\n- **Case details** — FIR-101, FIR-104, or FIR-109 specifics\n\nWhat would you like me to analyze?`,
  };
}
