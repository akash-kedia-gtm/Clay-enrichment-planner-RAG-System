import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { LeftPane } from './components/LeftPane/LeftPane';
import { RightPane } from './components/RightPane/RightPane';
import { ApiKeyModal } from './components/ApiKeyModal';
import { ServiceHealthModal } from './components/ServiceHealthModal';
import { CatalogueModal } from './components/CatalogueModal';
import { GtmPromptModal } from './components/GtmPromptModal';
import { workflowEngine } from './services/workflowEngine';
import { sessionManager } from './services/sessionManager';
import { CampaignRun, SessionState } from './types/workflow';

export const App: React.FC = () => {
  const [run, setRun] = useState<CampaignRun>(workflowEngine.getRun());
  const [sessionState, setSessionState] = useState<SessionState>(sessionManager.getState());
  const [isLoading, setIsLoading] = useState<boolean>(workflowEngine.getIsLoading());
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);
  const [isCatalogueModalOpen, setIsCatalogueModalOpen] = useState(false);
  const [isGtmModalOpen, setIsGtmModalOpen] = useState(false);

  useEffect(() => {
    const unsubWorkflow = workflowEngine.subscribe((updatedRun) => {
      setRun({ ...updatedRun });
      setIsLoading(workflowEngine.getIsLoading());
    });

    const unsubSession = sessionManager.subscribe((updatedSession) => {
      setSessionState({ ...updatedSession });
    });

    return () => {
      unsubWorkflow();
      unsubSession();
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#FAF9F5] text-[#121316] flex flex-col font-sans selection:bg-[#FF4713] selection:text-white">
      {/* Sticky Header with LLM connection pill, Catalogue & Reset */}
      <Header
        sessionState={sessionState}
        run={run}
        onOpenKeyModal={() => setIsKeyModalOpen(true)}
        onOpenCatalogueModal={() => setIsCatalogueModalOpen(true)}
        onReset={() => workflowEngine.resetWorkflow()}
      />

      {/* Main Workspace: Stacked Vertical Layout */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 space-y-7">
        {/* Section 1: User Inputs & Active Step (Formulation Workspace) */}
        <section aria-label="User Inputs & Action Workspace">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#FF4713]"></span>
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#636772]">
                1. Campaign Formulation & Approval Gates
              </h2>
            </div>
            <span className="text-[10px] text-[#8C909B] hidden sm:inline">
              Company research, outbound campaign selection & target persona approval
            </span>
          </div>
          <LeftPane
            run={run}
            sessionState={sessionState}
            isLoading={isLoading}
            onOpenKeyModal={() => setIsKeyModalOpen(true)}
          />
        </section>

        {/* Section 2: Live Execution Flow & Intelligence */}
        <section aria-label="Live System Flow & GTM Intelligence">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#CBD810]"></span>
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#636772]">
                2. Live Execution Flow & RAG Intelligence
              </h2>
            </div>
            <span className="text-[10px] text-[#8C909B] hidden sm:inline">
              Real-time checkpoints, company intelligence, persona signals & catalogue retrieval
            </span>
          </div>
          <RightPane run={run} isLoading={isLoading} />
        </section>
      </main>

      {/* Clay Warm Minimal Footer */}
      <footer className="mt-auto border-t border-[#E5E0D6] bg-[#F4F1EA] py-3.5 text-center text-xs text-[#636772]">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="font-medium text-[#121316]">
            Clay Campaign Planner — By{' '}
            <a
              href="https://www.linkedin.com/in/akash-kedia"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[#FF4713] hover:underline"
            >
              Akash Kedia
            </a>
          </span>
          <div className="flex items-center gap-3 text-[#8C909B] text-[11px]">
            <span>1,224 Canonical Actions Indexed</span>
            <span>•</span>
            <span>pgvector 384-dim</span>
            <span>•</span>
            <span>Edge Functions</span>
          </div>
        </div>
      </footer>

      {/* Masked Groq API Key & Model Selector Modal */}
      <ApiKeyModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
        sessionState={sessionState}
      />

      {/* Services Health Check Modal */}
      <ServiceHealthModal
        isOpen={isHealthModalOpen}
        onClose={() => setIsHealthModalOpen(false)}
        sessionState={sessionState}
      />

      {/* Catalogue Inspection, Mapping Preview & Live Retrieval Check Modal */}
      <CatalogueModal
        isOpen={isCatalogueModalOpen}
        onClose={() => setIsCatalogueModalOpen(false)}
      />

      {/* GTM Method & Task Instructions Editor Modal */}
      <GtmPromptModal
        isOpen={isGtmModalOpen}
        onClose={() => setIsGtmModalOpen(false)}
      />
    </div>
  );
};
