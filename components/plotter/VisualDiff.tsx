
import React from 'react';

const KEY_LABELS: Record<string, string> = {
  // Common
  id: "ID",
  name: "名前",
  title: "タイトル",
  description: "詳細・本文",
  summary: "あらすじ",
  content: "内容",
  type: "タイプ",
  status: "状態",
  updatedAt: "更新日時",
  
  // Character Profile
  profile: "プロフィール",
  role: "役割",
  shortSummary: "一言紹介",
  appearance: "外見",
  personality: "性格",
  background: "背景",
  motivation: "動機",
  flaw: "欠点",
  arc: "成長・変化",
  voice: "口調",
  traits: "特徴タグ",
  aliases: "別名",
  
  // Character State
  state: "現在の状態",
  location: "現在地",
  internalState: "心理状態",
  currentGoal: "目的",
  health: "健康状態",
  socialStanding: "社会的地位",

  // Timeline / Events
  event: "出来事",
  timeLabel: "時期",
  importance: "重要度",
  involvedCharacterIds: "関連キャラクター",
  
  // World / Items
  setting: "舞台設定",
  tone: "トーン",
  grandArc: "グランドアーク",
  concept: "概念・テーマ",
  motifs: "モチーフ",
  history: "来歴",
  definition: "定義",
  category: "カテゴリ",
  
  // Other
  value: "値",
  mechanics: "仕組み",
  cost: "代償",
  dangerLevel: "危険度",
  habitat: "生息地",
  
  // Relationships
  relationships: "人間関係",
  strength: "関係深度",
  targetId: "対象ID",
  
  // Links
  relatedEntityIds: "関連エンティティ",
  associatedCharacterIds: "関連キャラクター",
  memberIds: "構成メンバー"
};

const translateKey = (key: string) => KEY_LABELS[key] || key;

const ValueRenderer: React.FC<{ value: any, depth?: number, resolver?: (id: string) => string | undefined, currentKey?: string }> = ({ value, depth = 0, resolver, currentKey }) => {
  if (value === null || value === undefined) return <span className="text-stone-600 italic">---</span>;
  
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-stone-600 italic text-[10px]">(なし)</span>;
    
    // String/Number Array
    if (value.every(v => typeof v === 'string' || typeof v === 'number')) {
       const shouldResolve = resolver && currentKey && ['relatedEntityIds', 'involvedCharacterIds', 'associatedCharacterIds', 'memberIds'].includes(currentKey);

       return (
         <div className="flex flex-wrap gap-1">
           {value.map((v, i) => {
             const label = shouldResolve ? (resolver(String(v)) || v) : v;
             return <span key={i} className="px-1.5 py-0.5 bg-stone-800 rounded text-[9px] text-stone-300 border border-white/5">{label}</span>;
           })}
         </div>
       );
    }
    
    // Object Array (Small, e.g. relationships)
    if (value.length <= 5 && typeof value[0] === 'object') {
       return (
         <div className="space-y-1.5">
            {value.map((v: any, i: number) => (
               <div key={i} className="p-2 bg-stone-950/30 rounded border border-white/5">
                  <ValueRenderer value={v} depth={depth + 1} resolver={resolver} />
               </div>
            ))}
         </div>
       );
    }

    return <span className="text-[10px] font-mono text-stone-500">[リスト ({value.length}項目)]</span>;
  }

  if (typeof value === 'object') {
     return (
       <div className={`grid grid-cols-1 gap-y-2 ${depth > 0 ? 'pl-2 border-l border-white/10 mt-1' : ''}`}>
         {Object.entries(value).map(([k, v]) => {
           // Filter internal fields
           if (['id', 'history', 'updatedAt', 'lastChangedAt', 'createdAt'].includes(k)) return null;
           if (typeof v === 'object' && v !== null && Object.keys(v).length === 0) return null;
           
           return (
             <div key={k} className="group">
                <div className="text-[9px] font-black text-stone-500 uppercase tracking-widest mb-0.5 flex items-center gap-2">
                  {translateKey(k)}
                </div>
                <div className="text-[11px] md:text-[12px] text-stone-300 leading-relaxed font-serif">
                   <ValueRenderer value={v} depth={depth + 1} resolver={resolver} currentKey={k} />
                </div>
             </div>
           );
         })}
       </div>
     );
  }

  // Handle single ID resolution for specific keys like targetId
  if (resolver && currentKey && ['targetId'].includes(currentKey) && typeof value === 'string') {
     const name = resolver(value);
     if (name) return <span className="whitespace-pre-wrap text-stone-300" title={value}>{name}</span>;
  }

  return <span className="whitespace-pre-wrap text-stone-300">{String(value)}</span>;
};

interface VisualDiffProps {
  oldVal: any;
  newVal: any;
  resolver?: (id: string) => string | undefined;
}

export const VisualDiff = React.memo(({ oldVal, newVal, resolver }: VisualDiffProps) => {
  // Ignore old value if it is effectively empty or null
  const hasOld = oldVal !== null && oldVal !== undefined && oldVal !== "" && (typeof oldVal !== 'object' || Object.keys(oldVal).length > 0);
  
  return (
    <div className="grid grid-cols-1 gap-3 font-sans">
      {hasOld && (
        <div className="p-3 bg-rose-950/20 border border-rose-500/20 rounded-xl relative overflow-hidden group">
           <div className="absolute top-0 left-0 w-1 h-full bg-rose-500/40" />
           <div className="text-[8px] font-black text-rose-400 uppercase mb-2 tracking-widest pl-2">変更前</div>
           <div className="pl-2 opacity-80 grayscale group-hover:grayscale-0 transition-all max-h-40 overflow-y-auto custom-scrollbar">
             <ValueRenderer value={oldVal} resolver={resolver} />
           </div>
        </div>
      )}
      
      <div className={`p-3 bg-emerald-950/20 border border-emerald-500/20 rounded-xl relative overflow-hidden ${!hasOld ? 'border-dashed' : ''}`}>
         <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/40" />
         <div className="text-[8px] font-black text-emerald-400 uppercase mb-2 tracking-widest pl-2">{hasOld ? '変更後' : '新規内容'}</div>
         <div className="pl-2">
            <ValueRenderer value={newVal} resolver={resolver} />
         </div>
      </div>
    </div>
  );
});
