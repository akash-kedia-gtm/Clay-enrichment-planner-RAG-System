import React, { useState } from 'react';
import { Globe, ArrowRight, Sparkles, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { workflowEngine } from '../../services/workflowEngine';

interface Step1UrlInputProps {
  isLoading: boolean;
}

export const Step1UrlInput: React.FC<Step1UrlInputProps> = ({ isLoading }) => {
  const [url, setUrl] = useState('');
  const [showManualDescription, setShowManualDescription] = useState(false);
  const [manualDescription, setManualDescription] = useState('');
  const [validationError, setValidationError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = url.trim();
    if (!raw) {
      setValidationError('Please enter a company website URL or domain (e.g. stripe.com, www.stripe.com, or https://stripe.com).');
      return;
    }
    // Clean domain check to support www., http://, https://, or bare domain
    const domainPart = raw.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];
    if (!domainPart.includes('.') || domainPart.endsWith('.')) {
      setValidationError('Please enter a valid domain (e.g. linear.app, www.linear.app, or https://linear.app).');
      return;
    }
    setValidationError('');
    await workflowEngine.startAnalysis(raw, manualDescription.trim() || undefined);
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      <div>
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#FFF0EB] text-[#D83A0C] border border-[#FFD5C7] mb-2">
          <Sparkles className="w-3 h-3 text-[#FF4713]" />
          Step 1: Company Intelligence & Bounded Fetch
        </div>
        <h2 className="text-base font-bold text-[#121316] tracking-tight">
          Enter Company Website
        </h2>
        <p className="text-[11px] text-[#636772] mt-0.5 leading-relaxed">
          Provide your target company URL. The system conducts a bounded, SSRF-safe public fetch of offering, customers, and positioning before formulating strategic campaigns.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div>
          <label htmlFor="company-url" className="block text-[11px] font-medium text-[#121316] mb-1.5">
            Target Company Domain or URL
          </label>
          <div className="relative rounded-xl shadow-xs">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8C909B]">
              <Globe className="h-4 w-4" />
            </div>
            <input
              id="company-url"
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (validationError) setValidationError('');
              }}
              disabled={isLoading}
              placeholder="e.g. stripe.com, www.linear.app, or https://segment.com"
              className="block w-full pl-9 pr-24 py-2 text-xs bg-white border border-[#E5E0D6] rounded-xl placeholder-[#8C909B] focus:outline-none focus:ring-2 focus:ring-[#FF4713]/20 focus:border-[#FF4713] text-[#121316] font-medium"
            />
            <div className="absolute inset-y-1 right-1 flex items-center">
              <button
                type="submit"
                disabled={isLoading}
                className="h-full px-3 text-[11px] font-bold text-white bg-[#FF4713] hover:bg-[#E03E0F] disabled:opacity-50 rounded-lg transition shadow-2xs inline-flex items-center gap-1"
              >
                {isLoading ? (
                  'Analyzing...'
                ) : (
                  <>
                    Analyze <ArrowRight className="w-3 h-3" />
                  </>
                )}
              </button>
            </div>
          </div>
          {validationError && (
            <p className="text-[11px] text-rose-600 mt-1.5 font-medium">{validationError}</p>
          )}
        </div>

        {/* Manual Company Description Accordion (for unreadable/firewalled sites) */}
        <div className="border border-[#E5E0D6] rounded-xl p-2.5 bg-[#FAF7F2]">
          <button
            type="button"
            onClick={() => setShowManualDescription(!showManualDescription)}
            className="w-full flex items-center justify-between text-[11px] text-[#636772] hover:text-[#121316] transition font-medium"
          >
            <span className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#FF4713]" />
              Website behind login or cannot be read? Supply description directly
            </span>
            {showManualDescription ? (
              <ChevronUp className="w-3.5 h-3.5 text-[#8C909B]" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-[#8C909B]" />
            )}
          </button>

          {showManualDescription && (
            <div className="mt-2.5 pt-2.5 border-t border-[#E5E0D6] space-y-1.5 animate-fadeIn">
              <label htmlFor="company-description" className="block text-[10px] font-semibold text-[#121316]">
                Custom Company Overview, Product Offering & ICP:
              </label>
              <textarea
                id="company-description"
                rows={3}
                value={manualDescription}
                onChange={(e) => setManualDescription(e.target.value)}
                placeholder="e.g. Linear builds modern software project management for fast-moving engineering teams, integrating with GitHub to streamline issue tracking..."
                className="w-full p-2 bg-white border border-[#E5E0D6] rounded-lg text-xs text-[#121316] placeholder-[#8C909B] focus:outline-none focus:ring-1 focus:ring-[#FF4713] focus:border-[#FF4713] leading-relaxed resize-none"
              />
              <span className="text-[9px] text-[#8C909B] block">
                If provided, LLM uses this description alongside any public website excerpts fetched.
              </span>
            </div>
          )}
        </div>
      </form>
    </div>
  );
};
