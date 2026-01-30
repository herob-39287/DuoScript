import React, { useState } from 'react';
import {
  Sparkles,
  Loader2,
  Feather,
  ScanSearch,
  Minimize2,
  Book,
  ChevronRight,
  ChevronLeft,
  PenTool,
  WifiOff,
  FileSearch,
} from 'lucide-react';
import { useUI, useUIDispatch } from '../../contexts/StoryContext';

interface WriterToolbarProps {
  isZenMode: boolean;
  isProcessing: boolean;
  isSuggesting: boolean;
  isWhispering: boolean;
  isScanning?: boolean;
  onSuggest: () => void;
  onDraft: () => void;
  onWhisper: () => void;
  onScan?: () => void;
  onToggleZen: () => void;
}

export const WriterToolbar: React.FC<WriterToolbarProps> = ({
  isZenMode,
  isProcessing,
  isSuggesting,
  isWhispering,
  isScanning = false,
  onSuggest,
  onDraft,
  onWhisper,
  onScan,
  onToggleZen,
}) => {
  const ui = useUI();
  const uiDispatch = useUIDispatch();
  const [isExpanded, setIsExpanded] = useState(true);

  // Mobile collapsed state
  if (!isExpanded) {
    return (
      <div
        className={`fixed ${isZenMode ? 'bottom-8' : 'bottom-24 md:bottom-10'} right-4 md:right-auto md:left-1/2 md:-translate-x-1/2 z-50 transition-all`}
      >
        <button
          onClick={() => setIsExpanded(true)}
          className="p-3 bg-stone-800 text-orange-400 rounded-full shadow-xl border border-white/10 hover:bg-stone-700 transition-all opacity-50 hover:opacity-100"
        >
          <PenTool size={20} />
        </button>
      </div>
    );
  }

  return (
    <div
      className={`fixed ${isZenMode ? 'bottom-8' : 'bottom-24 md:bottom-10'} left-1/2 -translate-x-1/2 flex items-center gap-2 md:gap-4 transition-all duration-700 z-50 w-auto max-w-[95vw]`}
    >
      {/* Mobile Collapse Trigger */}
      <button
        onClick={() => setIsExpanded(false)}
        className="md:hidden p-2 bg-stone-800/80 text-stone-500 rounded-full shadow-lg border border-white/5 backdrop-blur-sm"
      >
        <ChevronRight size={16} />
      </button>

      <div
        className={`glass p-1.5 md:p-2 rounded-2xl md:rounded-[2rem] border border-white/10 flex items-center gap-1 md:gap-4 shadow-3xl bg-stone-900/90 backdrop-blur-xl relative overflow-hidden transition-opacity duration-500 ${isZenMode && !isProcessing ? 'opacity-30 hover:opacity-100' : 'opacity-100'}`}
      >
        {!ui.isOnline && (
          <div className="absolute inset-0 bg-stone-950/80 backdrop-blur-sm z-50 flex items-center justify-center gap-2 cursor-not-allowed">
            <WifiOff size={16} className="text-stone-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-stone-500">
              Offline Mode
            </span>
          </div>
        )}

        <button
          onClick={() =>
            uiDispatch({ type: 'TOGGLE_CONTEXT_ACTIVE', payload: !ui.isContextActive })
          }
          className={`p-3 md:p-4 rounded-xl md:rounded-2xl transition-all flex items-center gap-2 ${ui.isContextActive ? 'bg-orange-600/20 text-orange-400' : 'bg-stone-800 text-stone-600'}`}
          title={ui.isContextActive ? 'Bible ON' : 'Bible OFF'}
        >
          <Book size={18} className={ui.isContextActive ? 'animate-pulse' : ''} />
          <span className="hidden sm:block text-[8px] md:text-[10px] font-black uppercase tracking-widest">
            {ui.isContextActive ? 'Bible ON' : 'Bible OFF'}
          </span>
        </button>

        <div className="w-[1px] h-6 md:h-8 bg-white/5 mx-1" />

        <button
          onClick={onSuggest}
          disabled={isProcessing || isSuggesting || !ui.isOnline}
          className="p-3 md:p-4 bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-orange-400 rounded-xl md:rounded-2xl transition-all group flex items-center gap-2 disabled:opacity-50"
          title="提案 (AI)"
        >
          {isSuggesting ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Sparkles size={18} className="group-hover:rotate-12 transition-transform" />
          )}
          <span className="hidden sm:block text-[8px] md:text-[10px] font-black uppercase tracking-widest">
            {isSuggesting ? '提案中...' : '提案'}
          </span>
        </button>

        <button
          onClick={onDraft}
          disabled={isProcessing || !ui.isOnline}
          className={`p-3 md:p-4 rounded-xl md:rounded-2xl shadow-xl transition-all active:scale-95 group flex items-center gap-2 disabled:opacity-50 ${isProcessing ? 'bg-orange-500 text-white shadow-orange-900/40' : 'bg-orange-600 hover:bg-orange-500 text-white shadow-orange-950/40'}`}
          title="執筆 (AI)"
        >
          {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Feather size={18} />}
          <span className="hidden sm:block text-[8px] md:text-[10px] font-black uppercase tracking-widest">
            {isProcessing ? '執筆中...' : '執筆'}
          </span>
        </button>

        <button
          onClick={onWhisper}
          disabled={isWhispering || isProcessing || !ui.isOnline}
          className="p-3 md:p-4 bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-emerald-400 rounded-xl md:rounded-2xl transition-all flex items-center gap-2 disabled:opacity-50"
          title="整合 (AI)"
        >
          {isWhispering ? <Loader2 size={18} className="animate-spin" /> : <ScanSearch size={18} />}
          <span className="hidden sm:block text-[8px] md:text-[10px] font-black uppercase tracking-widest">
            {isWhispering ? '確認中...' : '整合'}
          </span>
        </button>

        {onScan && (
          <button
            onClick={onScan}
            disabled={isScanning || isProcessing || !ui.isOnline}
            className="p-3 md:p-4 bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-indigo-400 rounded-xl md:rounded-2xl transition-all flex items-center gap-2 disabled:opacity-50"
            title="抽出 (AI)"
          >
            {isScanning ? <Loader2 size={18} className="animate-spin" /> : <FileSearch size={18} />}
            <span className="hidden sm:block text-[8px] md:text-[10px] font-black uppercase tracking-widest">
              {isScanning ? '抽出中...' : '抽出'}
            </span>
          </button>
        )}
      </div>

      {isZenMode && (
        <button
          onClick={onToggleZen}
          className="p-3 md:p-4 bg-stone-800 text-stone-500 hover:text-white rounded-full shadow-2xl transition-all border border-white/5 opacity-50 hover:opacity-100"
          title="Zen Mode 終了"
        >
          <Minimize2 size={18} className="md:w-[20px] md:h-[20px]" />
        </button>
      )}
    </div>
  );
};
