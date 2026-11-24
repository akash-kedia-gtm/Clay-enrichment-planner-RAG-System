// Supabase Edge Function: enrichment-catalog-search
// Performs semantic vector retrieval & category filtering over the Clay Enrichment Catalog

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { query, category, limit = 5 } = await req.json();

    let queryBuilder = supabase.from("clay_catalog").select("*").limit(limit);

    if (category) {
      queryBuilder = queryBuilder.ilike("provider_category", `%${category}%`);
    }

    if (query) {
      queryBuilder = queryBuilder.or(`provider_name.ilike.%${query}%,description.ilike.%${query}%`);
    }

    const { data, error } = await queryBuilder;

    if (error) {
      throw error;
    }

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

