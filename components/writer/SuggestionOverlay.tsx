import React from 'react';
import { Lightbulb, X } from 'lucide-react';

interface SuggestionOverlayProps {
  suggestions: string[];
  onApply: (text: string) => void;
  onClose: () => void;
}

export const SuggestionOverlay: React.FC<SuggestionOverlayProps> = ({
  suggestions,
  onApply,
  onClose,
}) => {
  if (suggestions.length === 0) return null;

  return (
    <div className="absolute bottom-24 md:bottom-32 left-1/2 -translate-x-1/2 w-full max-w-lg animate-fade-in z-[100] px-4">
      <div className="glass-bright rounded-2xl border border-orange-500/30 p-2 space-y-2 shadow-3xl">
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
          <span className="text-[9px] font-black text-orange-400 uppercase tracking-widest flex items-center gap-2">
            <Lightbulb size={12} /> ミューズの囁き
          </span>
          <button onClick={onClose} className="p-1 hover:bg-stone-800 rounded-lg text-stone-600">
            <X size={14} />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-1">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => onApply(s)}
              className="w-full text-left p-3 hover:bg-orange-600/10 rounded-xl transition-all group border border-transparent hover:border-orange-500/20"
            >
              <p className="text-[12px] font-serif text-stone-300 leading-relaxed group-hover:text-white">
                "{s}"
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
