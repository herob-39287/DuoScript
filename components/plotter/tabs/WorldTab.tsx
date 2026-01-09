import React, { useState } from 'react';
import { Globe, Feather, Scale, Map as MapIcon, Landmark, Users, Skull, Zap, Key, Book } from 'lucide-react';
import { useBible, useBibleDispatch, useUIDispatch } from '../../../contexts/StoryContext';
import * as Actions from '../../../store/actions';
import { WorldLaw } from '../../../types';
import { WorldSection } from '../parts/WorldSection';
import { ItemEditorModal, ItemType } from '../ItemEditorModal';

export const WorldTab: React.FC = () => {
  const bible = useBible();
  const bibleDispatch = useBibleDispatch();
  const uiDispatch = useUIDispatch();

  const [editor, setEditor] = useState<{ isOpen: boolean; type: ItemType; initialData?: any }>({
    isOpen: false,
    type: 'law'
  });

  const handleConsult = (item: any, type: string) => {
    const name = item.name || item.title || "この項目";
    uiDispatch(Actions.setPendingMsg(`設定項目【${type}：${name}】について相談です。\n\n`));
  };

  const openEditor = (type: ItemType, initialData?: any) => {
    setEditor({ isOpen: true, type, initialData });
  };

  const handleDelete = (type: ItemType, id: string, name: string) => {
    uiDispatch(Actions.openDialog({
      isOpen: true,
      type: 'confirm',
      title: '項目の削除',
      message: `「${name}」を削除してもよろしいですか？`,
      onConfirm: () => {
        const pathMap: Record<ItemType, string> = {
          law: 'laws', location: 'locations', organization: 'organizations', item: 'keyItems', 
          entry: 'entries', race: 'races', bestiary: 'bestiary', ability: 'abilities',
          timeline: '', foreshadowing: '', thread: '', structure: '', volume: '', chapter: ''
        };
        const path = pathMap[type];
        if (!path) return;
        
        const list = (bible as any)[path];
        const updated = list.filter((i: any) => i.id !== id);
        bibleDispatch(Actions.updateBible({ [path]: updated }));
        uiDispatch(Actions.closeDialog());
      }
    }));
  };

  const handleSave = (data: any) => {
    const pathMap: Record<ItemType, string> = {
        law: 'laws', location: 'locations', organization: 'organizations', item: 'keyItems', 
        entry: 'entries', race: 'races', bestiary: 'bestiary', ability: 'abilities',
        timeline: '', foreshadowing: '', thread: '', structure: '', volume: '', chapter: ''
    };
    const path = pathMap[editor.type];
    if (!path) return;

    const list = [...((bible as any)[path] || [])];
    
    if (data.id) {
        // Update
        const idx = list.findIndex((i: any) => i.id === data.id);
        if (idx !== -1) list[idx] = { ...list[idx], ...data };
    } else {
        // Create
        list.push({ ...data, id: crypto.randomUUID() });
    }
    
    bibleDispatch(Actions.updateBible({ [path]: list }));
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-5xl mx-auto">
        {/* Setting & Tone */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
               <h3 className="text-[10px] font-black text-stone-600 uppercase tracking-widest flex items-center gap-2"><Globe size={14}/> Setting / 舞台設定</h3>
               <textarea 
                  className="w-full bg-stone-900/40 border border-white/5 rounded-2xl p-4 text-[12px] text-stone-300 font-serif leading-relaxed h-32 focus:border-orange-500/30 outline-none resize-none"
                  value={bible.setting}
                  onChange={(e) => bibleDispatch(Actions.updateBible({ setting: e.target.value }))}
                  placeholder="世界の概略..."
               />
            </div>
            <div className="space-y-3">
               <h3 className="text-[10px] font-black text-stone-600 uppercase tracking-widest flex items-center gap-2"><Feather size={14}/> Tone / 文体・トーン</h3>
               <textarea 
                  className="w-full bg-stone-900/40 border border-white/5 rounded-2xl p-4 text-[12px] text-stone-300 font-serif leading-relaxed h-32 focus:border-orange-500/30 outline-none resize-none"
                  value={bible.tone}
                  onChange={(e) => bibleDispatch(Actions.updateBible({ tone: e.target.value }))}
                  placeholder="作品の雰囲気..."
               />
            </div>
        </div>

        {/* Laws */}
        <WorldSection 
            title="Laws / 世界の理" icon={<Scale size={14} className="text-orange-400"/>} items={bible.laws} 
            onAdd={() => openEditor('law')}
            onEdit={(item) => openEditor('law', item)}
            onDelete={(item) => handleDelete('law', item.id, item.name)}
            onConsult={(item) => handleConsult(item, '世界の理')} 
            renderItem={(item: WorldLaw) => (
            <>
               <div className="flex justify-between items-start mb-1">
                  <span className="text-[11px] font-bold text-stone-200">{item.name}</span>
                  <span className={`text-[8px] px-1.5 py-0.5 rounded uppercase font-black ${item.importance === 'Absolute' ? 'bg-rose-500/20 text-rose-400' : 'bg-stone-800 text-stone-500'}`}>{item.type}</span>
               </div>
               <p className="text-[10px] text-stone-400 font-serif leading-relaxed">{item.description}</p>
            </>
        )}/>

        {/* Locations */}
        <WorldSection 
            title="Geography / 地理" icon={<MapIcon size={14} className="text-emerald-400"/>} items={bible.locations} 
            onAdd={() => openEditor('location')}
            onEdit={(item) => openEditor('location', item)}
            onDelete={(item) => handleDelete('location', item.id, item.name)}
            onConsult={(item) => handleConsult(item, '地理')} 
            renderItem={(item: any) => (
            <>
               <div className="flex justify-between items-start mb-1">
                  <span className="text-[11px] font-bold text-stone-200">{item.name}</span>
                  <span className="text-[8px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded uppercase font-black">{item.type}</span>
               </div>
               <p className="text-[10px] text-stone-400 font-serif leading-relaxed line-clamp-3">{item.description}</p>
            </>
        )}/>

        {/* Organizations */}
        <WorldSection 
            title="Organizations / 組織" icon={<Landmark size={14} className="text-indigo-400"/>} items={bible.organizations} 
            onAdd={() => openEditor('organization')}
            onEdit={(item) => openEditor('organization', item)}
            onDelete={(item) => handleDelete('organization', item.id, item.name)}
            onConsult={(item) => handleConsult(item, '組織')} 
            renderItem={(item: any) => (
            <>
               <div className="flex justify-between items-start mb-1">
                  <span className="text-[11px] font-bold text-stone-200">{item.name}</span>
                  <span className="text-[8px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded uppercase font-black">{item.type}</span>
               </div>
               <p className="text-[10px] text-stone-400 font-serif leading-relaxed line-clamp-3">{item.description}</p>
            </>
        )}/>

        {/* Races, Bestiary, Abilities */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <WorldSection 
                title="Races / 種族" icon={<Users size={14}/>} items={bible.races} compact 
                onAdd={() => openEditor('race')}
                onEdit={(item) => openEditor('race', item)}
                onDelete={(item) => handleDelete('race', item.id, item.name)}
                onConsult={(item) => handleConsult(item, '種族')} 
                renderItem={(item: any) => (
                <div className="text-[10px] font-bold text-stone-300">{item.name}</div>
            )}/>
            <WorldSection 
                title="Bestiary / 生物" icon={<Skull size={14}/>} items={bible.bestiary} compact 
                onAdd={() => openEditor('bestiary')}
                onEdit={(item) => openEditor('bestiary', item)}
                onDelete={(item) => handleDelete('bestiary', item.id, item.name)}
                onConsult={(item) => handleConsult(item, '魔物・生物')} 
                renderItem={(item: any) => (
                <div className="text-[10px] font-bold text-stone-300">{item.name}</div>
            )}/>
            <WorldSection 
                title="Magic / 能力" icon={<Zap size={14}/>} items={bible.abilities} compact 
                onAdd={() => openEditor('ability')}
                onEdit={(item) => openEditor('ability', item)}
                onDelete={(item) => handleDelete('ability', item.id, item.name)}
                onConsult={(item) => handleConsult(item, '能力・魔法')} 
                renderItem={(item: any) => (
                <div className="text-[10px] font-bold text-stone-300">{item.name}</div>
            )}/>
        </div>

        {/* Items & Entries */}
        <WorldSection 
            title="Key Items / 重要アイテム" icon={<Key size={14} className="text-amber-400"/>} items={bible.keyItems} 
            onAdd={() => openEditor('item')}
            onEdit={(item) => openEditor('item', item)}
            onDelete={(item) => handleDelete('item', item.id, item.name)}
            onConsult={(item) => handleConsult(item, '重要アイテム')} 
            renderItem={(item: any) => (
            <>
               <div className="flex justify-between items-start mb-1">
                  <span className="text-[11px] font-bold text-stone-200">{item.name}</span>
                  <span className="text-[8px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded uppercase font-black">{item.type}</span>
               </div>
               <p className="text-[10px] text-stone-400 font-serif leading-relaxed">{item.description}</p>
            </>
        )}/>

        <WorldSection 
            title="Encyclopedia / 用語集" icon={<Book size={14} className="text-stone-400"/>} items={bible.entries} 
            onAdd={() => openEditor('entry')}
            onEdit={(item) => openEditor('entry', item)}
            onDelete={(item) => handleDelete('entry', item.id, item.title)}
            onConsult={(item) => handleConsult(item, '用語')} 
            renderItem={(item: any) => (
            <>
               <div className="flex justify-between items-start mb-1">
                  <span className="text-[11px] font-bold text-stone-200">{item.title}</span>
                  <span className="text-[8px] bg-stone-800 text-stone-500 px-1.5 py-0.5 rounded uppercase font-black">{item.category}</span>
               </div>
               <p className="text-[10px] text-stone-400 font-serif leading-relaxed line-clamp-2">{item.definition || item.content}</p>
            </>
        )}/>

        <ItemEditorModal 
            isOpen={editor.isOpen} 
            type={editor.type} 
            initialData={editor.initialData} 
            onClose={() => setEditor({ ...editor, isOpen: false })}
            onSave={handleSave}
        />
    </div>
  );
};