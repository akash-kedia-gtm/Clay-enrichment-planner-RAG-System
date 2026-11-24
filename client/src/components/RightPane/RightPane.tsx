import React from 'react';
import { StageTracker } from './StageTracker';
import { CompanyInfoCard } from './CompanyInfoCard';
import { CampaignOverviewCard } from './CampaignOverviewCard';
import { DecisionQuestionCard } from './DecisionQuestionCard';
import { HypothesisMatrixCard } from './HypothesisMatrixCard';
import { CatalogAndCostCard } from './CatalogAndCostCard';
import { CampaignRun } from '../../types/workflow';

interface RightPaneProps {
  run: CampaignRun;
  isLoading: boolean;
}

export const RightPane: React.FC<RightPaneProps> = ({ run, isLoading }) => {
  return (
    <div className="space-y-6">
      {/* Stage Tracker & Completed Checkpoints */}
      <StageTracker stage={run.stage} status={run.status} checkpoints={run.checkpoints} />

      {/* 2-Column Grid: Company Intelligence & Campaign Options */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* 1. Company Information, Scraped Excerpts & Provenance */}
        <CompanyInfoCard companyData={run.companyData} isLoading={isLoading} />

        {/* 2. Proposed Campaigns & Selected Campaign with GTM Assumptions */}
        <CampaignOverviewCard
          proposedCampaigns={run.proposedCampaigns}
          selectedCampaignId={run.selectedCampaignId}
        />
      </div>

      {/* 2-Column Grid: Target Company Personas & Hypothesis Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* 3. Target Company Personas, Decision Questions & Selected Gate */}
        <DecisionQuestionCard
          personas={run.proposedPersonas}
          selectedPersonaId={run.selectedPersonaId}
          proposedQuestions={run.proposedQuestions}
          selectedQuestionId={run.selectedQuestionId}
        />

        {/* 4. Checkpoints C1, C2, C3: Hypotheses, Outcomes & Evidence Requirements */}
        <HypothesisMatrixCard matrix={run.hypothesisMatrix} />
      </div>

      {/* 5. Retrieved Catalogue Records, Prerequisite Graph, Billing Formulas and Unresolved Gaps */}
      <CatalogAndCostCard
        catalogSelections={run.catalogSelections}
        unresolvedGaps={run.unresolvedGaps}
        billingFormulas={run.enrichmentPlan?.billingFormulas}
        dependencyGraph={run.enrichmentPlan?.dependencyGraph}
        totalCredits={run.enrichmentPlan?.totalCreditsPerRow}
        costPerThousand={run.enrichmentPlan?.estimatedCostPerThousand}
      />
    </div>
  );
};
