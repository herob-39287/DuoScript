
import React, { useEffect, useState } from 'react';
import { Loader2, BrainCircuit, Search, Edit3, Database } from 'lucide-react';

interface ThinkingIndicatorProps {
  phase: string | null;
}

export const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({ phase }) => {
  const [dots, setDots] = useState('');

  useEffect(() => {
    if (!phase) return;
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);
    return () => clearInterval(interval);
  }, [phase]);

  if (!phase) return null;

  // フェーズに応じたアイコンの選択
  let icon = <BrainCircuit size={14} className="animate-pulse text-orange-400" />;
  if (phase.includes('検索') || phase.includes('Looking') || phase.includes('Search')) icon = <Search size={14} className="animate-bounce text-sky-400" />;
  else if (phase.includes('執筆') || phase.includes('Drafting') || phase.includes('Writing')) icon = <Edit3 size={14} className="animate-pulse text-emerald-400" />;
  else if (phase.includes('整理') || phase.includes('Memory') || phase.includes('Saving')) icon = <Database size={14} className="animate-spin text-purple-400" />;

  return (
    <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[100] animate-fade-in pointer-events-none">
      <div className="flex items-center gap-3 px-6 py-2.5 bg-stone-900/90 backdrop-blur-xl border border-orange-500/20 rounded-full shadow-2xl shadow-orange-900/10">
        <div className="relative">
           {icon}
           <div className="absolute inset-0 bg-current opacity-20 blur-lg animate-pulse" />
        </div>
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-200">
          {phase}{dots}
        </span>
      </div>
    </div>
  );
};
