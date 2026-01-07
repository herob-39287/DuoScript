
import React from 'react';
import { ChevronLeft, AlignLeft, Maximize2 } from 'lucide-react';
import { ChapterLog } from '../../types';

interface WriterHeaderProps {
  activeChapter?: ChapterLog;
  wordCount: number;
  isVertical: boolean;
  onToggleVertical: () => void;
  onToggleZen: () => void;
  onNavigateBack: () => void;
}

export const WriterHeader: React.FC<WriterHeaderProps> = ({
  activeChapter,
  wordCount,
  isVertical,
  onToggleVertical,
  onToggleZen,
  onNavigateBack
}) => {
  return (
    <header className="h-16 border-b border-white/5 flex items-center px-4 md:px-8 justify-between bg-stone-900/60 backdrop-blur-md shrink-0 z-50">
      <div className="flex items-center gap-4">
        <button onClick={onNavigateBack} className="p-2 hover:bg-stone-800 rounded-lg text-stone-500 transition-colors">
          <ChevronLeft size={20} />
        </button>
        <div className="min-w-0">
          <h2 className="text-sm font-black text-stone-200 uppercase tracking-widest truncate">
            {activeChapter?.title || '無題の章'}
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-stone-600 font-mono">{(wordCount || 0).toLocaleString()} chars</span>
            <div className="w-1 h-1 rounded-full bg-stone-700" />
            <span className="text-[9px] text-stone-600 font-mono">Draft V{activeChapter?.draftVersion || 0}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onToggleVertical}
          className={`p-2.5 rounded-xl transition-all ${isVertical ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/20' : 'bg-stone-800 text-stone-500 hover:text-stone-300'}`}
          title="縦書き切り替え"
        >
          <AlignLeft size={18} className={isVertical ? 'rotate-90' : ''} />
        </button>
        <button
          onClick={onToggleZen}
          className="p-2.5 bg-stone-800 text-stone-500 hover:text-stone-300 rounded-xl transition-all"
          title="全画面集中モード"
        >
          <Maximize2 size={18} />
        </button>
      </div>
    </header>
  );
};
