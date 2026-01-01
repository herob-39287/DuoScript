
import { Loader2, Image as ImageIcon, Sparkles, Target, Activity, Lock, ChevronDown, ChevronUp, Package, Brain, MapPin, Heart, Edit2, Save, Wand2 } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { Character, ViewMode } from '../../types';
import { getPortrait } from '../../services/storageService';
import { useBible, useBibleDispatch, useUIDispatch, useNotificationDispatch } from '../../contexts/StoryContext';
import * as Actions from '../../store/actions';

interface CharacterCardProps {
  character: Character;
  onGeneratePortrait: () => void;
  isGenerating: boolean;
}

export const CharacterCard = React.memo(({ character: c, onGeneratePortrait, isGenerating }: CharacterCardProps) => {
  const bible = useBible();
  const bibleDispatch = useBibleDispatch();
  const uiDispatch = useUIDispatch();
  const { addLog } = useNotificationDispatch();

  // Guard clause for missing data
  if (!c || !c.profile || !c.state) {
    return (
      <div className="p-6 glass-bright rounded-2xl border border-rose-500/20 flex items-center justify-center gap-2 text-rose-400/50">
        <Activity size={16} /> <span className="text-xs font-mono">Corrupted Data</span>
      </div>
    );
  }

  const [imgData, setImgData] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Local edit states
  const [editName, setEditName] = useState(c.profile.name || "");
  const [editDesc, setEditDesc] = useState(c.profile.description || "");

  const inventory = bible.keyItems
    .filter(i => i.currentOwnerId === c.id)
    .map(i => i.name);

  useEffect(() => {
    if (c.imageUrl) {
      if (c.imageUrl.startsWith('data:')) {
        setImgData(c.imageUrl);
        setIsLoaded(true);
      } else {
        setIsLoaded(false);
        getPortrait(c.imageUrl).then(data => {
          setImgData(data);
          setIsLoaded(true);
        });
      }
    } else {
      setImgData(null);
      setIsLoaded(true);
    }
  }, [c.imageUrl, c.id]);

  const handleSave = () => {
    const updatedChars = bible.characters.map(char => 
      char.id === c.id ? { 
        ...char, 
        profile: { ...char.profile, name: editName, description: editDesc },
        history: [...char.history, { timestamp: Date.now(), diff: 'Manual Quick Edit' }]
      } : char
    );
    bibleDispatch(Actions.updateBible({ characters: updatedChars }));
    setIsEditing(false);
    addLog('success', 'System', `${editName} の情報を更新しました。`);
  };

  const handleAiConsult = () => {
    uiDispatch(Actions.setPendingMsg(`「${c.profile.name}」というキャラクターの設定について相談したい。\n現在の説明：\n${c.profile.description}\n\nこの人物をもっと魅力的にするために、動機や葛藤などを深掘りして。`));
    uiDispatch(Actions.setView(ViewMode.PLOTTER));
  };

  return (
    <div className={`glass-bright rounded-[2rem] md:rounded-[2.5rem] overflow-hidden border transition-all shadow-xl group ${isExpanded ? 'ring-2 ring-orange-500/30' : ''} ${isEditing ? 'border-orange-500/40' : 'border-white/5'}`}>
      <div className="aspect-[16/10] bg-stone-900 relative">
        {!isLoaded ? (
          <div className="w-full h-full flex items-center justify-center text-stone-700 animate-pulse">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : imgData ? (
          <img src={imgData} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-stone-700">
             {isGenerating ? <Loader2 size={24} className="animate-spin text-orange-400" /> : <ImageIcon size={24} />}
             <span className="text-[8px] font-black uppercase tracking-[0.2em]">{isGenerating ? '肖像画を生成中...' : '肖像画なし'}</span>
          </div>
        )}
        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
           {c.isPrivate && (
             <div className="p-3 bg-stone-950/60 backdrop-blur-md text-emerald-400 rounded-xl shadow-xl">
               <Lock size={16} />
             </div>
           )}
           <button 
             onClick={(e) => { e.stopPropagation(); onGeneratePortrait(); }}
             disabled={isGenerating}
             className="p-3 bg-orange-600 text-white rounded-xl shadow-xl hover:bg-orange-500 transition-all active:scale-95 disabled:opacity-50"
             title="肖像画を再生成"
           >
             <Sparkles size={16} />
           </button>
           <button 
             onClick={(e) => { e.stopPropagation(); setIsEditing(!isEditing); }}
             className={`p-3 rounded-xl shadow-xl transition-all active:scale-95 ${isEditing ? 'bg-white text-stone-900' : 'bg-stone-800 text-stone-400 hover:text-white'}`}
             title="クイックエディット"
           >
             <Edit2 size={16} />
           </button>
        </div>
        <div className="absolute bottom-4 left-6 md:bottom-6 md:left-8 bg-stone-950/60 backdrop-blur-md px-4 py-2 rounded-xl flex items-center gap-2">
          {isEditing ? (
            <input 
              value={editName} 
              onChange={e => setEditName(e.target.value)} 
              className="bg-stone-900 border border-orange-500/40 rounded px-2 py-0.5 text-base md:text-lg font-display font-black text-white italic outline-none" 
            />
          ) : (
            <h4 className="text-base md:text-lg font-display font-black text-white italic">{c.profile.name}</h4>
          )}
          {c.isPrivate && <Lock size={12} className="text-emerald-400" />}
        </div>
      </div>
      <div className="p-6 md:p-8 space-y-4 md:space-y-6 flex-1 flex flex-col">
        <div className="flex-1 space-y-4">
          {isEditing ? (
            <div className="space-y-3">
              <textarea 
                value={editDesc} 
                onChange={e => setEditDesc(e.target.value)} 
                className="w-full bg-stone-950/50 border border-white/5 rounded-xl p-3 text-[11px] text-stone-300 font-serif leading-relaxed h-24 outline-none focus:border-orange-500/20 resize-none shadow-inner" 
                placeholder="キャラクターの説明..."
              />
              <div className="flex gap-2">
                 <button onClick={handleSave} className="flex-1 py-2 bg-orange-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-orange-500 transition-all"><Save size={12}/> 保存</button>
                 <button onClick={handleAiConsult} className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg hover:bg-indigo-600 hover:text-white transition-all" title="設計士に相談"><Wand2 size={14}/></button>
              </div>
            </div>
          ) : (
            <p className="text-[10px] md:text-[11px] text-stone-400 font-serif leading-relaxed line-clamp-3 italic">"{c.profile.description}"</p>
          )}
          
          <div className="space-y-3 pt-2">
             <div className="flex items-start gap-3">
               <Target size={14} className="text-orange-500 mt-0.5 shrink-0" />
               <div className="space-y-0.5">
                 <span className="text-[8px] font-black text-stone-600 uppercase">Motivation</span>
                 <p className="text-[10px] text-stone-300 font-serif leading-relaxed">{c.profile.motivation || "未設定"}</p>
               </div>
             </div>
             <div className="flex items-start gap-3">
               <Activity size={14} className="text-emerald-500 mt-0.5 shrink-0" />
               <div className="space-y-0.5">
                 <span className="text-[8px] font-black text-stone-600 uppercase">State</span>
                 <p className="text-[10px] text-stone-400 font-serif italic">@{c.state.location || "不明"}: {c.state.internalState || "平常"}</p>
               </div>
             </div>
          </div>
        </div>

        {isExpanded && (
          <div className="pt-6 border-t border-white/5 space-y-6 animate-fade-in">
             <div className="grid grid-cols-2 gap-4">
                <StatusItem icon={<MapPin size={12}/>} label="Location" value={c.state.location || "不明"} />
                <StatusItem icon={<Heart size={12}/>} label="Health" value={c.state.health || "良好"} />
             </div>
             <div className="space-y-3">
                <div className="flex items-center gap-2 text-[8px] font-black text-stone-600 uppercase tracking-widest"><Package size={12}/> Key Items</div>
                <div className="flex flex-wrap gap-1.5">
                   {inventory.length === 0 ? <span className="text-[9px] text-stone-700 italic">None</span> : 
                    inventory.map((item, i) => (
                      <span key={i} className="px-2 py-1 bg-stone-900 border border-white/5 rounded-lg text-[9px] text-stone-400">{item}</span>
                    ))}
                </div>
             </div>
          </div>
        )}
        
        <div className="flex items-center justify-between pt-4 border-t border-white/5">
          <button onClick={() => setIsExpanded(!isExpanded)} className="flex items-center gap-2 text-[8px] font-black text-stone-500 uppercase tracking-widest hover:text-white transition-colors">
            {isExpanded ? <ChevronUp size={12}/> : <ChevronDown size={12}/>} {isExpanded ? 'Hide Stats' : 'Show Stats'}
          </button>
          <div className="flex gap-1">
             {c.profile.traits?.slice(0, 2).map((t: string, i: number) => (
               <span key={i} className="px-2 py-0.5 bg-stone-800 rounded text-[7px] text-stone-400 font-bold">{t}</span>
             ))}
          </div>
        </div>
      </div>
    </div>
  );
});

const StatusItem = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) => (
  <div className="p-3 bg-stone-900 border border-white/5 rounded-2xl space-y-1">
    <div className="flex items-center gap-1.5 text-[7px] font-black text-stone-600 uppercase tracking-widest">
      {icon} {label}
    </div>
    <div className="text-[10px] text-stone-300 font-serif truncate">{value}</div>
  </div>
);
