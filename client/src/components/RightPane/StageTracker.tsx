import React from 'react';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  ShieldCheck,
  Activity,
  Key,
} from 'lucide-react';
import { Checkpoint, WorkflowStage, CheckpointStatus } from '../../types/workflow';

interface StageTrackerProps {
  stage: WorkflowStage;
  status: CheckpointStatus;
  checkpoints: Checkpoint[];
}

const STAGE_LABELS: Record<WorkflowStage, { step: number; label: string }> = {
  INIT: { step: 0, label: 'Website Input' },
  FETCHING_WEBSITE: { step: 1, label: 'SSRF-Safe Public Fetch' },
  ANALYZING_COMPANY: { step: 2, label: 'Company Analysis & ICP' },
  CAMPAIGNS_PROPOSED: { step: 3, label: 'Campaign Selection (Approval 1)' },
  GENERATING_PERSONAS: { step: 4, label: '3rd LLM Call: Company Personas' },
  PERSONAS_PROPOSED: { step: 5, label: 'Company Persona Selection (Approval 2)' },
  DISSECTING_PERSONA: { step: 6, label: '4th LLM Call: Persona Dissection' },
  GENERATING_QUESTIONS: { step: 4, label: 'Gating Question Synthesis' },
  QUESTIONS_PROPOSED: { step: 5, label: 'Question Selection (Approval 2)' },
  BUILDING_PLAN: { step: 6, label: 'Plan Construction' },
  BREAKDOWN_C1_RULES: { step: 6, label: 'C1/C2/C3 Decision Breakdown' },
  BREAKDOWN_C2_OUTCOMES: { step: 6, label: 'Outcomes & Action Pathways' },
  BREAKDOWN_C3_EVIDENCE: { step: 6, label: 'Evidence Requirements' },
  RETRIEVING_CANDIDATES: { step: 7, label: 'Hybrid Catalogue Retrieval' },
  EVALUATING_SELECTIONS: { step: 7, label: 'Candidate Selection' },
  RESOLVING_DEPENDENCIES: { step: 8, label: 'Prerequisite Resolution & Billing' },
  PLAN_READY: { step: 8, label: 'Clay Waterfall Plan Ready' },
  ERROR: { step: -1, label: 'Error' },
};

export const StageTracker: React.FC<StageTrackerProps> = ({ stage, status, checkpoints }) => {
  const currentStageInfo = STAGE_LABELS[stage] || { step: 0, label: stage };
  const progressPct = Math.min(100, Math.round((Math.max(0, currentStageInfo.step) / 8) * 100));

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E5E0D6] shadow-xs space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#FF4713]" />
          <span className="text-xs font-bold uppercase tracking-wider text-[#121316]">
            System Workflow Engine
          </span>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={status} />
          <span className="text-xs font-mono text-[#FF4713] font-semibold">
            Stage {currentStageInfo.step}/8: {currentStageInfo.label}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-[#FAF7F2] h-2 rounded-full overflow-hidden border border-[#E5E0D6]">
        <div
          className="h-full bg-gradient-to-r from-[#FF4713] to-[#FF7A45] transition-all duration-500 rounded-full"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Checkpoints Audit Log */}
      <div className="space-y-1.5 pt-1 max-h-48 overflow-y-auto pr-1">
        {checkpoints.length === 0 ? (
          <p className="text-xs text-[#8B8F9A] italic">Awaiting initial domain submission...</p>
        ) : (
          checkpoints.map((chk) => (
            <div
              key={chk.id}
              className="flex items-start gap-2.5 text-xs p-2 rounded-lg bg-[#FAF7F2] border border-[#E5E0D6]"
            >
              <div className="mt-0.5 flex-shrink-0">
                {chk.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5 text-[#1E7E34]" />}
                {chk.status === 'running' && <Clock className="w-3.5 h-3.5 text-[#FF4713] animate-spin" />}
                {chk.status === 'awaiting_selection' && <ShieldCheck className="w-3.5 h-3.5 text-[#B25E00]" />}
                {chk.status === 'awaiting_credentials' && <Key className="w-3.5 h-3.5 text-[#B25E00]" />}
                {chk.status === 'pending' && <Clock className="w-3.5 h-3.5 text-[#8B8F9A]" />}
                {chk.status === 'failed' && <AlertTriangle className="w-3.5 h-3.5 text-[#C92A2A]" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[#121316] font-medium text-[11px] leading-snug">{chk.label}</p>
                {chk.error && <p className="text-[#C92A2A] text-[10px] mt-0.5">{chk.error}</p>}
              </div>
              <span className="text-[10px] font-mono text-[#8B8F9A] flex-shrink-0">{chk.timestamp}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const StatusBadge: React.FC<{ status: CheckpointStatus }> = ({ status }) => {
  if (status === 'completed') {
    return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#F5F8D5] text-[#4A5404] border border-[#CBD810]">Completed</span>;
  }
  if (status === 'running') {
    return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FFF0EB] text-[#FF4713] border border-[#FFD9CC] animate-pulse">Running</span>;
  }
  if (status === 'awaiting_selection') {
    return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FFF4E5] text-[#B25E00] border border-[#FFE2B8]">Awaiting Selection</span>;
  }
  if (status === 'awaiting_credentials') {
    return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FFF4E5] text-[#B25E00] border border-[#FFE2B8]">Awaiting Credentials</span>;
  }
  if (status === 'failed') {
    return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FDECEE] text-[#C92A2A] border border-[#FAC5CB]">Failed</span>;
  }
  return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#F4F1EA] text-[#636772] border border-[#E5E0D6]">Pending</span>;
};
