-- CaseFlow Database Schema
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)

-- 1. ENTITIES
CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL DEFAULT 'Person',
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. RELATIONSHIPS
CREATE TABLE IF NOT EXISTS relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'LINKED_TO',
  confidence NUMERIC DEFAULT 0.8,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RISK ANALYSIS
CREATE TABLE IF NOT EXISTS risk_analysis (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  risk_level TEXT NOT NULL DEFAULT 'low',
  score NUMERIC NOT NULL DEFAULT 0,
  factors TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. PATTERNS
CREATE TABLE IF NOT EXISTS patterns (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT DEFAULT 'medium',
  entities_involved TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ANOMALIES
CREATE TABLE IF NOT EXISTS anomalies (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  anomaly TEXT NOT NULL,
  deviation NUMERIC DEFAULT 0,
  explanation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. LEADS
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  score NUMERIC NOT NULL DEFAULT 0,
  reason TEXT,
  recommended_action TEXT,
  status TEXT DEFAULT 'pending',
  risk_level TEXT DEFAULT 'medium',
  cross_case BOOLEAN DEFAULT FALSE,
  ai_reasoning TEXT,
  confidence_breakdown JSONB DEFAULT '{}',
  evidence JSONB DEFAULT '[]',
  connected_entities JSONB DEFAULT '[]',
  linked_cases JSONB DEFAULT '[]',
  timeline JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. INGESTIONS
CREATE TABLE IF NOT EXISTS ingestions (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  type TEXT DEFAULT 'cdr',
  status TEXT DEFAULT 'ingested',
  records INTEGER DEFAULT 0,
  entities INTEGER DEFAULT 0,
  relationships INTEGER DEFAULT 0,
  detail TEXT,
  date TIMESTAMPTZ DEFAULT NOW(),
  verified_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. CASE STATS VIEW
CREATE OR REPLACE VIEW case_stats AS
SELECT
  (SELECT COUNT(*) FROM entities)::INTEGER AS entities,
  (SELECT COUNT(*) FROM relationships)::INTEGER AS relationships,
  (SELECT COUNT(DISTINCT id) FROM entities WHERE label = 'Case')::INTEGER AS cases,
  (SELECT COUNT(*) FROM ingestions)::INTEGER AS files,
  (SELECT COALESCE(SUM(records), 0) FROM ingestions)::INTEGER AS records;

-- 9. LEADS ENRICHED VIEW
CREATE OR REPLACE VIEW leads_enriched AS
SELECT
  l.*,
  l.evidence AS evidence_items
FROM leads l;

-- 10. ROW LEVEL SECURITY (allow all for service role, anon can read)
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingestions ENABLE ROW LEVEL SECURITY;

-- Allow anon to read all tables
DROP POLICY IF EXISTS "anon_read_entities" ON entities;
CREATE POLICY "anon_read_entities" ON entities FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "anon_read_relationships" ON relationships;
CREATE POLICY "anon_read_relationships" ON relationships FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "anon_read_risk_analysis" ON risk_analysis;
CREATE POLICY "anon_read_risk_analysis" ON risk_analysis FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "anon_read_patterns" ON patterns;
CREATE POLICY "anon_read_patterns" ON patterns FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "anon_read_anomalies" ON anomalies;
CREATE POLICY "anon_read_anomalies" ON anomalies FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "anon_read_leads" ON leads;
CREATE POLICY "anon_read_leads" ON leads FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "anon_read_ingestions" ON ingestions;
CREATE POLICY "anon_read_ingestions" ON ingestions FOR SELECT TO anon USING (true);

-- Allow service_role full access (implicit, but explicit for clarity)
DROP POLICY IF EXISTS "service_all_entities" ON entities;
CREATE POLICY "service_all_entities" ON entities FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "service_all_relationships" ON relationships;
CREATE POLICY "service_all_relationships" ON relationships FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "service_all_risk_analysis" ON risk_analysis;
CREATE POLICY "service_all_risk_analysis" ON risk_analysis FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "service_all_patterns" ON patterns;
CREATE POLICY "service_all_patterns" ON patterns FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "service_all_anomalies" ON anomalies;
CREATE POLICY "service_all_anomalies" ON anomalies FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "service_all_leads" ON leads;
CREATE POLICY "service_all_leads" ON leads FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "service_all_ingestions" ON ingestions;
CREATE POLICY "service_all_ingestions" ON ingestions FOR ALL TO service_role USING (true) WITH CHECK (true);
