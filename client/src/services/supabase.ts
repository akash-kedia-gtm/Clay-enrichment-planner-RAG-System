import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CampaignRun } from '../types/workflow';

// User's connected Supabase Project
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://yadpkqnidlsewxwmponv.supabase.co';
export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_2oZqmshxO9qRtX9XeNU8og_F1FYD_4F';

export const supabaseClient: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper to persist state to user's Supabase campaign_runs or runs table
export async function persistRunToSupabase(run: CampaignRun): Promise<boolean> {
  if (!run.id) return false;

  try {
    const payload = {
      id: run.id.includes('-') ? run.id : undefined,
      user_id: run.userId,
      company_url: run.companyUrl,
      stage: run.stage,
      status: run.status,
      revision_id: run.revisionId,
      selected_campaign_id: run.selectedCampaignId || undefined,
      selected_question_id: run.selectedQuestionId || undefined,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabaseClient.from('runs').upsert(payload);
    if (!error) return true;

    // Fallback attempt to campaign_runs if v1 table
    const { error: v1Error } = await supabaseClient.from('campaign_runs').upsert({
      id: run.id,
      company_url: run.companyUrl,
      stage: run.stage,
      company_data: run.companyData || {},
      proposed_campaigns: run.proposedCampaigns || [],
      selected_campaign_id: run.selectedCampaignId,
      proposed_questions: run.proposedQuestions || [],
      selected_question_id: run.selectedQuestionId,
      follow_up_notes: run.followUpNotes,
      hypothesis_matrix: run.hypothesisMatrix || {},
      enrichment_plan: run.enrichmentPlan || {},
      catalog_selections: run.catalogSelections || [],
      unresolved_gaps: run.unresolvedGaps || [],
      checkpoints: run.checkpoints || [],
      updated_at: new Date().toISOString(),
    });

    return !v1Error;
  } catch (err) {
    return false;
  }
}
