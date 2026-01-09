
import React, { useState } from 'react';
import { Anchor, Library, MessageSquare, Plus, Edit2, Trash2, BookOpen } from 'lucide-react';
import { useBible, useBibleDispatch, useUIDispatch, useManuscript, useManuscriptDispatch } from '../../../contexts/StoryContext';
import * as Actions from '../../../store/actions';
import { ItemEditorModal, ItemType } from '../ItemEditorModal';
import { ChapterLog } from '../../../types';

export const GrandArcTab: React.FC = () => {
  const bible = useBible();
  const bibleDispatch = useBibleDispatch();
  const chapters = useManuscript();
  const projectDispatch = useManuscriptDispatch();
  const uiDispatch = useUIDispatch();

  const [editor, setEditor] = useState<{ isOpen: boolean; type: ItemType; initialData?: any }>({
    isOpen: false,
    type: 'volume'
  });

  const handleConsult = (context: string) => {
    uiDispatch(Actions.setPendingMsg(`【${context}】について相談です。\n\n`));
  };

  const openEditor = (type: ItemType, item?: any) => {
    setEditor({ isOpen: true, type, initialData: item });
  };

  const handleVolumeDelete = (id: string, title: string) => {
    uiDispatch(Actions.openDialog({
        isOpen: true, type: 'confirm', title: '巻の削除', message: `「${title}」を削除しますか？`,
        onConfirm: () => {
            const updated = bible.volumes.filter(v => v.id !== id);
            bibleDispatch(Actions.updateBible({ volumes: updated }));
            uiDispatch(Actions.closeDialog());
        }
    }));
  };

  const handleVolumeSave = (data: any) => {
    const list = [...bible.volumes];
    if (data.id) {
        const idx = list.findIndex(v => v.id === data.id);
        if (idx !== -1) list[idx] = { ...list[idx], ...data };
    } else {
        list.push({ ...data, id: crypto.randomUUID() });
    }
    bibleDispatch(Actions.updateBible({ volumes: list }));
  };

  const handleChapterDelete = (id: string, title: string) => {
    uiDispatch(Actions.openDialog({
        isOpen: true, type: 'confirm', title: '章の削除', message: `「${title}」を削除しますか？これにより原稿データも削除されます。`,
        onConfirm: () => {
            projectDispatch(Actions.removeChapter(id));
            uiDispatch(Actions.closeDialog());
        }
    }));
  };

  const handleChapterSave = (data: any) => {
    if (data.id) {
        projectDispatch(Actions.updateChapter(data.id, data));
    } else {
        const newChapter: ChapterLog = {
            id: crypto.randomUUID(),
            title: data.title || "新章",
            summary: data.summary || "",
            content: "",
            scenes: [],
            beats: [],
            strategy: { milestones: [], forbiddenResolutions: [], characterArcProgress: '', pacing: '' },
            status: data.status || 'Idea',
            wordCount: 0,
            draftVersion: 0,
            updatedAt: Date.now(),
            involvedCharacterIds: [],
            foreshadowingLinks: []
        };
        projectDispatch(Actions.addChapter(newChapter));
    }
  };

  const handleModalSave = (data: any) => {
    if (editor.type === 'volume') handleVolumeSave(data);
    else if (editor.type === 'chapter') handleChapterSave(data);
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
         <div className="flex justify-between items-end">
            <h3 className="text-[10px] font-black text-stone-600 uppercase tracking-widest flex items-center gap-2"><Library size={14}/> Volumes / 巻構成</h3>
            <button onClick={() => openEditor('volume')} className="p-1.5 bg-stone-800 hover:bg-orange-600 hover:text-white text-stone-500 rounded-lg transition-all"><Plus size={14}/></button>
         </div>
         <div className="grid grid-cols-1 gap-4">
             {bible.volumes.length === 0 ? (
                <div className="p-8 border border-dashed border-stone-800 rounded-2xl text-center text-stone-600 text-[11px]">巻構成はまだありません。</div>
             ) : (
               bible.volumes.map((vol, i) => (
                  <div key={vol.id} className="p-4 bg-stone-900/40 border border-white/5 rounded-2xl relative group hover:border-orange-500/20 transition-all">
                     <div className="text-[9px] font-black text-orange-400 uppercase tracking-widest mb-1">Volume {vol.order || i + 1}</div>
                     <div className="text-sm font-bold text-stone-200">{vol.title}</div>
                     <div className="text-[11px] text-stone-400 font-serif mt-1">{vol.summary}</div>
                     
                     <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                         <button 
                             onClick={() => openEditor('volume', vol)}
                             className="p-2 bg-stone-800 text-stone-500 hover:text-white rounded-lg shadow-lg"
                         >
                            <Edit2 size={14}/>
                         </button>
                         <button 
                             onClick={() => handleVolumeDelete(vol.id, vol.title)}
                             className="p-2 bg-stone-800 text-stone-500 hover:text-rose-400 rounded-lg shadow-lg"
                         >
                            <Trash2 size={14}/>
                         </button>
                         <button 
                             onClick={() => handleConsult(`第${vol.order || i + 1}巻：${vol.title}`)}
                             className="p-2 bg-stone-800 text-stone-500 hover:bg-orange-600 hover:text-white rounded-lg shadow-lg"
                             title="この巻について相談"
                         >
                            <MessageSquare size={14}/>
                         </button>
                     </div>
                  </div>
               ))
             )}
         </div>
      </div>

      <div className="space-y-4 pt-4 border-t border-white/5">
         <div className="flex justify-between items-end">
            <h3 className="text-[10px] font-black text-stone-600 uppercase tracking-widest flex items-center gap-2"><BookOpen size={14}/> Chapters / 章構成</h3>
            <button onClick={() => openEditor('chapter')} className="p-1.5 bg-stone-800 hover:bg-orange-600 hover:text-white text-stone-500 rounded-lg transition-all"><Plus size={14}/></button>
         </div>
         <div className="grid grid-cols-1 gap-4">
             {chapters.length === 0 ? (
                <div className="p-8 border border-dashed border-stone-800 rounded-2xl text-center text-stone-600 text-[11px]">章構成はまだありません。</div>
             ) : (
               chapters.map((ch, i) => (
                  <div key={ch.id} className="p-4 bg-stone-900/40 border border-white/5 rounded-2xl relative group hover:border-orange-500/20 transition-all">
                     <div className="flex items-center justify-between mb-1">
                        <div className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Chapter {i + 1}</div>
                        <div className="flex gap-2">
                           <span className="text-[8px] font-mono text-stone-600">{ch.status}</span>
                           <span className="text-[8px] font-mono text-stone-600">{ch.wordCount.toLocaleString()}c</span>
                        </div>
                     </div>
                     <div className="text-sm font-bold text-stone-200">{ch.title}</div>
                     <div className="text-[11px] text-stone-400 font-serif mt-1 line-clamp-3">{ch.summary || "あらすじ未設定"}</div>
                     
                     <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                         <button 
                             onClick={() => openEditor('chapter', ch)}
                             className="p-2 bg-stone-800 text-stone-500 hover:text-white rounded-lg shadow-lg"
                         >
                            <Edit2 size={14}/>
                         </button>
                         <button 
                             onClick={() => handleChapterDelete(ch.id, ch.title)}
                             className="p-2 bg-stone-800 text-stone-500 hover:text-rose-400 rounded-lg shadow-lg"
                         >
                            <Trash2 size={14}/>
                         </button>
                         <button 
                             onClick={() => handleConsult(`第${i + 1}章：${ch.title}\nあらすじ：${ch.summary}`)}
                             className="p-2 bg-stone-800 text-stone-500 hover:bg-orange-600 hover:text-white rounded-lg shadow-lg"
                             title="この章について相談"
                         >
                            <MessageSquare size={14}/>
                         </button>
                     </div>
                  </div>
               ))
             )}
         </div>
      </div>

      <ItemEditorModal 
        isOpen={editor.isOpen} 
        type={editor.type}
        initialData={editor.initialData}
        onClose={() => setEditor({ ...editor, isOpen: false })}
        onSave={handleModalSave}
      />
    </div>
  );
};
