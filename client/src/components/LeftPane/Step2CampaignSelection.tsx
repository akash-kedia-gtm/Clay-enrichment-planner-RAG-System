import React, { useState } from 'react';
import { Target, Users, CheckCircle2, ChevronRight, RotateCcw, ShieldCheck, Sparkles, ExternalLink, Lightbulb } from 'lucide-react';
import { CampaignOption } from '../../types/workflow';
import { Badge } from '../common/Badge';
import { workflowEngine } from '../../services/workflowEngine';

interface Step2CampaignSelectionProps {
  campaigns: CampaignOption[];
  selectedCampaignId: string | null;
  isLoading: boolean;
}

export const Step2CampaignSelection: React.FC<Step2CampaignSelectionProps> = ({
  campaigns,
  selectedCampaignId,
  isLoading,
}) => {
  const [selectedId, setSelectedId] = useState<string>(selectedCampaignId || campaigns[0]?.id || '');

  const handleApprove = async () => {
    if (!selectedId) return;
    await workflowEngine.approveCampaign(selectedId);
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Header & Approval Notice */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#FFF0EB] text-[#D83A0C] border border-[#FFD5C7]">
            <ShieldCheck className="w-3 h-3 text-[#FF4713]" />
            Approval Point 1: Campaign Selection
          </div>
          <button
            type="button"
            onClick={() => workflowEngine.reviseStep(1)}
            className="text-[11px] text-[#636772] hover:text-[#FF4713] font-medium inline-flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" /> Change URL
          </button>
        </div>
        <h2 className="text-base font-bold text-[#121316] tracking-tight">
          Select Campaign Strategy
        </h2>
        <p className="text-[11px] text-[#636772] mt-0.5">
          Review the generated campaign angles below. Choose the campaign that best matches your target revenue goal.
        </p>
      </div>

      {/* Campaign List */}
      <div className="space-y-3">
        {campaigns.map((camp) => {
          const isSelected = selectedId === camp.id;
          return (
            <div
              key={camp.id}
              onClick={() => setSelectedId(camp.id)}
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
                    <h3 className="text-xs font-bold text-[#121316]">{camp.title}</h3>
                    <span className="px-1.5 py-0.5 text-[9px] font-semibold rounded bg-[#F4F8D3] text-[#4A5404] border border-[#DFE8A8]">
                      {camp.difficulty}
                    </span>
                    <span className="px-1.5 py-0.5 text-[9px] font-semibold rounded bg-[#FAF7F2] text-[#636772] border border-[#E5E0D6]">
                      <Users className="w-2.5 h-2.5 mr-0.5 inline text-[#8C909B]" /> {camp.estimatedTam}
                    </span>
                  </div>

                  <p className="text-[11px] text-[#4B4E57] leading-relaxed font-normal">
                    {camp.objective}
                  </p>

                  {/* Target Company Profile */}
                  <div className="p-2 rounded-lg bg-[#FAF7F2] border border-[#E5E0D6] text-[10px] space-y-0.5">
                    <span className="font-bold text-[#121316] block">Target Company Profile:</span>
                    <span className="text-[#636772]">{camp.targetCompanyProfile}</span>
                  </div>

                  {/* Labeled Model-Generated GTM Assumptions */}
                  {camp.gtmAssumptions && camp.gtmAssumptions.length > 0 && (
                    <div className="p-2 rounded-lg bg-[#FFF6ED] border border-[#FFD5C7] text-[10px] space-y-0.5">
                      <span className="font-bold text-[#A72D07] flex items-center gap-1">
                        <Lightbulb className="w-3 h-3 text-[#FF4713]" /> Model-Generated GTM Assumptions:
                      </span>
                      <ul className="list-disc list-inside text-[#636772] space-y-0.5 pl-0.5">
                        {camp.gtmAssumptions.map((assump, aIdx) => (
                          <li key={aIdx}>{assump}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Supporting Company Sources (Citations from Public Website) */}
                  {camp.supportingCompanySources && camp.supportingCompanySources.length > 0 && (
                    <div className="pt-1.5 text-[10px] border-t border-[#E5E0D6]">
                      <span className="font-semibold text-[#636772] block mb-1">
                        Supporting Company Website Citations:
                      </span>
                      <div className="space-y-1">
                        {camp.supportingCompanySources.map((src, sIdx) => (
                          <div key={sIdx} className="p-1.5 rounded bg-[#FAF7F2] border border-[#E5E0D6] flex items-start justify-between gap-2">
                            <div>
                              <span className="font-semibold text-[#121316] block">{src.fact}</span>
                              <span className="text-[#636772] italic font-mono text-[9px]">"{src.excerpt}"</span>
                            </div>
                            <a
                              href={src.url}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-[#FF4713] hover:text-[#E03E0F] flex-shrink-0"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Approve and Continue Action Button */}
      <div className="pt-2.5 border-t border-[#E5E0D6] flex items-center justify-between">
        <span className="text-[11px] text-[#636772]">
          Approval Point 1 sends the selected campaign to Groq for target persona formulation.
        </span>
        <button
          type="button"
          onClick={handleApprove}
          disabled={!selectedId || isLoading}
          className="px-4 py-2 text-xs font-bold text-white bg-[#FF4713] hover:bg-[#E03E0F] disabled:opacity-50 rounded-xl transition shadow-2xs inline-flex items-center gap-1.5"
        >
          {isLoading ? 'Formulating Personas...' : 'Approve Campaign & Formulate Personas'}
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
