import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  label?: string;
  sublabel?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  label = 'Processing...',
  sublabel,
  size = 'md',
}) => {
  const iconSize = size === 'sm' ? 16 : size === 'lg' ? 32 : 24;
  return (
    <div className="flex flex-col items-center justify-center p-6 text-center space-y-3">
      <Loader2
        size={iconSize}
        className="animate-spin text-indigo-400 transition-all duration-300"
      />
      <div>
        <p className="text-sm font-semibold text-slate-100">{label}</p>
        {sublabel && <p className="text-xs text-slate-400 mt-1">{sublabel}</p>}
      </div>
    </div>
  );
};
