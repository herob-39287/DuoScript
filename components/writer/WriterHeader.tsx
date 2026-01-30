import React from 'react';
import {
  ChevronLeft,
  AlignLeft,
  Maximize2,
  BookOpen,
  Zap,
  CloudCheck,
  Settings2,
} from 'lucide-react';
import { ChapterLog } from '../../types';
import { useUI } from '../../contexts/StoryContext';

interface WriterHeaderProps {
  activeChapter?: ChapterLog;
  wordCount: number;
  isVertical: boolean;
  onToggleVertical: () => void;
  onToggleZen: () => void;
  onNavigateBack: () => void;
  onOpenChapters: () => void;
  onOpenPlot: () => void;
  onOpenSettings: () => void;
}

export const WriterHeader: React.FC<WriterHeaderProps> = ({
  activeChapter,
  wordCount,
  isVertical,
  onToggleVertical,
  onToggleZen,
  onNavigateBack,
  onOpenChapters,
  onOpenPlot,
  onOpenSettings,
}) => {
  const { saveStatus } = useUI();

  return (
    <header className="h-16 border-b border-white/5 flex items-center px-4 md:px-8 justify-between bg-stone-900/60 backdrop-blur-md shrink-0 z-50">
      <div className="flex items-center gap-2 md:gap-4 overflow-hidden">
        <button
          onClick={onNavigateBack}
          className="p-2 hover:bg-stone-800 rounded-lg text-stone-500 transition-colors"
          title="ダッシュボードに戻る"
        >
          <ChevronLeft size={20} />
        </button>

        {/* Mobile: Chapter List Toggle */}
        <button
          onClick={onOpenChapters}
          className="xl:hidden p-2 hover:bg-stone-800 rounded-lg text-stone-500 hover:text-orange-400 transition-colors"
          title="章リストを表示"
        >
          <BookOpen size={18} />
        </button>

        <div className="min-w-0 flex flex-col overflow-hidden">
          <h2 className="text-xs md:text-sm font-black text-stone-200 uppercase tracking-widest truncate">
            {activeChapter?.title || '無題の章'}
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-stone-600 font-mono">
              {(wordCount || 0).toLocaleString()} c
            </span>
            <div className="hidden sm:block w-1 h-1 rounded-full bg-stone-700" />
            <span className="text-[9px] text-stone-600 font-mono hidden sm:inline">
              V{activeChapter?.draftVersion || 0}
            </span>
            {saveStatus !== 'idle' && (
              <CloudCheck
                size={10}
                className={
                  saveStatus === 'saved' ? 'text-orange-400' : 'text-stone-500 animate-pulse'
                }
              />
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 md:gap-2 shrink-0">
        {/* Mobile: Plot Toggle */}
        <button
          onClick={onOpenPlot}
          className="xl:hidden p-2 rounded-xl bg-stone-800 text-stone-500 hover:text-orange-400 transition-all mr-1"
          title="プロットと設定を表示"
        >
          <Zap size={18} />
        </button>

        <button
          onClick={onOpenSettings}
          className="p-2 md:p-2.5 rounded-xl bg-stone-800 text-stone-500 hover:text-stone-300 transition-all"
          title="表示設定"
        >
          <Settings2 size={18} />
        </button>

        <button
          onClick={onToggleVertical}
          className={`hidden sm:flex p-2 md:p-2.5 rounded-xl transition-all ${isVertical ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/20' : 'bg-stone-800 text-stone-500 hover:text-stone-300'}`}
          title={isVertical ? '横書きモードに切り替え' : '縦書きモードに切り替え'}
        >
          <AlignLeft size={18} className={isVertical ? 'rotate-90' : ''} />
        </button>
        <button
          onClick={onToggleZen}
          className="p-2 md:p-2.5 bg-stone-800 text-stone-500 hover:text-stone-300 rounded-xl transition-all"
          title="メニューを隠して執筆に集中する (Zen Mode)"
        >
          <Maximize2 size={18} />
        </button>
      </div>
    </header>
  );
};
