import React, { useState } from 'react';
import { Step1UrlInput } from './Step1UrlInput';
import { Step2CampaignSelection } from './Step2CampaignSelection';
import { Step3QuestionSelection } from './Step3QuestionSelection';
import { Step4FollowUp } from './Step4FollowUp';
import { Step5EnrichmentPlan } from './Step5EnrichmentPlan';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ErrorBanner } from '../common/ErrorBanner';
import { CampaignRun, SessionState } from '../../types/workflow';
import { workflowEngine } from '../../services/workflowEngine';
import { Key, Sparkles, ShieldCheck } from 'lucide-react';

interface LeftPaneProps {
  run: CampaignRun;
  sessionState: SessionState;
  isLoading: boolean;
  onOpenKeyModal: () => void;
}

export const LeftPane: React.FC<LeftPaneProps> = ({
  run,
  sessionState,
  isLoading,
  onOpenKeyModal,
}) => {
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);

  const selectedCamp = run.proposedCampaigns.find((c) => c.id === run.selectedCampaignId);
  const selectedQuestion = run.proposedQuestions.find((q) => q.id === run.selectedQuestionId);

  return (
    <div className="bg-white border border-[#E5E0D6] rounded-2xl shadow-sm p-4 sm:p-6 flex flex-col relative">
      {/* Missing LLM Key Banner */}
      {!sessionState.isGroqConnected && (
        <div className="mb-3.5 p-3 bg-[#FFF6ED] border border-[#FFD5C7] rounded-xl text-[11px] text-[#A72D07] flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2">
            <Key className="w-3.5 h-3.5 text-[#FF4713] flex-shrink-0" />
            <span>
              <strong>Connect your LLM key to continue.</strong> Real-time requests require your personal LLM key.
            </span>
          </div>
          <button
            onClick={onOpenKeyModal}
            className="px-2.5 py-1 font-bold text-[10px] bg-[#FF4713] hover:bg-[#E03E0F] text-white rounded-lg shadow-2xs transition flex-shrink-0"
          >
            Connect LLM Key
          </button>
        </div>
      )}

      {/* Demonstration Data Banner if showing sample output */}
      {run.isDemonstrationData && (
        <div className="mb-3.5 p-2 bg-[#F5F8D5] border border-[#DFE8A8] rounded-xl text-[10px] text-[#4A5404] flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#CBD810]"></span>
            <span className="font-semibold">Sample Demonstration Active:</span>
            <span>
              {sessionState.isGroqConnected
                ? 'Displaying verified sample enrichment output. Subsequent actions will run live with your connected LLM.'
                : 'Displaying verified sample enrichment output. Connect your key for live AI execution.'}
            </span>
          </div>
        </div>
      )}

      {/* Workflow Navigation Stepper */}
      <div className="flex items-center gap-1.5 pb-3.5 mb-4 border-b border-[#E5E0D6] overflow-x-auto text-[10px] font-semibold">
        <button
          onClick={() => workflowEngine.reviseStep(1)}
          className={`px-2.5 py-1 rounded-md transition ${
            run.stage === 'INIT' || run.stage === 'ANALYZING_COMPANY'
              ? 'bg-[#FF4713] text-white font-bold shadow-2xs'
              : 'bg-[#F4F1EA] text-[#636772] hover:text-[#121316] hover:bg-[#EAE5DB]'
          }`}
        >
          1. Company
        </button>
        <span className="text-[#C5BEB0]">›</span>
        <button
          onClick={() => run.proposedCampaigns.length > 0 && workflowEngine.reviseStep(2)}
          disabled={run.proposedCampaigns.length === 0}
          className={`px-2.5 py-1 rounded-md transition disabled:opacity-40 ${
            run.stage === 'CAMPAIGNS_PROPOSED' || run.stage === 'GENERATING_QUESTIONS'
              ? 'bg-[#FF4713] text-white font-bold shadow-2xs'
              : 'bg-[#F4F1EA] text-[#636772] hover:text-[#121316] hover:bg-[#EAE5DB]'
          }`}
        >
          2. Campaign {run.selectedCampaignId ? '✓' : ''}
        </button>
        <span className="text-[#C5BEB0]">›</span>
        <button
          onClick={() => ((run.proposedPersonas && run.proposedPersonas.length > 0) || run.proposedQuestions.length > 0) && workflowEngine.reviseStep(3)}
          disabled={(!run.proposedPersonas || run.proposedPersonas.length === 0) && run.proposedQuestions.length === 0}
          className={`px-2.5 py-1 rounded-md transition disabled:opacity-40 ${
            run.stage === 'PERSONAS_PROPOSED' || run.stage === 'QUESTIONS_PROPOSED' || run.stage === 'BUILDING_PLAN' || run.stage === 'DISSECTING_PERSONA'
              ? 'bg-[#FF4713] text-white font-bold shadow-2xs'
              : 'bg-[#F4F1EA] text-[#636772] hover:text-[#121316] hover:bg-[#EAE5DB]'
          }`}
        >
          3. Company Persona {run.selectedPersonaId || run.selectedQuestionId ? '✓' : ''}
        </button>
        <span className="text-[#C5BEB0]">›</span>
        <button
          onClick={() => run.enrichmentPlan && workflowEngine.reviseStep(4)}
          disabled={!run.enrichmentPlan}
          className={`px-2.5 py-1 rounded-md transition disabled:opacity-40 ${
            run.stage === 'PLAN_READY'
              ? 'bg-[#CBD810] text-[#121316] font-bold shadow-2xs'
              : 'bg-[#F4F1EA] text-[#636772] hover:text-[#121316] hover:bg-[#EAE5DB]'
          }`}
        >
          4. Plan
        </button>
      </div>

      {/* Error state */}
      {run.stage === 'ERROR' && run.errorMessage && (
        <ErrorBanner
          message={run.errorMessage}
          onRetry={() => workflowEngine.retryCurrentStage()}
        />
      )}

      {/* Loading state indicator */}
      {isLoading && (
        <div className="my-auto py-12">
          <LoadingSpinner
            label={
              run.stage === 'ANALYZING_COMPANY'
                ? 'Inspecting website domain & extracting GTM positioning...'
                : run.stage === 'GENERATING_PERSONAS' || run.stage === 'GENERATING_QUESTIONS'
                ? 'Defining 3 target company personas based on website + brief + campaign...'
                : run.stage === 'DISSECTING_PERSONA'
                ? 'Calling LLM (4th Call): Dissecting approved persona into catalogue enrichment requirements...'
                : run.stage === 'RETRIEVING_CANDIDATES'
                ? 'Server RAG System: Running hybrid semantic search across 1,224 Clay catalogue actions...'
                : run.stage === 'EVALUATING_SELECTIONS'
                ? 'Calling LLM (5th Call): Evaluating catalogue candidates, selecting actions & calculating costs...'
                : run.stage === 'RESOLVING_DEPENDENCIES'
                ? 'Checking input prerequisites in code & calculating deterministic billing formulas...'
                : run.stage === 'BUILDING_PLAN'
                ? 'Searching Clay enrichment catalog & building waterfall...'
                : 'Processing step...'
            }
            sublabel="Backend is validating LLM output and syncing state with Supabase."
            size="lg"
          />
        </div>
      )}

      {/* Content for each stage when not loading */}
      {!isLoading && (
        <div className="flex-1 flex flex-col justify-between">
          {showFollowUpModal ? (
            <Step4FollowUp
              currentNotes={run.followUpNotes}
              selectedCampaignTitle={selectedCamp?.title}
              selectedQuestionTitle={selectedQuestion?.question}
              isLoading={isLoading}
            />
          ) : run.stage === 'INIT' || run.stage === 'ANALYZING_COMPANY' ? (
            <Step1UrlInput isLoading={isLoading} />
          ) : run.stage === 'CAMPAIGNS_PROPOSED' ? (
            <Step2CampaignSelection
              campaigns={run.proposedCampaigns}
              selectedCampaignId={run.selectedCampaignId}
              isLoading={isLoading}
            />
          ) : run.stage === 'PERSONAS_PROPOSED' || run.stage === 'QUESTIONS_PROPOSED' ? (
            <Step3QuestionSelection
              personas={run.proposedPersonas}
              selectedPersonaId={run.selectedPersonaId}
              questions={run.proposedQuestions}
              selectedQuestionId={run.selectedQuestionId}
              isLoading={isLoading}
            />
          ) : run.stage === 'PLAN_READY' && run.enrichmentPlan ? (
            <Step5EnrichmentPlan
              plan={run.enrichmentPlan}
              campaignTitle={selectedCamp?.title}
              questionTitle={selectedQuestion?.question}
              onOpenFollowUp={() => setShowFollowUpModal(true)}
            />
          ) : (
            <Step1UrlInput isLoading={isLoading} />
          )}
        </div>
      )}
    </div>
  );
};
