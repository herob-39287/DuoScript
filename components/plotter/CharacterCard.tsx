
import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Image as ImageIcon, Sparkles, Target, Activity, Lock, ChevronDown, ChevronUp, Package, Brain, MapPin, Heart, Edit2, Save, Wand2, MessageCircle, Volume2, Sun, Moon, Skull, Check, Trash2, Plus, X } from 'lucide-react';
import { Character, CharacterProfile, Relationship } from '../../types';
import { getPortrait } from '../../services/storageService';
import { useBible, useBibleDispatch, useUIDispatch, useNotificationDispatch, useMetadataDispatch, useManuscript, useNeuralSync, useMetadata } from '../../contexts/StoryContext';
import * as Actions from '../../store/actions';
import { generateSpeech, genesisFill } from '../../services/geminiService';
import { Card, Button, Badge } from '../ui/DesignSystem';

interface CharacterCardProps {
  character: Character;
  onGeneratePortrait: () => void;
  isGenerating: boolean;
}

// PCM Decoding Helpers
function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// UI Component for Genesis Fill Button
const FillBtn: React.FC<{ onClick: () => void; loading: boolean }> = ({ onClick, loading }) => (
  <button 
    onClick={onClick} 
    disabled={loading}
    className="absolute top-2 right-2 p-1.5 bg-stone-800 hover:bg-indigo-600 text-stone-500 hover:text-white rounded-lg transition-all opacity-0 group-hover:opacity-100 disabled:opacity-100 focus:opacity-100"
    title="Genesis Fill: AIによる自動生成"
  >
    {loading ? <Loader2 size={12} className="animate-spin text-indigo-400"/> : <Wand2 size={12}/>}
  </button>
);

export const CharacterCard = React.memo(({ character: c, onGeneratePortrait, isGenerating }: CharacterCardProps) => {
  const bible = useBible();
  const meta = useMetadata();
  const chapters = useManuscript();
  const sync = useNeuralSync();
  const metaDispatch = useMetadataDispatch();
  const bibleDispatch = useBibleDispatch();
  const uiDispatch = useUIDispatch();
  const { addLog } = useNotificationDispatch();

  const [imgData, setImgData] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState<'profile' | 'relationships'>('profile');
  
  // Consolidated Edit State
  const [editProfile, setEditProfile] = useState<CharacterProfile>(c.profile);
  const [editRelationships, setEditRelationships] = useState<Relationship[]>(c.relationships || []);
  const [loadingField, setLoadingField] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);

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

  // Sync editData when entering edit mode or when character prop changes
  useEffect(() => {
    if (isEditing) {
      setEditProfile(c.profile);
      setEditRelationships(c.relationships || []);
    }
  }, [isEditing, c.profile, c.relationships]);

  const handleSave = () => {
    const updatedChars = bible.characters.map(char => 
      char.id === c.id ? { 
        ...char, 
        profile: editProfile,
        relationships: editRelationships,
        history: [...char.history, { timestamp: Date.now(), diff: 'Manual Edit' }]
      } : char
    );
    bibleDispatch(Actions.updateBible({ characters: updatedChars }));
    setIsEditing(false);
    addLog('success', 'System', `${editProfile.name} の情報を更新しました。`);
  };

  const handleDelete = () => {
    uiDispatch(Actions.openDialog({
      isOpen: true,
      type: 'confirm',
      title: 'キャラクターの削除',
      message: `「${c.profile.name}」を完全に削除しますか？`,
      onConfirm: () => {
        const updatedChars = bible.characters.filter(char => char.id !== c.id);
        bibleDispatch(Actions.updateBible({ characters: updatedChars }));
        uiDispatch(Actions.closeDialog());
        addLog('info', 'System', `${c.profile.name} を削除しました。`);
      }
    }));
  };

  const handleAddRelationship = () => {
    setEditRelationships([...editRelationships, {
      targetId: '',
      type: 'Other',
      description: '',
      strength: 0,
      lastChangedAt: 'Manual'
    }]);
  };

  const handleUpdateRelationship = (index: number, field: keyof Relationship, value: any) => {
    const updated = [...editRelationships];
    updated[index] = { ...updated[index], [field]: value };
    setEditRelationships(updated);
  };

  const handleRemoveRelationship = (index: number) => {
    const updated = [...editRelationships];
    updated.splice(index, 1);
    setEditRelationships(updated);
  };

  const handleFill = async (key: keyof CharacterProfile, label: string) => {
    if (loadingField) return;
    setLoadingField(key as string);
    try {
      const generated = await genesisFill(
        { meta, bible, chapters, sync } as any, 
        editProfile, 
        label, 
        (u) => metaDispatch(Actions.trackUsage(u)),
        addLog
      );
      setEditProfile(prev => ({ ...prev, [key]: generated }));
      addLog('success', 'Genesis', `${label} を生成しました。`);
    } catch (e) {
      addLog('error', 'Genesis', '生成に失敗しました。');
    } finally {
      setLoadingField(null);
    }
  };

  const handleConsult = () => {
    uiDispatch(Actions.setPendingMsg(`キャラクター「${c.profile.name}」について相談です。\n\n`));
  };

  const handlePlayVoice = async () => {
    if (isSpeaking) return;
    setIsSpeaking(true);
    addLog('info', 'Voice', `${c.profile.name} の声を生成中...`);

    try {
      const voiceName = c.voiceId || 'Zephyr';
      const sampleText = c.profile.motivation || "私は私の道を切り拓く。";
      const base64Audio = await generateSpeech(
        `Character: ${c.profile.name}. Mood: ${bible.tone}. Lines: ${sampleText}`, 
        voiceName, 
        (u) => metaDispatch(Actions.trackUsage(u)), 
        addLog
      );

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const ctx = audioContextRef.current;
      const audioBytes = decodeBase64(base64Audio as unknown as string);
      const audioBuffer = await decodeAudioData(audioBytes, ctx, 24000, 1);
      
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => setIsSpeaking(false);
      source.start();
    } catch (e) {
      addLog('error', 'Voice', '音声の生成に失敗しました。');
      setIsSpeaking(false);
    }
  };

  const getRelationshipName = (targetId: string) => {
    const target = bible.characters.find(char => char.id === targetId);
    return target ? target.profile.name : "Unknown";
  };

  const inventory = bible.keyItems
    .filter(i => i.currentOwnerId === c.id)
    .map(i => i.name);

  return (
    <Card variant="glass-bright" padding="none" className={`group ${isExpanded ? 'ring-2 ring-orange-500/30' : ''} ${isEditing ? 'border-orange-500/40' : ''} flex flex-col`}>
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
           <Button 
             variant={isSpeaking ? 'primary' : 'secondary'}
             size="icon-sm"
             onClick={(e) => { e.stopPropagation(); handlePlayVoice(); }}
             isLoading={isSpeaking}
             icon={<Volume2 size={16} />}
             title="声を聴く"
           />
           <Button 
             variant="primary"
             size="icon-sm"
             onClick={(e) => { e.stopPropagation(); onGeneratePortrait(); }}
             disabled={isGenerating}
             icon={<Sparkles size={16} />}
             title="肖像画を再生成"
           />
           <Button 
             variant="secondary"
             size="icon-sm"
             onClick={(e) => { e.stopPropagation(); handleConsult(); }}
             icon={<MessageCircle size={16} />}
             title="設計士に相談"
           />
           <Button 
             variant={isEditing ? 'ghost' : 'secondary'}
             size="icon-sm"
             onClick={(e) => { e.stopPropagation(); setIsEditing(!isEditing); }}
             icon={isEditing ? <Check size={16}/> : <Edit2 size={16} />}
             className={isEditing ? 'bg-emerald-500 text-white' : ''}
             title={isEditing ? "編集を完了" : "クイックエディット"}
           />
           {isEditing && (
             <Button
                variant="danger"
                size="icon-sm"
                onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                icon={<Trash2 size={16} />}
                title="キャラクター削除"
             />
           )}
        </div>
        <div className="absolute bottom-4 left-6 md:bottom-6 md:left-8 bg-stone-950/60 backdrop-blur-md px-4 py-2 rounded-xl flex items-center gap-2 max-w-[80%]">
          {isEditing ? (
            <input 
              value={editProfile.name} 
              onChange={e => setEditProfile({...editProfile, name: e.target.value})} 
              className="bg-stone-900 border border-orange-500/40 rounded px-2 py-0.5 text-base md:text-lg font-display font-black text-white italic outline-none w-full" 
            />
          ) : (
            <h4 className="text-base md:text-lg font-display font-black text-white italic truncate">{c.profile.name}</h4>
          )}
          {c.isPrivate && <Lock size={12} className="text-emerald-400 shrink-0" />}
        </div>
      </div>
      <div className="p-6 md:p-8 space-y-4 md:space-y-6 flex-1 flex flex-col">
        <div className="flex-1 space-y-4">
          {isEditing ? (
            <div className="space-y-3">
              <div className="space-y-1 relative group">
                <label className="text-[8px] font-black text-stone-600 uppercase">一言紹介</label>
                <input 
                  value={editProfile.shortSummary || ""}
                  onChange={e => setEditProfile({...editProfile, shortSummary: e.target.value})}
                  className="w-full bg-stone-950/50 border border-white/5 rounded-lg p-2 text-xs text-stone-300 outline-none focus:border-orange-500/20"
                  placeholder="一言紹介..."
                />
                <FillBtn onClick={() => handleFill('shortSummary', '一言紹介')} loading={loadingField === 'shortSummary'} />
              </div>
              <div className="relative group">
                <textarea 
                  value={editProfile.description} 
                  onChange={e => setEditProfile({...editProfile, description: e.target.value})} 
                  className="w-full bg-stone-950/50 border border-white/5 rounded-xl p-3 text-[11px] text-stone-300 font-serif leading-relaxed h-24 outline-none focus:border-orange-500/20 resize-none shadow-inner" 
                  placeholder="キャラクターの説明..."
                />
                <FillBtn onClick={() => handleFill('description', '詳細説明')} loading={loadingField === 'description'} />
              </div>
              
              <div className="space-y-3 pt-2">
                 <div className="flex items-start gap-3 relative group bg-stone-950/30 p-2 rounded-lg border border-white/5">
                   <Target size={14} className="text-orange-500 mt-0.5 shrink-0" />
                   <div className="space-y-0.5 w-full">
                     <span className="text-[8px] font-black text-stone-600 uppercase">Motivation / 動機</span>
                     <textarea 
                       value={editProfile.motivation}
                       onChange={e => setEditProfile({...editProfile, motivation: e.target.value})}
                       className="w-full bg-transparent border-none p-0 text-[10px] text-stone-300 font-serif leading-relaxed outline-none resize-none h-12"
                       placeholder="動機..."
                     />
                   </div>
                   <FillBtn onClick={() => handleFill('motivation', '動機')} loading={loadingField === 'motivation'} />
                 </div>
              </div>

              <div className="flex gap-2 pt-2">
                 <Button variant="primary" onClick={handleSave} size="sm" icon={<Save size={12}/>} className="flex-1">保存して終了</Button>
              </div>
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>

        {isExpanded && (
          <div className="pt-4 border-t border-white/5 space-y-4 animate-fade-in">
             <div className="flex gap-2 border-b border-white/5 pb-2">
                <Button variant={activeDetailTab === 'profile' ? 'primary' : 'ghost'} size="xs" onClick={() => setActiveDetailTab('profile')} className={activeDetailTab === 'profile' ? 'bg-orange-600/20 text-orange-400 shadow-none' : ''}>プロフィール詳細</Button>
                <Button variant={activeDetailTab === 'relationships' ? 'primary' : 'ghost'} size="xs" onClick={() => setActiveDetailTab('relationships')} className={activeDetailTab === 'relationships' ? 'bg-orange-600/20 text-orange-400 shadow-none' : ''}>人間関係</Button>
             </div>

             {activeDetailTab === 'profile' && (
               <div className="space-y-4 h-64 overflow-y-auto custom-scrollbar pr-2">
                 {isEditing ? (
                   <>
                     <div className="space-y-1 relative group bg-stone-950/30 p-2 rounded-lg border border-white/5">
                        <div className="flex items-center gap-1.5 text-[8px] font-black text-stone-600 uppercase tracking-widest"><Sun size={12}/> Appearance / 外見</div>
                        <textarea value={editProfile.appearance} onChange={e => setEditProfile({...editProfile, appearance: e.target.value})} className="w-full bg-transparent text-[10px] text-stone-300 font-serif h-16 outline-none resize-none" placeholder="外見..." />
                        <FillBtn onClick={() => handleFill('appearance', '外見')} loading={loadingField === 'appearance'} />
                     </div>
                     <div className="space-y-1 relative group bg-stone-950/30 p-2 rounded-lg border border-white/5">
                        <div className="flex items-center gap-1.5 text-[8px] font-black text-stone-600 uppercase tracking-widest"><Brain size={12}/> Personality / 性格</div>
                        <textarea value={editProfile.personality} onChange={e => setEditProfile({...editProfile, personality: e.target.value})} className="w-full bg-transparent text-[10px] text-stone-300 font-serif h-16 outline-none resize-none" placeholder="性格..." />
                        <FillBtn onClick={() => handleFill('personality', '性格')} loading={loadingField === 'personality'} />
                     </div>
                     <div className="space-y-1 relative group bg-stone-950/30 p-2 rounded-lg border border-white/5">
                        <div className="flex items-center gap-1.5 text-[8px] font-black text-stone-600 uppercase tracking-widest"><Moon size={12}/> Background / 背景</div>
                        <textarea value={editProfile.background} onChange={e => setEditProfile({...editProfile, background: e.target.value})} className="w-full bg-transparent text-[10px] text-stone-300 font-serif h-16 outline-none resize-none" placeholder="背景..." />
                        <FillBtn onClick={() => handleFill('background', '背景・生い立ち')} loading={loadingField === 'background'} />
                     </div>
                     <div className="space-y-1 relative group bg-stone-950/30 p-2 rounded-lg border border-white/5">
                        <div className="flex items-center gap-1.5 text-[8px] font-black text-stone-600 uppercase tracking-widest"><Skull size={12}/> Flaw / 欠点</div>
                        <textarea value={editProfile.flaw} onChange={e => setEditProfile({...editProfile, flaw: e.target.value})} className="w-full bg-transparent text-[10px] text-stone-300 font-serif h-12 outline-none resize-none" placeholder="致命的な欠点..." />
                        <FillBtn onClick={() => handleFill('flaw', '欠点')} loading={loadingField === 'flaw'} />
                     </div>
                     <div className="space-y-1 relative group bg-stone-950/30 p-2 rounded-lg border border-white/5">
                        <div className="flex items-center gap-1.5 text-[8px] font-black text-stone-600 uppercase tracking-widest"><Wand2 size={12}/> Character Arc / アーク</div>
                        <textarea value={editProfile.arc} onChange={e => setEditProfile({...editProfile, arc: e.target.value})} className="w-full bg-transparent text-[10px] text-stone-300 font-serif h-12 outline-none resize-none" placeholder="成長・変化の軌跡..." />
                        <FillBtn onClick={() => handleFill('arc', 'キャラクターアーク')} loading={loadingField === 'arc'} />
                     </div>
                   </>
                 ) : (
                   <>
                     <DetailSection icon={<Sun size={12}/>} label="Appearance / 外見" content={c.profile.appearance || "外見の描写はありません。"} />
                     <DetailSection icon={<Brain size={12}/>} label="Personality / 性格" content={c.profile.personality || "性格の定義はありません。"} />
                     <DetailSection icon={<Moon size={12}/>} label="Background / 背景" content={c.profile.background || "背景ストーリーはありません。"} />
                     <DetailSection icon={<Skull size={12}/>} label="Flaw / 欠点" content={c.profile.flaw || "致命的な欠点はありません。"} />
                     <DetailSection icon={<Wand2 size={12}/>} label="Character Arc / アーク" content={c.profile.arc || "アークの定義はありません。"} />
                   </>
                 )}
                 
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
               </div>
             )}

             {activeDetailTab === 'relationships' && (
               <div className="space-y-3 h-64 overflow-y-auto custom-scrollbar pr-2">
                 {isEditing ? (
                   <>
                     <div className="space-y-2">
                        {editRelationships.map((rel, idx) => (
                          <div key={idx} className="p-3 bg-stone-950/30 border border-white/5 rounded-xl space-y-2 relative">
                             <div className="grid grid-cols-2 gap-2">
                               <div className="space-y-1">
                                 <label className="text-[7px] text-stone-600 font-black uppercase">対象キャラクター</label>
                                 <select 
                                   value={rel.targetId} 
                                   onChange={(e) => handleUpdateRelationship(idx, 'targetId', e.target.value)}
                                   className="w-full bg-stone-950 text-xs text-stone-300 rounded px-2 py-1 outline-none border border-white/10"
                                 >
                                   <option value="">選択...</option>
                                   {bible.characters.filter(char => char.id !== c.id).map(char => (
                                     <option key={char.id} value={char.id}>{char.profile.name}</option>
                                   ))}
                                 </select>
                               </div>
                               <div className="space-y-1">
                                 <label className="text-[7px] text-stone-600 font-black uppercase">関係性タイプ</label>
                                 <select 
                                   value={rel.type} 
                                   onChange={(e) => handleUpdateRelationship(idx, 'type', e.target.value)}
                                   className="w-full bg-stone-950 text-xs text-stone-300 rounded px-2 py-1 outline-none border border-white/10"
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
                     <button onClick={handleAddRelationship} className="w-full py-2 border border-dashed border-stone-800 text-stone-500 hover:text-white rounded-lg flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest">
                       <Plus size={12}/> 関係を追加
                     </button>
                   </>
                 ) : (
                   c.relationships && c.relationships.length > 0 ? (
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
                   )
                 )}
               </div>
             )}
          </div>
        )}
        
        <div className="flex items-center justify-between pt-4 border-t border-white/5">
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
    </Card>
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

const DetailSection = ({ icon, label, content }: { icon: React.ReactNode, label: string, content: string }) => (
  <div className="space-y-1">
     <div className="flex items-center gap-1.5 text-[8px] font-black text-stone-600 uppercase tracking-widest">
        {icon} {label}
     </div>
     <p className="text-[10px] text-stone-400 font-serif leading-relaxed whitespace-pre-wrap">{content}</p>
  </div>
);
