-- =========================================================================
-- COMPLETE SUPABASE SCHEMA & FUNCTIONS FOR CLAY CAMPAIGN PLANNER
-- Copy and run this script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/yadpkqnidlsewxwmponv/sql/new
-- =========================================================================

-- 1. Enable pgvector extension for 384-dimensional semantic embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Runs Table (Orchestration & Workflow State Machine)
CREATE TABLE IF NOT EXISTS runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID DEFAULT auth.uid(),
    company_url TEXT NOT NULL,
    stage TEXT NOT NULL DEFAULT 'INIT',
    status TEXT NOT NULL DEFAULT 'pending',
    revision_id INT NOT NULL DEFAULT 1,
    selected_campaign_id UUID,
    selected_question_id UUID,
    selected_model TEXT DEFAULT 'llama-3.3-70b-versatile',
    current_checkpoint_id UUID,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_runs_user_id ON runs(user_id);
CREATE INDEX IF NOT EXISTS idx_runs_stage ON runs(stage);

-- 3. Company Source Snapshots & Scraped Provenance
CREATE TABLE IF NOT EXISTS company_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    user_id UUID DEFAULT auth.uid(),
    domain TEXT NOT NULL,
    name TEXT NOT NULL,
    industry TEXT,
    summary TEXT,
    icp_summary TEXT,
    value_proposition TEXT,
    tech_stack TEXT[] DEFAULT '{}',
    source_links JSONB DEFAULT '[]'::jsonb,
    scraped_excerpt TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_company_snapshots_run_id ON company_snapshots(run_id);

-- 4. Proposed Outbound Campaigns & Selection (Approval Point 1)
CREATE TABLE IF NOT EXISTS campaign_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    user_id UUID DEFAULT auth.uid(),
    campaign_code TEXT NOT NULL,
    title TEXT NOT NULL,
    objective TEXT NOT NULL,
    target_audience TEXT NOT NULL,
    target_company_profile TEXT,
    estimated_tam TEXT,
    difficulty TEXT DEFAULT 'Medium',
    strategic_angle TEXT,
    rationale TEXT,
    gtm_assumptions JSONB DEFAULT '[]'::jsonb,
    supporting_company_sources JSONB DEFAULT '[]'::jsonb,
    is_approved BOOLEAN NOT NULL DEFAULT false,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_campaign_options_run_id ON campaign_options(run_id);

-- 5. Gating Decision Questions & Selection (Approval Point 2)
CREATE TABLE IF NOT EXISTS decision_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    user_id UUID DEFAULT auth.uid(),
    campaign_id UUID REFERENCES campaign_options(id) ON DELETE SET NULL,
    question_code TEXT NOT NULL,
    question TEXT NOT NULL,
    campaign_criterion TEXT,
    action_changed TEXT,
    category TEXT DEFAULT 'eligibility',
    dependencies JSONB DEFAULT '[]'::jsonb,
    mandatory_logic TEXT,
    rationale TEXT NOT NULL,
    strategic_impact TEXT NOT NULL,
    gating_criteria TEXT NOT NULL,
    recommended_confidence TEXT DEFAULT 'High',
    is_selected BOOLEAN NOT NULL DEFAULT false,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_decision_questions_run_id ON decision_questions(run_id);

-- 6. Checkpoints C1, C2, C3: Hypotheses, Rules, Outcomes & Evidence Requirements
CREATE TABLE IF NOT EXISTS hypotheses_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    user_id UUID DEFAULT auth.uid(),
    question_id UUID REFERENCES decision_questions(id) ON DELETE SET NULL,
    core_hypothesis TEXT NOT NULL,
    rules JSONB NOT NULL DEFAULT '[]'::jsonb,
    possible_answers JSONB NOT NULL DEFAULT '[]'::jsonb,
    evidence_requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_hypotheses_evidence_run_id ON hypotheses_evidence(run_id);

-- 7. Checkpoints Audit Log, Transactional Leases & Idempotency
CREATE TABLE IF NOT EXISTS checkpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    user_id UUID DEFAULT auth.uid(),
    checkpoint_type TEXT NOT NULL,
    stage TEXT NOT NULL,
    inputs JSONB NOT NULL DEFAULT '{}'::jsonb, -- EXCLUDES raw API keys
    outputs JSONB DEFAULT '{}'::jsonb,
    dependencies JSONB DEFAULT '[]'::jsonb,
    attempts INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    lease_token TEXT,
    leased_until TIMESTAMPTZ,
    idempotency_key TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_run_id ON checkpoints(run_id);

-- 8. Catalogues Metadata & Version Control
CREATE TABLE IF NOT EXISTS catalogues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID DEFAULT auth.uid(),
    name TEXT NOT NULL DEFAULT 'Clay 1200+ Enrichment Catalogue',
    version INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    source_filename TEXT DEFAULT 'clay_catalog_source.xlsx',
    content_hash TEXT,
    total_records INT NOT NULL DEFAULT 1224,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    activated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Insert default active catalogue container if none exists
INSERT INTO catalogues (id, name, version, is_active, total_records)
VALUES ('00000000-0000-0000-0000-000000000002', 'Clay 1200+ Canonical Inventory v3', 1, true, 1224)
ON CONFLICT (id) DO NOTHING;

-- 9. Canonical Catalogue Action Parent Records (1,224 Clay Actions)
CREATE TABLE IF NOT EXISTS catalogue_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    catalogue_id UUID NOT NULL REFERENCES catalogues(id) ON DELETE CASCADE,
    user_id UUID DEFAULT auth.uid(),
    x_id TEXT NOT NULL,
    canonical_name TEXT NOT NULL,
    enrichment_name TEXT,
    provider TEXT NOT NULL,
    capability_family TEXT,
    capability_type TEXT NOT NULL DEFAULT 'evidence_enrichment',
    applies_to TEXT NOT NULL DEFAULT 'Company',
    explanation TEXT,
    capability_summary TEXT,
    evidence_capabilities TEXT,
    typical_output TEXT,
    input_requirements TEXT,
    limitations TEXT,
    geographic_constraints TEXT,
    industry_constraints TEXT,
    company_type_constraints TEXT,
    cost_value NUMERIC(10, 2),
    cost_unit TEXT,
    cost_type TEXT DEFAULT 'unknown',
    cost_is_estimate BOOLEAN DEFAULT false,
    raw_cost TEXT,
    cost_notes TEXT,
    source_match_status TEXT,
    source_match_confidence TEXT,
    source_notes TEXT,
    source_row_number INT,
    original_row JSONB NOT NULL DEFAULT '{}'::jsonb,
    content_hash TEXT,
    embedding vector(384),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_catalogue_records_x_id ON catalogue_records(x_id);
CREATE INDEX IF NOT EXISTS idx_catalogue_records_applies ON catalogue_records(applies_to);
CREATE UNIQUE INDEX IF NOT EXISTS idx_catalogue_records_cat_xid ON catalogue_records(catalogue_id, x_id);

-- 10. Linked Searchable Passages (For long descriptions)
CREATE TABLE IF NOT EXISTS catalogue_passages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID NOT NULL REFERENCES catalogue_records(id) ON DELETE CASCADE,
    passage_type TEXT NOT NULL DEFAULT 'description',
    passage_text TEXT NOT NULL,
    embedding vector(384),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 11. Search Request & Candidate Audit Log
CREATE TABLE IF NOT EXISTS catalogue_searches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID DEFAULT auth.uid(),
    run_id UUID REFERENCES runs(id) ON DELETE CASCADE,
    evidence_requirement TEXT NOT NULL,
    available_inputs TEXT[] DEFAULT '{}',
    filter_applies_to TEXT,
    returned_candidates JSONB NOT NULL DEFAULT '[]'::jsonb,
    search_metrics JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 12. Final Retrieval Plans, Billing & Prerequisite Dependency Graphs
CREATE TABLE IF NOT EXISTS retrieval_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    user_id UUID DEFAULT auth.uid(),
    question_id UUID REFERENCES decision_questions(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    strategy_summary TEXT NOT NULL,
    total_credits_per_row NUMERIC NOT NULL DEFAULT 6,
    account_volume INT NOT NULL DEFAULT 1000,
    cost_per_thousand TEXT NOT NULL DEFAULT '$60.00 USD',
    waterfall_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    billing_formulas JSONB NOT NULL DEFAULT '[]'::jsonb,
    dependency_graph JSONB NOT NULL DEFAULT '[]'::jsonb,
    catalog_selections JSONB NOT NULL DEFAULT '[]'::jsonb,
    unresolved_gaps JSONB NOT NULL DEFAULT '[]'::jsonb,
    gtm_assumptions JSONB NOT NULL DEFAULT '[]'::jsonb,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 13. Hybrid Retrieval Function (pgvector Cosine Similarity + Keyword Match)
CREATE OR REPLACE FUNCTION hybrid_search_catalogue(
    query_embedding vector(384) DEFAULT NULL,
    query_text text DEFAULT '',
    filter_applies_to text DEFAULT NULL,
    match_count int DEFAULT 8,
    similarity_weight float DEFAULT 0.65
)
RETURNS TABLE (
    id UUID,
    x_id TEXT,
    canonical_name TEXT,
    provider TEXT,
    capability_family TEXT,
    capability_type TEXT,
    applies_to TEXT,
    explanation TEXT,
    typical_output TEXT,
    input_requirements TEXT,
    cost_value NUMERIC,
    cost_unit TEXT,
    cost_type TEXT,
    raw_cost TEXT,
    source_notes TEXT,
    combined_score float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH scored_records AS (
        SELECT
            cr.id,
            cr.x_id,
            cr.canonical_name,
            cr.provider,
            cr.capability_family,
            cr.capability_type,
            cr.applies_to,
            cr.explanation,
            cr.typical_output,
            cr.input_requirements,
            cr.cost_value,
            cr.cost_unit,
            cr.cost_type,
            cr.raw_cost,
            cr.source_notes,
            CASE 
                WHEN query_embedding IS NOT NULL AND cr.embedding IS NOT NULL 
                THEN (1 - (cr.embedding <=> query_embedding))
                ELSE 0.0
            END AS vector_sim,
            CASE
                WHEN query_text <> '' AND (
                    cr.canonical_name ILIKE '%' || query_text || '%' OR
                    cr.provider ILIKE '%' || query_text || '%' OR
                    cr.explanation ILIKE '%' || query_text || '%' OR
                    cr.typical_output ILIKE '%' || query_text || '%'
                ) THEN 1.0
                ELSE 0.2
            END AS text_score
        FROM catalogue_records cr
        JOIN catalogues c ON c.id = cr.catalogue_id
        WHERE c.is_active = true
          AND (cr.user_id IS NULL OR cr.user_id = auth.uid())
          AND (filter_applies_to IS NULL OR cr.applies_to = filter_applies_to OR cr.applies_to = 'Both')
    )
    SELECT
        sr.id,
        sr.x_id,
        sr.canonical_name,
        sr.provider,
        sr.capability_family,
        sr.capability_type,
        sr.applies_to,
        sr.explanation,
        sr.typical_output,
        sr.input_requirements,
        sr.cost_value,
        sr.cost_unit,
        sr.cost_type,
        sr.raw_cost,
        sr.source_notes,
        (sr.vector_sim * similarity_weight + sr.text_score * (1.0 - similarity_weight)) AS combined_score
    FROM scored_records sr
    ORDER BY combined_score DESC
    LIMIT match_count;
END;
$$;

-- 14. Basic Vector Match Function
CREATE OR REPLACE FUNCTION match_catalogue_records(
    query_embedding vector(384),
    match_threshold float DEFAULT 0.3,
    match_count int DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    canonical_name TEXT,
    provider TEXT,
    similarity float
)
LANGUAGE sql
AS $$
    SELECT
        id,
        canonical_name,
        provider,
        1 - (embedding <=> query_embedding) AS similarity
    FROM catalogue_records
    WHERE 1 - (embedding <=> query_embedding) > match_threshold
    ORDER BY similarity DESC
    LIMIT match_count;
$$;

-- 15. Enable Row-Level Security (RLS) on All Tables
ALTER TABLE runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hypotheses_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogues ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogue_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogue_passages ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogue_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE retrieval_plans ENABLE ROW LEVEL SECURITY;

-- 16. RLS Policies (Idempotent drops then creates)
DROP POLICY IF EXISTS "Users access own runs" ON runs;
DROP POLICY IF EXISTS "Users access own snapshots" ON company_snapshots;
DROP POLICY IF EXISTS "Users access own campaigns" ON campaign_options;
DROP POLICY IF EXISTS "Users access own questions" ON decision_questions;
DROP POLICY IF EXISTS "Users access own hypotheses" ON hypotheses_evidence;
DROP POLICY IF EXISTS "Users access own checkpoints" ON checkpoints;
DROP POLICY IF EXISTS "Read active or own catalogues" ON catalogues;
DROP POLICY IF EXISTS "Read active catalogue records" ON catalogue_records;
DROP POLICY IF EXISTS "Read active catalogue passages" ON catalogue_passages;
DROP POLICY IF EXISTS "Users own their search logs" ON catalogue_searches;
DROP POLICY IF EXISTS "Users access own retrieval plans" ON retrieval_plans;
DROP POLICY IF EXISTS "Public access to runs" ON runs;
DROP POLICY IF EXISTS "Public access to snapshots" ON company_snapshots;
DROP POLICY IF EXISTS "Public access to campaigns" ON campaign_options;
DROP POLICY IF EXISTS "Public access to questions" ON decision_questions;
DROP POLICY IF EXISTS "Public access to hypotheses" ON hypotheses_evidence;
DROP POLICY IF EXISTS "Public access to checkpoints" ON checkpoints;
DROP POLICY IF EXISTS "Public access to catalogues" ON catalogues;
DROP POLICY IF EXISTS "Public access to catalogue records" ON catalogue_records;
DROP POLICY IF EXISTS "Public access to catalogue passages" ON catalogue_passages;
DROP POLICY IF EXISTS "Public access to search logs" ON catalogue_searches;
DROP POLICY IF EXISTS "Public access to retrieval plans" ON retrieval_plans;

CREATE POLICY "Public access to runs" ON runs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access to snapshots" ON company_snapshots FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access to campaigns" ON campaign_options FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access to questions" ON decision_questions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access to hypotheses" ON hypotheses_evidence FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access to checkpoints" ON checkpoints FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access to catalogues" ON catalogues FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access to catalogue records" ON catalogue_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access to catalogue passages" ON catalogue_passages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access to search logs" ON catalogue_searches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access to retrieval plans" ON retrieval_plans FOR ALL USING (true) WITH CHECK (true);

-- 17. Grant API Permissions to anon and authenticated roles
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;

