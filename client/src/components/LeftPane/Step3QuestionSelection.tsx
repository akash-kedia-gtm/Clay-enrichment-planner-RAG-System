import React, { useState } from 'react';
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  RotateCcw,
  ShieldCheck,
  Zap,
  ArrowDownRight,
  Globe2,
  TrendingUp,
} from 'lucide-react';
import { CompanyPersona, DecisionQuestion } from '../../types/workflow';
import { workflowEngine } from '../../services/workflowEngine';

interface Step3QuestionSelectionProps {
  personas?: CompanyPersona[];
  selectedPersonaId?: string | null;
  questions: DecisionQuestion[];
  selectedQuestionId: string | null;
  isLoading: boolean;
}

export const Step3QuestionSelection: React.FC<Step3QuestionSelectionProps> = ({
  personas = [],
  selectedPersonaId,
  questions = [],
  selectedQuestionId,
  isLoading,
}) => {
  const hasPersonas = personas && personas.length > 0;
  const initialSelected = hasPersonas
    ? (selectedPersonaId || personas[0]?.id || '')
    : (selectedQuestionId || questions[0]?.id || '');

  const [selectedId, setSelectedId] = useState<string>(initialSelected);
  const [notes, setNotes] = useState<string>('');

  const handleApprove = async () => {
    if (!selectedId) return;
    if (hasPersonas) {
      await workflowEngine.approveCompanyPersona(selectedId, notes);
    } else {
      await workflowEngine.approveDecisionQuestion(selectedId, notes);
    }
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Header & Approval Notice */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#FFF0EB] text-[#D83A0C] border border-[#FFD5C7]">
            <ShieldCheck className="w-3 h-3 text-[#FF4713]" />
            Approval Point 2: Target Company Persona Selection
          </div>
          <button
            type="button"
            onClick={() => workflowEngine.reviseStep(2)}
            className="text-[11px] text-[#636772] hover:text-[#FF4713] font-medium inline-flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" /> Change Campaign
          </button>
        </div>
        <h2 className="text-base font-bold text-[#121316] tracking-tight">
          Select Target Company Persona
        </h2>
        <p className="text-[11px] text-[#636772] mt-0.5">
          The LLM has defined 3 distinct company personas based on your website brief and selected campaign. Select the target company profile to qualify and assemble your Clay waterfall.
        </p>
      </div>

      {/* If 3 Company Personas Generated */}
      {hasPersonas ? (
        <div className="space-y-3">
          {personas.map((persona, idx) => {
            const isSelected = selectedId === persona.id;
            return (
              <div
                key={persona.id}
                onClick={() => setSelectedId(persona.id)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer relative ${
                  isSelected
                    ? 'border-[#FF4713] bg-[#FFF8F5] shadow-xs ring-1 ring-[#FF4713]/30'
                    : 'border-[#E5E0D6] bg-white hover:border-[#FF4713]/60 hover:bg-[#FAF7F2]'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center border flex-shrink-0 transition ${
                      isSelected
                        ? 'border-[#FF4713] bg-[#FF4713] text-white'
                        : 'border-[#C5BEB0] bg-[#FAF7F2]'
                    }`}
                  >
                    {isSelected && <CheckCircle2 className="w-3 h-3" />}
                  </div>

                  <div className="space-y-2 flex-1">
                    {/* Header badges */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[#FFF0EB] text-[#D83A0C] border border-[#FFD5C7]">
                        Company Persona {idx + 1}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-[#FAF7F2] text-[#636772] border border-[#E5E0D6]">
                        {persona.archetype}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-[#F5F8D5] text-[#4A5404] border border-[#DFE8A8]">
                        <Zap className="w-2.5 h-2.5 mr-0.5 inline text-[#CBD810]" /> {persona.recommendedConfidence || 'High'} Fit
                      </span>
                    </div>

                    {/* Persona Title */}
                    <h3 className="text-xs font-bold text-[#121316] leading-snug">
                      {persona.title}
                    </h3>

                    {/* Key Attributes Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[10px]">
                      <div className="p-2 rounded-lg bg-[#FAF7F2] border border-[#E5E0D6] flex items-start gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-[#FF4713] flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="text-[9px] uppercase font-bold text-[#8C909B]">Company Scale</div>
                          <div className="text-[#121316] font-medium">{persona.companySize}</div>
                        </div>
                      </div>

                      <div className="p-2 rounded-lg bg-[#FAF7F2] border border-[#E5E0D6] flex items-start gap-1.5">
                        <Globe2 className="w-3.5 h-3.5 text-[#FF4713] flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="text-[9px] uppercase font-bold text-[#8C909B]">Industry & Geography</div>
                          <div className="text-[#121316] font-medium">{persona.industry} • {persona.geography}</div>
                        </div>
                      </div>
                    </div>

                    {/* Operating Friction & Business Pain */}
                    <div className="p-2.5 rounded-xl bg-[#FAF7F2] border border-[#E5E0D6] text-[10px] space-y-1.5">
                      <div>
                        <span className="font-semibold text-[#121316]">Operational Profile: </span>
                        <span className="text-[#636772]">{persona.operationalProfile}</span>
                      </div>

                      <div className="pt-1.5 border-t border-[#E5E0D6]">
                        <span className="font-semibold text-rose-700">Acute Business Pain / Friction: </span>
                        <span className="text-[#4B4E57]">{persona.businessPainAndFriction}</span>
                      </div>

                      {/* Buying Triggers */}
                      {persona.buyingTriggers && persona.buyingTriggers.length > 0 && (
                        <div className="pt-1.5 border-t border-[#E5E0D6] flex items-start gap-1 text-[#A72D07]">
                          <TrendingUp className="w-3 h-3 text-[#FF4713] flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-[#A72D07]">Buying Urgency Triggers: </span>
                            <span className="text-[#636772]">{persona.buyingTriggers.join('; ')}</span>
                          </div>
                        </div>
                      )}

                      {/* Campaign Fit Rationale */}
                      <div className="pt-1.5 border-t border-[#E5E0D6] flex items-start gap-1 text-[#121316]">
                        <ArrowDownRight className="w-3 h-3 text-[#FF4713] flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-[#121316]">Why This Persona Fits Campaign: </span>
                          <span className="text-[#4B4E57]">{persona.whyThisCompanyFitsCampaign}</span>
                        </div>
                      </div>

                      {/* Gating Qualification Criteria */}
                      {persona.qualificationCriteria && persona.qualificationCriteria.length > 0 && (
                        <div className="pt-1.5 border-t border-[#E5E0D6] text-[10px] text-[#636772]">
                          <span className="font-semibold text-[#121316]">Clay Account Gating Rules: </span>
                          <span>{persona.qualificationCriteria.join(' • ')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Fallback Question list if no personas */
        <div className="space-y-3">
          {questions.map((q) => {
            const isSelected = selectedId === q.id;
            return (
              <div
                key={q.id}
                onClick={() => setSelectedId(q.id)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer relative ${
                  isSelected
                    ? 'border-[#FF4713] bg-[#FFF8F5] shadow-xs ring-1 ring-[#FF4713]/30'
                    : 'border-[#E5E0D6] bg-white hover:border-[#FF4713]/60 hover:bg-[#FAF7F2]'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center border flex-shrink-0 transition ${
                      isSelected
                        ? 'border-[#FF4713] bg-[#FF4713] text-white'
                        : 'border-[#C5BEB0] bg-[#FAF7F2]'
                    }`}
                  >
                    {isSelected && <CheckCircle2 className="w-3 h-3" />}
                  </div>
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[#FFF0EB] text-[#D83A0C] border border-[#FFD5C7]">
                        {q.category}
                      </span>
                    </div>

                    <h3 className="text-xs font-bold text-[#121316] leading-snug">
                      "{q.question}"
                    </h3>

                    <div className="p-2.5 rounded-lg bg-[#FAF7F2] border border-[#E5E0D6] text-[10px] text-[#4B4E57] space-y-1.5">
                      <div>
                        <span className="font-semibold text-[#121316]">Campaign Criterion: </span>
                        <span>{q.campaignCriterion}</span>
                      </div>
                      <div className="pt-1 border-t border-[#E5E0D6] flex items-start gap-1 font-medium">
                        <ArrowDownRight className="w-3 h-3 text-[#FF4713] flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-[#121316]">Action Changed: </span>
                          <span>{q.actionChanged}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Approve and Continue Action Button */}
      <div className="pt-2.5 border-t border-[#E5E0D6] flex items-center justify-between">
        <span className="text-[11px] text-[#636772]">
          Approval Point 2 triggers the RAG retrieval across 1,224 Clay actions and assembles your waterfall.
        </span>
        <button
          type="button"
          onClick={handleApprove}
          disabled={!selectedId || isLoading}
          className="px-4 py-2 text-xs font-bold text-white bg-[#FF4713] hover:bg-[#E03E0F] disabled:opacity-50 rounded-xl transition shadow-2xs inline-flex items-center gap-1.5"
        >
          {isLoading ? 'Assembling Waterfall Plan...' : 'Approve Company Persona & Build Enrichment Plan'}
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
