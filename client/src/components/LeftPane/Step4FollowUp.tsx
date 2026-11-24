import React, { useState } from 'react';
import { SlidersHorizontal, RotateCcw, RefreshCw, Check, Sparkles, Hash, Calendar, DollarSign } from 'lucide-react';
import { workflowEngine } from '../../services/workflowEngine';

interface Step4FollowUpProps {
  currentNotes: string;
  selectedCampaignTitle?: string;
  selectedQuestionTitle?: string;
  isLoading: boolean;
}

export const Step4FollowUp: React.FC<Step4FollowUpProps> = ({
  currentNotes,
  selectedCampaignTitle,
  selectedQuestionTitle,
  isLoading,
}) => {
  const [notes, setNotes] = useState(currentNotes);
  const [targetGeo, setTargetGeo] = useState('North America & Western Europe');
  const [minHeadcount, setMinHeadcount] = useState('50 - 500 Employees');
  const [creditLimit, setCreditLimit] = useState('8 Credits / lead');
  const [accountVolume, setAccountVolume] = useState('1000');
  const [timeWindow, setTimeWindow] = useState('Last 60 Days');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleApply = async () => {
    const combinedNotes = `Target Accounts Volume: ${accountVolume}; Geography: ${targetGeo}; Headcount: ${minHeadcount}; Max Credits: ${creditLimit}; Time Window: ${timeWindow}; Directives: ${notes}`;
    workflowEngine.updateFollowUp(combinedNotes);
    const run = workflowEngine.getRun();
    if (run.selectedQuestionId) {
      await workflowEngine.approveDecisionQuestion(run.selectedQuestionId, combinedNotes);
    }
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#FFF0EB] text-[#FF4713] border border-[#FFD9CC] mb-2">
          <SlidersHorizontal className="w-3.5 h-3.5 text-[#FF4713]" />
          Follow-up & Revision Parameters
        </div>
        <h2 className="text-xl font-bold text-[#121316] tracking-tight">
          Tune Parameters & Revise Choices
        </h2>
        <p className="text-xs sm:text-sm text-[#636772] mt-1">
          Adjust ICP thresholds, time windows, and target account volume for code-based cost calculation.
        </p>
      </div>

      {/* Review current choices */}
      <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E5E0D6] space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#636772]">
          Current Approved Selections
        </h3>
        <div className="flex items-start justify-between gap-2 p-3 bg-white rounded-lg border border-[#E5E0D6]">
          <div className="text-xs">
            <span className="font-semibold text-[#636772] block text-[11px]">Approved Campaign:</span>
            <span className="text-[#121316] font-medium">{selectedCampaignTitle || 'Not selected'}</span>
          </div>
          <button
            type="button"
            onClick={() => workflowEngine.reviseStep(2)}
            className="text-xs text-[#FF4713] hover:text-[#E03E0F] font-semibold inline-flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" /> Change
          </button>
        </div>

        <div className="flex items-start justify-between gap-2 p-3 bg-white rounded-lg border border-[#E5E0D6]">
          <div className="text-xs">
            <span className="font-semibold text-[#636772] block text-[11px]">Gating Persona / Gate:</span>
            <span className="text-[#121316] font-medium">{selectedQuestionTitle || 'Not selected'}</span>
          </div>
          <button
            type="button"
            onClick={() => workflowEngine.reviseStep(3)}
            className="text-xs text-[#FF4713] hover:text-[#E03E0F] font-semibold inline-flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" /> Change
          </button>
        </div>
      </div>

      {/* Parameter options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div>
          <label className="block text-xs font-semibold text-[#121316] mb-1">
            Target Account Volume (List Size)
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8B8F9A]">
              <Hash className="w-3.5 h-3.5" />
            </div>
            <select
              value={accountVolume}
              onChange={(e) => setAccountVolume(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-[#E5E0D6] rounded-lg text-xs text-[#121316] focus:outline-none focus:ring-1 focus:ring-[#FF4713] focus:border-[#FF4713] font-medium"
            >
              <option value="500">500 Target Accounts</option>
              <option value="1000">1,000 Target Accounts (Standard)</option>
              <option value="2500">2,500 Target Accounts</option>
              <option value="5000">5,000 Target Accounts (Scale)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#121316] mb-1">
            Evidence Time Window
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8B8F9A]">
              <Calendar className="w-3.5 h-3.5" />
            </div>
            <select
              value={timeWindow}
              onChange={(e) => setTimeWindow(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-[#E5E0D6] rounded-lg text-xs text-[#121316] focus:outline-none focus:ring-1 focus:ring-[#FF4713] focus:border-[#FF4713] font-medium"
            >
              <option value="Last 30 Days">Last 30 Days (Highest Recency)</option>
              <option value="Last 60 Days">Last 60 Days (Standard)</option>
              <option value="Last 90 Days">Last 90 Days (Broader Coverage)</option>
              <option value="Past 6 Months">Past 6 Months</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#121316] mb-1">
            Target Geography
          </label>
          <select
            value={targetGeo}
            onChange={(e) => setTargetGeo(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-[#E5E0D6] rounded-lg text-xs text-[#121316] focus:outline-none focus:ring-1 focus:ring-[#FF4713] focus:border-[#FF4713] font-medium"
          >
            <option>North America & Western Europe</option>
            <option>United States & Canada Only</option>
            <option>Global (Worldwide English-speaking)</option>
            <option>EMEA Region</option>
            <option>APAC Region</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#121316] mb-1">
            Company Headcount Threshold
          </label>
          <select
            value={minHeadcount}
            onChange={(e) => setMinHeadcount(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-[#E5E0D6] rounded-lg text-xs text-[#121316] focus:outline-none focus:ring-1 focus:ring-[#FF4713] focus:border-[#FF4713] font-medium"
          >
            <option>20 - 100 Employees (Early Stage)</option>
            <option>50 - 500 Employees (Mid-Market)</option>
            <option>500 - 2,000 Employees (Enterprise Scale)</option>
            <option>2,000+ Employees (Global Enterprise)</option>
          </select>
        </div>
      </div>

      {/* Freeform Notes / Follow-up information */}
      <div>
        <label className="block text-xs font-semibold text-[#121316] mb-1">
          Custom Directives & Specific Qualification Rules
        </label>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Prioritize companies who recently raised funding; exclude agencies and consultancies; ensure contact has VP or Director in title..."
          className="w-full p-3 bg-white border border-[#E5E0D6] rounded-lg text-xs text-[#121316] placeholder-[#8B8F9A] focus:outline-none focus:ring-1 focus:ring-[#FF4713] focus:border-[#FF4713] leading-relaxed resize-none shadow-inner"
        />
      </div>

      {/* Actions */}
      <div className="pt-3 border-t border-[#E5E0D6] flex items-center justify-between">
        <span className="text-xs text-[#636772]">
          {savedSuccess ? (
            <span className="text-[#1E7E34] font-medium flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Parameters updated & plan re-synthesized!
            </span>
          ) : (
            'Updates recalculate the waterfall and formula billing in real-time.'
          )}
        </span>
        <button
          type="button"
          onClick={handleApply}
          disabled={isLoading}
          className="px-5 py-2 text-xs font-bold text-white bg-[#FF4713] hover:bg-[#E03E0F] disabled:opacity-50 rounded-lg transition shadow-sm inline-flex items-center gap-1.5 cursor-pointer"
        >
          {isLoading ? (
            'Re-synthesizing...'
          ) : (
            <>
              <RefreshCw className="w-3.5 h-3.5" /> Apply & Rebuild Plan
            </>
          )}
        </button>
      </div>
    </div>
  );
};
