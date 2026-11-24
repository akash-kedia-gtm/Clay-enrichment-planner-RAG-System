import React from 'react';
import { HelpCircle, CheckCircle2, Building2 } from 'lucide-react';
import { CompanyPersona, DecisionQuestion } from '../../types/workflow';
import { Badge } from '../common/Badge';

interface DecisionQuestionCardProps {
  personas?: CompanyPersona[];
  selectedPersonaId?: string | null;
  proposedQuestions: DecisionQuestion[];
  selectedQuestionId: string | null;
}

export const DecisionQuestionCard: React.FC<DecisionQuestionCardProps> = ({
  personas = [],
  selectedPersonaId,
  proposedQuestions = [],
  selectedQuestionId,
}) => {
  const hasPersonas = personas && personas.length > 0;
  const hasQuestions = proposedQuestions && proposedQuestions.length > 0;

  if (!hasPersonas && !hasQuestions) {
    return (
      <div className="p-6 rounded-2xl border border-dashed border-[#E5E0D6] bg-white/60 text-center">
        <Building2 className="w-6 h-6 text-[#8B8F9A] mx-auto mb-1.5 opacity-60" />
        <h4 className="text-xs font-bold text-[#121316]">Target Company Personas Awaiting Campaign Approval</h4>
        <p className="text-[11px] text-[#636772] mt-0.5">
          Approve an outbound campaign to generate 3 tailored company personas via the 3rd LLM call.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-5 rounded-2xl border border-[#E5E0D6] bg-white shadow-xs space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-[#FF4713]" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#121316]">
            {hasPersonas ? 'Target Company Personas & Gating Gate' : 'Decision Questions & Selected Gate'}
          </h3>
        </div>
        <Badge variant={selectedPersonaId || selectedQuestionId ? 'emerald' : 'amber'}>
          {selectedPersonaId || selectedQuestionId ? '1 Approved' : 'Pending Selection'}
        </Badge>
      </div>

      {hasPersonas ? (
        <div className="space-y-2.5">
          {personas.map((persona, idx) => {
            const isSelected = persona.id === selectedPersonaId || (!selectedPersonaId && idx === 0 && selectedQuestionId);
            return (
              <div
                key={persona.id}
                className={`p-3.5 rounded-xl border text-xs transition ${
                  isSelected
                    ? 'border-[#FF4713] bg-[#FFF8F5] shadow-xs'
                    : 'border-[#E5E0D6] bg-[#FAF7F2] opacity-80'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[#FFF0EB] text-[#FF4713] border border-[#FFD9CC]">
                        Persona {idx + 1}
                      </span>
                      <span className="text-[10px] text-[#636772] font-medium">
                        {persona.archetype}
                      </span>
                    </div>
                    <span className="font-bold text-[#121316] leading-snug flex items-start gap-1.5">
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-[#FF4713] mt-0.5 flex-shrink-0" />}
                      {persona.title}
                    </span>
                  </div>
                  {isSelected && <Badge variant="clay">Approved Persona</Badge>}
                </div>

                <div className="text-[11px] text-[#121316] space-y-1 mt-2">
                  <p className="text-[#636772]">
                    <strong className="text-[#121316]">Scale:</strong> {persona.companySize} • <strong className="text-[#121316]">Geography:</strong> {persona.geography}
                  </p>
                  <p>
                    <strong className="text-[#C92A2A]">Acute Friction:</strong> {persona.businessPainAndFriction}
                  </p>
                  {isSelected && (
                    <div className="mt-2 pt-2 border-t border-[#E5E0D6] space-y-1">
                      <p className="text-[#636772]">
                        <strong className="text-[#121316]">Why Fits Campaign:</strong> {persona.whyThisCompanyFitsCampaign}
                      </p>
                      {persona.qualificationCriteria && persona.qualificationCriteria.length > 0 && (
                        <p className="text-[#636772] text-[10px]">
                          <strong className="text-[#121316]">Gating Qualification:</strong> {persona.qualificationCriteria.join('; ')}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {proposedQuestions.map((q) => {
            const isSelected = q.id === selectedQuestionId;
            return (
              <div
                key={q.id}
                className={`p-3 rounded-xl border text-xs transition ${
                  isSelected
                    ? 'border-[#FF4713] bg-[#FFF8F5] shadow-xs'
                    : 'border-[#E5E0D6] bg-[#FAF7F2] opacity-80'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="space-y-1">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[#FAF7F2] text-[#636772] border border-[#E5E0D6]">
                      {q.category}
                    </span>
                    <span className="font-bold text-[#121316] leading-snug flex items-start gap-1.5">
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-[#FF4713] mt-0.5 flex-shrink-0" />}
                      "{q.question}"
                    </span>
                  </div>
                  {isSelected && <Badge variant="clay">Approved Gate</Badge>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
