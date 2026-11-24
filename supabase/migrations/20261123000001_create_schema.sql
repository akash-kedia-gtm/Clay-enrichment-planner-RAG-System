-- Schema for Clay Campaign Planner

-- 1. Campaign Runs (State machine, checkpoints, plans)
CREATE TABLE IF NOT EXISTS campaign_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    company_url TEXT NOT NULL,
    stage TEXT NOT NULL DEFAULT 'INIT',
    
    -- Extracted Company Data
    company_data JSONB DEFAULT '{}'::jsonb,
    
    -- Campaign Approval Point 1
    proposed_campaigns JSONB DEFAULT '[]'::jsonb,
    selected_campaign_id TEXT,
    
    -- Decision Question Approval Point 2
    proposed_questions JSONB DEFAULT '[]'::jsonb,
    selected_question_id TEXT,
    
    -- Follow-up inputs & revisions
    follow_up_notes TEXT,
    
    -- Strategic Matrix & Evidence Requirements
    hypothesis_matrix JSONB DEFAULT '{}'::jsonb,
    
    -- Resulting Clay Enrichment Plan
    enrichment_plan JSONB DEFAULT '{}'::jsonb,
    
    -- Catalog Selections & Cost Summary
    catalog_selections JSONB DEFAULT '[]'::jsonb,
    unresolved_gaps JSONB DEFAULT '[]'::jsonb,
    
    -- Audit checkpoints
    checkpoints JSONB DEFAULT '[]'::jsonb,
    
    -- Metadata and error states
    error_message TEXT
);

-- Index on stage and updated_at
CREATE INDEX IF NOT EXISTS idx_campaign_runs_stage ON campaign_runs(stage);
CREATE INDEX IF NOT EXISTS idx_campaign_runs_updated_at ON campaign_runs(updated_at DESC);

-- 2. Clay Enrichment Catalog (with pgvector embeddings)
CREATE TABLE IF NOT EXISTS clay_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_name TEXT NOT NULL,
    provider_category TEXT NOT NULL,
    data_points TEXT[] NOT NULL,
    cost_credits INT NOT NULL DEFAULT 1,
    description TEXT NOT NULL,
    reliability_score NUMERIC(3, 2) DEFAULT 0.95,
    sample_output JSONB DEFAULT '{}'::jsonb,
    embedding vector(384)
);

CREATE INDEX IF NOT EXISTS idx_clay_catalog_category ON clay_catalog(provider_category);

-- RPC for vector similarity search over Clay catalog
CREATE OR REPLACE FUNCTION match_clay_catalog(
    query_embedding vector(384),
    match_threshold float DEFAULT 0.3,
    match_count int DEFAULT 5
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
        clay_catalog.id,
        clay_catalog.provider_name,
        clay_catalog.provider_category,
        clay_catalog.data_points,
        clay_catalog.cost_credits,
        clay_catalog.description,
        clay_catalog.reliability_score,
        1 - (clay_catalog.embedding <=> query_embedding) AS similarity
    FROM clay_catalog
    WHERE 1 - (clay_catalog.embedding <=> query_embedding) > match_threshold
    ORDER BY clay_catalog.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- RLS setup (public demo / anon read/write allowed)
ALTER TABLE campaign_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE clay_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read and write on campaign_runs"
    ON campaign_runs FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow public read on clay_catalog"
    ON clay_catalog FOR SELECT
    USING (true);

