
import React from 'react';
import { Loader2, Image as ImageIcon, Sparkles, Target, Activity } from 'lucide-react';
import { Character } from '../../types';

interface CharacterCardProps {
  character: Character;
  onGeneratePortrait: () => void;
  isGenerating: boolean;
}

export const CharacterCard = React.memo(({ character: c, onGeneratePortrait, isGenerating }: CharacterCardProps) => (
  <div className="glass-bright rounded-[2rem] md:rounded-[2.5rem] overflow-hidden border border-white/5 flex flex-col h-full hover:border-orange-500/20 transition-all shadow-xl group">
    <div className="aspect-[16/10] bg-stone-900 relative">
      {c.imageUrl ? (
        <img src={c.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000" />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-stone-700">
           {isGenerating ? <Loader2 size={24} className="animate-spin text-orange-400" /> : <ImageIcon size={24} />}
           <span className="text-[8px] font-black uppercase tracking-[0.2em]">{isGenerating ? '肖像画を生成中...' : '肖像画なし'}</span>
        </div>
      )}
      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
         <button 
           onClick={(e) => { e.stopPropagation(); onGeneratePortrait(); }}
           disabled={isGenerating}
           className="p-3 bg-orange-600 text-white rounded-xl shadow-xl hover:bg-orange-500 transition-all active:scale-95 disabled:opacity-50"
         >
           <Sparkles size={16} />
         </button>
      </div>
      <div className="absolute bottom-4 left-6 md:bottom-6 md:left-8 bg-stone-950/60 backdrop-blur-md px-4 py-2 rounded-xl"><h4 className="text-base md:text-lg font-display font-black text-white italic">{c.name}</h4></div>
    </div>
    <div className="p-6 md:p-8 space-y-4 md:space-y-6 flex-1 flex flex-col">
      <div className="flex-1 space-y-4">
        <p className="text-[10px] md:text-[11px] text-stone-400 font-serif leading-relaxed line-clamp-3 italic">"{c.description}"</p>
        
        <div className="space-y-3 pt-2">
           <div className="flex items-start gap-3">
             <Target size={14} className="text-orange-500 mt-0.5 shrink-0" />
             <div className="space-y-0.5">
               <span className="text-[8px] font-black text-stone-600 uppercase">Motivation</span>
               <p className="text-[10px] text-stone-300 font-serif leading-relaxed">{c.motivation || "未設定"}</p>
             </div>
           </div>
           <div className="flex items-start gap-3">
             <Activity size={14} className="text-emerald-500 mt-0.5 shrink-0" />
             <div className="space-y-0.5">
               <span className="text-[8px] font-black text-stone-600 uppercase">Current Status</span>
               <p className="text-[10px] text-stone-400 font-serif italic">@{c.status?.location || "不明"}: {c.status?.internalState || "平常"}</p>
             </div>
           </div>
        </div>
      </div>
      
      <div className="flex items-center justify-between pt-4 border-t border-white/5">
        <span className="text-[8px] font-black text-stone-500 uppercase tracking-widest">{c.role}</span>
        <div className="flex gap-1">
           {c.traits?.slice(0, 2).map((t: string, i: number) => (
             <span key={i} className="px-2 py-0.5 bg-stone-800 rounded text-[7px] text-stone-400 font-bold">{t}</span>
           ))}
        </div>
      </div>
    </div>
  </div>
));
