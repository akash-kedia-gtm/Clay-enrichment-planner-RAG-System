import React from 'react';

interface BadgeProps {
  variant?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'slate' | 'purple' | 'blue' | 'clay';
  children: React.ReactNode;
  size?: 'sm' | 'md';
  className?: string;
}

const variantStyles = {
  indigo: 'bg-[#EDF5FF] text-[#1E6FD9] border-[#D0E2FF]',
  emerald: 'bg-[#F5F8D5] text-[#4A5404] border-[#E2EBB4]',
  amber: 'bg-[#FFF4E5] text-[#B25E00] border-[#FFE2B8]',
  rose: 'bg-[#FDECEE] text-[#C92A2A] border-[#FAC5CB]',
  slate: 'bg-[#F4F1EA] text-[#636772] border-[#E5E0D6]',
  purple: 'bg-[#F3EEFF] text-[#6E42CA] border-[#E0D4FC]',
  blue: 'bg-[#EDF5FF] text-[#1E6FD9] border-[#D0E2FF]',
  clay: 'bg-[#FFF0EB] text-[#FF4713] border-[#FFD9CC]',
};

export const Badge: React.FC<BadgeProps> = ({
  variant = 'slate',
  children,
  size = 'sm',
  className = '',
}) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs font-semibold';
  return (
    <span
      className={`inline-flex items-center gap-1 font-medium rounded-md border ${variantStyles[variant]} ${sizeClasses} ${className}`}
    >
      {children}
    </span>
  );
};
