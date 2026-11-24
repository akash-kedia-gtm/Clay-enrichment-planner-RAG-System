import React from 'react';
import { GitBranch, CheckCircle2, XCircle, AlertCircle, Sparkles, Clock, Target } from 'lucide-react';
import { HypothesisMatrix } from '../../types/workflow';
import { Badge } from '../common/Badge';

interface HypothesisMatrixCardProps {
  matrix: HypothesisMatrix | null;
}

export const HypothesisMatrixCard: React.FC<HypothesisMatrixCardProps> = ({ matrix }) => {
  if (!matrix) {
    return (
      <div className="p-6 rounded-2xl border border-dashed border-[#E5E0D6] bg-white/60 text-center">
        <GitBranch className="w-6 h-6 text-[#8B8F9A] mx-auto mb-1.5 opacity-60" />
        <h4 className="text-xs font-bold text-[#121316]">Hypotheses & Decision Rules Awaiting Persona Approval</h4>
        <p className="text-[11px] text-[#636772] mt-0.5">
          Approve a company persona to execute Checkpoints C1 (rules), C2 (outcomes with missing data distinction), and C3 (evidence requirements).
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-5 rounded-2xl border border-[#E5E0D6] bg-white shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-[#FF4713]" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#121316]">
            Checkpoints C1, C2 & C3: Decision Breakdown
          </h3>
        </div>
        <Badge variant="indigo">Checkpoints Verified</Badge>
      </div>

      {/* Core Hypothesis */}
      <div className="p-3 bg-[#FAF7F2] border border-[#E5E0D6] rounded-xl text-xs">
        <span className="font-bold text-[#FF4713] block mb-1 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-[#FF4713]" /> Core Qualification Hypothesis:
        </span>
        <p className="text-[#121316] leading-relaxed font-normal">{matrix.coreHypothesis}</p>
      </div>

      {/* C1: Decision Rules */}
      {matrix.rules && matrix.rules.length > 0 && (
        <div className="space-y-2">
          <span className="text-[10px] font-semibold text-[#636772] uppercase tracking-wider block">
            C1: Formulated Decision Rules & Thresholds:
          </span>
          <div className="space-y-2">
            {matrix.rules.map((rule, idx) => (
              <div key={idx} className="p-2.5 rounded-lg border border-[#E5E0D6] bg-[#FAF7F2] text-xs space-y-1">
                <span className="font-bold text-[#121316] block">{rule.ruleStatement}</span>
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#636772] pt-1 border-t border-[#E5E0D6]">
                  <span className="flex items-center gap-1">
                    <Target className="w-3 h-3 text-[#FF4713]" /> Threshold: <strong className="text-[#121316]">{rule.threshold}</strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[#1E7E34]" /> Window: <strong className="text-[#121316]">{rule.timeWindow}</strong>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* C2: Possible Answers & Operational Action Pathways */}
      <div className="space-y-2">
        <span className="text-[10px] font-semibold text-[#636772] uppercase tracking-wider block">
          C2: Possible Answers & Resulting Actions:
        </span>
        <div className="space-y-2">
          {(matrix.possibleAnswers || []).map((item, idx) => {
            const isPos = item.indicatorStatus === 'Positive';
            const isNeg = item.indicatorStatus === 'Negative';
            return (
              <div
                key={idx}
                className="p-3 rounded-lg border border-[#E5E0D6] bg-[#FAF7F2] text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-[#121316] flex items-center gap-1.5">
                    {isPos && <CheckCircle2 className="w-3.5 h-3.5 text-[#1E7E34]" />}
                    {isNeg && <XCircle className="w-3.5 h-3.5 text-[#C92A2A]" />}
                    {!isPos && !isNeg && <AlertCircle className="w-3.5 h-3.5 text-[#B25E00]" />}
                    {item.statusLabel || item.indicatorStatus}
                  </span>
                  <Badge variant={isPos ? 'emerald' : isNeg ? 'rose' : 'amber'}>
                    {item.indicatorStatus}
                  </Badge>
                </div>

                <p className="text-[#636772] text-[11px] leading-relaxed">
                  <span className="font-semibold text-[#121316]">Action Pathway: </span>
                  {item.actionPathway}
                </p>

                {item.indicatorStatus === 'Insufficient_Evidence' && (
                  <div className="p-1.5 rounded bg-[#FFF4E5] border border-[#FFE2B8] text-[10px] text-[#B25E00]">
                    <strong>Distinction Preserved:</strong> Missing data is tracked separately from evidence that a condition fails.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* C3: Required Observations & Fields */}
      {matrix.evidenceRequirements && matrix.evidenceRequirements.length > 0 && (
        <div className="space-y-2">
          <span className="text-[10px] font-semibold text-[#636772] uppercase tracking-wider block">
            C3: Evidence Requirements & Completeness Criteria:
          </span>
          <div className="space-y-2">
            {matrix.evidenceRequirements.map((ev, idx) => (
              <div key={idx} className="p-2.5 rounded-lg border border-[#E5E0D6] bg-[#FAF7F2] text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#FF4713]">{ev.observationName}</span>
                  <span className="text-[10px] font-mono text-[#8B8F9A]">{ev.timeCoverage}</span>
                </div>
                <div className="flex flex-wrap gap-1 pt-1">
                  {(ev.requiredFields || []).map((f, fIdx) => (
                    <span key={fIdx} className="px-1.5 py-0.5 rounded bg-white border border-[#E5E0D6] text-[10px] font-mono text-[#121316]">
                      {f}
                    </span>
                  ))}
                </div>
                <span className="text-[10px] text-[#636772] block pt-0.5">
                  Completeness Threshold: <span className="text-[#121316] font-medium">{ev.completenessThreshold}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
