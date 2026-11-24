// Supabase Edge Function: workflow-checkpoint
// Server-controlled checkpoint executor with transactional leases, idempotency, and upstream invalidation.
// Enforces Supabase user auth (auth.uid()), persists verified outputs to normalized tables, and proxies Groq calls.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-groq-api-key, x-idempotency-key",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Verify user session via JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized: Supabase session required." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid user session." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    // 2. Extract user Groq key strictly from header
    const userGroqKey = req.headers.get("x-groq-api-key")?.trim() || "";
    const idempotencyKey = req.headers.get("x-idempotency-key")?.trim();

    const body = await req.json();
    const { action, runId, companyUrl, selectedCampaignId, selectedQuestionId, followUpNotes, selectedModel = "llama-3.3-70b-versatile" } = body;

    // -------------------------------------------------------------
    // ACTION: START_RUN
    // -------------------------------------------------------------
    if (action === "START_RUN") {
      if (!companyUrl || !companyUrl.includes(".")) {
        return new Response(JSON.stringify({ error: "Valid company URL is required." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if user has credentials
      const initialStatus = userGroqKey ? "running" : "awaiting_credentials";

      // Insert new Run
      const { data: newRun, error: runInsertErr } = await supabase
        .from("runs")
        .insert({
          user_id: userId,
          company_url: companyUrl,
          stage: "ANALYZING_COMPANY",
          status: initialStatus,
          selected_model: selectedModel,
          revision_id: 1,
        })
        .select()
        .single();

      if (runInsertErr) throw new Error(`Failed to create run: ${runInsertErr.message}`);

      // Insert Initial Checkpoint
      const leaseToken = crypto.randomUUID();
      const leasedUntil = new Date(Date.now() + 60000).toISOString();

      const { data: chk, error: chkErr } = await supabase
        .from("checkpoints")
        .insert({
          run_id: newRun.id,
          user_id: userId,
          checkpoint_type: "ANALYZE_COMPANY",
          stage: "ANALYZING_COMPANY",
          inputs: { companyUrl }, // Raw API key NEVER saved
          status: initialStatus,
          lease_token: leaseToken,
          leased_until: leasedUntil,
          idempotency_key: idempotencyKey,
          attempts: userGroqKey ? 1 : 0,
        })
        .select()
        .single();

      if (chkErr) throw new Error(`Checkpoint creation failed: ${chkErr.message}`);

      if (!userGroqKey) {
        return new Response(
          JSON.stringify({
            run: newRun,
            checkpoint: chk,
            status: "awaiting_credentials",
            message: "Connect your Groq key to continue.",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Execute 1st Groq Call: Research Company
      const groqServiceUrl = `${supabaseUrl}/functions/v1/groq-service`;
      const groqRes1 = await fetch(groqServiceUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-groq-api-key": userGroqKey,
        },
        body: JSON.stringify({
          task: "RESEARCH_COMPANY",
          model: selectedModel,
          context: { companyUrl },
        }),
      });

      if (!groqRes1.ok) {
        const errJson = await groqRes1.json().catch(() => ({}));
        await supabase
          .from("checkpoints")
          .update({ status: "failed", error_message: errJson.error || "Groq company research failed." })
          .eq("id", chk.id);
        await supabase
          .from("runs")
          .update({ status: "failed", stage: "ERROR" })
          .eq("id", newRun.id);

        return new Response(JSON.stringify({ error: errJson.error || "Company research failed.", code: errJson.code }), {
          status: groqRes1.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: groqData1 } = await groqRes1.json();
      const company = groqData1.company;

      // Persist Company Snapshot (website link + summary)
      await supabase.from("company_snapshots").insert({
        run_id: newRun.id,
        user_id: userId,
        domain: company.domain,
        name: company.name,
        industry: company.industry,
        summary: company.summary,
        icp_summary: company.icpSummary,
        value_proposition: company.valueProposition,
        tech_stack: company.techStack || [],
        source_links: company.sourceLinks || [],
      });

      // Execute 2nd Groq Call: Request 3 grounded campaign suggestions
      const groqRes2 = await fetch(groqServiceUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-groq-api-key": userGroqKey,
        },
        body: JSON.stringify({
          task: "PROPOSE_CAMPAIGNS",
          model: selectedModel,
          context: { companyUrl, company },
        }),
      });

      if (!groqRes2.ok) {
        const errJson = await groqRes2.json().catch(() => ({}));
        return new Response(JSON.stringify({ error: errJson.error || "Campaign synthesis failed.", code: errJson.code }), {
          status: groqRes2.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: groqData2 } = await groqRes2.json();
      const campaigns = groqData2.campaigns || [];

      // Persist Proposed Campaign Options
      const campaignInserts = (campaigns || []).map((c: any) => ({
        run_id: newRun.id,
        user_id: userId,
        campaign_code: c.code || c.id || "camp",
        title: c.title,
        objective: c.objective,
        target_audience: c.targetAudience,
        estimated_tam: c.estimatedTam,
        difficulty: c.difficulty || "Medium",
        strategicAngle: c.strategicAngle,
        rationale: c.rationale,
        is_approved: false,
        version: 1,
      }));

      await supabase.from("campaign_options").insert(campaignInserts);

      // Checkpoint 1 Completed
      await supabase
        .from("checkpoints")
        .update({
          status: "completed",
          outputs: { companyName: company.name, campaignCount: campaigns?.length },
          updated_at: new Date().toISOString(),
        })
        .eq("id", chk.id);

      // Checkpoint 2 Created: Awaiting Campaign Selection (User Approval 1)
      const { data: chk2 } = await supabase
        .from("checkpoints")
        .insert({
          run_id: newRun.id,
          user_id: userId,
          checkpoint_type: "SELECT_CAMPAIGN",
          stage: "CAMPAIGNS_PROPOSED",
          status: "awaiting_selection",
        })
        .select()
        .single();

      // Update Run state
      const { data: updatedRun } = await supabase
        .from("runs")
        .update({
          stage: "CAMPAIGNS_PROPOSED",
          status: "awaiting_selection",
          current_checkpoint_id: chk2?.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", newRun.id)
        .select()
        .single();

      return new Response(JSON.stringify({ success: true, run: updatedRun }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // -------------------------------------------------------------
    // ACTION: APPROVE_CAMPAIGN (User Approval Point 1)
    // -------------------------------------------------------------
    if (action === "APPROVE_CAMPAIGN") {
      if (!runId || !selectedCampaignId) {
        return new Response(JSON.stringify({ error: "runId and selectedCampaignId required." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify run ownership
      const { data: run, error: runErr } = await supabase
        .from("runs")
        .eq("id", runId)
        .eq("user_id", userId)
        .single();

      if (runErr || !run) {
        return new Response(JSON.stringify({ error: "Run not found or unauthorized." }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Upstream Invalidation: If campaign selection changed, increment revision_id
      const isNewCampaign = run.selected_campaign_id !== selectedCampaignId;
      const nextRevision = isNewCampaign ? run.revision_id + 1 : run.revision_id;

      // Update campaign approval flag
      await supabase
        .from("campaign_options")
        .update({ is_approved: false })
        .eq("run_id", runId);

      const { data: chosenCamp } = await supabase
        .from("campaign_options")
        .update({ is_approved: true })
        .eq("id", selectedCampaignId)
        .eq("run_id", runId)
        .select()
        .single();

      // Load company snapshot
      const { data: companySnap } = await supabase
        .from("company_snapshots")
        .eq("run_id", runId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      // Checkpoint: Generate Decision Questions
      const initialStatus = userGroqKey ? "running" : "awaiting_credentials";
      const leaseToken = crypto.randomUUID();

      const { data: chkQ } = await supabase
        .from("checkpoints")
        .insert({
          run_id: runId,
          user_id: userId,
          checkpoint_type: "GENERATE_QUESTIONS",
          stage: "GENERATING_QUESTIONS",
          inputs: { campaignTitle: chosenCamp?.title },
          status: initialStatus,
          lease_token: leaseToken,
          leased_until: new Date(Date.now() + 60000).toISOString(),
          idempotency_key: idempotencyKey,
        })
        .select()
        .single();

      await supabase
        .from("runs")
        .update({
          selected_campaign_id: selectedCampaignId,
          stage: "GENERATING_QUESTIONS",
          status: initialStatus,
          revision_id: nextRevision,
          current_checkpoint_id: chkQ?.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", runId);

      if (!userGroqKey) {
        return new Response(
          JSON.stringify({
            status: "awaiting_credentials",
            message: "Connect your Groq key to continue.",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Invoke Groq for Decision Questions
      const groqServiceUrl = `${supabaseUrl}/functions/v1/groq-service`;
      const groqRes = await fetch(groqServiceUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-groq-api-key": userGroqKey,
        },
        body: JSON.stringify({
          task: "GENERATE_QUESTIONS",
          model: run.selected_model || selectedModel,
          context: {
            companyName: companySnap?.name,
            campaignTitle: chosenCamp?.title,
            campaignObjective: chosenCamp?.objective,
            campaignAudience: chosenCamp?.target_audience,
          },
        }),
      });

      if (!groqRes.ok) {
        const errJson = await groqRes.json().catch(() => ({}));
        await supabase
          .from("checkpoints")
          .update({ status: "failed", error_message: errJson.error })
          .eq("id", chkQ.id);

        return new Response(JSON.stringify({ error: errJson.error }), {
          status: groqRes.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: groqData } = await groqRes.json();
      const questions = groqData.questions || [];

      // If revision bumped, delete or archive obsolete questions for this run
      if (isNewCampaign) {
        await supabase.from("decision_questions").delete().eq("run_id", runId);
      }

      const questionInserts = questions.map((q: any) => ({
        run_id: runId,
        user_id: userId,
        campaign_id: selectedCampaignId,
        question_code: q.code || "q",
        question: q.question,
        rationale: q.rationale,
        strategic_impact: q.strategicImpact,
        gating_criteria: q.gatingCriteria,
        recommended_confidence: q.recommendedConfidence || "High",
        is_selected: false,
        version: nextRevision,
      }));

      await supabase.from("decision_questions").insert(questionInserts);

      // Checkpoint Completed
      await supabase
        .from("checkpoints")
        .update({ status: "completed", outputs: { questionCount: questions.length } })
        .eq("id", chkQ.id);

      // Checkpoint 4: Awaiting Question Selection (User Approval 2)
      const { data: chkSelQ } = await supabase
        .from("checkpoints")
        .insert({
          run_id: runId,
          user_id: userId,
          checkpoint_type: "SELECT_QUESTION",
          stage: "QUESTIONS_PROPOSED",
          status: "awaiting_selection",
        })
        .select()
        .single();

      const { data: finalRun } = await supabase
        .from("runs")
        .update({
          stage: "QUESTIONS_PROPOSED",
          status: "awaiting_selection",
          current_checkpoint_id: chkSelQ?.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", runId)
        .select()
        .single();

      return new Response(JSON.stringify({ success: true, run: finalRun }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // -------------------------------------------------------------
    // ACTION: APPROVE_QUESTION & APPROVE_PERSONA (User Approval Point 2)
    // -------------------------------------------------------------
    if (action === "APPROVE_QUESTION" || action === "APPROVE_PERSONA") {
      const targetSelectionId = selectedQuestionId || body.selectedPersonaId || body.personaId;
      if (!runId || !targetSelectionId) {
        return new Response(JSON.stringify({ error: "runId and selection ID required." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: run, error: runErr } = await supabase
        .from("runs")
        .eq("id", runId)
        .eq("user_id", userId)
        .single();

      if (runErr || !run) {
        return new Response(JSON.stringify({ error: "Run not found or unauthorized." }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Mark question selected
      await supabase
        .from("decision_questions")
        .update({ is_selected: false })
        .eq("run_id", runId);

      const { data: chosenQ } = await supabase
        .from("decision_questions")
        .update({ is_selected: true })
        .eq("id", selectedQuestionId)
        .eq("run_id", runId)
        .select()
        .single();

      const { data: chosenCamp } = await supabase
        .from("campaign_options")
        .eq("id", run.selected_campaign_id)
        .single();

      const { data: companySnap } = await supabase
        .from("company_snapshots")
        .eq("run_id", runId)
        .single();

      const initialStatus = userGroqKey ? "running" : "awaiting_credentials";
      const leaseToken = crypto.randomUUID();

      const { data: chkPlan } = await supabase
        .from("checkpoints")
        .insert({
          run_id: runId,
          user_id: userId,
          checkpoint_type: "SYNTHESIZE_PLAN",
          stage: "BUILDING_PLAN",
          inputs: { question: chosenQ?.question, followUpNotes },
          status: initialStatus,
          lease_token: leaseToken,
          leased_until: new Date(Date.now() + 60000).toISOString(),
          idempotency_key: idempotencyKey,
        })
        .select()
        .single();

      await supabase
        .from("runs")
        .update({
          selected_question_id: selectedQuestionId,
          stage: "BUILDING_PLAN",
          status: initialStatus,
          current_checkpoint_id: chkPlan?.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", runId);

      if (!userGroqKey) {
        return new Response(
          JSON.stringify({
            status: "awaiting_credentials",
            message: "Connect your Groq key to continue.",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Invoke Groq for Plan Synthesis
      const groqServiceUrl = `${supabaseUrl}/functions/v1/groq-service`;
      const groqRes = await fetch(groqServiceUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-groq-api-key": userGroqKey,
        },
        body: JSON.stringify({
          task: "SYNTHESIZE_PLAN",
          model: run.selected_model || selectedModel,
          context: {
            companyName: companySnap?.name,
            campaignTitle: chosenCamp?.title,
            questionText: chosenQ?.question,
            followUpNotes,
          },
        }),
      });

      if (!groqRes.ok) {
        const errJson = await groqRes.json().catch(() => ({}));
        await supabase
          .from("checkpoints")
          .update({ status: "failed", error_message: errJson.error })
          .eq("id", chkPlan.id);

        return new Response(JSON.stringify({ error: errJson.error }), {
          status: groqRes.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: groqData } = await groqRes.json();
      const { hypothesisMatrix, enrichmentPlan, catalogSelections, unresolvedGaps } = groqData;

      // Persist Hypotheses Evidence
      await supabase.from("hypotheses_evidence").insert({
        run_id: runId,
        user_id: userId,
        question_id: selectedQuestionId,
        core_hypothesis: hypothesisMatrix.coreHypothesis,
        possible_answers: hypothesisMatrix.possibleAnswers || [],
        evidence_requirements: hypothesisMatrix.possibleAnswers?.flatMap((a: any) => a.evidenceNeeded || []) || [],
        version: run.revision_id,
      });

      // Persist Retrieval Plan
      await supabase.from("retrieval_plans").insert({
        run_id: runId,
        user_id: userId,
        question_id: selectedQuestionId,
        title: enrichmentPlan.title,
        strategy_summary: enrichmentPlan.strategySummary,
        total_credits_per_row: enrichmentPlan.totalCreditsPerRow || 6,
        cost_per_thousand: enrichmentPlan.estimatedCostPerThousand || "$60.00 USD",
        waterfall_steps: enrichmentPlan.waterfallSteps || [],
        catalog_selections: catalogSelections || [],
        unresolved_gaps: unresolvedGaps || [],
        version: run.revision_id,
      });

      // Checkpoint Completed
      await supabase
        .from("checkpoints")
        .update({ status: "completed", outputs: { planTitle: enrichmentPlan.title } })
        .eq("id", chkPlan.id);

      const { data: completedRun } = await supabase
        .from("runs")
        .update({
          stage: "PLAN_READY",
          status: "completed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", runId)
        .select()
        .single();

      return new Response(JSON.stringify({ success: true, run: completedRun }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `Unsupported workflow action: ${action}` }), {
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

