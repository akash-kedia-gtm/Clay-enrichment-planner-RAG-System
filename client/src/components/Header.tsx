import React, { useState } from 'react';
import {
  Layers,
  Key,
  RefreshCw,
  FileSpreadsheet,
  Sun,
  Moon,
} from 'lucide-react';
import { SessionState, CampaignRun } from '../types/workflow';
import { themeManager, Theme } from '../services/themeManager';

interface HeaderProps {
  sessionState: SessionState;
  run: CampaignRun;
  onOpenKeyModal: () => void;
  onOpenCatalogueModal: () => void;
  onReset: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  sessionState,
  run,
  onOpenKeyModal,
  onOpenCatalogueModal,
  onReset,
}) => {
  const [theme, setTheme] = useState<Theme>(() => themeManager.init());

  const handleToggleTheme = () => {
    const next = themeManager.toggleTheme();
    setTheme(next);
  };

  return (
    <header className="sticky top-0 z-40 bg-[#FAF9F5]/95 border-b border-[#E5E0D6] shadow-xs backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        {/* Brand identity */}
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#FF4713] text-white flex items-center justify-center shadow-xs">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#121316] tracking-tight text-sm">
                Clay Campaign Planner
              </span>
              {run.isDemonstrationData && (
                <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-[#FFF0EB] text-[#FF4713] border border-[#FFD9CC] uppercase tracking-wider">
                  Sample Data
                </span>
              )}
            </div>
            <p className="text-[10px] text-[#636772] hidden sm:block">
              By{' '}
              <a
                href="https://www.linkedin.com/in/akash-kedia"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[#FF4713] hover:underline"
              >
                Akash Kedia
              </a>
            </p>
          </div>
        </div>

        {/* Status Pills & Actions */}
        <div className="flex items-center space-x-2">
          {/* Active Company Badge */}
          {run.companyData && (
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-full text-[11px] text-[#121316] border border-[#E5E0D6] shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-[#CBD810]"></span>
              <span className="font-semibold">{run.companyData.name}</span>
            </div>
          )}

          {/* Catalogue Button */}
          <button
            type="button"
            onClick={onOpenCatalogueModal}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-[#E5E0D6] bg-white hover:bg-[#FAF7F2] text-[#121316] transition shadow-2xs cursor-pointer"
            title="Inspect 1,200+ Clay Enrichment Catalogue"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#FF4713]" />
            <span>Catalogue (1.2k)</span>
          </button>

          {/* Dark / Light Mode Toggle Button */}
          <button
            type="button"
            onClick={handleToggleTheme}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-[#E5E0D6] bg-white hover:bg-[#FAF7F2] text-[#121316] transition shadow-2xs cursor-pointer"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label="Toggle theme mode"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-3.5 h-3.5 text-[#E8B94A]" />
                <span className="hidden sm:inline">Light</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-[#636772]" />
                <span className="hidden sm:inline">Dark</span>
              </>
            )}
          </button>

          {/* LLM Key Connection Pill */}
          <button
            type="button"
            onClick={onOpenKeyModal}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition shadow-2xs cursor-pointer ${
              sessionState.isGroqConnected
                ? 'border-[#CBD810] bg-[#F5F8D5] hover:bg-[#EEF3C4] text-[#4A5404]'
                : 'border-[#FF4713] bg-[#FF4713] hover:bg-[#E03E0F] text-white shadow-xs'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>
              {sessionState.isGroqConnected
                ? sessionState.llmProvider
                  ? `${sessionState.llmProvider.toUpperCase()} Connected`
                  : 'LLM Connected'
                : 'Connect LLM Key'}
            </span>
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                sessionState.isGroqConnected ? 'bg-[#CBD810]' : 'bg-white animate-ping'
              }`}
            />
          </button>

          {/* Reset / New Plan button */}
          {run.stage !== 'INIT' && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg text-[#636772] hover:text-[#121316] hover:bg-[#FAF7F2] border border-[#E5E0D6] bg-white transition shadow-2xs cursor-pointer"
              title="Reset planner and start fresh"
            >
              <RefreshCw className="w-3 h-3" />
              <span className="hidden sm:inline">New Plan</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
