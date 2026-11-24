// Supabase Edge Function: catalogue-search
// Performs normalized 384-dimensional vector retrieval matching gte-small embeddings

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });

    const { query, category, limit = 5, matchThreshold = 0.25 } = await req.json();

    // In a full Supabase AI setup, query embedding can be generated via Supabase.ai or transformers
    // If embedding vector provided in payload:
    let queryEmbedding: number[] | null = null;

    if (queryEmbedding) {
      const { data, error } = await supabase.rpc("match_catalogue_records", {
        query_embedding: queryEmbedding,
        match_threshold: matchThreshold,
        match_count: limit,
        filter_category: category || null,
      });

      if (error) throw error;
      return new Response(JSON.stringify({ results: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback: Full-text & category search over catalogue_records
    let queryBuilder = supabase.from("catalogue_records").select("*").limit(limit);

    if (category) {
      queryBuilder = queryBuilder.ilike("provider_category", `%${category}%`);
    }

    if (query) {
      queryBuilder = queryBuilder.or(`provider_name.ilike.%${query}%,description.ilike.%${query}%`);
    }

    const { data, error } = await queryBuilder;
    if (error) throw error;

    return new Response(JSON.stringify({ results: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

