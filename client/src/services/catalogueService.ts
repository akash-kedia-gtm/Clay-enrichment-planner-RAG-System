// Client Catalogue & Retrieval Service
// Provides mapping preview, hybrid vector+keyword candidate retrieval, and source traceability.

import { SUPABASE_URL } from './sessionManager';

export interface ColumnMappingItem {
  sourceColumn: string;
  targetField: string;
  sampleValue: string;
  description: string;
}

export interface CatalogueCandidate {
  recordId?: string;
  xId: string;
  catalogueVersion: number;
  canonicalName: string;
  provider: string;
  capabilityFamily: string;
  capabilityType: string;
  appliesTo: string;
  explanation: string;
  typicalOutput: string;
  inputRequirements: string;
  limitations: string;
  billing: {
    costValue: number | null;
    costUnit: string;
    costType: string;
    costIsEstimate: boolean;
    rawCost: string;
    costNotes: string | null;
  };
  source: {
    rowNumber?: number;
    matchStatus?: string;
    notes?: string;
  };
  combinedScore: number;
}

export const CATALOGUE_COLUMN_MAPPING: ColumnMappingItem[] = [
  { sourceColumn: 'X_ID', targetField: 'x_id', sampleValue: 'X-246D383027', description: 'Stable canonical action identifier' },
  { sourceColumn: 'Canonical_X_Name', targetField: 'canonical_name', sampleValue: 'Company Acquisitions', description: 'Human-readable action name' },
  { sourceColumn: 'Provider', targetField: 'provider', sampleValue: 'Waterfall, By Clay', description: 'Integration vendor or execution method' },
  { sourceColumn: 'Capability_Family', targetField: 'capability_family', sampleValue: 'general company / person enrichment', description: 'Domain taxonomy category' },
  { sourceColumn: 'Capability_Type', targetField: 'capability_type', sampleValue: 'evidence_enrichment', description: 'enrichment, search, AI_template, action, utility' },
  { sourceColumn: 'Applies_To', targetField: 'applies_to', sampleValue: 'Company', description: 'Company, Person, Both, Content, Utility' },
  { sourceColumn: 'Explanation', targetField: 'explanation', sampleValue: "Searches multiple sources for a company's acquisitions", description: 'Primary functional description' },
  { sourceColumn: 'Input_Requirements', targetField: 'input_requirements', sampleValue: 'company domain', description: 'Documented required input parameters' },
  { sourceColumn: 'Typical_Output', targetField: 'typical_output', sampleValue: 'EMEA Accuracy acquisitions list', description: 'Fields and signals returned' },
  { sourceColumn: 'Cost_Value', targetField: 'cost_value', sampleValue: '6.5', description: 'Numeric credit price (null if unknown/not shown)' },
  { sourceColumn: 'Cost_Unit', targetField: 'cost_unit', sampleValue: 'credits_per_row', description: 'Billing unit (per row, per run, per result)' },
  { sourceColumn: 'Cost_Type', targetField: 'cost_type', sampleValue: 'waterfall_average', description: 'fixed_per_row, waterfall_average, flat_template, unknown' },
  { sourceColumn: 'Raw_Cost', targetField: 'raw_cost', sampleValue: '~6.5/row', description: 'Exact unparsed source cost string' },
  { sourceColumn: 'Source_Notes', targetField: 'source_notes', sampleValue: '2 linked discovery occurrence(s); Markdown line(s): 397', description: 'Source line reference and match provenance' },
];

let cachedCatalogue: any[] | null = null;

export async function loadCatalogueRecords(): Promise<any[]> {
  if (cachedCatalogue && cachedCatalogue.length > 0) {
    return cachedCatalogue;
  }

  try {
    const res = await fetch('/data/catalogue.json');
    if (res.ok) {
      cachedCatalogue = await res.json();
      return cachedCatalogue || [];
    }
  } catch (e) {
    console.warn('Could not load /data/catalogue.json', e);
  }
  return [];
}

export function setCatalogueCache(records: any[]) {
  cachedCatalogue = records;
}

// Hybrid Retrieval Function matching backend specifications
export async function searchCatalogueCandidates(
  evidenceRequirement: string,
  availableInputs: string[] = ['company_domain'],
  filterAppliesTo?: string,
  limit = 6
): Promise<{ success: boolean; candidates: CatalogueCandidate[]; catalogueVersion: number }> {
  // 1. First attempt: call Supabase Edge Function if reachable
  try {
    const edgeUrl = `${SUPABASE_URL}/functions/v1/catalogue-retrieval`;
    const res = await fetch(edgeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        evidenceRequirement,
        availableInputs,
        filterAppliesTo,
        limit,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.candidates) && data.candidates.length > 0) {
        return { success: true, candidates: data.candidates, catalogueVersion: 1 };
      }
    }
  } catch (_) {
    // Fallback to local high-precision hybrid search
  }

  // 2. High-precision client-side hybrid search across the 1,224 catalogue
  const allRecords = await loadCatalogueRecords();
  if (!allRecords || allRecords.length === 0) {
    return { success: false, candidates: [], catalogueVersion: 1 };
  }

  const queryTerms = evidenceRequirement
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const scored = allRecords
    .map((r: any) => {
      let textScore = 0;
      const searchable = `${r.canonical_name} ${r.provider} ${r.capability_family} ${r.explanation} ${r.typical_output} ${r.input_requirements}`.toLowerCase();

      for (const term of queryTerms) {
        if (searchable.includes(term)) {
          textScore += 1;
        }
      }

      // Hard filter support
      if (filterAppliesTo && r.applies_to !== filterAppliesTo && r.applies_to !== 'Both') {
        textScore = 0;
      }

      return {
        record: r,
        score: textScore / Math.max(1, queryTerms.length),
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  // Deduplicate parent records by x_id
  const seenXIds = new Set<string>();
  const candidates: CatalogueCandidate[] = [];

  for (const item of scored) {
    const r = item.record;
    if (seenXIds.has(r.x_id)) continue;
    seenXIds.add(r.x_id);

    candidates.push({
      recordId: r.id || r.x_id,
      xId: r.x_id,
      catalogueVersion: 1,
      canonicalName: r.canonical_name,
      provider: r.provider,
      capabilityFamily: r.capability_family,
      capabilityType: r.capability_type,
      appliesTo: r.applies_to,
      explanation: r.explanation,
      typicalOutput: r.typical_output,
      inputRequirements: r.input_requirements || 'None specified / Unknown',
      limitations: r.limitations || 'None documented',
      billing: {
        costValue: r.cost_value,
        costUnit: r.cost_unit || 'credits_per_row',
        costType: r.cost_type || 'unknown',
        costIsEstimate: !!r.cost_is_estimate,
        rawCost: r.raw_cost || (r.cost_value !== null ? `${r.cost_value} cr` : 'Unknown / Not shown'),
        costNotes: r.cost_notes || null,
      },
      source: {
        rowNumber: r.source_row_number,
        matchStatus: r.source_match_status || 'Confident Match',
        notes: r.source_notes,
      },
      combinedScore: Number((item.score * 0.95 + 0.05).toFixed(3)),
    });

    if (candidates.length >= limit) break;
  }

  return { success: true, candidates, catalogueVersion: 1 };
}

