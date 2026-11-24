// Workflow State, Data Models & Checkpoint Specifications
// Supports full GTM campaign planning, decision questions, granular hypotheses,
// catalogue retrieval evaluations, dependency resolution, and billing calculations.

export type WorkflowStage =
  | 'INIT'
  | 'FETCHING_WEBSITE'
  | 'ANALYZING_COMPANY'
  | 'CAMPAIGNS_PROPOSED'
  | 'GENERATING_PERSONAS'
  | 'PERSONAS_PROPOSED'
  | 'DISSECTING_PERSONA'
  | 'GENERATING_QUESTIONS'
  | 'QUESTIONS_PROPOSED'
  | 'BUILDING_PLAN'
  | 'BREAKDOWN_C1_RULES'
  | 'BREAKDOWN_C2_OUTCOMES'
  | 'BREAKDOWN_C3_EVIDENCE'
  | 'RETRIEVING_CANDIDATES'
  | 'EVALUATING_SELECTIONS'
  | 'RESOLVING_DEPENDENCIES'
  | 'PLAN_READY'
  | 'ERROR';

export type CheckpointStatus =
  | 'pending'
  | 'running'
  | 'awaiting_selection'
  | 'awaiting_credentials'
  | 'completed'
  | 'failed';

export interface GroqModel {
  id: string;
  created?: number;
  owned_by?: string;
}

export interface SessionState {
  userId: string | null;
  isAnonymous: boolean;
  isAnonymousAuth?: boolean;
  isGroqConnected: boolean;
  isTestingKey?: boolean;
  connectionError?: string | null;
  selectedModel: string;
  availableModels: GroqModel[];
  groqKeyInMemory: string | null;
  llmProvider?: 'groq' | 'openai' | 'openrouter' | 'anthropic';
}

export interface Checkpoint {
  id: string;
  stage: WorkflowStage;
  label: string;
  timestamp: string;
  status: CheckpointStatus;
  leaseToken?: string;
  leasedUntil?: string;
  idempotencyKey?: string;
  error?: string;
  details?: Record<string, any>;
}

export interface SourceLink {
  title: string;
  url: string;
  badge: string;
  excerpt?: string;
  byteCount?: number;
}

export interface CompanyData {
  name: string;
  domain: string;
  industry: string;
  summary: string;
  icpSummary: string;
  valueProposition: string;
  techStack: string[];
  targetBuyerPersonas?: string[];
  sourceLinks: SourceLink[];
  scrapedExcerpt?: string;
  isManualDescription?: boolean;
}

export interface CampaignOption {
  id: string;
  code?: string;
  title: string;
  objective: string;
  targetAudience: string;
  targetCompanyProfile: string;
  estimatedTam: string;
  difficulty: 'Low' | 'Medium' | 'High';
  strategicAngle: string;
  rationale: string;
  gtmAssumptions: string[]; // Explicitly labeled model-generated GTM assumptions
  supportingCompanySources: Array<{
    url: string;
    excerpt: string;
    fact: string;
  }>;
  isApproved?: boolean;
}

export type QuestionCategory = 'discovery' | 'eligibility' | 'priority' | 'contact_selection';

export interface DecisionQuestion {
  id: string;
  code?: string;
  question: string;
  campaignCriterion: string;
  actionChanged: string; // The action its answer changes (e.g. "Disqualify immediately", "Route to Tier-1 AE")
  category: QuestionCategory;
  dependencies: string[]; // IDs of questions/criteria it relies upon
  mandatoryLogic: string; // How mandatory criteria combine (e.g. "ALL mandatory eligibility criteria must pass (AND) before priority")
  rationale: string;
  strategicImpact: string;
  gatingCriteria: string;
  recommendedConfidence: 'High' | 'Medium' | 'Low';
  isSelected?: boolean;
}

// Target Company Persona (Account ICP Archetype - persona of the company, not of the person)
export interface CompanyPersona {
  id: string;
  code?: string;
  title: string;
  archetype: string;
  industry: string;
  companySize: string;
  geography: string;
  techInfrastructure: string;
  operationalProfile: string;
  businessPainAndFriction: string;
  buyingTriggers: string[];
  whyThisCompanyFitsCampaign: string;
  qualificationCriteria: string[];
  recommendedConfidence: 'High' | 'Medium' | 'Low';
  isApproved?: boolean;
}

// Dissected Characteristic of a Target Company Persona (for RAG catalogue retrieval)
export interface PersonaCharacteristic {
  id: string;
  name: string;
  facet: 'firmographics' | 'technographics' | 'operational_profile' | 'buying_triggers' | 'contact_discovery';
  searchQuery: string;
  targetSignal: string;
  requiredInputs: string[];
  qualificationRule: string;
  rationale: string;
}

// Checkpoint C1: Hypotheses & Decision Rules
export interface DecisionRule {
  ruleId: string;
  ruleStatement: string;
  userSuppliedFacts: string[];
  proposedAssumptions: string[];
  threshold: string;
  timeWindow: string;
}

// Checkpoint C2: Possible Answers & Resulting Actions
export interface RuleOutcome {
  ruleId: string;
  indicatorStatus: 'Positive' | 'Negative' | 'Insufficient_Evidence';
  statusLabel: string; // e.g. "Condition Confirmed True", "Condition Confirmed False", "No Data / Insufficient Evidence"
  actionPathway: string; // specific operational action to take
  isMissingDataDistinct: boolean; // Flag proving missing data != condition failure
  evidenceRequirements: string[];
}

// Checkpoint C3: Evidence Requirements
export interface EvidenceRequirementDetail {
  id: string;
  ruleId: string;
  observationName: string;
  requiredFields: string[];
  timeCoverage: string;
  completenessThreshold: string;
  isResolved?: boolean;
  selectedCatalogueId?: string;
}

export interface HypothesisMatrix {
  coreHypothesis: string;
  rules: DecisionRule[];
  possibleAnswers: RuleOutcome[];
  evidenceRequirements: EvidenceRequirementDetail[];
}

export interface CandidateEvaluationResult {
  requirementId: string;
  evidenceRequirement: string;
  coverage: 'full' | 'partial' | 'insufficient';
  selectedCatalogueId: string | null;
  selectedActionName?: string;
  selectedProvider?: string;
  sourceBackedReason: string;
  remainingGaps: string[];
  candidateRecords: Array<{
    xId: string;
    canonicalName: string;
    provider: string;
    explanation: string;
    costValue: number | null;
  }>;
}

export interface PrerequisiteDependency {
  actionId: string;
  actionName: string;
  requiredInput: string;
  providedByActionId?: string;
  providedByActionName?: string;
  status: 'satisfied' | 'resolved_via_prerequisite' | 'unresolved_gap';
}

export interface BillingFormulaDetail {
  actionId: string;
  provider: string;
  actionName: string;
  billingUnit: string;
  baseCost: number | null;
  isEstimate: boolean;
  estimatedMatchRate: number; // e.g. 0.65
  accountVolume: number; // e.g. 1000
  formulaText: string;
  estimatedCreditsTotal: number;
}

export interface WaterfallStep {
  stepNumber: number;
  columnName: string;
  provider: string;
  catalogueId: string; // e.g. X_0012
  costCredits: number;
  costUnit?: string;
  purpose: string;
  evidenceSupplied: string;
  prerequisites: string[];
  supportedDecisions: string;
  limitations: string;
  sourceProvenance: string;
  failoverStrategy: string;
}

export interface EnrichmentPlan {
  title: string;
  strategySummary: string;
  totalCreditsPerRow: number;
  accountVolume: number;
  estimatedCostPerThousand: string;
  waterfallSteps: WaterfallStep[];
  billingFormulas: BillingFormulaDetail[];
  dependencyGraph: PrerequisiteDependency[];
  gtmAssumptions: string[];
}

export interface CatalogSelection {
  provider: string;
  category: string;
  catalogueId?: string;
  costCredits: number;
  dataSupplied: string;
  sourceRow?: number;
}

export interface UnresolvedGap {
  gapName: string;
  impact: string;
  mitigationAdvice: string;
  prerequisiteNeeded?: string;
}

export interface CampaignRun {
  id: string;
  userId?: string;
  createdAt: string;
  updatedAt: string;
  companyUrl: string;
  stage: WorkflowStage;
  status: CheckpointStatus;
  revisionId: number;
  isDemonstrationData: boolean;
  companyData: CompanyData | null;
  proposedCampaigns: CampaignOption[];
  selectedCampaignId: string | null;
  proposedPersonas: CompanyPersona[];
  selectedPersonaId: string | null;
  proposedQuestions: DecisionQuestion[];
  selectedQuestionId: string | null;
  followUpNotes: string;
  hypothesisMatrix: HypothesisMatrix | null;
  candidateEvaluations: CandidateEvaluationResult[];
  enrichmentPlan: EnrichmentPlan | null;
  catalogSelections: CatalogSelection[];
  unresolvedGaps: UnresolvedGap[];
  checkpoints: Checkpoint[];
  errorMessage: string | null;
}
