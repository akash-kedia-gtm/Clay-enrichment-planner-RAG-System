// GTM Method & Task Instructions Manager
// Keeps task instructions separately editable so users can refine prompts and GTM methods.
// Supports custom overrides stored locally or passed directly into Groq requests.

export interface GtmTaskInstruction {
  task: string;
  name: string;
  description: string;
  defaultPrompt: string;
  userPromptOverride?: string;
}

const DEFAULT_INSTRUCTIONS: Record<string, GtmTaskInstruction> = {
  RESEARCH_COMPANY: {
    task: 'RESEARCH_COMPANY',
    name: '1. Company Website Intelligence & ICP Discovery',
    description: 'Researches the company based on its website link and domain to extract real offerings, problem solved, ICP, target buyer personas, and value proposition.',
    defaultPrompt: `You are a Principal B2B Market Researcher and Company Intelligence Analyst.
Task: Thoroughly research and analyze the company based strictly on the provided website excerpt, title, metadata, and domain.

CRITICAL INSTRUCTIONS:
1. Ground your analysis strictly in what this company ACTUALLY offers as detailed in the website excerpt. Do NOT guess, hallucinate, or rely on vague generic assumptions.
2. Identify the official company name (e.g. from the Title or header), primary domain, and specific industry.
3. Analyze what this company actually does:
   - What core product(s) or service(s) do they provide? (Cite specific product names and features mentioned in the excerpt)
   - What specific business or technical problem do they solve for customers?
   - What is their core value proposition and differentiation?
   - What is their Ideal Customer Profile (ICP) - target company size, industry, tech sophistication?
   - Who are the primary target buyer personas (job titles / roles)?
   - What detected or likely technologies/platforms are associated with their product or customers?
4. Output MUST strictly follow the JSON schema.`,
  },
  PROPOSE_CAMPAIGNS: {
    task: 'PROPOSE_CAMPAIGNS',
    name: '2. Grounded Outbound Campaign Synthesis',
    description: 'Synthesizes exactly 3 concrete outbound campaigns strictly grounded in the researched company data, avoiding arbitrary GTM templates.',
    defaultPrompt: `You are an expert Outbound Go-To-Market Strategist and Campaign Architect.
Task: Formulate exactly 3 concrete, distinct outbound acquisition campaign suggestions designed specifically for this company.

CRITICAL INSTRUCTIONS - GROUNDED IN REAL COMPANY INFO:
1. Ground every campaign in what this company ACTUALLY sells and who their real buyers are.
2. Do NOT use arbitrary, random, or generic GTM filler templates (do NOT say "Companies using AWS" or "50+ employees" unless AWS or employee count is directly relevant to this company's product).
3. The 3 campaigns must represent 3 distinct strategic angles:
   - Campaign 1 (Pain Point / Incumbent Displacement): Focuses on prospects experiencing acute friction with legacy incumbents or manual alternatives that this company replaces.
   - Campaign 2 (Trigger Event / Organizational Growth): Focuses on companies undergoing specific triggers (e.g. rapid department hiring, recent funding, tech stack changes, expanding to new markets) where this company's product becomes a priority.
   - Campaign 3 (High-Fit ICP / Sweet-Spot Vertical): Focuses on the ideal niche or specialized segment where this company delivers immediate 10x ROI.
4. For each of the 3 campaigns:
   - code: "camp_1", "camp_2", "camp_3"
   - title: Clear, compelling title reflecting the specific strategy
   - objective: Concrete business goal of the campaign
   - targetAudience: Specific buyer personas (job titles) and target company profile
   - targetCompanyProfile: Headcount range, industry, geography, technical profile
   - estimatedTam: Realistic estimated number of target accounts
   - difficulty: "Low" | "Medium" | "High"
   - strategicAngle: The specific hook, value angle, or reason why outreach converts
   - rationale: Why this strategy works specifically for THIS company's product
   - gtmAssumptions: 2-3 realistic operational assumptions grounded in this campaign
   - supportingCompanySources: Exact facts, features, or value props from the company's website that support this campaign
Output MUST strictly follow the JSON schema.`,
  },
  ANALYZE_COMPANY_AND_PROPOSE_CAMPAIGNS: {
    task: 'ANALYZE_COMPANY_AND_PROPOSE_CAMPAIGNS',
    name: 'A. Company Analysis & Campaign Synthesis (Unified)',
    description: 'Extracts ICP profile, detected tech stack, value proposition, and synthesizes 3 strategic outbound campaigns with explicitly labeled GTM assumptions and website source citations.',
    defaultPrompt: `You are a Principal B2B Go-To-Market Architect and Clay Enrichment Specialist.
Task: Analyze the provided target company public website excerpts and domain facts.
1. Extract company name, industry, value proposition, target customer segment (ICP), and detected tech stack.
2. Synthesize 3 distinct outbound campaign options designed to find and win revenue for this company.
3. For each campaign:
   - Ground every campaign in what this company actually sells. Do NOT use arbitrary or random GTM templates.
   - Provide objective, target audience, estimated TAM, execution difficulty, and strategic angle.
   - Detail the target-company profile (ideal employee count, geography, tech maturity).
   - State the strategic rationale.
   - Explicitly list 2-3 model-generated GTM assumptions (e.g. "Assumes ACV >= $20k justifies multi-touch enrichment").
   - Cite supporting company sources (exact facts or excerpts found in the website context).
Output MUST strictly follow the JSON schema.`,
  },
  GENERATE_COMPANY_PERSONAS: {
    task: 'GENERATE_COMPANY_PERSONAS',
    name: '3. Target Company Personas Generation',
    description: 'Generates exactly 3 distinct personas of companies to target based on the website, company brief, and selected campaign.',
    defaultPrompt: `You are a Principal B2B Go-To-Market Architect and Account Profiling Specialist.
Task: Given the company running this outbound campaign, its verified website brief, and the approved campaign, define exactly 3 distinct personas of COMPANIES that we can target.

CRITICAL INSTRUCTIONS:
1. The persona is of the COMPANY, NOT of the person. Do NOT define individual buyer job title profiles (e.g. do not say "John the VP of Sales"); define the organizational ICP profile of the target company itself.
2. Logic: Given this approved campaign and the company running it, who is most likely to be the target persona, and what does that persona look like from a company perspective?
3. Generate exactly 3 distinct company personas representing 3 realistic segments:
   - Persona 1 (Core Bullseye Fit): The direct sweet-spot company profile with acute, immediate need for this offering.
   - Persona 2 (High-Velocity / Scaling Fit): Fast-growing or transitioning organizations experiencing trigger events that accelerate buying.
   - Persona 3 (Specialized Strategic Niche): A distinct vertical, sub-sector, or high-value operating archetype where the offering delivers outsized ROI.
4. For each company persona, output:
   - code: "persona_1", "persona_2", "persona_3"
   - title: Descriptive name of the company persona (e.g., "Tier-1 Quantitative Hedge Funds & Multi-Strategy Asset Managers")
   - archetype: Organizational category (e.g., "Mid-Market Enterprise Asset Manager")
   - industry: Specific industry and niche
   - companySize: Company size (headcount range, revenue / AUM / transaction volume)
   - geography: Geographic presence
   - techInfrastructure: Key technology platforms or infrastructure they typically run
   - operationalProfile: How this company operates internally and where operational bottlenecks occur
   - businessPainAndFriction: Specific business pain, risk, or inefficiency this company suffers without our solution
   - buyingTriggers: 2-3 concrete company events or signals that make this company buy right now
   - whyThisCompanyFitsCampaign: Detailed rationale for why this company persona is the best fit for the approved campaign
   - qualificationCriteria: 2-3 objective gating criteria questions/rules to qualify accounts in Clay (e.g., "Company manages >$250M AUM and files SEC Form 13F")
   - recommendedConfidence: "High" | "Medium" | "Low"
Output MUST strictly follow the JSON schema.`,
  },
  DISSECT_PERSONA_ENRICHMENTS: {
    task: 'DISSECT_PERSONA_ENRICHMENTS',
    name: '4. Persona Dissection & Enrichment Identification',
    description: 'Dissects the approved company persona into 3-5 concrete enrichment characteristics with high-precision semantic search queries to find matching actions in the Clay catalogue.',
    defaultPrompt: `You are a Principal B2B Go-To-Market Architect and Clay Catalogue Integration Engineer.
Task: Dissect the approved target company persona into the exact enrichment characteristics and verification signals needed to find and verify all characteristics of the persona in the Clay catalogue.

CRITICAL INSTRUCTIONS:
1. Ground the dissection strictly in the approved company persona's industry, company size, tech infrastructure, operational profile, and buying triggers.
2. Identify 3 to 5 concrete characteristics that must be verified or enriched in Clay to qualify and reach accounts matching this company persona:
   - Firmographics (headcount, revenue, AUM, corporate classification, geography)
   - Technographics / Tech Stack (detected software, cloud infrastructure, development tools, platforms)
   - Operational Profile & Governance (business activity, compliance filings, certificates, locations)
   - Buying Triggers & Growth Signals (job postings, department hiring trends, recent executive appointments)
   - Contact Discovery (finding verified work email and phone numbers for buying committee personas)
3. For each characteristic:
   - id: "char_1", "char_2", etc.
   - name: Clear descriptive name (e.g., "Company Technographic Stack Detection", "Firmographic Employee Headcount & Revenue Verification")
   - facet: "firmographics" | "technographics" | "operational_profile" | "buying_triggers" | "contact_discovery"
   - searchQuery: High-precision semantic search query tailored to retrieve the most suitable action from Clay's 1,224 integration actions (e.g. "detect company technographics cloud infrastructure AWS Bloomberg", "find company employee headcount revenue firmographics", "find company active job postings department hiring growth", "find verified work email phone decision maker")
   - targetSignal: Specific data signal required (e.g., "Installed tech stack list", "Employee headcount range", "Active job count")
   - requiredInputs: The required inputs available from preceding steps (e.g. ["company_domain"], ["company_domain", "job_title"])
   - qualificationRule: The gating threshold or criterion to qualify this persona (e.g. "Headcount between 50-500", "Must have active engineering job postings")
   - rationale: Why this enrichment is required to verify this company persona
Output MUST strictly follow the JSON schema.`,
  },
  GENERATE_DECISION_QUESTIONS: {
    task: 'GENERATE_DECISION_QUESTIONS',
    name: 'B. Decision Questions Formulation',
    description: 'Generates comprehensive gating decision questions covering discovery, eligibility, priority, buying signals, and contact selection.',
    defaultPrompt: `You are a GTM Strategist designing an account qualification gate.
For the approved campaign and target company context:
1. Generate all required decision questions needed to execute this campaign.
2. A company-finding campaign requires separate questions covering:
   - Discovery (how accounts are sourced)
   - Eligibility (mandatory fit criteria: industry, geography, size)
   - Priority (scoring & tiering based on buying signals, tech stack, hiring)
   - Contact Selection (identifying buying committee personas)
3. For each question:
   - State the campaign criterion it evaluates.
   - Specify the exact operational action its answer changes (e.g., "Disqualify immediately", "Route to Tier-1 Enterprise AE", "Enrich VP Sales verified email").
   - Classify category: 'discovery' | 'eligibility' | 'priority' | 'contact_selection'.
   - List question dependencies (which criteria it relies upon).
   - Define mandatory logic (e.g. "ALL mandatory eligibility criteria must pass (AND) before evaluating priority").
Output MUST strictly follow the JSON schema.`,
  },
  BREAKDOWN_C1_RULES: {
    task: 'BREAKDOWN_C1_RULES',
    name: 'C1. Decision Rules & Hypotheses',
    description: 'Defines one or more hypotheses or decision rules with user-supplied facts, proposed assumptions, thresholds, and time windows.',
    defaultPrompt: `You are a Decision Logic Engineer.
For the chosen gating decision question:
1. Formulate the core qualification hypothesis.
2. Define 1 to 3 explicit decision rules.
3. For each rule:
   - Identify user-supplied facts (from company context or parameters).
   - State proposed GTM assumptions.
   - Define concrete numerical or categorical thresholds (e.g., "Headcount >= 50", "Job postings >= 2").
   - Define time windows (e.g., "Last 60 days", "Past 6 months").
Output MUST strictly follow the JSON schema.`,
  },
  BREAKDOWN_C2_OUTCOMES: {
    task: 'BREAKDOWN_C2_OUTCOMES',
    name: 'C2. Possible Answers & Resulting Actions',
    description: 'Defines possible answers and resulting actions, including Insufficient Evidence. Distinguishes missing data from condition failure.',
    defaultPrompt: `For each formulated decision rule:
1. Define the possible outcomes:
   - Positive ("Condition Confirmed True"): condition is verified, trigger qualified action pathway.
   - Negative ("Condition Confirmed False"): condition verified not met, trigger disqualification or non-priority path.
   - Insufficient Evidence ("No Data / Inconclusive"): crucial distinction! Missing data must NOT be treated as condition failure. Trigger fallback search or manual SDR review.
2. For each outcome, detail the operational action pathway and initial evidence requirements.
Output MUST strictly follow the JSON schema.`,
  },
  BREAKDOWN_C3_EVIDENCE: {
    task: 'BREAKDOWN_C3_EVIDENCE',
    name: 'C3. Evidence Requirements Specification',
    description: 'Specifies the observations, fields, time coverage, and completeness needed to distinguish outcomes.',
    defaultPrompt: `For each decision rule and outcome:
1. Specify the concrete observations needed (e.g. "Active engineering hiring for Kubernetes").
2. Specify exact data fields required (e.g., ["job_title", "posted_at", "location", "department"]).
3. Specify required time coverage (e.g. "Active within past 45 days").
4. Specify completeness threshold (e.g., "At least 1 verified match; 100% confidence on company domain").
Output MUST strictly follow the JSON schema.`,
  },
  EVALUATE_CATALOGUE_SELECTIONS: {
    task: 'EVALUATE_CATALOGUE_SELECTIONS',
    name: 'D. Catalogue Evaluation & Candidate Selection',
    description: 'Evaluates retrieved Clay catalogue candidates against evidence requirements, assessing full/partial/insufficient coverage and citing metadata.',
    defaultPrompt: `You are a Master Clay Solutions Architect.
Evaluate the candidate Clay actions retrieved from the 1,224-action catalogue against the specified evidence requirements.
1. Determine coverage level for each requirement: 'full', 'partial', or 'insufficient'.
2. Select the optimal catalogue action ID (e.g. X_0012) based on documented provider capabilities and input prerequisites.
3. Provide source-backed reasons citing the provider and capability explanation.
4. If candidate actions do not cover the evidence requirement, explicitly declare an unresolved gap with mitigation advice.
Output MUST strictly follow the JSON schema.`,
  },
};

class GtmPromptManager {
  private instructions: Record<string, GtmTaskInstruction>;

  constructor() {
    this.instructions = { ...DEFAULT_INSTRUCTIONS };
    try {
      const saved = localStorage.getItem('clay_planner_gtm_instructions_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        Object.keys(parsed).forEach((key) => {
          if (this.instructions[key]) {
            this.instructions[key].userPromptOverride = parsed[key].userPromptOverride;
          }
        });
      }
    } catch (_) {}
  }

  public getAll(): GtmTaskInstruction[] {
    return Object.values(this.instructions);
  }

  public getInstruction(task: string): string {
    const item = this.instructions[task];
    if (item && item.userPromptOverride && item.userPromptOverride.trim()) {
      return item.userPromptOverride.trim();
    }
    return item ? item.defaultPrompt : '';
  }

  public updateInstruction(task: string, override: string) {
    if (this.instructions[task]) {
      this.instructions[task].userPromptOverride = override.trim() || undefined;
      this.persist();
    }
  }

  public resetInstruction(task: string) {
    if (this.instructions[task]) {
      delete this.instructions[task].userPromptOverride;
      this.persist();
    }
  }

  public resetAll() {
    this.instructions = { ...DEFAULT_INSTRUCTIONS };
    this.persist();
  }

  private persist() {
    try {
      localStorage.setItem('clay_planner_gtm_instructions_v1', JSON.stringify(this.instructions));
    } catch (_) {}
  }
}

export const gtmPromptManager = new GtmPromptManager();

