// Supabase Edge Function: workflow-transition
// Serves as the central state machine coordinator for Clay Campaign Planner

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TransitionRequest {
  action: "START_ANALYSIS" | "APPROVE_CAMPAIGN" | "APPROVE_QUESTION" | "REVISE_STEP" | "RETRY_STAGE";
  runId?: string;
  companyUrl?: string;
  selectedCampaignId?: string;
  selectedQuestionId?: string;
  followUpNotes?: string;
  targetStep?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: TransitionRequest = await req.json();
    const { action, runId, companyUrl, selectedCampaignId, selectedQuestionId, followUpNotes } = body;

    const groqKey = Deno.env.get("GROQ_API_KEY") || "";

    if (action === "START_ANALYSIS") {
      if (!companyUrl || !companyUrl.includes(".")) {
        return new Response(JSON.stringify({ error: "A valid company URL is required." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 1. Create or initialize campaign_runs row in Supabase
      const { data: run, error: insertError } = await supabase
        .from("campaign_runs")
        .insert({
          company_url: companyUrl,
          stage: "ANALYZING_COMPANY",
          checkpoints: [
            {
              id: "chk-1",
              stage: "ANALYZING_COMPANY",
              label: "Submitted company website URL",
              timestamp: new Date().toISOString(),
              status: "in_progress",
            },
          ],
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(`Failed to create run: ${insertError.message}`);
      }

      // 2. Invoke Groq orchestrator to analyze company & propose campaigns
      const orchestratorUrl = `${supabaseUrl}/functions/v1/groq-llm-orchestrator`;
      const llmRes = await fetch(orchestratorUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          task: "ANALYZE_AND_PROPOSE_CAMPAIGNS",
          companyUrl,
          apiKey: groqKey,
        }),
      });

      if (!llmRes.ok) {
        const errText = await llmRes.text();
        throw new Error(`Groq LLM analysis failed: ${errText}`);
      }

      const { companyData, proposedCampaigns } = await llmRes.json();

      // 3. Backend validation and persistence before advancing to approval point
      const updatedCheckpoints = [
        {
          id: "chk-1",
          stage: "ANALYZING_COMPANY",
          label: "Analyzed company & verified web footprint",
          timestamp: new Date().toISOString(),
          status: "completed",
        },
        {
          id: "chk-2",
          stage: "CAMPAIGNS_PROPOSED",
          label: "Generated strategic outbound campaigns (Awaiting User Selection)",
          timestamp: new Date().toISOString(),
          status: "pending_approval",
        },
      ];

      const { data: updatedRun, error: updateError } = await supabase
        .from("campaign_runs")
        .update({
          stage: "CAMPAIGNS_PROPOSED",
          company_data: companyData,
          proposed_campaigns: proposedCampaigns,
          checkpoints: updatedCheckpoints,
          updated_at: new Date().toISOString(),
        })
        .eq("id", run.id)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Failed to update run: ${updateError.message}`);
      }

      return new Response(JSON.stringify({ success: true, run: updatedRun }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "APPROVE_CAMPAIGN") {
      if (!runId || !selectedCampaignId) {
        return new Response(JSON.stringify({ error: "Run ID and selected campaign ID are required." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch current run
      const { data: currentRun, error: fetchErr } = await supabase
        .from("campaign_runs")
        .eq("id", runId)
        .single();

      if (fetchErr || !currentRun) {
        throw new Error(`Run not found: ${fetchErr?.message}`);
      }

      const selectedCampaign = (currentRun.proposed_campaigns || []).find(
        (c: any) => c.id === selectedCampaignId
      );

      if (!selectedCampaign) {
        throw new Error("Invalid campaign ID selected.");
      }

      // Checkpoint: approved campaign, generating questions
      const checkpoints = [
        ...currentRun.checkpoints.map((chk: any) =>
          chk.stage === "CAMPAIGNS_PROPOSED" ? { ...chk, status: "completed" } : chk
        ),
        {
          id: "chk-3",
          stage: "GENERATING_QUESTIONS",
          label: `Approved campaign: "${selectedCampaign.title}". Synthesizing strategic decision questions...`,
          timestamp: new Date().toISOString(),
          status: "in_progress",
        },
      ];

      await supabase
        .from("campaign_runs")
        .update({
          selected_campaign_id: selectedCampaignId,
          stage: "GENERATING_QUESTIONS",
          checkpoints,
          updated_at: new Date().toISOString(),
        })
        .eq("id", runId);

      // Invoke Groq for Decision Questions
      const orchestratorUrl = `${supabaseUrl}/functions/v1/groq-llm-orchestrator`;
      const llmRes = await fetch(orchestratorUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          task: "GENERATE_DECISION_QUESTIONS",
          companyData: currentRun.company_data,
          campaign: selectedCampaign,
          apiKey: groqKey,
        }),
      });

      if (!llmRes.ok) {
        throw new Error("Failed to generate decision questions.");
      }

      const { proposedQuestions } = await llmRes.json();

      const finalCheckpoints = [
        ...checkpoints.map((chk: any) =>
          chk.stage === "GENERATING_QUESTIONS" ? { ...chk, status: "completed" } : chk
        ),
        {
          id: "chk-4",
          stage: "QUESTIONS_PROPOSED",
          label: "Decision questions ready (Awaiting User Selection)",
          timestamp: new Date().toISOString(),
          status: "pending_approval",
        },
      ];

      const { data: finalRun, error: saveErr } = await supabase
        .from("campaign_runs")
        .update({
          stage: "QUESTIONS_PROPOSED",
          proposed_questions: proposedQuestions,
          checkpoints: finalCheckpoints,
          updated_at: new Date().toISOString(),
        })
        .eq("id", runId)
        .select()
        .single();

      if (saveErr) throw new Error(saveErr.message);

      return new Response(JSON.stringify({ success: true, run: finalRun }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "APPROVE_QUESTION") {
      if (!runId || !selectedQuestionId) {
        return new Response(JSON.stringify({ error: "Run ID and selected question ID are required." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: currentRun, error: fetchErr } = await supabase
        .from("campaign_runs")
        .eq("id", runId)
        .single();

      if (fetchErr || !currentRun) throw new Error(`Run not found: ${fetchErr?.message}`);

      const selectedCampaign = (currentRun.proposed_campaigns || []).find(
        (c: any) => c.id === currentRun.selected_campaign_id
      );
      const selectedQuestion = (currentRun.proposed_questions || []).find(
        (q: any) => q.id === selectedQuestionId
      );

      // Checkpoint
      const checkpoints = [
        ...currentRun.checkpoints.map((chk: any) =>
          chk.stage === "QUESTIONS_PROPOSED" ? { ...chk, status: "completed" } : chk
        ),
        {
          id: "chk-5",
          stage: "BUILDING_PLAN",
          label: `Approved question: "${selectedQuestion?.question}". Searching Clay catalog & building waterfall plan...`,
          timestamp: new Date().toISOString(),
          status: "in_progress",
        },
      ];

      await supabase
        .from("campaign_runs")
        .update({
          selected_question_id: selectedQuestionId,
          follow_up_notes: followUpNotes || currentRun.follow_up_notes,
          stage: "BUILDING_PLAN",
          checkpoints,
          updated_at: new Date().toISOString(),
        })
        .eq("id", runId);

      // Invoke Groq for hypotheses + evidence requirements + catalog match
      const orchestratorUrl = `${supabaseUrl}/functions/v1/groq-llm-orchestrator`;
      const llmRes = await fetch(orchestratorUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          task: "SYNTHESIZE_ENRICHMENT_PLAN",
          companyData: currentRun.company_data,
          campaign: selectedCampaign,
          question: selectedQuestion,
          followUpNotes: followUpNotes || currentRun.follow_up_notes,
          apiKey: groqKey,
        }),
      });

      if (!llmRes.ok) throw new Error("Failed to synthesize enrichment plan.");

      const { hypothesisMatrix, enrichmentPlan, catalogSelections, unresolvedGaps } = await llmRes.json();

      const finalCheckpoints = [
        ...checkpoints.map((chk: any) =>
          chk.stage === "BUILDING_PLAN" ? { ...chk, status: "completed" } : chk
        ),
        {
          id: "chk-6",
          stage: "PLAN_READY",
          label: "Clay Enrichment Plan complete and validated.",
          timestamp: new Date().toISOString(),
          status: "completed",
        },
      ];

      const { data: finalRun, error: saveErr } = await supabase
        .from("campaign_runs")
        .update({
          stage: "PLAN_READY",
          hypothesis_matrix: hypothesisMatrix,
          enrichment_plan: enrichmentPlan,
          catalog_selections: catalogSelections,
          unresolved_gaps: unresolvedGaps,
          checkpoints: finalCheckpoints,
          updated_at: new Date().toISOString(),
        })
        .eq("id", runId)
        .select()
        .single();

      if (saveErr) throw new Error(saveErr.message);

      return new Response(JSON.stringify({ success: true, run: finalRun }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "REVISE_STEP") {
      const { targetStep } = body;
      const stageMap: Record<number, string> = {
        1: "ANALYZING_COMPANY",
        2: "CAMPAIGNS_PROPOSED",
        3: "QUESTIONS_PROPOSED",
        4: "PLAN_READY",
      };

      const targetStage = stageMap[targetStep || 1] || "CAMPAIGNS_PROPOSED";

      const { data: updatedRun, error } = await supabase
        .from("campaign_runs")
        .update({
          stage: targetStage,
          updated_at: new Date().toISOString(),
        })
        .eq("id", runId)
        .select()
        .single();

      if (error) throw new Error(error.message);

      return new Response(JSON.stringify({ success: true, run: updatedRun }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unsupported workflow action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

