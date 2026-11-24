-- Migration: 20261123000003_create_planner_v2_schema.sql
-- Enables pgvector and establishes normalized tables with user-scoped Row Level Security

CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Runs Table (Tracks overall run status, current stage, revision counter for upstream invalidation)
CREATE TABLE IF NOT EXISTS runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid(),
    company_url TEXT NOT NULL,
    stage TEXT NOT NULL DEFAULT 'INIT',
    -- Stage enum: 'INIT', 'ANALYZING_COMPANY', 'CAMPAIGNS_PROPOSED', 'GENERATING_QUESTIONS', 'QUESTIONS_PROPOSED', 'BUILDING_PLAN', 'PLAN_READY', 'ERROR'
    revision_id INT NOT NULL DEFAULT 1,
    current_checkpoint_id UUID,
    status TEXT NOT NULL DEFAULT 'pending', 
    -- Status enum: 'pending', 'running', 'awaiting_selection', 'awaiting_credentials', 'completed', 'failed'
    selected_campaign_id UUID,
    selected_question_id UUID,
    selected_model TEXT DEFAULT 'llama-3.3-70b-versatile',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_runs_user_id ON runs(user_id);
CREATE INDEX IF NOT EXISTS idx_runs_stage ON runs(stage);

-- 2. Company Source Snapshots
CREATE TABLE IF NOT EXISTS company_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL DEFAULT auth.uid(),
    domain TEXT NOT NULL,
    name TEXT NOT NULL,
    industry TEXT,
    summary TEXT,
    icp_summary TEXT,
    value_proposition TEXT,
    tech_stack TEXT[] DEFAULT '{}',
    source_links JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_company_snapshots_run_id ON company_snapshots(run_id);

-- 3. Campaign Options & User Selection
CREATE TABLE IF NOT EXISTS campaign_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL DEFAULT auth.uid(),
    campaign_code TEXT NOT NULL,
    title TEXT NOT NULL,
    objective TEXT NOT NULL,
    target_audience TEXT NOT NULL,
    estimated_tam TEXT,
    difficulty TEXT DEFAULT 'Medium',
    strategic_angle TEXT,
    rationale TEXT,
    is_approved BOOLEAN NOT NULL DEFAULT false,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_campaign_options_run_id ON campaign_options(run_id);

-- 4. Decision Questions & User Selection
CREATE TABLE IF NOT EXISTS decision_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL DEFAULT auth.uid(),
    campaign_id UUID REFERENCES campaign_options(id) ON DELETE SET NULL,
    question_code TEXT NOT NULL,
    question TEXT NOT NULL,
    rationale TEXT NOT NULL,
    strategic_impact TEXT NOT NULL,
    gating_criteria TEXT NOT NULL,
    recommended_confidence TEXT DEFAULT 'High',
    is_selected BOOLEAN NOT NULL DEFAULT false,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_decision_questions_run_id ON decision_questions(run_id);

-- 5. Hypotheses, Possible Answers & Evidence Requirements
CREATE TABLE IF NOT EXISTS hypotheses_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL DEFAULT auth.uid(),
    question_id UUID REFERENCES decision_questions(id) ON DELETE SET NULL,
    core_hypothesis TEXT NOT NULL,
    possible_answers JSONB NOT NULL DEFAULT '[]'::jsonb,
    evidence_requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_hypotheses_evidence_run_id ON hypotheses_evidence(run_id);

-- 6. Checkpoint Executions, Inputs, Outputs, Leases & Idempotency
CREATE TABLE IF NOT EXISTS checkpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL DEFAULT auth.uid(),
    checkpoint_type TEXT NOT NULL,
    stage TEXT NOT NULL,
    inputs JSONB NOT NULL DEFAULT '{}'::jsonb, -- EXCLUDES user API keys
    outputs JSONB DEFAULT '{}'::jsonb,
    dependencies JSONB DEFAULT '[]'::jsonb,
    attempts INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    -- Status: 'pending', 'running', 'awaiting_selection', 'awaiting_credentials', 'completed', 'failed'
    lease_token TEXT,
    leased_until TIMESTAMPTZ,
    idempotency_key TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_run_id ON checkpoints(run_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_status ON checkpoints(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_checkpoints_idempotency ON checkpoints(run_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- 7. Catalogues & Source Records
CREATE TABLE IF NOT EXISTS catalogues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID DEFAULT auth.uid(), -- NULL indicates built-in public catalogue
    name TEXT NOT NULL,
    version INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS catalogue_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    catalogue_id UUID REFERENCES catalogues(id) ON DELETE CASCADE,
    user_id UUID DEFAULT auth.uid(), -- NULL indicates built-in public record
    provider_name TEXT NOT NULL,
    provider_category TEXT NOT NULL,
    data_points TEXT[] NOT NULL,
    cost_credits INT NOT NULL DEFAULT 1,
    description TEXT NOT NULL,
    reliability_score NUMERIC(3, 2) DEFAULT 0.95,
    sample_output JSONB DEFAULT '{}'::jsonb,
    embedding vector(384), -- 384-dimensional gte-small normalized vectors
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_catalogue_records_category ON catalogue_records(provider_category);

-- 8. Retrieval Plans & Clay Waterfall Blueprints
CREATE TABLE IF NOT EXISTS retrieval_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL DEFAULT auth.uid(),
    question_id UUID REFERENCES decision_questions(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    strategy_summary TEXT NOT NULL,
    total_credits_per_row INT NOT NULL DEFAULT 0,
    cost_per_thousand TEXT NOT NULL,
    waterfall_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    catalog_selections JSONB NOT NULL DEFAULT '[]'::jsonb,
    unresolved_gaps JSONB NOT NULL DEFAULT '[]'::jsonb,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_retrieval_plans_run_id ON retrieval_plans(run_id);

-- 9. Semantic Vector Search Function matching gte-small 384-dimensional vectors
CREATE OR REPLACE FUNCTION match_catalogue_records(
    query_embedding vector(384),
    match_threshold float DEFAULT 0.25,
    match_count int DEFAULT 6,
    filter_category text DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    provider_name TEXT,
    provider_category TEXT,
    data_points TEXT[],
    cost_credits INT,
    description TEXT,
    reliability_score NUMERIC,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        cr.id,
        cr.provider_name,
        cr.provider_category,
        cr.data_points,
        cr.cost_credits,
        cr.description,
        cr.reliability_score,
        1 - (cr.embedding <=> query_embedding) AS similarity
    FROM catalogue_records cr
    WHERE (cr.user_id IS NULL OR cr.user_id = auth.uid())
      AND (filter_category IS NULL OR cr.provider_category ILIKE '%' || filter_category || '%')
      AND (cr.embedding IS NULL OR 1 - (cr.embedding <=> query_embedding) > match_threshold)
    ORDER BY cr.embedding <=> query_embedding ASC NULLS LAST
    LIMIT match_count;
END;
$$;

-- 10. Row Level Security Policies
ALTER TABLE runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hypotheses_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogues ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogue_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE retrieval_plans ENABLE ROW LEVEL SECURITY;

-- Anonymous and authenticated user policies
CREATE POLICY "Users own their runs" ON runs
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users own company snapshots" ON company_snapshots
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users own campaign options" ON campaign_options
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users own decision questions" ON decision_questions
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users own hypotheses evidence" ON hypotheses_evidence
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users own checkpoints" ON checkpoints
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read public and own catalogues" ON catalogues
    FOR ALL USING (user_id IS NULL OR auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read public and own catalogue records" ON catalogue_records
    FOR ALL USING (user_id IS NULL OR auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users own retrieval plans" ON retrieval_plans
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

