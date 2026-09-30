-- ============================================================
-- CaseFlow — Supabase Database Schema
-- Paste this into Supabase SQL Editor and run
-- ============================================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. USERS & AUTH
-- ============================================================

create table public.users (
  id uuid primary key default uuid_generate_v4(),
  username text unique not null,
  full_name text,
  role text not null default 'officer' check (role in ('officer', 'analyst', 'admin')),
  email text unique,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 2. CASES (FIRs / investigations)
-- ============================================================

create table public.cases (
  id text primary key,                          -- e.g. 'FIR-101'
  name text not null,                           -- e.g. 'FIR-101 Narcotics'
  description text,
  status text not null default 'active' check (status in ('active', 'closed', 'archived')),
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 3. ENTITIES (persons, phones, vehicles, accounts, locations)
-- ============================================================

create type entity_type as enum ('Person', 'Phone', 'Case', 'Vehicle', 'Account', 'Location');

create table public.entities (
  id text primary key,                          -- e.g. 'UENT-0001'
  label entity_type not null,
  name text not null,
  metadata jsonb default '{}',                  -- flexible: phone number, plate, address, etc.
  created_at timestamptz not null default now()
);

-- ============================================================
-- 4. RELATIONSHIPS (edges between entities)
-- ============================================================

create table public.relationships (
  id uuid primary key default uuid_generate_v4(),
  source_id text not null references public.entities(id) on delete cascade,
  target_id text not null references public.entities(id) on delete cascade,
  type text not null,                           -- e.g. 'CALLED', 'TRANSFERRED', 'OWNS'
  confidence numeric(4,3) not null default 1.0 check (confidence >= 0 and confidence <= 1),
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);

create index idx_rel_source on public.relationships(source_id);
create index idx_rel_target on public.relationships(target_id);

-- ============================================================
-- 5. ENTITY ↔ CASE junction
-- ============================================================

create table public.entity_cases (
  entity_id text not null references public.entities(id) on delete cascade,
  case_id text not null references public.cases(id) on delete cascade,
  role text,                                    -- e.g. 'accused', 'witness', 'suspect'
  primary key (entity_id, case_id)
);

-- ============================================================
-- 6. DATA INGESTIONS (file upload history)
-- ============================================================

create type ingestion_type as enum ('cdr', 'financial', 'fir', 'vehicle', 'osint');
create type ingestion_status as enum ('ingested', 'verified', 'rejected');

create table public.ingestions (
  id text primary key,
  filename text not null,
  type ingestion_type not null,
  status ingestion_status not null default 'ingested',
  records int not null default 0,
  entities int not null default 0,
  relationships int not null default 0,
  detail text,
  file_url text,                                -- Supabase Storage path
  uploaded_by uuid references public.users(id),
  verified_by text,
  date timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ============================================================
-- 7. LEADS (AI-generated investigative leads)
-- ============================================================

create type risk_level as enum ('critical', 'high', 'medium', 'low');
create type lead_status as enum ('pending', 'verified', 'rejected');

create table public.leads (
  id text primary key,
  entity_id text not null references public.entities(id) on delete cascade,
  entity_name text not null,
  score numeric(4,3) not null check (score >= 0 and score <= 1),
  risk_level risk_level not null,
  status lead_status not null default 'pending',
  cross_case boolean not null default false,
  reason text not null,
  recommended_action text,
  ai_reasoning text,
  confidence_breakdown jsonb default '{}',       -- { network, cross_case, evidence, temporal, anomaly }
  verified_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_leads_entity on public.leads(entity_id);
create index idx_leads_risk on public.leads(risk_level);

-- ============================================================
-- 8. EVIDENCE (linked to leads)
-- ============================================================

create type evidence_type as enum ('cdr', 'financial', 'witness', 'vehicle', 'document', 'osint');

create table public.evidence (
  id uuid primary key default uuid_generate_v4(),
  lead_id text not null references public.leads(id) on delete cascade,
  type evidence_type not null,
  source text not null,
  detail text not null,
  date text,
  confidence numeric(4,3) not null default 1.0 check (confidence >= 0 and confidence <= 1),
  created_at timestamptz not null default now()
);

create index idx_evidence_lead on public.evidence(lead_id);

-- ============================================================
-- 9. LEAD CONNECTIONS (entities connected to a lead)
-- ============================================================

create table public.lead_connections (
  id uuid primary key default uuid_generate_v4(),
  lead_id text not null references public.leads(id) on delete cascade,
  entity_id text not null,
  entity_name text not null,
  entity_type text not null,
  relationship text not null
);

-- ============================================================
-- 10. LEAD LINKED CASES
-- ============================================================

create table public.lead_cases (
  id uuid primary key default uuid_generate_v4(),
  lead_id text not null references public.leads(id) on delete cascade,
  case_id text not null references public.cases(id) on delete cascade,
  relevance text
);

-- ============================================================
-- 11. LEAD TIMELINE EVENTS
-- ============================================================

create table public.lead_timeline (
  id uuid primary key default uuid_generate_v4(),
  lead_id text not null references public.leads(id) on delete cascade,
  date text not null,
  event text not null,
  sort_order int not null default 0
);

-- ============================================================
-- 12. RISK ANALYSIS (per-entity risk scores)
-- ============================================================

create table public.risk_analysis (
  entity_id text primary key references public.entities(id) on delete cascade,
  entity_name text not null,
  risk_level risk_level not null,
  score numeric(4,3) not null check (score >= 0 and score <= 1),
  factors text[] not null default '{}',
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 13. PATTERN DETECTIONS
-- ============================================================

create type pattern_type as enum ('structuring', 'timing', 'geographic', 'communication', 'financial');
create type severity_level as enum ('critical', 'high', 'medium');

create table public.patterns (
  id text primary key,
  type pattern_type not null,
  title text not null,
  description text not null,
  severity severity_level not null,
  entities_involved text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- ============================================================
-- 14. ANOMALY DETECTIONS
-- ============================================================

create table public.anomalies (
  id text primary key,
  entity_id text not null references public.entities(id) on delete cascade,
  entity_name text not null,
  anomaly text not null,
  deviation numeric(5,2) not null,
  explanation text not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 15. AGENT CONVERSATIONS (AI chat history)
-- ============================================================

create table public.agent_conversations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id),
  messages jsonb not null default '[]',          -- array of { role, content, timestamp }
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- ROW-LEVEL SECURITY
-- ============================================================

alter table public.users enable row level security;
alter table public.cases enable row level security;
alter table public.entities enable row level security;
alter table public.relationships enable row level security;
alter table public.entity_cases enable row level security;
alter table public.ingestions enable row level security;
alter table public.leads enable row level security;
alter table public.evidence enable row level security;
alter table public.lead_connections enable row level security;
alter table public.lead_cases enable row level security;
alter table public.lead_timeline enable row level security;
alter table public.risk_analysis enable row level security;
alter table public.patterns enable row level security;
alter table public.anomalies enable row level security;
alter table public.agent_conversations enable row level security;

-- Allow authenticated users to read all data
create policy "Authenticated users can read all data" on public.users for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read cases" on public.cases for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read entities" on public.entities for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read relationships" on public.relationships for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read entity_cases" on public.entity_cases for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read ingestions" on public.ingestions for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read leads" on public.leads for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read evidence" on public.evidence for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read lead_connections" on public.lead_connections for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read lead_cases" on public.lead_cases for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read lead_timeline" on public.lead_timeline for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read risk_analysis" on public.risk_analysis for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read patterns" on public.patterns for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read anomalies" on public.anomalies for select using (auth.role() = 'authenticated');
create policy "Users can read own conversations" on public.agent_conversations for select using (auth.uid() = user_id);

-- Allow authenticated users to insert/update
create policy "Authenticated users can insert ingestions" on public.ingestions for insert with check (auth.role() = 'authenticated');
create policy "Authenticated users can update leads" on public.leads for update using (auth.role() = 'authenticated');
create policy "Users can manage own conversations" on public.agent_conversations for all using (auth.uid() = user_id);

-- ============================================================
-- STORAGE BUCKET for uploaded files
-- ============================================================

insert into storage.buckets (id, name, public)
values ('case-files', 'case-files', false)
on conflict (id) do nothing;

create policy "Authenticated users can upload files"
  on storage.objects for insert
  with check (bucket_id = 'case-files' and auth.role() = 'authenticated');

create policy "Authenticated users can read files"
  on storage.objects for select
  using (bucket_id = 'case-files' and auth.role() = 'authenticated');

-- ============================================================
-- HELPER VIEWS
-- ============================================================

create or replace view public.case_stats as
select
  (select count(*) from public.cases where status = 'active') as cases,
  (select count(*) from public.entities) as entities,
  (select count(*) from public.relationships) as relationships,
  (select count(*) from public.ingestions) as files,
  (select coalesce(sum(records), 0) from public.ingestions) as records;

create or replace view public.leads_enriched as
select
  l.*,
  coalesce(
    (select json_agg(json_build_object('type', e.type, 'source', e.source, 'detail', e.detail, 'date', e.date, 'confidence', e.confidence))
     from public.evidence e where e.lead_id = l.id),
    '[]'::json
  ) as evidence_items,
  coalesce(
    (select json_agg(json_build_object('id', lc.entity_id, 'name', lc.entity_name, 'type', lc.entity_type, 'relationship', lc.relationship))
     from public.lead_connections lc where lc.lead_id = l.id),
    '[]'::json
  ) as connected_entities,
  coalesce(
    (select json_agg(json_build_object('id', lk.case_id, 'name', c.name, 'relevance', lk.relevance))
     from public.lead_cases lk join public.cases c on c.id = lk.case_id where lk.lead_id = l.id),
    '[]'::json
  ) as linked_cases,
  coalesce(
    (select json_agg(json_build_object('date', lt.date, 'event', lt.event) order by lt.sort_order)
     from public.lead_timeline lt where lt.lead_id = l.id),
    '[]'::json
  ) as timeline
from public.leads l;
