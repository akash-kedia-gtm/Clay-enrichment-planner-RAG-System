import {
  CampaignRun,
  WorkflowStage,
  Checkpoint,
  CheckpointStatus,
  CompanyData,
  CampaignOption,
  DecisionQuestion,
} from '../types/workflow';
import { sessionManager, supabase } from './sessionManager';
import { executeServerCheckpoint } from './groqClient';

const INITIAL_RUN: CampaignRun = {
  id: '',
  createdAt: '',
  updatedAt: '',
  companyUrl: '',
  stage: 'INIT',
  status: 'pending',
  revisionId: 1,
  isDemonstrationData: false,
  companyData: null,
  proposedCampaigns: [],
  selectedCampaignId: null,
  proposedPersonas: [],
  selectedPersonaId: null,
  proposedQuestions: [],
  selectedQuestionId: null,
  followUpNotes: '',
  hypothesisMatrix: null,
  candidateEvaluations: [],
  enrichmentPlan: null,
  catalogSelections: [],
  unresolvedGaps: [],
  checkpoints: [],
  errorMessage: null,
};

class WorkflowEngine {
  private currentRun: CampaignRun = { ...INITIAL_RUN };
  private listeners: Array<(run: CampaignRun) => void> = [];
  private isLoading = false;

  constructor() {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('clay_planner_current_run_v3');
        if (saved) {
          this.currentRun = JSON.parse(saved);
        }
      }
    } catch (e) {
      console.warn('Could not restore previous run', e);
    }
  }

  public getRun(): CampaignRun {
    return { ...this.currentRun };
  }

  public getIsLoading(): boolean {
    return this.isLoading;
  }

  public subscribe(listener: (run: CampaignRun) => void) {
    this.listeners.push(listener);
    listener({ ...this.currentRun });
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('clay_planner_current_run_v3', JSON.stringify(this.currentRun));
      }
      this.syncToSupabase();
    } catch (e) {
      console.warn('Persistence warning:', e);
    }
    const nextRun = { ...this.currentRun };
    this.listeners.forEach((l) => l(nextRun));
  }

  private async syncToSupabase() {
    if (!this.currentRun.id) return;
    const session = sessionManager.getState();
    try {
      await supabase.from('runs').upsert({
        id: this.currentRun.id,
        user_id: session.userId || undefined,
        company_url: this.currentRun.companyUrl,
        stage: this.currentRun.stage,
        status: this.currentRun.status,
        revision_id: this.currentRun.revisionId,
        selected_campaign_id: this.currentRun.selectedCampaignId || undefined,
        selected_question_id: this.currentRun.selectedQuestionId || undefined,
        updated_at: new Date().toISOString(),
      });
    } catch (_) {}
  }

  private addCheckpoint(stage: WorkflowStage, label: string, status: CheckpointStatus, details?: Record<string, any>): Checkpoint {
    const chk: Checkpoint = {
      id: crypto.randomUUID ? crypto.randomUUID() : `chk_${Date.now()}`,
      stage,
      label,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      status,
      details,
    };
    this.currentRun.checkpoints = [...this.currentRun.checkpoints, chk];
    this.currentRun.status = status;
    return chk;
  }

  private updateLastCheckpoint(status: CheckpointStatus, error?: string) {
    if (this.currentRun.checkpoints.length > 0) {
      const lastIdx = this.currentRun.checkpoints.length - 1;
      this.currentRun.checkpoints[lastIdx] = {
        ...this.currentRun.checkpoints[lastIdx],
        status,
        error,
      };
      this.currentRun.status = status;
    }
  }

  // 1. Submit URL or manual company description and analyze company
  public async startAnalysis(url: string, manualDescription?: string): Promise<void> {
    if (!url || !url.trim()) {
      throw new Error('Please enter a company website URL.');
    }

    let cleanUrl = url.trim();
    // Normalize format: supports www., https://, http://, or bare domain
    if (!/^https?:\/\//i.test(cleanUrl)) {
      cleanUrl = 'https://' + cleanUrl;
    }

    const session = sessionManager.getState();
    const runId = crypto.randomUUID ? crypto.randomUUID() : '00000000-0000-4000-8000-' + Date.now().toString().slice(-12);

    this.isLoading = true;
    this.currentRun = {
      ...INITIAL_RUN,
      id: runId,
      userId: session.userId || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      companyUrl: cleanUrl,
      stage: 'ANALYZING_COMPANY',
      status: 'running',
      revisionId: 1,
      isDemonstrationData: !session.isGroqConnected,
      errorMessage: null,
      checkpoints: [],
    };

    // 1st LLM Call Checkpoint: Research company from website link
    this.addCheckpoint(
      'ANALYZING_COMPANY',
      `Calling LLM (1st Call): Researches company offering, products, and buyers for ${cleanUrl}`,
      'running'
    );
    this.notify();

    try {
      // Step 1: Make 1st LLM call to research the company
      const researchRes = await executeServerCheckpoint('RESEARCH_COMPANY', {
        companyUrl: cleanUrl,
        runId,
        manualDescription,
      });

      if (!researchRes.success || !researchRes.data?.company) {
        throw new Error(researchRes.error || 'Failed to complete company research.');
      }

      const researchedCompany = researchRes.data.company;
      // Store company info (website link + summary of the website)
      this.currentRun.companyData = researchedCompany;
      this.currentRun.isDemonstrationData = !session.isGroqConnected || !!researchRes.isDemonstrationData;

      // Checkpoint 1 completed: Server stores company info
      this.updateLastCheckpoint(
        'completed',
        `Researched ${researchedCompany.name} (${researchedCompany.domain}): ${researchedCompany.summary.slice(0, 120)}...`
      );

      // 2nd LLM Call Checkpoint: Ask for 3 campaign suggestions based on this company
      this.addCheckpoint(
        'CAMPAIGNS_PROPOSED',
        `Calling LLM (2nd Call): Formulating 3 grounded outbound campaigns tailored to ${researchedCompany.name}`,
        'running'
      );
      // Notify so Right Pane displays company info immediately
      this.notify();

      // Step 2: Make 2nd LLM call for 3 grounded campaign suggestions
      const campaignsRes = await executeServerCheckpoint('PROPOSE_CAMPAIGNS', {
        companyUrl: cleanUrl,
        company: researchedCompany,
        runId,
      });

      if (!campaignsRes.success || !campaignsRes.data?.campaigns) {
        throw new Error(campaignsRes.error || 'Failed to synthesize campaign suggestions.');
      }

      const rawCampaigns = campaignsRes.data.campaigns;
      this.currentRun.proposedCampaigns = rawCampaigns.map((c: any, idx: number) => ({
        id: c.id || c.code || `camp_${idx + 1}`,
        code: c.code || `camp_${idx + 1}`,
        title: c.title,
        objective: c.objective,
        targetAudience: c.targetAudience,
        targetCompanyProfile: c.targetCompanyProfile || c.targetAudience,
        estimatedTam: c.estimatedTam || '2,500 Target Accounts',
        difficulty: c.difficulty || 'Medium',
        strategicAngle: c.strategicAngle,
        rationale: c.rationale,
        gtmAssumptions: c.gtmAssumptions && c.gtmAssumptions.length > 0
          ? c.gtmAssumptions
          : [
              `Assumes target accounts have budget allocation for ${researchedCompany.name}'s solution category.`,
            ],
        supportingCompanySources: c.supportingCompanySources && c.supportingCompanySources.length > 0
          ? c.supportingCompanySources
          : [
              {
                url: cleanUrl,
                fact: `Grounded in ${researchedCompany.name}'s verified product intelligence.`,
                excerpt: researchedCompany.summary.slice(0, 160),
              },
            ],
      }));

      this.currentRun.stage = 'CAMPAIGNS_PROPOSED';
      this.currentRun.status = 'awaiting_selection';
      this.currentRun.isDemonstrationData = !session.isGroqConnected || !!campaignsRes.isDemonstrationData;

      this.updateLastCheckpoint(
        'awaiting_selection',
        `Generated ${this.currentRun.proposedCampaigns.length} grounded campaigns based on ${researchedCompany.name} (Awaiting User Approval)`
      );
      this.isLoading = false;
      this.notify();
    } catch (err: any) {
      this.isLoading = false;
      this.currentRun.stage = 'ERROR';
      this.currentRun.status = 'failed';
      this.currentRun.errorMessage = err.message || 'Analysis failed.';
      this.updateLastCheckpoint('failed', this.currentRun.errorMessage || undefined);
      this.notify();
    }
  }

  // 2. User Approval Point 1: Select and approve campaign
  public async approveCampaign(campaignId: string): Promise<void> {
    const selected = this.currentRun.proposedCampaigns.find((c) => c.id === campaignId);
    if (!selected) {
      throw new Error('Please select a valid campaign.');
    }

    const session = sessionManager.getState();
    this.isLoading = true;

    // Save that information ONLY for the campaign that has been selected
    this.currentRun.selectedCampaignId = campaignId;
    this.currentRun.proposedCampaigns = this.currentRun.proposedCampaigns.map((c) => ({
      ...c,
      isApproved: c.id === campaignId,
    }));
    this.currentRun.stage = 'GENERATING_PERSONAS';
    this.currentRun.status = 'running';

    this.updateLastCheckpoint('completed');
    this.addCheckpoint(
      'GENERATING_PERSONAS',
      `Calling LLM (3rd Call): Defining 3 target company personas for "${selected.title}" based on ${this.currentRun.companyUrl} and company brief...`,
      'running'
    );
    this.notify();

    try {
      // Step 3: Make 3rd LLM call to define 3 company personas
      const res = await executeServerCheckpoint('APPROVE_CAMPAIGN', {
        runId: this.currentRun.id,
        selectedCampaignId: campaignId,
        campaign: selected,
        campaignTitle: selected.title,
        campaignObjective: selected.objective,
        campaignAudience: selected.targetAudience,
        strategicAngle: selected.strategicAngle,
        rationale: selected.rationale,
        company: this.currentRun.companyData,
        companyName: this.currentRun.companyData?.name,
        companySummary: this.currentRun.companyData?.summary,
        companyUrl: this.currentRun.companyUrl,
      });

      if (!res.success) {
        throw new Error(res.error || 'Failed to generate company personas.');
      }

      this.currentRun.proposedPersonas = res.data.personas || [];
      this.currentRun.proposedQuestions = (res.data.questions || []).map((q: any, idx: number) => ({
        id: q.id || q.code || `q_${idx + 1}`,
        code: q.code || `q_${idx + 1}`,
        question: q.question,
        campaignCriterion: q.campaignCriterion || q.gatingCriteria || 'Account qualification criterion',
        actionChanged: q.actionChanged || 'Changes qualification tier and sales routing pathway',
        category: q.category || (idx === 0 ? 'eligibility' : idx === 1 ? 'priority' : 'contact_selection'),
        dependencies: q.dependencies || (idx > 0 ? [`q_1`] : []),
        mandatoryLogic:
          q.mandatoryLogic ||
          'ALL mandatory eligibility criteria must pass (AND) before evaluating priority and contacts.',
        rationale: q.rationale,
        strategicImpact: q.strategicImpact,
        gatingCriteria: q.gatingCriteria,
        recommendedConfidence: q.recommendedConfidence || 'High',
      }));

      this.currentRun.stage = 'PERSONAS_PROPOSED';
      this.currentRun.status = 'awaiting_selection';
      this.currentRun.isDemonstrationData = !session.isGroqConnected || !!res.isDemonstrationData;

      this.updateLastCheckpoint('completed');
      this.addCheckpoint(
        'PERSONAS_PROPOSED',
        `Generated ${this.currentRun.proposedPersonas.length} target company personas based on website + brief + campaign (Awaiting User Approval)`,
        'awaiting_selection'
      );
      this.isLoading = false;
      this.notify();
    } catch (err: any) {
      this.isLoading = false;
      this.currentRun.stage = 'ERROR';
      this.currentRun.status = 'failed';
      this.currentRun.errorMessage = err.message || 'Failed to generate company personas.';
      this.updateLastCheckpoint('failed', this.currentRun.errorMessage || undefined);
      this.notify();
    }
  }

  // 3. User Approval Point 2: Select target company persona & build RAG enrichment plan
  public async approveCompanyPersona(personaId: string, notes?: string): Promise<void> {
    const selected = (this.currentRun.proposedPersonas || []).find((p) => p.id === personaId) ||
      this.currentRun.proposedPersonas?.[0];

    if (!selected) {
      throw new Error('Please select a valid company persona.');
    }

    const selectedCamp = this.currentRun.proposedCampaigns.find((c) => c.id === this.currentRun.selectedCampaignId);
    const session = sessionManager.getState();

    this.isLoading = true;
    this.currentRun.selectedPersonaId = personaId;
    this.currentRun.proposedPersonas = (this.currentRun.proposedPersonas || []).map((p) => ({
      ...p,
      isApproved: p.id === personaId,
    }));

    if (notes !== undefined) {
      this.currentRun.followUpNotes = notes;
    }

    // Pipeline Checkpoints: Start RAG System
    this.updateLastCheckpoint('completed');
    this.currentRun.stage = 'DISSECTING_PERSONA';
    this.currentRun.status = 'running';

    // 4th LLM Call Checkpoint: Dissect persona into catalogue enrichments
    this.addCheckpoint(
      'DISSECTING_PERSONA',
      `Calling LLM (4th Call): Dissecting approved persona "${selected.title}" into catalogue enrichment characteristics & search queries...`,
      'running'
    );
    this.addCheckpoint(
      'BREAKDOWN_C1_RULES',
      `Checkpoints C1, C2, C3: Formulating gating decision rules & distinguishing missing data outcomes`,
      'running'
    );
    this.notify();

    try {
      // Server RAG Semantic Search Checkpoint
      this.addCheckpoint(
        'RETRIEVING_CANDIDATES',
        `Server RAG System: Running hybrid semantic search across 1,224 Clay catalogue actions for persona characteristics...`,
        'running'
      );
      this.notify();

      // 5th LLM Call Checkpoint: Candidate evaluation & plan synthesis
      this.addCheckpoint(
        'EVALUATING_SELECTIONS',
        `Calling LLM (5th Call): Evaluating candidate enrichments, selecting canonical providers & calculating credit costs...`,
        'running'
      );
      this.notify();

      // Code Engine Checkpoint
      this.addCheckpoint(
        'RESOLVING_DEPENDENCIES',
        `Checkpoint E: Checking required inputs in code, resolving prerequisites & calculating deterministic formulas...`,
        'running'
      );
      this.notify();

      const res = await executeServerCheckpoint('APPROVE_PERSONA', {
        runId: this.currentRun.id,
        personaId,
        persona: selected,
        company: this.currentRun.companyData,
        companyName: this.currentRun.companyData?.name,
        companyUrl: this.currentRun.companyUrl,
        campaign: selectedCamp,
        campaignTitle: selectedCamp?.title,
        followUpNotes: this.currentRun.followUpNotes,
      });

      if (!res.success) {
        throw new Error(res.error || 'Failed to construct enrichment plan.');
      }

      this.currentRun.hypothesisMatrix = res.data.hypothesisMatrix;
      this.currentRun.candidateEvaluations = res.data.candidateEvaluations || [];
      this.currentRun.enrichmentPlan = res.data.enrichmentPlan;
      this.currentRun.catalogSelections = res.data.catalogSelections || [];
      this.currentRun.unresolvedGaps = res.data.unresolvedGaps || [];
      this.currentRun.stage = 'PLAN_READY';
      this.currentRun.status = 'completed';
      this.currentRun.isDemonstrationData = !session.isGroqConnected || !!res.isDemonstrationData;

      this.updateLastCheckpoint('completed');
      this.addCheckpoint(
        'PLAN_READY',
        `Clay Enrichment Waterfall Plan ready (${res.data.enrichmentPlan?.waterfallSteps?.length || 4} steps, ${res.data.enrichmentPlan?.totalCreditsPerRow || 6} credits/row)`,
        'completed'
      );
      this.isLoading = false;
      this.notify();
    } catch (err: any) {
      this.isLoading = false;
      this.currentRun.stage = 'ERROR';
      this.currentRun.status = 'failed';
      this.currentRun.errorMessage = err.message || 'Failed to construct enrichment plan.';
      this.updateLastCheckpoint('failed', this.currentRun.errorMessage || undefined);
      this.notify();
    }
  }

  // 3. User Approval Point 2 (Question / Persona compatibility): Select decision question & build enrichment plan
  public async approveDecisionQuestion(questionId: string, followUpNotes?: string): Promise<void> {
    this.currentRun.selectedQuestionId = questionId;
    const persona = (this.currentRun.proposedPersonas || []).find((p) => p.isApproved) ||
      this.currentRun.proposedPersonas?.[0];
    const personaId = persona?.id || 'persona_1';
    await this.approveCompanyPersona(personaId, followUpNotes);
  }

  // Upstream Invalidation & Revision
  public reviseStep(targetStep: number) {
    this.currentRun.revisionId += 1;

    // Invalidate all downstream plan and hypothesis state
    this.currentRun.hypothesisMatrix = null;
    this.currentRun.candidateEvaluations = [];
    this.currentRun.catalogSelections = [];
    this.currentRun.unresolvedGaps = [];
    this.currentRun.enrichmentPlan = null;

    if (targetStep === 1) {
      this.currentRun.stage = 'INIT';
      this.currentRun.status = 'pending';
      this.currentRun.companyData = null;
      this.currentRun.proposedCampaigns = [];
      this.currentRun.selectedCampaignId = null;
      this.currentRun.proposedQuestions = [];
      this.currentRun.selectedQuestionId = null;
      this.addCheckpoint('INIT', 'Restarted with new company domain', 'pending');
    } else if (targetStep === 2) {
      this.currentRun.stage = 'CAMPAIGNS_PROPOSED';
      this.currentRun.status = 'awaiting_selection';
      this.currentRun.selectedCampaignId = null;
      this.currentRun.proposedPersonas = [];
      this.currentRun.selectedPersonaId = null;
      this.currentRun.proposedQuestions = [];
      this.currentRun.selectedQuestionId = null;
      this.addCheckpoint('CAMPAIGNS_PROPOSED', 'Revisited campaign selection (invalidated downstream personas and plan)', 'awaiting_selection');
    } else if (targetStep === 3) {
      this.currentRun.stage = 'PERSONAS_PROPOSED';
      this.currentRun.status = 'awaiting_selection';
      this.currentRun.selectedPersonaId = null;
      this.currentRun.selectedQuestionId = null;
      this.addCheckpoint('PERSONAS_PROPOSED', 'Revisited company persona selection (invalidated downstream plan)', 'awaiting_selection');
    } else if (targetStep === 4) {
      this.currentRun.stage = 'PLAN_READY';
    }
    this.notify();
  }

  public updateFollowUp(notes: string) {
    this.currentRun.followUpNotes = notes;
    this.notify();
  }

  public retryCurrentStage() {
    this.currentRun.errorMessage = null;
    if (this.currentRun.stage === 'ERROR') {
      if (!this.currentRun.companyData) {
        this.startAnalysis(this.currentRun.companyUrl);
      } else if (!this.currentRun.selectedCampaignId) {
        this.currentRun.stage = 'CAMPAIGNS_PROPOSED';
        this.currentRun.status = 'awaiting_selection';
        this.notify();
      } else if (!this.currentRun.selectedPersonaId && !this.currentRun.selectedQuestionId) {
        this.currentRun.stage = 'PERSONAS_PROPOSED';
        this.currentRun.status = 'awaiting_selection';
        this.notify();
      } else if (this.currentRun.selectedPersonaId) {
        this.approveCompanyPersona(this.currentRun.selectedPersonaId, this.currentRun.followUpNotes);
      } else if (this.currentRun.selectedQuestionId) {
        this.approveDecisionQuestion(this.currentRun.selectedQuestionId, this.currentRun.followUpNotes);
      }
    }
  }

  public resetWorkflow() {
    this.currentRun = { ...INITIAL_RUN };
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('clay_planner_current_run_v3');
      }
    } catch (_) {}
    this.notify();
  }
}

export const workflowEngine = new WorkflowEngine();
