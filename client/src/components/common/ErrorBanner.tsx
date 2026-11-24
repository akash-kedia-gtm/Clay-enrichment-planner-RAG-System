import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({ message, onRetry }) => {
  return (
    <div className="rounded-xl bg-rose-950/50 border border-rose-800/80 p-4 text-rose-200 mb-4 flex items-start gap-3">
      <AlertCircle className="w-5 h-5 text-rose-400 mt-0.5 flex-shrink-0" />
      <div className="flex-1">
        <h4 className="text-xs font-bold text-rose-300">Action Required</h4>
        <p className="text-xs text-rose-200 mt-0.5 leading-relaxed">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-200 bg-rose-900/60 border border-rose-700/80 rounded-lg hover:bg-rose-900 transition shadow-sm"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Retry
        </button>
      )}
    </div>
  );
};
