import React from 'react';
import { Database, AlertTriangle, ShieldAlert, Sparkles, FileSpreadsheet, Calculator, CheckCircle2 } from 'lucide-react';
import { CatalogSelection, UnresolvedGap, BillingFormulaDetail, PrerequisiteDependency } from '../../types/workflow';
import { Badge } from '../common/Badge';

interface CatalogAndCostCardProps {
  catalogSelections: CatalogSelection[];
  unresolvedGaps: UnresolvedGap[];
  billingFormulas?: BillingFormulaDetail[];
  dependencyGraph?: PrerequisiteDependency[];
  totalCredits?: number;
  costPerThousand?: string;
}

export const CatalogAndCostCard: React.FC<CatalogAndCostCardProps> = ({
  catalogSelections,
  unresolvedGaps,
  billingFormulas = [],
  dependencyGraph = [],
  totalCredits = 6,
  costPerThousand = '$60.00 USD',
}) => {
  if (catalogSelections.length === 0) {
    return (
      <div className="p-6 rounded-2xl border border-dashed border-[#E5E0D6] bg-white/60 text-center">
        <Database className="w-6 h-6 text-[#8B8F9A] mx-auto mb-1.5 opacity-60" />
        <h4 className="text-xs font-bold text-[#121316]">Catalogue Selections & Cost Summary</h4>
        <p className="text-[11px] text-[#636772] mt-0.5">
          Matched actions from the 1,224 Clay catalogue and credit costs will appear here once the enrichment plan is finalized.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-5 rounded-2xl border border-[#E5E0D6] bg-white shadow-xs space-y-3.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-[#FF4713]" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#121316]">
            Retrieved Actions & Code-Calculated Costs
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-[#4A5404] bg-[#F5F8D5] px-2 py-0.5 rounded border border-[#CBD810] font-semibold">
            v3 Catalogue
          </span>
          <span className="text-xs font-mono font-bold text-[#FF4713] bg-[#FFF0EB] px-2 py-0.5 rounded border border-[#FFD9CC]">
            {totalCredits} cr / row
          </span>
        </div>
      </div>

      {/* Providers matched from 1,224 catalogue */}
      <div className="space-y-2">
        <span className="text-[10px] font-semibold text-[#636772] uppercase tracking-wider block">
          Matched Actions from 1,224 Canonical Inventory:
        </span>
        <div className="divide-y divide-[#E5E0D6] border border-[#E5E0D6] rounded-xl overflow-hidden bg-white shadow-xs">
          {catalogSelections.map((item, idx) => (
            <div key={idx} className="p-2.5 flex items-center justify-between text-xs bg-white">
              <div className="space-y-0.5">
                <div className="font-semibold text-[#121316] flex items-center gap-1.5">
                  <span>{item.provider}</span>
                  {item.catalogueId && (
                    <span className="text-[10px] font-mono text-[#636772] bg-[#FAF7F2] px-1.5 py-0.2 rounded border border-[#E5E0D6]">
                      {item.catalogueId}
                    </span>
                  )}
                  {item.sourceRow && (
                    <span className="text-[9px] font-mono text-[#8B8F9A]">Row #{item.sourceRow}</span>
                  )}
                </div>
                <div className="text-[10px] text-[#636772] font-mono">{item.dataSupplied}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="slate" size="sm">
                  {item.category}
                </Badge>
                <span className="text-[11px] font-mono font-bold text-[#B25E00] bg-[#FFF4E5] px-1.5 py-0.5 rounded border border-[#FFE2B8]">
                  {item.costCredits} cr
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Code-Calculated Billing Formulas */}
      {billingFormulas.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-[#E5E0D6]">
          <span className="text-[10px] font-semibold text-[#636772] uppercase tracking-wider block flex items-center gap-1">
            <Calculator className="w-3 h-3 text-[#FF4713]" /> Billing Formulas (Deterministic Code Calculation):
          </span>
          <div className="space-y-1.5 font-mono text-[10px]">
            {billingFormulas.map((f, idx) => (
              <div key={idx} className="p-2 rounded bg-[#FAF7F2] border border-[#E5E0D6] flex items-center justify-between">
                <span className="text-[#121316]">{f.actionName}</span>
                <span className="text-[#FF4713] font-bold">~{f.estimatedCreditsTotal} credits</span>
              </div>
            ))}
          </div>
        </div>
      )}


      {/* Unresolved Evidence Gaps */}
      {unresolvedGaps && unresolvedGaps.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-[#E5E0D6]">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#B25E00]">
            <ShieldAlert className="w-4 h-4 text-[#B25E00]" />
            Unresolved Evidence Gaps & Mitigations:
          </div>
          <div className="space-y-2">
            {unresolvedGaps.map((gap, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-lg bg-[#FFF4E5] border border-[#FFE2B8] text-xs text-[#B25E00] space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#121316]">{gap.gapName}</span>
                  {gap.prerequisiteNeeded && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white text-[#B25E00] border border-[#FFE2B8]">
                      Prerequisite: {gap.prerequisiteNeeded}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#636772] leading-snug">{gap.mitigationAdvice}</p>
                <p className="text-[10px] text-[#8B8F9A] italic">Impact: {gap.impact}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
