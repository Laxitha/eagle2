import axios from "axios";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = window.localStorage.getItem("eagle_token");
    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export type EntityType = "Person" | "Phone" | "Case" | "Vehicle" | "Account" | "Location";

export interface GraphNode {
  id: string;
  label: EntityType;
  name: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
  confidence: number;
}

export interface PriorityEntity {
  entity_id: string;
  score: number;
  breakdown: Record<string, number>;
}

export interface Lead {
  id: string;
  entity_id: string;
  score: number;
  reason: string;
  recommended_action: string;
  status: "pending" | "verified" | "rejected";
}

export interface CaseStats {
  entities: number;
  relationships: number;
  cases: number;
  files: number;
  records: number;
}

export interface CaseLead {
  id: string;
  entity_id: string;
  entity_name: string;
  score: number;
  reason: string;
  recommended_action: string;
  status: "pending" | "verified" | "rejected";
  cross_case?: boolean;
}

// ---- CaseFlow agent (the /agent router) ----------------------------------

export interface AgentStep {
  id: string;
  tool: string;
  intent: string;
  status: "pending" | "running" | "done" | "failed" | "skipped";
  args: Record<string, unknown>;
  result?: { ok: boolean; error?: string | null; reason_code?: string | null } | null;
}

export interface AgentApproval {
  id: string;
  run_id: string;
  tool: string;
  summary: string;
  reasons: string[];
  risk: "auto" | "ask" | "always_ask";
  confidence: number | null;
  decided: boolean | null;
}

export interface AgentEntity {
  entity_id: string;
  canonical: { name: string; phone?: string };
  variants: { name: string[] };
  record_count: number;
  sources?: string[];
  confidence: number;
}

export interface AgentRun {
  id: string;
  goal: string;
  status: "running" | "completed" | "awaiting_approval" | "failed";
  case_id: string | null;
  plan: { source: string; steps: AgentStep[] };
  summary: string;
  state: Record<string, any>;
  elapsed_seconds: number;
}

export interface AgentTraceSummary {
  events: number;
  tool_calls: number;
  failures: number;
  recovery_attempts: number;
  recoveries: number;
  approvals_requested: number;
  approvals_granted: number;
  approvals_denied: number;
}

export interface AgentRunResponse {
  run: AgentRun;
  awaiting_approval: boolean;
  approvals: AgentApproval[];
  trace_summary: AgentTraceSummary;
}

export const endpoints = {
  centrality: (id: string) => api.get(`/api/graph/centrality/${id}`),
  communityDetection: () => api.get(`/api/graph/community-detection`),
  shortestPath: (from: string, to: string) => api.get(`/api/graph/shortest-path`, { params: { from, to } }),
  pagerank: () => api.get(`/api/graph/pagerank`),
  timeline: (id: string) => api.get(`/api/timeline/${id}`),
  evidence: (relationshipId: string) => api.get(`/api/evidence/${relationshipId}`),
  priorityTop: (limit = 10) => api.get<{ entities: PriorityEntity[] }>(`/api/priority/top`, { params: { limit } }),
  priorityFor: (id: string) => api.get<PriorityEntity>(`/api/priority/${id}`),
  generateLeads: (limit = 10) => api.post<Lead[]>(`/api/leads/generate`, null, { params: { limit } }),
  verifyLead: (id: string, approved: boolean, notes = "") =>
    api.patch(`/api/leads/${id}/verify`, { approved, notes }),
  explain: (id: string) => api.post(`/api/explain/${id}`),
  nlQuery: (question: string) => api.post(`/api/query`, { question }),
  // CaseFlow agent — the plan → run → recover → approve loop.
  agentRun: (goal: string, caseId?: string) =>
    api.post<AgentRunResponse>(`/agent/run`, { goal, case_id: caseId || null }),
  agentDecide: (approvalId: string, approved: boolean, by = "officer") =>
    api.post<AgentRunResponse>(`/agent/approvals/${approvalId}`, { approved, by }),
  agentTraceText: (runId: string) =>
    api.get<{ run_id: string; text: string }>(`/agent/runs/${runId}/trace`, { params: { fmt: "text" } }),
  agentTools: () => api.get(`/agent/tools`),
  ingestCsv: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post(`/api/ingest/csv`, form, { headers: { "Content-Type": "multipart/form-data" } });
  },
  // Case-data store (the demo backend). Starts empty; upload drives everything.
  ingestFile: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post<{ file: string; parsed_records: number; parsed_relations: number; totals: CaseStats }>(
      `/api/ingest`, form, { headers: { "Content-Type": "multipart/form-data" } });
  },
  stats: () => api.get<CaseStats>(`/api/stats`),
  graph: () => api.get<{ nodes: GraphNode[]; edges: GraphEdge[] }>(`/api/graph`),
  leads: () => api.get<{ leads: CaseLead[]; total: number }>(`/api/leads`),
  verifyLead2: (id: string, approved: boolean) =>
    api.post<CaseLead>(`/api/leads/${id}/verify`, { approved }),
  resetData: () => api.post(`/api/reset`),
  agentChat: (message: string, caseId?: string) =>
    api.post<any>(`/agent/chat`, { message, case_id: caseId || null }),
  login: (username: string, password: string) => {
    const form = new URLSearchParams();
    form.append("username", username);
    form.append("password", password);
    return api.post(`/api/auth/login`, form, { headers: { "Content-Type": "application/x-www-form-urlencoded" } });
  },
};
