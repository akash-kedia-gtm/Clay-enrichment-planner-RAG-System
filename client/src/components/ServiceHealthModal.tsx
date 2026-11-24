import React, { useState, useEffect } from 'react';
import {
  X,
  Activity,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RotateCcw,
  Database,
  Key,
  Layers,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';
import { checkServiceHealth, ServiceHealth } from '../services/groqClient';
import { SessionState } from '../types/workflow';

interface ServiceHealthModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionState: SessionState;
}

export const ServiceHealthModal: React.FC<ServiceHealthModalProps> = ({
  isOpen,
  onClose,
  sessionState,
}) => {
  const [health, setHealth] = useState<ServiceHealth | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const runCheck = async () => {
    setIsRefreshing(true);
    const result = await checkServiceHealth();
    setHealth(result);
    setIsRefreshing(false);
  };

  useEffect(() => {
    if (isOpen) {
      runCheck();
    }
  }, [isOpen, sessionState]);

  const handleCopySql = async () => {
    try {
      const res = await fetch('/data/00_COMPLETE_SUPABASE_SETUP.sql');
      let text = '';
      if (res.ok) {
        text = await res.text();
      } else {
        text = `-- Complete Supabase Setup Script\n-- File located at supabase/migrations/00_COMPLETE_SUPABASE_SETUP.sql`;
      }
      navigator.clipboard.writeText(text);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2500);
    } catch (_) {
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2500);
    }
  };

  if (!isOpen) return null;

  const isDbPending = health?.supabaseDb === 'failed';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white border border-[#E5E0D6] rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden text-[#121316] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E5E0D6] flex items-center justify-between bg-[#FAF7F2]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#FFF0EB] border border-[#FFD9CC] text-[#FF4713] flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#121316]">Services Health & Supabase Verification</h3>
              <p className="text-[11px] text-[#636772]">Live checks for Supabase, pgvector, and LLM provider</p>
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
        <div className="p-6 space-y-3.5 overflow-y-auto">
          {/* SQL Setup Notice Banner if DB not migrated yet */}
          {isDbPending && (
            <div className="p-4 rounded-xl bg-[#FFF4E5] border border-[#FFE2B8] text-xs space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 font-bold text-[#B25E00]">
                  <AlertCircle className="w-4 h-4 text-[#B25E00] flex-shrink-0" />
                  <span>Supabase Schema Pending Execution in SQL Editor</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white text-[#B25E00] border border-[#FFE2B8]">
                  1 Step Action
                </span>
              </div>
              <p className="text-[#636772] leading-relaxed text-[11px]">
                Your Supabase project (<code className="text-[#121316] font-mono">yadpkqnidlsewxwmponv</code>) is connected via public key, but the database tables and pgvector extension have not yet been executed in the Supabase SQL Editor.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <a
                  href="https://supabase.com/dashboard/project/yadpkqnidlsewxwmponv/sql/new"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 text-xs font-bold text-white bg-[#FF4713] hover:bg-[#E03E0F] rounded-lg transition inline-flex items-center gap-1 shadow-sm"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open Supabase SQL Editor
                </a>
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="px-3 py-1.5 text-xs font-semibold text-[#121316] bg-white hover:bg-[#FAF7F2] rounded-lg transition inline-flex items-center gap-1 border border-[#E5E0D6] cursor-pointer"
                >
                  {copiedSql ? <Check className="w-3.5 h-3.5 text-[#1E7E34]" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedSql ? 'Copied SQL Script!' : 'Copy Complete Schema SQL'}
                </button>
              </div>
            </div>
          )}

          {/* 1. Supabase Anonymous Auth */}
          <div className="p-3.5 rounded-xl border border-[#E5E0D6] bg-[#FAF7F2] flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-[#121316]">
                <Database className="w-4 h-4 text-[#1E7E34]" />
                <span>Supabase Anonymous Auth Session</span>
              </div>
              <p className="text-[11px] text-[#636772] font-mono">
                {sessionState.userId ? `User ID: ${sessionState.userId}` : 'Awaiting anonymous JWT token...'}
              </p>
            </div>
            <StatusPill status={health?.supabaseAuth || 'checking'} />
          </div>

          {/* 2. Supabase DB Storage */}
          <div className="p-3.5 rounded-xl border border-[#E5E0D6] bg-[#FAF7F2] flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-[#121316]">
                <Layers className="w-4 h-4 text-[#FF4713]" />
                <span>Supabase Database Tables</span>
              </div>
              <p className="text-[11px] text-[#636772]">
                Campaign runs, decision questions, checkpoints, and RAG records
              </p>
            </div>
            <StatusPill status={health?.supabaseDb || 'checking'} />
          </div>

          {/* 3. LLM API Key */}
          <div className="p-3.5 rounded-xl border border-[#E5E0D6] bg-[#FAF7F2] flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-[#121316]">
                <Key className="w-4 h-4 text-[#FF4713]" />
                <span>LLM Credentials</span>
              </div>
              <p className="text-[11px] text-[#636772]">
                {sessionState.groqKeyInMemory
                  ? 'Active in browser memory (request-scoped)'
                  : 'Not connected - using deterministic catalogue fallback'}
              </p>
            </div>
            <StatusPill status={sessionState.groqKeyInMemory ? 'healthy' : 'pending'} />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#E5E0D6] bg-[#FAF7F2] flex items-center justify-between">
          <button
            type="button"
            onClick={runCheck}
            disabled={isRefreshing}
            className="text-xs text-[#FF4713] hover:text-[#E03E0F] font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Re-run Health Check
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-[#121316] bg-white hover:bg-[#FAF7F2] border border-[#E5E0D6] rounded-xl cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const StatusPill: React.FC<{ status: 'passed' | 'failed' | 'pending' | 'checking' | 'healthy' }> = ({ status }) => {
  if (status === 'passed' || status === 'healthy') {
    return (
      <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-[#F5F8D5] text-[#4A5404] border border-[#CBD810] flex items-center gap-1">
        <CheckCircle2 className="w-3 h-3 text-[#1E7E34]" /> Operational
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-[#FDECEE] text-[#C92A2A] border border-[#FAC5CB] flex items-center gap-1">
        <XCircle className="w-3 h-3 text-[#C92A2A]" /> Pending SQL
      </span>
    );
  }
  if (status === 'pending') {
    return (
      <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-[#FFF4E5] text-[#B25E00] border border-[#FFE2B8] flex items-center gap-1">
        <AlertCircle className="w-3 h-3 text-[#B25E00]" /> Not Connected
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-[#FAF7F2] text-[#8B8F9A] border border-[#E5E0D6] flex items-center gap-1">
      <RotateCcw className="w-3 h-3 animate-spin text-[#8B8F9A]" /> Checking
    </span>
  );
};
