import React from 'react';

type BadgeTone = 'neutral' | 'danger' | 'warning';

const toneStyles: Record<BadgeTone, string> = {
  neutral: 'bg-white/70 text-gray-700 border border-gray-200 backdrop-blur',
  danger: 'bg-rose-100/70 text-rose-700 border border-rose-200/60 backdrop-blur',
  warning: 'bg-amber-100/70 text-amber-700 border border-amber-200/60 backdrop-blur'
};

interface BadgeProps {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({ tone = 'neutral', className, children }) => {
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs ${toneStyles[tone]} ${className || ''}`}>
      {children}
    </span>
  );
};
