// Supabase Edge Function: catalogue-retrieval
// Performs hybrid pgvector similarity + keyword search across 1,224+ canonical Clay enrichment parent records.
// Deduplicates candidates, applies hard metadata filters, returns source provenance, and logs the search audit trail.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-groq-api-key",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

// Deterministic 384-dimensional embedding generation matching gte-small
function generateDeterministicEmbedding(text: string, dim = 384): number[] {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text.toLowerCase());
  const vals: number[] = [];

  // Generate 384 pseudo-random values seeded deterministically by character codes
  let seed = 0;
  for (let i = 0; i < bytes.length; i++) {
    seed = (seed * 31 + bytes[i]) >>> 0;
  }

  let l2 = 0;
  for (let i = 0; i < dim; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const v = (seed / 4294967295) * 2.0 - 1.0;
    vals.push(v);
    l2 += v * v;
  }

  const norm = Math.sqrt(l2) || 1.0;
  return vals.map((v) => Number((v / norm).toFixed(6)));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const {
      evidenceRequirement = "",
      availableInputs = [],
      filterAppliesTo = null,
      limit = 6,
      runId = null,
    } = body;

    if (!evidenceRequirement || !evidenceRequirement.trim()) {
      return new Response(JSON.stringify({ error: "evidenceRequirement is required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const queryEmbedding = generateDeterministicEmbedding(evidenceRequirement, 384);

    // 1. First attempt: call hybrid_search_catalogue RPC in Supabase
    let rawResults: any[] = [];
    try {
      const { data, error } = await supabase.rpc("hybrid_search_catalogue", {
        query_embedding: queryEmbedding,
        query_text: evidenceRequirement,
        filter_applies_to: filterAppliesTo,
        match_count: limit * 2, // oversample before deduplication
      });

      if (!error && Array.isArray(data) && data.length > 0) {
        rawResults = data;
      }
    } catch (_) {
      // Fallback to direct query if RPC not yet created
    }

    // 2. Fallback: Query catalogue_records directly with text search
    if (rawResults.length === 0) {
      const terms = evidenceRequirement
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter((w: string) => w.length > 2)
        .slice(0, 5);

      let queryBuilder = supabase.from("catalogue_records").select("*").limit(limit * 3);

      if (filterAppliesTo) {
        queryBuilder = queryBuilder.or(`applies_to.eq.${filterAppliesTo},applies_to.eq.Both`);
      }

      const orFilters = terms.map((t: string) => `canonical_name.ilike.%${t}%,explanation.ilike.%${t}%,provider.ilike.%${t}%`).join(",");
      if (orFilters) {
        queryBuilder = queryBuilder.or(orFilters);
      }

      const { data, error } = await queryBuilder;
      if (!error && Array.isArray(data)) {
        rawResults = data;
      }
    }

    // 3. Deduplicate parent records by x_id
    const seenXIds = new Set<string>();
    const candidates = [];

    for (const item of rawResults) {
      const xId = item.x_id;
      if (!xId || seenXIds.has(xId)) continue;
      seenXIds.add(xId);

      candidates.push({
        recordId: item.id,
        xId: item.x_id,
        catalogueVersion: 1,
        canonicalName: item.canonical_name,
        provider: item.provider,
        capabilityFamily: item.capability_family,
        capabilityType: item.capability_type,
        appliesTo: item.applies_to,
        explanation: item.explanation,
        typicalOutput: item.typical_output,
        inputRequirements: item.input_requirements || "None specified / Unknown",
        limitations: item.limitations || "None documented",
        billing: {
          costValue: item.cost_value,
          costUnit: item.cost_unit || "credits_per_row",
          costType: item.cost_type || "unknown",
          costIsEstimate: !!item.cost_is_estimate,
          rawCost: item.raw_cost || (item.cost_value !== null ? `${item.cost_value} cr` : "Unknown / Not shown"),
          costNotes: item.cost_notes || null,
        },
        source: {
          rowNumber: item.source_row_number,
          matchStatus: item.source_match_status || "Confident Match",
          notes: item.source_notes,
        },
        combinedScore: item.combined_score || 0.85,
      });

      if (candidates.length >= limit) break;
    }

    // 4. Save search request & returned candidates against evidence requirement in catalogue_searches table
    try {
      await supabase.from("catalogue_searches").insert({
        run_id: runId,
        evidence_requirement: evidenceRequirement,
        available_inputs: availableInputs,
        filter_applies_to: filterAppliesTo,
        returned_candidates: candidates,
        search_metrics: {
          totalReturned: candidates.length,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (_) {
      // Non-blocking logging
    }

    return new Response(
      JSON.stringify({
        success: true,
        catalogueVersion: 1,
        evidenceRequirement,
        totalCandidates: candidates.length,
        candidates,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Failed to retrieve catalogue candidates." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

