import React, { useState, useEffect } from 'react';
import {
  X,
  FileSpreadsheet,
  CheckCircle2,
  UploadCloud,
  AlertCircle,
  Database,
  Layers,
  Sparkles,
} from 'lucide-react';
import { loadCatalogueRecords } from '../services/catalogueService';
import { supabase } from '../services/sessionManager';

interface CatalogueModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CatalogueModal: React.FC<CatalogueModalProps> = ({ isOpen, onClose }) => {
  const [totalRecords, setTotalRecords] = useState(1224);
  const [syncedCount, setSyncedCount] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'completed' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Check remote count on open
  useEffect(() => {
    if (isOpen) {
      checkRemoteCount();
    }
  }, [isOpen]);

  const checkRemoteCount = async () => {
    try {
      const { count, error } = await supabase
        .from('catalogue_records')
        .select('*', { count: 'exact', head: true });

      if (!error && count !== null) {
        setSyncedCount(count);
        if (count >= 1224) {
          setSyncStatus('completed');
          setSyncMessage(`All ${count} canonical Clay actions are synced and active in Supabase pgvector.`);
        }
      }
    } catch (_) {}
  };

  const handleStartSync = async () => {
    setIsSyncing(true);
    setSyncStatus('syncing');
    setSyncMessage('Streaming 384-dimensional catalogue records to Supabase...');

    try {
      const records = await loadCatalogueRecords();
      if (!records || records.length === 0) {
        throw new Error('Catalogue data file could not be loaded.');
      }

      setTotalRecords(records.length);

      // Ensure default catalogue container exists
      try {
        await supabase.from('catalogues').upsert({
          id: '00000000-0000-0000-0000-000000000002',
          name: 'Clay 1200+ Canonical Inventory v3',
          version: 1,
          is_active: true,
          total_records: records.length,
        }, { onConflict: 'id' });
      } catch (_) {}

      const batchSize = 40;
      const total = records.length;

      for (let i = 0; i < total; i += batchSize) {
        const batch = records.slice(i, i + batchSize).map((r) => ({
          catalogue_id: '00000000-0000-0000-0000-000000000002',
          x_id: r.x_id,
          canonical_name: r.canonical_name,
          enrichment_name: r.enrichment_name,
          provider: r.provider,
          capability_family: r.capability_family,
          capability_type: r.capability_type,
          applies_to: r.applies_to,
          explanation: r.explanation,
          typical_output: r.typical_output,
          input_requirements: r.input_requirements,
          limitations: r.limitations,
          cost_value: r.cost_value,
          cost_unit: r.cost_unit,
          cost_type: r.cost_type,
          cost_is_estimate: r.cost_is_estimate,
          raw_cost: r.raw_cost,
          source_notes: r.source_notes,
          source_row_number: r.source_row_number,
          content_hash: r.content_hash,
          embedding: r.embedding,
        }));

        let { error: insertErr } = await supabase.from('catalogue_records').upsert(batch, {
          onConflict: 'catalogue_id,x_id',
        });

        // Fallback to plain insert if constraint missing
        if (insertErr && (insertErr.message?.includes('ON CONFLICT') || insertErr.message?.includes('constraint'))) {
          const insertRes = await supabase.from('catalogue_records').insert(batch);
          insertErr = insertRes.error;
        }

        if (insertErr) {
          throw new Error(`Sync error on batch ${i / batchSize + 1}: ${insertErr.message}`);
        }

        const currentCount = Math.min(i + batchSize, total);
        setSyncedCount(currentCount);
        setSyncMessage(`Streamed ${currentCount} / ${total} records to Supabase PostgreSQL...`);
      }

      setIsSyncing(false);
      setSyncStatus('completed');
      setSyncMessage(`Successfully stored and indexed all ${total} canonical actions with 384-dim pgvector embeddings!`);
    } catch (err: any) {
      setIsSyncing(false);
      setSyncStatus('error');
      setSyncMessage(err.message || 'Failed to sync catalogue to Supabase.');
    }
  };

  if (!isOpen) return null;

  const isFullySynced = syncedCount !== null && syncedCount >= 1224;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white border border-[#E5E0D6] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden text-[#121316] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E5E0D6] flex items-center justify-between bg-[#FAF7F2]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFF0EB] border border-[#FFD9CC] text-[#FF4713] flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[#121316]">Clay Enrichment Catalogue</h3>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-[#F5F8D5] text-[#4A5404] border border-[#CBD810] uppercase">
                  Version 1 Active
                </span>
              </div>
              <p className="text-xs text-[#636772]">1,224 Canonical Clay Actions with Pre-computed Embeddings</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#8B8F9A] hover:text-[#121316] p-1 rounded-md hover:bg-[#FAF7F2] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Status Overview Card */}
          <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E5E0D6] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-[#121316]">
                <Database className="w-4 h-4 text-[#FF4713]" />
                <span>Supabase PostgreSQL pgvector</span>
              </div>
              <span
                className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                  isFullySynced
                    ? 'bg-[#F5F8D5] text-[#4A5404] border border-[#CBD810]'
                    : 'bg-[#FFF4E5] text-[#B25E00] border border-[#FFE2B8]'
                }`}
              >
                {isFullySynced ? 'Ready & Indexed' : 'Incomplete / Unsynced'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-2.5 bg-white rounded-lg border border-[#E5E0D6]">
                <span className="text-[10px] text-[#636772] block">Client Seed File</span>
                <span className="text-base font-bold text-[#121316] font-mono">1,224 Records</span>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-[#E5E0D6]">
                <span className="text-[10px] text-[#636772] block">Supabase Remote Count</span>
                <span className="text-base font-bold text-[#121316] font-mono">
                  {syncedCount !== null ? `${syncedCount} Records` : 'Checking...'}
                </span>
              </div>
            </div>

            {/* Sync Progress or Status Message */}
            {syncMessage && (
              <div className="p-2.5 rounded-lg bg-white border border-[#E5E0D6] text-xs flex items-start gap-2">
                {syncStatus === 'completed' ? (
                  <CheckCircle2 className="w-4 h-4 text-[#1E7E34] flex-shrink-0 mt-0.5" />
                ) : syncStatus === 'error' ? (
                  <AlertCircle className="w-4 h-4 text-[#C92A2A] flex-shrink-0 mt-0.5" />
                ) : (
                  <Sparkles className="w-4 h-4 text-[#FF4713] flex-shrink-0 mt-0.5 animate-spin" />
                )}
                <span className="text-[#636772] font-mono text-[11px] leading-snug">{syncMessage}</span>
              </div>
            )}
          </div>

          {/* Sync Button */}
          {!isFullySynced && (
            <button
              type="button"
              onClick={handleStartSync}
              disabled={isSyncing}
              className="w-full py-2.5 px-4 text-xs font-bold text-white bg-[#FF4713] hover:bg-[#E03E0F] disabled:opacity-50 rounded-xl transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <UploadCloud className="w-4 h-4" />
              {isSyncing ? 'Streaming to Supabase...' : 'Sync 1,224 Actions to Supabase'}
            </button>
          )}

          {isFullySynced && (
            <div className="p-3 bg-[#F5F8D5] border border-[#CBD810] rounded-xl text-xs text-[#4A5404] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#1E7E34] flex-shrink-0" />
              <span>Full semantic search and hybrid catalog queries are fully operational.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
