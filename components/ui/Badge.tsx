
import React from 'react';
import { Styles } from './Styles';

export const Badge: React.FC<{ color?: 'orange' | 'emerald' | 'rose' | 'indigo' | 'stone' | 'amber', children: React.ReactNode, className?: string }> = ({ color = 'stone', children, className = '' }) => {
  const colors = {
    orange: "bg-orange-500/10 text-orange-400",
    emerald: "bg-emerald-500/10 text-emerald-400",
    rose: "bg-rose-500/10 text-rose-400",
    indigo: "bg-indigo-500/10 text-indigo-400",
    amber: "bg-amber-500/10 text-amber-400",
    stone: "bg-stone-800 text-stone-500"
  };
  return (
    <span className={`px-2 py-0.5 rounded ${Styles.text.labelSm} ${colors[color]} ${className}`}>
      {children}
    </span>
  );
};
