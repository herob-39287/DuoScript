
import React, { useState } from 'react';
import { Target, Save, Plus, X, Sun, Brain, Moon, Skull, Wand2, Loader2 } from 'lucide-react';
import { Character, CharacterProfile, Relationship } from '../../../types';
import { useBible } from '../../../contexts/StoryContext';
import { Button } from '../../ui/DesignSystem';

interface CharacterEditFormProps {
  character: Character;
  loadingField: string | null;
  onSave: (profile: CharacterProfile, relationships: Relationship[]) => void;
  onFill: (profile: CharacterProfile, key: keyof CharacterProfile, label: string) => Promise<string | null>;
  onCancel: () => void;
}

const FillBtn: React.FC<{ onClick: () => void; loading: boolean }> = ({ onClick, loading }) => (
  <button 
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    disabled={loading}
    className="absolute top-2 right-2 p-1.5 bg-stone-800 hover:bg-indigo-600 text-stone-500 hover:text-white rounded-lg transition-all opacity-0 group-hover:opacity-100 disabled:opacity-100 focus:opacity-100"
    title="Genesis Fill: AIによる自動生成"
  >
    {loading ? <Loader2 size={12} className="animate-spin text-indigo-400"/> : <Wand2 size={12}/>}
  </button>
);

export const CharacterEditForm: React.FC<CharacterEditFormProps> = ({
  character,
  loadingField,
  onSave,
  onFill,
  onCancel
}) => {
  const bible = useBible();
  const [profile, setProfile] = useState<CharacterProfile>(character.profile);
  const [relationships, setRelationships] = useState<Relationship[]>(character.relationships || []);

  const handleFillWrapper = async (key: keyof CharacterProfile, label: string) => {
    const result = await onFill(profile, key, label);
    if (result) {
      setProfile(prev => ({ ...prev, [key]: result }));
    }
  };

  const handleAddRelationship = () => {
    setRelationships([...relationships, {
      targetId: '',
      type: 'Other',
      description: '',
      strength: 0,
      lastChangedAt: 'Manual'
    }]);
  };

  const handleUpdateRelationship = (index: number, field: keyof Relationship, value: any) => {
    const updated = [...relationships];
    updated[index] = { ...updated[index], [field]: value };
    setRelationships(updated);
  };

  const handleRemoveRelationship = (index: number) => {
    const updated = [...relationships];
    updated.splice(index, 1);
    setRelationships(updated);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2">
        {/* Name Input */}
        <div className="sticky top-0 bg-stone-900/95 backdrop-blur z-10 pb-2 border-b border-white/5 mb-2">
           <label className="text-[8px] font-black text-stone-600 uppercase">Character Name</label>
           <input 
              value={profile.name} 
              onChange={e => setProfile({...profile, name: e.target.value})} 
              className="w-full bg-stone-950/50 border border-orange-500/40 rounded-xl px-3 py-2 text-lg font-display font-black text-white italic outline-none focus:bg-stone-950 transition-colors" 
              placeholder="キャラクター名"
            />
        </div>

        <div className="space-y-3">
          <div className="space-y-1 relative group">
            <label className="text-[8px] font-black text-stone-600 uppercase">一言紹介</label>
            <input 
              value={profile.shortSummary || ""}
              onChange={e => setProfile({...profile, shortSummary: e.target.value})}
              className="w-full bg-stone-950/50 border border-white/5 rounded-lg p-2 text-xs text-stone-300 outline-none focus:border-orange-500/20"
              placeholder="一言紹介..."
            />
            <FillBtn onClick={() => handleFillWrapper('shortSummary', '一言紹介')} loading={loadingField === 'shortSummary'} />
          </div>
          <div className="relative group">
            <label className="text-[8px] font-black text-stone-600 uppercase">Description / 詳細</label>
            <textarea 
              value={profile.description} 
              onChange={e => setProfile({...profile, description: e.target.value})} 
              className="w-full bg-stone-950/50 border border-white/5 rounded-xl p-3 text-[11px] text-stone-300 font-serif leading-relaxed h-24 outline-none focus:border-orange-500/20 resize-none shadow-inner" 
              placeholder="キャラクターの説明..."
            />
            <FillBtn onClick={() => handleFillWrapper('description', '詳細説明')} loading={loadingField === 'description'} />
          </div>
          
          <div className="flex items-start gap-3 relative group bg-stone-950/30 p-2 rounded-lg border border-white/5">
            <Target size={14} className="text-orange-500 mt-0.5 shrink-0" />
            <div className="space-y-0.5 w-full">
              <span className="text-[8px] font-black text-stone-600 uppercase">Motivation / 動機</span>
              <textarea 
                value={profile.motivation}
                onChange={e => setProfile({...profile, motivation: e.target.value})}
                className="w-full bg-transparent border-none p-0 text-[10px] text-stone-300 font-serif leading-relaxed outline-none resize-none h-12"
                placeholder="動機..."
              />
            </div>
            <FillBtn onClick={() => handleFillWrapper('motivation', '動機')} loading={loadingField === 'motivation'} />
          </div>
        </div>

        {/* Detailed Fields */}
        <div className="space-y-3 pt-2">
           <h4 className="text-[9px] font-black text-stone-500 uppercase tracking-widest border-b border-white/5 pb-1">Deep Profile</h4>
           
           <div className="space-y-1 relative group bg-stone-950/30 p-2 rounded-lg border border-white/5">
              <div className="flex items-center gap-1.5 text-[8px] font-black text-stone-600 uppercase tracking-widest"><Sun size={12}/> Appearance / 外見</div>
              <textarea value={profile.appearance} onChange={e => setProfile({...profile, appearance: e.target.value})} className="w-full bg-transparent text-[10px] text-stone-300 font-serif h-16 outline-none resize-none" placeholder="外見..." />
              <FillBtn onClick={() => handleFillWrapper('appearance', '外見')} loading={loadingField === 'appearance'} />
           </div>
           <div className="space-y-1 relative group bg-stone-950/30 p-2 rounded-lg border border-white/5">
              <div className="flex items-center gap-1.5 text-[8px] font-black text-stone-600 uppercase tracking-widest"><Brain size={12}/> Personality / 性格</div>
              <textarea value={profile.personality} onChange={e => setProfile({...profile, personality: e.target.value})} className="w-full bg-transparent text-[10px] text-stone-300 font-serif h-16 outline-none resize-none" placeholder="性格..." />
              <FillBtn onClick={() => handleFillWrapper('personality', '性格')} loading={loadingField === 'personality'} />
           </div>
           <div className="space-y-1 relative group bg-stone-950/30 p-2 rounded-lg border border-white/5">
              <div className="flex items-center gap-1.5 text-[8px] font-black text-stone-600 uppercase tracking-widest"><Moon size={12}/> Background / 背景</div>
              <textarea value={profile.background} onChange={e => setProfile({...profile, background: e.target.value})} className="w-full bg-transparent text-[10px] text-stone-300 font-serif h-16 outline-none resize-none" placeholder="背景..." />
              <FillBtn onClick={() => handleFillWrapper('background', '背景・生い立ち')} loading={loadingField === 'background'} />
           </div>
           <div className="space-y-1 relative group bg-stone-950/30 p-2 rounded-lg border border-white/5">
              <div className="flex items-center gap-1.5 text-[8px] font-black text-stone-600 uppercase tracking-widest"><Skull size={12}/> Flaw / 欠点</div>
              <textarea value={profile.flaw} onChange={e => setProfile({...profile, flaw: e.target.value})} className="w-full bg-transparent text-[10px] text-stone-300 font-serif h-12 outline-none resize-none" placeholder="致命的な欠点..." />
              <FillBtn onClick={() => handleFillWrapper('flaw', '欠点')} loading={loadingField === 'flaw'} />
           </div>
           <div className="space-y-1 relative group bg-stone-950/30 p-2 rounded-lg border border-white/5">
              <div className="flex items-center gap-1.5 text-[8px] font-black text-stone-600 uppercase tracking-widest"><Wand2 size={12}/> Character Arc / アーク</div>
              <textarea value={profile.arc} onChange={e => setProfile({...profile, arc: e.target.value})} className="w-full bg-transparent text-[10px] text-stone-300 font-serif h-12 outline-none resize-none" placeholder="成長・変化の軌跡..." />
              <FillBtn onClick={() => handleFillWrapper('arc', 'キャラクターアーク')} loading={loadingField === 'arc'} />
           </div>
        </div>

        {/* Relationships */}
        <div className="space-y-3 pt-2">
           <div className="flex items-center justify-between border-b border-white/5 pb-1">
             <h4 className="text-[9px] font-black text-stone-500 uppercase tracking-widest">Relationships</h4>
             <button onClick={handleAddRelationship} className="text-orange-400 hover:text-white flex items-center gap-1 text-[8px] font-black uppercase"><Plus size={10}/> Add</button>
           </div>
           <div className="space-y-2">
              {relationships.map((rel, idx) => (
                <div key={idx} className="p-3 bg-stone-950/30 border border-white/5 rounded-xl space-y-2 relative">
                   <div className="grid grid-cols-2 gap-2">
                     <div className="space-y-1">
                       <label className="text-[7px] text-stone-600 font-black uppercase">対象</label>
                       <select 
                         value={rel.targetId} 
                         onChange={(e) => handleUpdateRelationship(idx, 'targetId', e.target.value)}
                         className="w-full bg-stone-950 text-xs text-stone-300 rounded px-2 py-1 outline-none border border-white/10 appearance-none"
                       >
                         <option value="">選択...</option>
                         {bible.characters.filter(char => char.id !== character.id).map(char => (
                           <option key={char.id} value={char.id}>{char.profile.name}</option>
                         ))}
                       </select>
                     </div>
                     <div className="space-y-1">
                       <label className="text-[7px] text-stone-600 font-black uppercase">タイプ</label>
                       <select 
                         value={rel.type} 
                         onChange={(e) => handleUpdateRelationship(idx, 'type', e.target.value)}
                         className="w-full bg-stone-950 text-xs text-stone-300 rounded px-2 py-1 outline-none border border-white/10 appearance-none"
                       >
                         {['Ally', 'Enemy', 'Romance', 'Family', 'Business', 'Other', 'Complex'].map(t => (
                           <option key={t} value={t}>{t}</option>
                         ))}
                       </select>
                     </div>
                   </div>
                   <input 
                     value={rel.description}
                     onChange={(e) => handleUpdateRelationship(idx, 'description', e.target.value)}
                     placeholder="詳細..."
                     className="w-full bg-stone-950 border border-white/5 rounded px-2 py-1 text-xs text-stone-300 outline-none"
                   />
                   <button onClick={() => handleRemoveRelationship(idx)} className="absolute -top-2 -right-2 p-1 bg-stone-800 text-stone-500 hover:text-rose-400 rounded-full shadow-lg">
                     <X size={12}/>
                   </button>
                </div>
              ))}
           </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="pt-4 mt-2 border-t border-white/5 flex gap-2 shrink-0">
         <Button variant="ghost" onClick={onCancel} className="flex-1">キャンセル</Button>
         <Button variant="primary" onClick={() => onSave(profile, relationships)} icon={<Save size={12}/>} className="flex-1">保存して終了</Button>
      </div>
    </div>
  );
};
