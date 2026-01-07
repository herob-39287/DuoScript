
import React from 'react';
import { Sparkles, Loader2, Feather, ScanSearch, Minimize2, Book } from 'lucide-react';
import { useUI, useUIDispatch } from '../../contexts/StoryContext';

interface WriterToolbarProps {
  isZenMode: boolean;
  isProcessing: boolean;
  isSuggesting: boolean;
  isWhispering: boolean;
  onSuggest: () => void;
  onDraft: () => void;
  onWhisper: () => void;
  onToggleZen: () => void;
}

export const WriterToolbar: React.FC<WriterToolbarProps> = ({
  isZenMode,
  isProcessing,
  isSuggesting,
  isWhispering,
  onSuggest,
  onDraft,
  onWhisper,
  onToggleZen
}) => {
  const ui = useUI();
  const uiDispatch = useUIDispatch();

  return (
    <div className={`fixed bottom-24 md:bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-4 transition-all duration-700 z-50 ${isZenMode ? 'opacity-20 hover:opacity-100' : ''}`}>
      <div className="glass p-1.5 md:p-2 rounded-2xl md:rounded-[2rem] border border-white/10 flex items-center gap-2 md:gap-4 shadow-3xl">
        <button 
          onClick={() => uiDispatch({ type: 'TOGGLE_CONTEXT_ACTIVE', payload: !ui.isContextActive })} 
          className={`p-2.5 md:p-4 rounded-xl md:rounded-2xl transition-all flex items-center gap-2 ${ui.isContextActive ? 'bg-orange-600/20 text-orange-400' : 'bg-stone-800 text-stone-600'}`}
          title={ui.isContextActive ? "設定を参照中" : "設定を無視中"}
        >
          <Book size={16} className={ui.isContextActive ? "animate-pulse" : ""} />
          <span className="hidden sm:block text-[8px] md:text-[10px] font-black uppercase tracking-widest">{ui.isContextActive ? "Bible ON" : "Bible OFF"}</span>
        </button>

        <div className="w-[1px] h-6 md:h-8 bg-white/5" />

        <button onClick={onSuggest} disabled={isProcessing || isSuggesting} className="p-2.5 md:p-4 bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-orange-400 rounded-xl md:rounded-2xl transition-all group flex items-center gap-2">
          {isSuggesting ? <Loader2 size={16} className="animate-spin md:w-[18px] md:h-[18px]" /> : <Sparkles size={16} className="md:w-[18px] md:h-[18px] group-hover:rotate-12 transition-transform" />}
          <span className="hidden sm:block text-[8px] md:text-[10px] font-black uppercase tracking-widest">提案</span>
        </button>
        <div className="w-[1px] h-6 md:h-8 bg-white/5" />
        <button onClick={onDraft} disabled={isProcessing} className="p-2.5 md:p-4 bg-orange-600 hover:bg-orange-500 text-white rounded-xl md:rounded-2xl shadow-xl shadow-orange-950/40 transition-all active:scale-95 group flex items-center gap-2">
          {isProcessing ? <Loader2 size={16} className="animate-spin md:w-[18px] md:h-[18px]" /> : <Feather size={16} className="md:w-[18px] md:h-[18px]" />}
          <span className="hidden sm:block text-[8px] md:text-[10px] font-black uppercase tracking-widest">執筆</span>
        </button>
        <div className="w-[1px] h-6 md:h-8 bg-white/5" />
        <button onClick={onWhisper} disabled={isWhispering || isProcessing} className="p-2.5 md:p-4 bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-emerald-400 rounded-xl md:rounded-2xl transition-all flex items-center gap-2">
          {isWhispering ? <Loader2 size={16} className="animate-spin md:w-[18px] md:h-[18px]" /> : <ScanSearch size={16} className="md:w-[18px] md:h-[18px]" />}
          <span className="hidden sm:block text-[8px] md:text-[10px] font-black uppercase tracking-widest">整合</span>
        </button>
      </div>

      {isZenMode && (
        <button onClick={onToggleZen} className="p-3 md:p-4 bg-stone-800 text-stone-500 hover:text-white rounded-full shadow-2xl transition-all border border-white/5">
          <Minimize2 size={18} className="md:w-[20px] md:h-[20px]" />
        </button>
      )}
    </div>
  );
};
