import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Coins,
  CheckCircle,
  Copy,
  Download,
  SlidersHorizontal,
  Layers,
  Check,
  Calculator,
  GitBranch,
} from 'lucide-react';
import { EnrichmentPlan } from '../../types/workflow';
import { Badge } from '../common/Badge';

interface Step5EnrichmentPlanProps {
  plan: EnrichmentPlan;
  campaignTitle?: string;
  questionTitle?: string;
  onOpenFollowUp: () => void;
}

export const Step5EnrichmentPlan: React.FC<Step5EnrichmentPlanProps> = ({
  plan,
  campaignTitle,
  questionTitle,
  onOpenFollowUp,
}) => {
  const [activeTab, setActiveTab] = useState<'waterfall' | 'billing' | 'dependencies' | 'sheet' | 'json'>('waterfall');
  const [copied, setCopied] = useState(false);

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(plan, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(plan, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'clay-campaign-enrichment-plan.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Plan Header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#F5F8D5] text-[#4A5404] border border-[#CBD810]">
            <CheckCircle className="w-3.5 h-3.5 text-[#4A5404]" />
            Clay Enrichment Plan Ready
          </div>
          <button
            type="button"
            onClick={onOpenFollowUp}
            className="text-xs text-[#FF4713] hover:text-[#E03E0F] font-semibold inline-flex items-center gap-1 cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" /> Adjust Parameters
          </button>
        </div>
        <h2 className="text-xl font-bold text-[#121316] tracking-tight">{plan.title}</h2>
        <p className="text-xs text-[#636772] mt-1 leading-relaxed">{plan.strategySummary}</p>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-[#FAF7F2] border border-[#E5E0D6] rounded-xl">
        <div className="space-y-1">
          <span className="text-[11px] text-[#636772] font-medium block">Total Credit Cost / Row</span>
          <div className="flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-[#FF4713]" />
            <span className="text-lg font-bold text-[#121316] font-mono">{plan.totalCreditsPerRow} Credits</span>
          </div>
        </div>
        <div className="space-y-1 border-t sm:border-t-0 sm:border-l border-[#E5E0D6] pt-2 sm:pt-0 sm:pl-4">
          <span className="text-[11px] text-[#636772] font-medium block">Account Volume Target</span>
          <span className="text-lg font-bold text-[#FF4713] font-mono">{(plan.accountVolume || 1000).toLocaleString()} Accounts</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-[#E5E0D6] gap-2 sm:gap-4 text-xs font-medium overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('waterfall')}
          className={`pb-2.5 transition flex items-center gap-1.5 flex-shrink-0 cursor-pointer ${
            activeTab === 'waterfall'
              ? 'border-b-2 border-[#FF4713] text-[#FF4713] font-bold'
              : 'text-[#636772] hover:text-[#121316]'
          }`}
        >
          <Layers className="w-3.5 h-3.5" /> Waterfall Steps ({plan.waterfallSteps.length})
        </button>
        <button
          onClick={() => setActiveTab('billing')}
          className={`pb-2.5 transition flex items-center gap-1.5 flex-shrink-0 cursor-pointer ${
            activeTab === 'billing'
              ? 'border-b-2 border-[#FF4713] text-[#FF4713] font-bold'
              : 'text-[#636772] hover:text-[#121316]'
          }`}
        >
          <Calculator className="w-3.5 h-3.5" /> Billing Formulas ({plan.billingFormulas?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('dependencies')}
          className={`pb-2.5 transition flex items-center gap-1.5 flex-shrink-0 cursor-pointer ${
            activeTab === 'dependencies'
              ? 'border-b-2 border-[#FF4713] text-[#FF4713] font-bold'
              : 'text-[#636772] hover:text-[#121316]'
          }`}
        >
          <GitBranch className="w-3.5 h-3.5" /> Prerequisite Graph
        </button>
        <button
          onClick={() => setActiveTab('sheet')}
          className={`pb-2.5 transition flex items-center gap-1.5 flex-shrink-0 cursor-pointer ${
            activeTab === 'sheet'
              ? 'border-b-2 border-[#FF4713] text-[#FF4713] font-bold'
              : 'text-[#636772] hover:text-[#121316]'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" /> Clay Table
        </button>
        <button
          onClick={() => setActiveTab('json')}
          className={`pb-2.5 transition flex items-center gap-1.5 flex-shrink-0 cursor-pointer ${
            activeTab === 'json'
              ? 'border-b-2 border-[#FF4713] text-[#FF4713] font-bold'
              : 'text-[#636772] hover:text-[#121316]'
          }`}
        >
          <Download className="w-3.5 h-3.5" /> Export JSON
        </button>
      </div>

      {/* Tab 1: Waterfall Steps */}
      {activeTab === 'waterfall' && (
        <div className="space-y-3">
          {plan.waterfallSteps.map((step) => (
            <div
              key={step.stepNumber}
              className="p-4 rounded-xl border border-[#E5E0D6] bg-white space-y-2.5 hover:border-[#FF4713] transition shadow-xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#FF4713] text-white font-bold text-xs flex items-center justify-center font-mono">
                    {step.stepNumber}
                  </span>
                  <span className="font-bold text-sm text-[#121316] font-mono">{step.columnName}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FAF7F2] text-[#636772] border border-[#E5E0D6] font-semibold">
                    {step.catalogueId}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="blue">{step.provider}</Badge>
                  <span className="text-xs font-mono font-bold text-[#B25E00] bg-[#FFF4E5] px-2 py-0.5 rounded border border-[#FFE2B8]">
                    {step.costCredits} {step.costUnit || 'credits/row'}
                  </span>
                </div>
              </div>

              <p className="text-xs text-[#636772] leading-relaxed">{step.purpose}</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-[#E5E0D6] text-[11px] text-[#636772]">
                <div>
                  <span className="font-semibold text-[#121316] block">Evidence Supplied:</span>
                  <span className="text-[#636772]">{step.evidenceSupplied}</span>
                </div>
                <div>
                  <span className="font-semibold text-[#121316] block">Prerequisites:</span>
                  <span className="text-[#636772] font-mono">{step.prerequisites.join(', ')}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-[10px] text-[#8B8F9A] border-t border-[#E5E0D6]">
                <span>
                  <strong>Supported Decisions:</strong> {step.supportedDecisions}
                </span>
                <span className="font-mono text-[#1E7E34] font-medium">{step.sourceProvenance}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 2: Billing Formulas Calculated in Code */}
      {activeTab === 'billing' && (
        <div className="space-y-3 animate-fadeIn">
          <div className="p-3 rounded-lg bg-[#FAF7F2] border border-[#E5E0D6] text-xs text-[#636772]">
            <strong className="text-[#121316]">Code-Calculated Billing Rules:</strong> Calculates credit usage and dollar estimates based on account volume ({(plan.accountVolume || 1000).toLocaleString()}), vendor pricing units, and estimated match rates.
          </div>

          <div className="divide-y divide-[#E5E0D6] border border-[#E5E0D6] rounded-xl overflow-hidden bg-white shadow-xs">
            {(plan.billingFormulas || []).map((formula, idx) => (
              <div key={idx} className="p-3.5 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#121316] flex items-center gap-2">
                    <span className="text-[#8B8F9A] font-mono">{formula.actionId}:</span>
                    {formula.actionName}
                  </span>
                  <span className="font-mono font-bold text-[#B25E00] bg-[#FFF4E5] px-2 py-0.5 rounded border border-[#FFE2B8]">
                    ~{formula.estimatedCreditsTotal.toLocaleString()} Credits
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#636772] font-mono">
                  <span>Provider: {formula.provider} ({formula.billingUnit})</span>
                  <span>Match Rate: ~{(formula.estimatedMatchRate * 100).toFixed(0)}%</span>
                </div>
                <div className="p-2 rounded bg-[#FAF7F2] border border-[#E5E0D6] text-[#FF4713] font-mono text-[11px]">
                  Formula: {formula.formulaText}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Prerequisite Graph */}
      {activeTab === 'dependencies' && (
        <div className="space-y-3 animate-fadeIn">
          <div className="p-3 rounded-lg bg-[#FAF7F2] border border-[#E5E0D6] text-xs text-[#636772]">
            <strong className="text-[#121316]">Input Prerequisite & Cycle Resolution Graph:</strong> Each action's required fields are validated in code. Missing fields are automatically resolved by preceding prerequisite actions.
          </div>

          <div className="space-y-2">
            {(plan.dependencyGraph || []).map((dep, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl border border-[#E5E0D6] bg-white text-xs flex items-center justify-between gap-3 shadow-xs"
              >
                <div className="space-y-0.5">
                  <span className="font-bold text-[#121316] block">{dep.actionName}</span>
                  <span className="text-[11px] text-[#636772] font-mono">
                    Requires: <code className="text-[#FF4713]">{dep.requiredInput}</code>
                  </span>
                </div>
                <div className="text-right">
                  {dep.status === 'satisfied' ? (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-[#F5F8D5] text-[#4A5404] border border-[#CBD810]">
                      Satisfied by Seed List
                    </span>
                  ) : dep.status === 'resolved_via_prerequisite' ? (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-[#EDF5FF] text-[#1E6FD9] border border-[#D0E2FF]">
                      Supplied by: {dep.providedByActionName || dep.providedByActionId}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-[#FFF4E5] text-[#B25E00] border border-[#FFE2B8]">
                      Unresolved Gap
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Clay Table Preview */}
      {activeTab === 'sheet' && (
        <div className="rounded-xl border border-[#E5E0D6] overflow-hidden bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#121316] font-mono">
              <thead className="bg-[#FAF7F2] text-[#636772] border-b border-[#E5E0D6] text-[11px]">
                <tr>
                  <th className="py-2.5 px-3 border-r border-[#E5E0D6]">#</th>
                  <th className="py-2.5 px-3 border-r border-[#E5E0D6]">company_domain</th>
                  {plan.waterfallSteps.map((s) => (
                    <th key={s.stepNumber} className="py-2.5 px-3 border-r border-[#E5E0D6] whitespace-nowrap">
                      {s.columnName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E0D6] text-[11px]">
                <tr className="hover:bg-[#FAF7F2]">
                  <td className="py-2.5 px-3 border-r border-[#E5E0D6] text-[#8B8F9A]">1</td>
                  <td className="py-2.5 px-3 border-r border-[#E5E0D6] text-[#121316] font-semibold">linear.app</td>
                  {plan.waterfallSteps.map((s, idx) => (
                    <td key={idx} className="py-2.5 px-3 border-r border-[#E5E0D6] text-[#FF4713] whitespace-nowrap">
                      [Verified {s.provider}]
                    </td>
                  ))}
                </tr>
                <tr className="hover:bg-[#FAF7F2]">
                  <td className="py-2.5 px-3 border-r border-[#E5E0D6] text-[#8B8F9A]">2</td>
                  <td className="py-2.5 px-3 border-r border-[#E5E0D6] text-[#121316] font-semibold">stripe.com</td>
                  {plan.waterfallSteps.map((s, idx) => (
                    <td key={idx} className="py-2.5 px-3 border-r border-[#E5E0D6] text-[#FF4713] whitespace-nowrap">
                      [Verified {s.provider}]
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Export JSON */}
      {activeTab === 'json' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#636772] font-medium">Clay Waterfall JSON Schema:</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyJson}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#FAF7F2] hover:bg-[#F0ECE1] text-[#121316] border border-[#E5E0D6] transition inline-flex items-center gap-1.5 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-[#1E7E34]" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                type="button"
                onClick={handleDownloadJson}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#FF4713] hover:bg-[#E03E0F] text-white transition inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Download
              </button>
            </div>
          </div>
          <pre className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E5E0D6] text-xs font-mono text-[#121316] overflow-x-auto max-h-96 leading-relaxed">
            {JSON.stringify(plan, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
