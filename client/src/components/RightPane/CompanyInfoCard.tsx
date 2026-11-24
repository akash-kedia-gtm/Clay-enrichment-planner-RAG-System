import React from 'react';
import { Building2, ExternalLink, Code2, Globe, ShieldCheck, FileText } from 'lucide-react';
import { CompanyData } from '../../types/workflow';
import { Badge } from '../common/Badge';

interface CompanyInfoCardProps {
  companyData: CompanyData | null;
  isLoading: boolean;
}

export const CompanyInfoCard: React.FC<CompanyInfoCardProps> = ({ companyData, isLoading }) => {
  if (isLoading && !companyData) {
    return (
      <div className="p-4 rounded-2xl border border-[#E5E0D6] bg-white animate-pulse space-y-2.5">
        <div className="h-4 bg-[#F4F1EA] rounded w-1/3"></div>
        <div className="h-3 bg-[#FAF7F2] rounded w-full"></div>
        <div className="h-3 bg-[#FAF7F2] rounded w-2/3"></div>
      </div>
    );
  }

  if (!companyData) {
    return (
      <div className="p-6 rounded-2xl border border-dashed border-[#E5E0D6] bg-white/60 text-center">
        <Globe className="w-6 h-6 text-[#8B8F9A] mx-auto mb-1.5 opacity-60" />
        <h4 className="text-xs font-bold text-[#121316]">Company Intelligence Awaiting Input</h4>
        <p className="text-[11px] text-[#636772] mt-0.5">
          Enter a company URL in the section above to execute a bounded, SSRF-safe public fetch of offering and positioning.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-5 rounded-2xl border border-[#E5E0D6] bg-white shadow-xs space-y-3.5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm sm:text-base font-bold text-[#121316]">{companyData.name}</h3>
            <Badge variant="indigo">{companyData.industry}</Badge>
            {companyData.isManualDescription && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FFF4E5] text-[#B25E00] border border-[#FFE2B8]">
                Manual Description
              </span>
            )}
          </div>
          <a
            href={`https://${companyData.domain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-mono text-[#FF4713] hover:text-[#E03E0F] inline-flex items-center gap-1 mt-0.5"
          >
            {companyData.domain} <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Summary */}
      <p className="text-xs text-[#636772] leading-relaxed">{companyData.summary}</p>

      {/* Value Prop & ICP */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs bg-[#FAF7F2] p-3 rounded-xl border border-[#E5E0D6]">
        <div>
          <span className="font-semibold text-[#121316] block text-[11px] mb-0.5">Target ICP:</span>
          <p className="text-[#636772] text-[11px] leading-relaxed">{companyData.icpSummary}</p>
        </div>
        <div>
          <span className="font-semibold text-[#121316] block text-[11px] mb-0.5">Value Proposition:</span>
          <p className="text-[#636772] text-[11px] leading-relaxed">{companyData.valueProposition}</p>
        </div>
      </div>

      {/* Tech Stack */}
      {companyData.techStack && companyData.techStack.length > 0 && (
        <div>
          <span className="text-[10px] font-semibold text-[#636772] uppercase tracking-wider block mb-1.5 flex items-center gap-1">
            <Code2 className="w-3 h-3 text-[#8B8F9A]" /> Detected Tech Stack Signals:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {companyData.techStack.map((tech) => (
              <span
                key={tech}
                className="px-2 py-0.5 text-[11px] font-mono bg-[#FAF7F2] text-[#121316] rounded border border-[#E5E0D6]"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Verified Source Links & Excerpts */}
      {companyData.sourceLinks && companyData.sourceLinks.length > 0 && (
        <div className="pt-2 border-t border-[#E5E0D6]">
          <span className="text-[10px] font-semibold text-[#636772] uppercase tracking-wider block mb-1.5 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-[#1E7E34]" /> Public Website Excerpts & Provenance:
          </span>
          <div className="space-y-1.5">
            {companyData.sourceLinks.map((link, idx) => (
              <div
                key={idx}
                className="p-2 rounded-lg bg-[#FAF7F2] border border-[#E5E0D6] text-xs space-y-1"
              >
                <div className="flex items-center justify-between">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-[#FF4713] hover:text-[#E03E0F] inline-flex items-center gap-1 text-[11px]"
                  >
                    {link.title} <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                  <span className="text-[10px] font-mono text-[#4A5404] bg-[#F5F8D5] px-1.5 py-0.2 rounded border border-[#CBD810]">
                    {link.badge}
                  </span>
                </div>
                {link.excerpt && (
                  <p className="text-[10px] text-[#636772] italic font-mono line-clamp-2">
                    "{link.excerpt}"
                  </p>
                )}
                {link.byteCount && (
                  <span className="text-[9px] text-[#8B8F9A] font-mono block">
                    SSRF Bounded Fetch: {(link.byteCount / 1024).toFixed(1)} KB read
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
