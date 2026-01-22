
import React, { useState } from 'react';
import { Target, Activity, MapPin, Heart, Sun, Brain, Moon, Skull, Wand2, Package, MessageCircle, ChevronUp, ChevronDown } from 'lucide-react';
import { Character } from '../../../types';
import { Button, Badge } from '../../ui/DesignSystem';

interface CharacterDisplayProps {
  character: Character;
  inventory: string[];
  relationships: any[];
  getRelationshipName: (id: string) => string;
}

const StatusItem = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) => (
  <div className="p-3 bg-stone-900 border border-white/5 rounded-2xl space-y-1">
    <div className="flex items-center gap-1.5 text-[7px] font-black text-stone-600 uppercase tracking-widest">
      {icon} {label}
    </div>
    <div className="text-[10px] text-stone-300 font-serif truncate">{value}</div>
  </div>
);

const DetailSection = ({ icon, label, content }: { icon: React.ReactNode, label: string, content: string }) => (
  <div className="space-y-1">
     <div className="flex items-center gap-1.5 text-[8px] font-black text-stone-600 uppercase tracking-widest">
        {icon} {label}
     </div>
     <p className="text-[10px] text-stone-400 font-serif leading-relaxed whitespace-pre-wrap">{content}</p>
  </div>
);

export const CharacterDisplay: React.FC<CharacterDisplayProps> = ({ character: c, inventory, getRelationshipName }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState<'profile' | 'relationships'>('profile');

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
        {c.profile.shortSummary && (
          <p className="text-[10px] md:text-[11px] text-stone-300 font-bold leading-relaxed italic border-l-2 border-orange-500/40 pl-3">
            {c.profile.shortSummary}
          </p>
        )}
        <p className="text-[10px] md:text-[11px] text-stone-400 font-serif leading-relaxed line-clamp-3">
          {c.profile.description}
        </p>
        <div className="space-y-3 pt-2">
            <div className="flex items-start gap-3">
              <Target size={14} className="text-orange-500 mt-0.5 shrink-0" />
              <div className="space-y-0.5">
                <span className="text-[8px] font-black text-stone-600 uppercase">Motivation / 動機</span>
                <p className="text-[10px] text-stone-300 font-serif leading-relaxed line-clamp-2">{c.profile.motivation || "未設定"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Activity size={14} className="text-emerald-500 mt-0.5 shrink-0" />
              <div className="space-y-0.5">
                <span className="text-[8px] font-black text-stone-600 uppercase">State / 状態</span>
                <p className="text-[10px] text-stone-400 font-serif italic">@{c.state.location || "不明"}: {c.state.internalState || "平常"}</p>
              </div>
            </div>
        </div>

        {isExpanded && (
          <div className="pt-4 border-t border-white/5 space-y-4 animate-fade-in flex-1 overflow-hidden flex flex-col">
             <div className="flex gap-2 border-b border-white/5 pb-2 shrink-0">
                <Button variant={activeDetailTab === 'profile' ? 'primary' : 'ghost'} size="xs" onClick={() => setActiveDetailTab('profile')} className={activeDetailTab === 'profile' ? 'bg-orange-600/20 text-orange-400 shadow-none' : ''}>プロフィール詳細</Button>
                <Button variant={activeDetailTab === 'relationships' ? 'primary' : 'ghost'} size="xs" onClick={() => setActiveDetailTab('relationships')} className={activeDetailTab === 'relationships' ? 'bg-orange-600/20 text-orange-400 shadow-none' : ''}>人間関係</Button>
             </div>

             <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
               {activeDetailTab === 'profile' && (
                 <>
                   <DetailSection icon={<Sun size={12}/>} label="Appearance / 外見" content={c.profile.appearance || "外見の描写はありません。"} />
                   <DetailSection icon={<Brain size={12}/>} label="Personality / 性格" content={c.profile.personality || "性格の定義はありません。"} />
                   <DetailSection icon={<Moon size={12}/>} label="Background / 背景" content={c.profile.background || "背景ストーリーはありません。"} />
                   <DetailSection icon={<Skull size={12}/>} label="Flaw / 欠点" content={c.profile.flaw || "致命的な欠点はありません。"} />
                   <DetailSection icon={<Wand2 size={12}/>} label="Character Arc / アーク" content={c.profile.arc || "アークの定義はありません。"} />
                   
                   {c.profile.voice && (
                      <div className="p-3 bg-stone-900/50 rounded-xl space-y-1">
                        <div className="flex items-center gap-1.5 text-[8px] font-black text-stone-600 uppercase tracking-widest"><MessageCircle size={10}/> Voice / 口調</div>
                        <div className="grid grid-cols-2 gap-2 text-[10px] text-stone-400">
                           <span>一人称: {c.profile.voice.firstPerson}</span>
                           <span>二人称: {c.profile.voice.secondPerson}</span>
                        </div>
                      </div>
                   )}
                   <div className="grid grid-cols-2 gap-4 pt-2">
                      <StatusItem icon={<MapPin size={12}/>} label="Location / 場所" value={c.state.location || "不明"} />
                      <StatusItem icon={<Heart size={12}/>} label="Health / 健康" value={c.state.health || "良好"} />
                   </div>
                   <div className="space-y-2 pt-2">
                      <div className="flex items-center gap-2 text-[8px] font-black text-stone-600 uppercase tracking-widest"><Package size={12}/> Key Items / 所持品</div>
                      <div className="flex flex-wrap gap-1.5">
                         {inventory.length === 0 ? <span className="text-[9px] text-stone-700 italic">なし</span> : 
                          inventory.map((item, i) => (
                            <Badge key={i} color="stone">{item}</Badge>
                          ))}
                      </div>
                   </div>
                 </>
               )}

               {activeDetailTab === 'relationships' && (
                 <div className="space-y-3">
                   {c.relationships && c.relationships.length > 0 ? (
                     c.relationships.map((rel, idx) => (
                       <div key={idx} className="p-3 bg-stone-900/50 border border-white/5 rounded-xl space-y-1">
                          <div className="flex justify-between items-center">
                             <span className="text-[10px] font-bold text-stone-200">{getRelationshipName(rel.targetId)}</span>
                             <Badge color={rel.strength > 0 ? 'emerald' : 'rose'}>{rel.type}</Badge>
                          </div>
                          <p className="text-[10px] text-stone-400 font-serif italic">{rel.description}</p>
                       </div>
                     ))
                   ) : (
                     <div className="text-center text-stone-600 text-[10px] italic py-10">関係性の定義はありません。</div>
                   )}
                 </div>
               )}
             </div>
          </div>
        )}
      </div>
      
      <div className="flex items-center justify-between pt-4 mt-auto border-t border-white/5 shrink-0">
        <Button variant="ghost" size="xs" onClick={() => setIsExpanded(!isExpanded)} className="text-[8px] md:text-[8px] px-0 hover:bg-transparent">
           {isExpanded ? <ChevronUp size={12}/> : <ChevronDown size={12}/>} {isExpanded ? '閉じる' : '詳細'}
        </Button>
        <div className="flex gap-1">
           {c.profile.traits?.slice(0, 2).map((t: string, i: number) => (
             <Badge key={i} color="stone">{t}</Badge>
           ))}
        </div>
      </div>
    </div>
  );
};
