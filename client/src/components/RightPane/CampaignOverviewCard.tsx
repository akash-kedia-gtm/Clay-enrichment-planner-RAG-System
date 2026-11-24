import React from 'react';
import { Target, CheckCircle2, Lightbulb, ExternalLink } from 'lucide-react';
import { CampaignOption } from '../../types/workflow';
import { Badge } from '../common/Badge';

interface CampaignOverviewCardProps {
  proposedCampaigns: CampaignOption[];
  selectedCampaignId: string | null;
}

export const CampaignOverviewCard: React.FC<CampaignOverviewCardProps> = ({
  proposedCampaigns,
  selectedCampaignId,
}) => {
  if (proposedCampaigns.length === 0) {
    return (
      <div className="p-6 rounded-2xl border border-dashed border-[#E5E0D6] bg-white/60 text-center">
        <Target className="w-6 h-6 text-[#8B8F9A] mx-auto mb-1.5 opacity-60" />
        <h4 className="text-xs font-bold text-[#121316]">Campaigns Not Generated Yet</h4>
        <p className="text-[11px] text-[#636772] mt-0.5">
          Outbound campaigns will be displayed here once company domain is analyzed.
        </p>
      </div>
    );
  }

  const selected = proposedCampaigns.find((c) => c.id === selectedCampaignId);

  return (
    <div className="p-4 sm:p-5 rounded-2xl border border-[#E5E0D6] bg-white shadow-xs space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-[#FF4713]" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#121316]">
            Campaign Options & Selection
          </h3>
        </div>
        <Badge variant={selectedCampaignId ? 'emerald' : 'amber'}>
          {selectedCampaignId ? '1 Selected' : 'Pending Selection'}
        </Badge>
      </div>

      <div className="space-y-2">
        {proposedCampaigns.map((camp) => {
          const isSelected = camp.id === selectedCampaignId;
          return (
            <div
              key={camp.id}
              className={`p-3 rounded-xl border text-xs transition ${
                isSelected
                  ? 'border-[#FF4713] bg-[#FFF8F5] shadow-xs'
                  : 'border-[#E5E0D6] bg-[#FAF7F2] opacity-80'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-bold text-[#121316] flex items-center gap-1.5">
                  {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-[#FF4713] flex-shrink-0" />}
                  {camp.title}
                </span>
                {isSelected ? (
                  <Badge variant="clay">Selected</Badge>
                ) : (
                  <Badge variant="slate">{camp.estimatedTam}</Badge>
                )}
              </div>
              <p className="text-[#636772] text-[11px] line-clamp-2 mt-1">{camp.objective}</p>

              {isSelected && (
                <div className="mt-2.5 pt-2 border-t border-[#E5E0D6] text-[11px] space-y-2 text-[#121316]">
                  <div>
                    <span className="font-semibold text-[#121316]">Target Profile: </span>
                    <span className="text-[#636772]">{camp.targetCompanyProfile}</span>
                  </div>

                  {camp.gtmAssumptions && camp.gtmAssumptions.length > 0 && (
                    <div className="p-2 rounded-lg bg-[#FAF7F2] border border-[#E5E0D6] text-[10px] space-y-0.5">
                      <span className="font-bold text-[#FF4713] flex items-center gap-1">
                        <Lightbulb className="w-3 h-3 text-[#FF4713]" /> Labeled GTM Assumptions:
                      </span>
                      <ul className="list-disc list-inside text-[#636772] pl-1">
                        {camp.gtmAssumptions.map((a, i) => (
                          <li key={i}>{a}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {camp.supportingCompanySources && camp.supportingCompanySources.length > 0 && (
                    <div className="text-[10px] text-[#636772] space-y-1">
                      <span className="font-semibold text-[#121316]">Website Citations:</span>
                      {camp.supportingCompanySources.map((s, i) => (
                        <div key={i} className="flex items-center justify-between p-1.5 rounded bg-white border border-[#E5E0D6]">
                          <span className="truncate mr-2 font-mono text-[#121316]">{s.fact}</span>
                          <a href={s.url} target="_blank" rel="noreferrer" className="text-[#FF4713] hover:text-[#E03E0F]">
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
