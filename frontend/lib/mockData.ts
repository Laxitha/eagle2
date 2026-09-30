import type { GraphEdge, GraphNode, Lead, PriorityEntity } from "./api";

// Mirrors data/ground_truth.md's hidden connector chain, for demo mode /
// local dev before the backend + Neo4j graph is populated.
export const mockNodes: GraphNode[] = [
  { id: "UENT-0001", label: "Person", name: "Ravi Kumar" },
  { id: "UENT-0002", label: "Person", name: "Suresh Reddy" },
  { id: "UENT-0003", label: "Person", name: "Arun Nair" },
  { id: "UENT-0004", label: "Person", name: "Farooq Ahmed" },
  { id: "UENT-0005", label: "Person", name: "Rajesh Gupta" },
  { id: "UENT-0006", label: "Person", name: "Deepa Krishnan" },
  { id: "FIR-101", label: "Case", name: "FIR-101 Narcotics" },
  { id: "FIR-104", label: "Case", name: "FIR-104 Financial Fraud" },
  { id: "FIR-109", label: "Case", name: "FIR-109 Smuggling" },
  { id: "ACC-SURESH", label: "Account", name: "9123...780" },
  { id: "ACC-ARUN", label: "Account", name: "9988...655" },
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

export const mockStats = { entities: 20, relationships: 34, cases: 12 };
