
import React from 'react';
import { BookOpen, Plus, CheckCircle2 } from 'lucide-react';
import { ChapterLog } from '../../types';

interface ChapterNavigationProps {
  chapters: ChapterLog[];
  activeChapterId: string;
  onSelectChapter: (id: string) => void;
  onAddChapter: () => void;
}

export const ChapterNavigation: React.FC<ChapterNavigationProps> = ({
  chapters,
  activeChapterId,
  onSelectChapter,
  onAddChapter
}) => {
  return (
    <aside className="w-64 border-r border-white/5 flex flex-col bg-stone-900/40 hidden xl:flex shrink-0">
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <span className="text-[10px] font-black text-stone-500 uppercase tracking-widest"><BookOpen size={12} /> 書標</span>
        <button onClick={onAddChapter} className="p-1.5 hover:bg-stone-800 rounded-lg text-stone-600 hover:text-orange-400 transition-colors">
          <Plus size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
        {chapters.map(ch => (
          <button
            key={ch.id}
            onClick={() => onSelectChapter(ch.id)}
            className={`w-full text-left p-3 rounded-xl flex items-center justify-between group transition-all ${activeChapterId === ch.id ? 'bg-orange-600/10 border border-orange-500/20 shadow-inner' : 'hover:bg-white/5 border border-transparent'}`}
          >
            <div className="min-w-0">
              <div className={`text-[11px] font-bold truncate ${activeChapterId === ch.id ? 'text-orange-400' : 'text-stone-400'}`}>{ch.title}</div>
              <div className="text-[8px] text-stone-600 font-mono mt-0.5">{(ch.wordCount || 0).toLocaleString()} c</div>
            </div>
            {ch.status === 'Polished' && <CheckCircle2 size={10} className="text-emerald-500" />}
          </button>
        ))}
      </div>
    </aside>
  );
};
