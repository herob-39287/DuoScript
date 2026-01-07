
import React from 'react';
import { Anchor, Library, MessageSquare } from 'lucide-react';
import { useBible, useBibleDispatch, useUIDispatch } from '../../../contexts/StoryContext';
import * as Actions from '../../../store/actions';

export const GrandArcTab: React.FC = () => {
  const bible = useBible();
  const bibleDispatch = useBibleDispatch();
  const uiDispatch = useUIDispatch();

  const handleConsult = (context: string) => {
    uiDispatch(Actions.setPendingMsg(`【${context}】について相談です。\n\n`));
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl mx-auto">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-black text-stone-600 uppercase tracking-widest flex items-center gap-2"><Anchor size={14}/> Grand Arc / 物語の背骨</h3>
            <button onClick={() => handleConsult("グランドアーク（物語全体の大筋）")} className="flex items-center gap-1 text-[9px] font-black text-orange-400 hover:text-white transition-colors uppercase tracking-widest">
                <MessageSquare size={12} /> 相談
            </button>
        </div>
        <textarea 
          className="w-full bg-stone-900/40 border border-white/5 rounded-2xl p-6 text-[13px] md:text-base text-stone-300 font-serif leading-loose h-64 focus:border-orange-500/30 outline-none resize-none shadow-inner"
          value={bible.grandArc}
          onChange={(e) => bibleDispatch(Actions.updateBible({ grandArc: e.target.value }))}
          placeholder="物語全体の流れやテーマ..."
        />
      </div>
      
      <div className="space-y-4">
         <h3 className="text-[10px] font-black text-stone-600 uppercase tracking-widest flex items-center gap-2"><Library size={14}/> Volumes / 巻構成</h3>
         <div className="grid grid-cols-1 gap-4">
             {bible.volumes.length === 0 ? (
                <div className="p-8 border border-dashed border-stone-800 rounded-2xl text-center text-stone-600 text-[11px]">巻構成はまだありません。</div>
             ) : (
               bible.volumes.map((vol, i) => (
                  <div key={vol.id} className="p-4 bg-stone-900/40 border border-white/5 rounded-2xl relative group hover:border-orange-500/20 transition-all">
                     <div className="text-[9px] font-black text-orange-400 uppercase tracking-widest mb-1">Volume {vol.order || i + 1}</div>
                     <div className="text-sm font-bold text-stone-200">{vol.title}</div>
                     <div className="text-[11px] text-stone-400 font-serif mt-1">{vol.summary}</div>
                     <button 
                         onClick={() => handleConsult(`第${vol.order || i + 1}巻：${vol.title}`)}
                         className="absolute top-4 right-4 p-2 bg-stone-800 text-stone-500 hover:bg-orange-600 hover:text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                         title="この巻について相談"
                     >
                        <MessageSquare size={14}/>
                     </button>
                  </div>
               ))
             )}
         </div>
      </div>
    </div>
  );
};
