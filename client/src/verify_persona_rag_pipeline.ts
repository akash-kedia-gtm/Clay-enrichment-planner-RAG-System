import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock localStorage
const mockStorage = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (key: string) => mockStorage.get(key) || null,
  setItem: (key: string, val: string) => mockStorage.set(key, String(val)),
  removeItem: (key: string) => mockStorage.delete(key),
  clear: () => mockStorage.clear(),
};

// Seed catalogue
const cataloguePath = path.resolve(__dirname, '../public/data/catalogue.json');
const catalogueData = JSON.parse(fs.readFileSync(cataloguePath, 'utf-8'));

const originalFetch = globalThis.fetch;
globalThis.fetch = async (url: any, opts: any) => {
  const urlStr = String(url);
  if (urlStr.includes('/data/catalogue.json')) {
    return {
      ok: true,
      status: 200,
      json: async () => catalogueData,
    } as any;
  }
  return originalFetch(url, opts);
};

import { workflowEngine } from './services/workflowEngine';
import { setCatalogueCache, searchCatalogueCandidates } from './services/catalogueService';

setCatalogueCache(catalogueData);

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

async function runPersonaRagTest() {
  console.log('================================================================');
  console.log('VERIFYING TARGET COMPANY PERSONA APPROVAL & RAG SYSTEM (CALLS 4 & 5)');
  console.log('================================================================\n');

  workflowEngine.resetWorkflow();

  // 1. Start Analysis (1st & 2nd LLM Calls)
  console.log('Step 1: Analyzing website https://linear.app');
  await workflowEngine.startAnalysis('https://linear.app');
  let run = workflowEngine.getRun();
  assert(run.stage === 'CAMPAIGNS_PROPOSED', 'Must reach CAMPAIGNS_PROPOSED');
  assert(run.proposedCampaigns.length >= 3, 'Must have 3 campaigns');

  // 2. Approve Campaign (3rd LLM Call: Generate 3 Company Personas)
  console.log('\nStep 2: Approving Campaign:', run.proposedCampaigns[0].title);
  await workflowEngine.approveCampaign(run.proposedCampaigns[0].id);
  run = workflowEngine.getRun();
  assert(run.stage === 'PERSONAS_PROPOSED', 'Must reach PERSONAS_PROPOSED');
  assert(run.proposedPersonas.length >= 3, 'Must have 3 company personas');
  assert(run.selectedCampaignId === run.proposedCampaigns[0].id, 'Selected campaign saved');

  const chosenPersona = run.proposedPersonas[0];
  console.log(`\nStep 3: Company Personas Proposed:`);
  run.proposedPersonas.forEach((p, i) => {
    console.log(`  [${i + 1}] ${p.title} (${p.archetype}, ${p.companySize})`);
  });

  // 3. User Approves Company Persona -> Triggers 4th Call (Dissection) + Server RAG + 5th Call (Plan & Cost)
  console.log(`\nStep 4: User Approves Persona "${chosenPersona.title}"`);
  await workflowEngine.approveCompanyPersona(chosenPersona.id, 'Prioritize verified technographics & hiring velocity');
  run = workflowEngine.getRun();

  console.log('\nStep 5: Verifying RAG System Outputs:');
  assert(run.selectedPersonaId === chosenPersona.id, 'Selected persona ID must be saved');
  assert(run.stage === 'PLAN_READY', `Stage must be PLAN_READY, got ${run.stage}`);
  assert(run.status === 'completed', `Status must be completed, got ${run.status}`);

  // Checkpoints audit
  const stages = run.checkpoints.map((c) => c.stage);
  console.log('  Checkpoints Logged:', stages);
  assert(stages.includes('DISSECTING_PERSONA'), 'Must record DISSECTING_PERSONA (Call 4)');
  assert(stages.includes('RETRIEVING_CANDIDATES'), 'Must record RETRIEVING_CANDIDATES (Server RAG)');
  assert(stages.includes('EVALUATING_SELECTIONS'), 'Must record EVALUATING_SELECTIONS (Call 5)');
  assert(stages.includes('RESOLVING_DEPENDENCIES'), 'Must record RESOLVING_DEPENDENCIES (Code Engine)');
  assert(stages.includes('PLAN_READY'), 'Must record PLAN_READY');

  // Plan audit
  assert(run.enrichmentPlan !== null, 'Enrichment plan must be constructed');
  assert(run.enrichmentPlan!.waterfallSteps.length > 0, 'Waterfall steps must exist');
  assert(run.enrichmentPlan!.billingFormulas.length > 0, 'Billing formulas must exist');
  assert(run.enrichmentPlan!.dependencyGraph.length > 0, 'Dependency graph must exist');
  assert(run.enrichmentPlan!.totalCreditsPerRow > 0, 'Total credits per row must be computed');
  assert(run.candidateEvaluations.length > 0, 'Candidate evaluations must exist');
  assert(run.catalogSelections.length > 0, 'Catalog selections must exist');

  console.log(`  Enrichment Plan Title: "${run.enrichmentPlan!.title}"`);
  console.log(`  Total Credits / Row: ${run.enrichmentPlan!.totalCreditsPerRow} credits`);
  console.log(`  Cost / 1,000 Accounts: ${run.enrichmentPlan!.estimatedCostPerThousand}`);
  console.log(`  Waterfall Steps: ${run.enrichmentPlan!.waterfallSteps.length}`);
  run.enrichmentPlan!.waterfallSteps.forEach((s) => {
    console.log(`    Step ${s.stepNumber}: [${s.catalogueId}] ${s.columnName} (${s.provider}) - ${s.costCredits} cr`);
  });

  console.log('\n================================================================');
  console.log('RAG PIPELINE END-TO-END VERIFICATION: PASSED SUCCESSFULLY!');
  console.log('================================================================');
}

runPersonaRagTest().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});

