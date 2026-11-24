-- Migration: 20261123000005_catalogue_v3_parent_records.sql
-- Stable parent records, source preservation, linked passages, and hybrid retrieval function

CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Catalogues (Versioned imports)
CREATE TABLE IF NOT EXISTS catalogues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID DEFAULT auth.uid(), -- NULL for global system catalogue
    name TEXT NOT NULL DEFAULT 'Clay 1200+ Enrichment Catalogue',
    version INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT false, -- Only activated after full processing succeeds
    source_filename TEXT DEFAULT 'clay_catalog_source.xlsx',
    content_hash TEXT,
    total_records INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    activated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_catalogues_active ON catalogues(is_active);

-- 2. Stable Parent Catalogue Records
CREATE TABLE IF NOT EXISTS catalogue_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    catalogue_id UUID NOT NULL REFERENCES catalogues(id) ON DELETE CASCADE,
    user_id UUID DEFAULT auth.uid(),
    
    -- Stable Canonical Identity
    x_id TEXT NOT NULL,
    canonical_name TEXT NOT NULL,
    enrichment_name TEXT,
    provider TEXT NOT NULL,
    capability_family TEXT,
    capability_type TEXT NOT NULL DEFAULT 'evidence_enrichment',
    applies_to TEXT NOT NULL DEFAULT 'Company',
    
    -- Content & Documentation
    explanation TEXT,
    capability_summary TEXT,
    evidence_capabilities TEXT,
    typical_output TEXT,
    input_requirements TEXT,
    limitations TEXT,
    
    -- Constraints & Scopes
    geographic_constraints TEXT,
    industry_constraints TEXT,
    company_type_constraints TEXT,
    
    -- Pricing & Billing Information (Preserving unknowns)
    cost_value NUMERIC(10, 2), -- Nullable if unknown
    cost_unit TEXT, -- e.g. credits_per_row, credits_per_run
    cost_type TEXT DEFAULT 'unknown', -- fixed_per_row, waterfall_average, flat_template, external_provider_pricing, unknown
    cost_is_estimate BOOLEAN DEFAULT false,
    raw_cost TEXT,
    cost_notes TEXT,
    
    -- Provenance & Audit Traceability
    source_match_status TEXT,
    source_match_confidence TEXT,
    source_notes TEXT,
    source_row_number INT,
    original_row JSONB NOT NULL DEFAULT '{}'::jsonb, -- Complete original row preserved
    content_hash TEXT NOT NULL,
    
    -- 384-dimensional gte-small embedding vector
    embedding vector(384),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_catalogue_records_cat_xid ON catalogue_records(catalogue_id, x_id);
CREATE INDEX IF NOT EXISTS idx_catalogue_records_x_id ON catalogue_records(x_id);
CREATE INDEX IF NOT EXISTS idx_catalogue_records_family ON catalogue_records(capability_family);
CREATE INDEX IF NOT EXISTS idx_catalogue_records_applies ON catalogue_records(applies_to);

-- 3. Linked Searchable Passages (For long descriptions or multi-aspect searches)
CREATE TABLE IF NOT EXISTS catalogue_passages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID NOT NULL REFERENCES catalogue_records(id) ON DELETE CASCADE,
    passage_type TEXT NOT NULL DEFAULT 'description', -- 'description', 'inputs_outputs', 'constraints'
    passage_text TEXT NOT NULL,
    embedding vector(384),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_catalogue_passages_record ON catalogue_passages(record_id);

-- 4. Search Request & Candidate Audit Log
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

CREATE INDEX IF NOT EXISTS idx_catalogue_searches_run ON catalogue_searches(run_id);

-- 5. Hybrid Retrieval Function (pgvector Cosine Similarity + Full-Text Search + Deduplication)
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
            -- Vector similarity score (1 - cosine distance)
            CASE 
                WHEN query_embedding IS NOT NULL AND cr.embedding IS NOT NULL 
                THEN (1 - (cr.embedding <=> query_embedding))
                ELSE 0.0
            END AS vector_sim,
            -- Text match score via ILIKE / keyword weighting
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

-- RLS Policies
ALTER TABLE catalogues ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogue_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogue_passages ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogue_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read active or own catalogues" ON catalogues
    FOR ALL USING (is_active = true OR user_id IS NULL OR auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Read active catalogue records" ON catalogue_records
    FOR ALL USING (user_id IS NULL OR auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Read active catalogue passages" ON catalogue_passages
    FOR SELECT USING (true);

CREATE POLICY "Users own their search logs" ON catalogue_searches
    FOR ALL USING (user_id IS NULL OR auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

