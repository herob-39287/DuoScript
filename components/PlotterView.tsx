
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { StoryProject, ChatMessage, SystemLog, Character, SyncOperation, HistoryEntry, WorldBible, CharacterStatus, Foreshadowing, Relationship, TimelineEvent, WorldEntry, NexusBranch, ChapterLog, StateDelta, PlotBeat } from '../types';
import { chatWithArchitect, extractSettingsFromChat, generateCharacterPortrait, playCharacterVoice, generateCharacterIdea, simulateBranch, generateFullWorldPackage } from '../services/geminiService';
import { savePortrait } from '../services/storageService';
import { 
  Users, Globe, Search, Zap, History, Check, X, Volume2, Sparkles, Loader2, MessageSquare, 
  Calendar, BookOpen, ArrowUpRight, Activity, MapPin, Heart, BookText, Fingerprint, 
  Target, Bookmark, Clock, Compass, GitBranch, ListOrdered, Plus, Trash2, Wand2, Wand, Scale, Frown, Smile, Package, Brain,
  ShieldAlert, TrendingUp, Info, Flag, Link, Split, Tags, Book, Eye, EyeOff, Menu, Origami
} from 'lucide-react';

interface Props {
  project: StoryProject;
  setProject: React.Dispatch<React.SetStateAction<StoryProject>>;
  addLog: (type: SystemLog['type'], source: SystemLog['source'], message: string) => void;
  onTokenUsage: (usage: { input: number; output: number }) => void;
  initialTab?: string;
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
}

type CategoryType = 'CANON' | 'PLAN' | 'STATE' | 'OPS';

const PlotterView: React.FC<Props> = ({ project, setProject, addLog, onTokenUsage, initialTab, showConfirm }) => {
  const [activeCategory, setActiveCategory] = useState<CategoryType>('CANON');
  const [activeTab, setActiveTab] = useState<string>(initialTab || 'characters');
  const [input, setInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const [useSearch, setUseSearch] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isGeneratingImg, setIsGeneratingImg] = useState<string | null>(null);
  const [isGeneratingIdea, setIsGeneratingIdea] = useState(false);
  const [nexusInput, setNexusInput] = useState('');
  const [isSimulating, setIsSimulating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [showArchitectMobile, setShowArchitectMobile] = useState(false);
  const [isWorldGenesis, setIsWorldGenesis] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [project.chatHistory, project.pendingChanges]);

  const chapterProjections = useMemo(() => {
    const projections: { [chapterId: string]: { [characterId: string]: CharacterStatus } } = {};
    const currentStates: { [characterId: string]: CharacterStatus } = {};
    project.bible.characters.forEach(c => { currentStates[c.id] = JSON.parse(JSON.stringify(c.status)); });
    project.chapters.forEach(ch => {
      if (ch.stateDeltas) {
        ch.stateDeltas.forEach(delta => {
          const charState = currentStates[delta.characterId];
          if (charState) {
             if (delta.op === 'set') (charState as any)[delta.field] = delta.value;
             else if (delta.op === 'add' && Array.isArray((charState as any)[delta.field])) (charState as any)[delta.field] = [...(charState as any)[delta.field], delta.value];
             else if (delta.op === 'remove' && Array.isArray((charState as any)[delta.field])) (charState as any)[delta.field] = (charState as any)[delta.field].filter((v: any) => v !== delta.value);
          }
        });
      }
      projections[ch.id] = JSON.parse(JSON.stringify(currentStates));
    });
    return projections;
  }, [project.bible.characters, project.chapters]);

  const filteredEntries = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return project.bible.entries.filter(e => 
      e.title.toLowerCase().includes(q) || 
      e.aliases.some(a => a.toLowerCase().includes(q)) ||
      e.category.toLowerCase().includes(q)
    );
  }, [project.bible.entries, searchQuery]);

  const selectedEntry = useMemo(() => 
    project.bible.entries.find(e => e.id === selectedEntryId),
    [project.bible.entries, selectedEntryId]
  );

  const handleSendMessage = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || isChatting) return;
    setInput('');
    setIsChatting(true);
    try {
      const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: trimmedInput, timestamp: Date.now() };
      const historyWithUser = [...(project.chatHistory || []), userMsg];
      setProject(p => ({ ...p, chatHistory: historyWithUser }));
      const apiHistory = historyWithUser.map(m => ({ role: m.role, parts: [{ text: m.content }] }));
      const { text, sources } = await chatWithArchitect(apiHistory, trimmedInput, project, useSearch, onTokenUsage);
      const botMsg: ChatMessage = { id: (Date.now()+1).toString(), role: 'model', content: text, timestamp: Date.now(), sources };
      const finalHistory = [...historyWithUser, botMsg];
      setProject(p => ({ ...p, chatHistory: finalHistory }));
      runSync(finalHistory);
    } catch (err: any) { addLog('error', 'Architect', err.message); } finally { setIsChatting(false); }
  };

  const handleWorldGenesis = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || isWorldGenesis) return;
    setIsWorldGenesis(true);
    addLog('info', 'Architect', '物語の全構造を構築中...');
    try {
      const ops = await generateFullWorldPackage(trimmedInput, onTokenUsage);
      if (ops.length > 0) {
        setProject(prev => ({ ...prev, pendingChanges: [...prev.pendingChanges, ...ops] }));
        addLog('success', 'NeuralSync', `${ops.length}件の設定提案が生成されました。サイドバーから承認してください。`);
      }
      setInput('');
    } catch (err: any) { addLog('error', 'Architect', err.message); } finally { setIsWorldGenesis(false); }
  };

  const runSync = async (history: any[]) => {
    setIsSyncing(true);
    try {
      const ops = await extractSettingsFromChat(history, project.bible, onTokenUsage);
      if (ops.length > 0) { setProject(prev => ({ ...prev, pendingChanges: [...prev.pendingChanges, ...ops] })); addLog('success', 'NeuralSync', `${ops.length}件の変更提案があります。`); }
    } catch (err: any) { console.warn('Sync ignored:', err.message); } finally { setIsSyncing(false); }
  };

  const commitOp = (op: SyncOperation) => {
    setProject(prev => {
      let normalizedValue = op.value;
      if (typeof normalizedValue === 'string') { try { const parsed = JSON.parse(normalizedValue); if (parsed && typeof parsed === 'object') normalizedValue = parsed; } catch (e) { } }
      const nextBible: WorldBible = { ...prev.bible, version: prev.bible.version + 1 };
      const nextProject = { ...prev, bible: nextBible };
      const currentVersion = nextBible.version;
      let oldVal: any = null;
      let targetName = op.targetName || "不明な項目";

      if (['setting', 'tone', 'laws', 'grandArc'].includes(op.path)) {
        oldVal = (nextBible as any)[op.path];
        (nextBible as any)[op.path] = normalizedValue;
      } 
      else if (op.op === 'addAlias' && op.path === 'entries' && op.targetId) {
        const idx = nextBible.entries.findIndex(e => e.id === op.targetId);
        if (idx !== -1) {
          oldVal = nextBible.entries[idx].aliases;
          nextBible.entries[idx] = { ...nextBible.entries[idx], aliases: Array.from(new Set([...nextBible.entries[idx].aliases, String(normalizedValue)])) };
          targetName = nextBible.entries[idx].title;
        }
      }
      else if (['characters', 'timeline', 'foreshadowing', 'entries', 'chapters'].includes(op.path)) {
        const isBiblePath = op.path !== 'chapters';
        const collection = isBiblePath ? [...(nextBible as any)[op.path]] : [...prev.chapters];
        if (op.op === 'add') {
          const newItem = { id: crypto.randomUUID(), aliases: [], definition: '', narrativeSignificance: '', isSecret: false, linkedIds: [], tags: [], ...(typeof normalizedValue === 'object' ? normalizedValue : { content: normalizedValue }) };
          collection.push(newItem);
          targetName = newItem.title || newItem.name || targetName;
        } 
        else if (['set', 'update', 'rename', 'merge'].includes(op.op) && op.targetId) {
          const idx = collection.findIndex((item: any) => item.id === op.targetId);
          if (idx !== -1) {
            oldVal = op.field ? collection[idx][op.field] : collection[idx];
            collection[idx] = op.field ? { ...collection[idx], [op.field]: normalizedValue } : { ...collection[idx], ...(typeof normalizedValue === 'object' ? normalizedValue : {}) };
            targetName = collection[idx].title || collection[idx].name || targetName;
          }
        } 
        else if (op.op === 'delete' && op.targetId) {
          const idx = collection.findIndex((item: any) => item.id === op.targetId);
          if (idx !== -1) { targetName = collection[idx].title || collection[idx].name || targetName; collection.splice(idx, 1); }
        }
        if (isBiblePath) (nextBible as any)[op.path] = collection;
        else nextProject.chapters = collection as ChapterLog[];
      }

      const historyEntry: HistoryEntry = { id: crypto.randomUUID(), timestamp: Date.now(), operationId: op.id, opType: op.op, path: op.path, targetId: op.targetId, targetName: targetName, field: op.field, oldValue: oldVal, newValue: normalizedValue, rationale: op.rationale, evidence: op.evidence, versionAtCommit: currentVersion };
      return { ...nextProject, history: [historyEntry, ...prev.history].slice(0, 200), pendingChanges: prev.pendingChanges.filter(p => p.id !== op.id) };
    });
    addLog('success', 'NeuralSync', `設定資料を更新しました。 (V${project.bible.version + 1})`);
  };

  const renderChronicleView = () => (
    <div className="max-w-6xl mx-auto space-y-10 md:space-y-16 animate-fade-in relative px-4 md:px-0">
      <div className="flex items-center gap-4"><Clock size={24} className="text-orange-400"/><h3 className="text-xl font-display font-black text-white italic">The Unified Chronicle</h3></div>
      
      <div className="flex flex-wrap gap-4 md:gap-6 p-4 md:p-6 bg-stone-900/40 rounded-2xl md:rounded-3xl border border-white/5">
         <div className="flex items-center gap-2 text-[8px] md:text-[9px] font-black uppercase text-orange-400"><Flag size={12}/> Planting</div>
         <div className="flex items-center gap-2 text-[8px] md:text-[9px] font-black uppercase text-emerald-400"><Flag size={12}/> Payoff</div>
         <div className="flex items-center gap-2 text-[8px] md:text-[9px] font-black uppercase text-blue-400"><Flag size={12}/> Progress</div>
      </div>

      <div className="relative pt-8 pb-24">
         <div className="absolute left-1/2 top-0 bottom-0 w-px bg-stone-800 -translate-x-1/2 z-0 hidden md:block" />
         
         {project.bible.timeline.length === 0 ? (
           <div className="text-center py-20 text-stone-700 italic text-sm">年表が空です。</div>
         ) : project.bible.timeline.map((event, index) => {
           const isEven = index % 2 === 0;
           return (
             <div key={event.id} className={`relative flex flex-col md:flex-row items-center justify-between mb-16 md:mb-24 ${isEven ? 'md:flex-row' : 'md:flex-row-reverse'}`}>
                <div className={`w-full md:w-[45%] p-6 md:p-10 glass-bright rounded-[1.5rem] md:rounded-[2.5rem] border border-white/5 shadow-2xl relative group hover:scale-[1.01] transition-all duration-500 ${isEven ? 'md:text-right' : 'md:text-left'}`}>
                   <div className={`absolute top-0 hidden md:block ${isEven ? '-right-4' : '-left-4'} w-8 h-8 rounded-full bg-stone-950 border-4 border-orange-600 z-10`} />
                   <div className="space-y-4">
                      <div className="flex items-center justify-between gap-4">
                        {(isEven || window.innerWidth < 768) && <span className="text-[10px] font-mono text-stone-600">{event.timeLabel}</span>}
                        <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${event.importance === 'Climax' ? 'bg-rose-500 text-white' : 'bg-stone-800 text-stone-400'}`}>{event.importance}</span>
                        {!isEven && window.innerWidth >= 768 && <span className="text-[10px] font-mono text-stone-600">{event.timeLabel}</span>}
                      </div>
                      <h4 className="text-lg md:text-xl font-display font-black text-white italic leading-tight">{event.event}</h4>
                      <p className="text-[12px] md:text-[13px] font-serif text-stone-400 leading-relaxed italic">{event.description}</p>
                      <div className={`flex flex-wrap gap-2 pt-4 ${isEven ? 'md:justify-end' : 'md:justify-start'}`}>
                         {event.foreshadowingLinks?.map(link => {
                           const f = project.bible.foreshadowing.find(x => x.id === link.foreshadowingId);
                           return (
                             <div key={link.foreshadowingId} className={`flex items-center gap-2 px-3 py-1 rounded-full text-[8px] md:text-[9px] font-black uppercase border ${
                               link.action === 'Plant' ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' :
                               link.action === 'Payoff' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                               'bg-blue-500/10 border-blue-500/30 text-blue-400'
                             }`}>
                                <Flag size={10}/> {f?.title || 'Unknown'}
                             </div>
                           );
                         })}
                      </div>
                   </div>
                </div>
                <div className={`w-full md:w-[45%] flex flex-col gap-4 mt-4 md:mt-0`}>
                   {event.foreshadowingLinks?.map(link => {
                      const f = project.bible.foreshadowing.find(x => x.id === link.foreshadowingId);
                      return (
                        <div key={link.foreshadowingId} className={`p-4 md:p-6 bg-stone-900/40 rounded-2xl border border-white/5 animate-fade-in ${isEven ? 'md:text-left' : 'md:text-right'}`}>
                           <div className={`flex items-center gap-3 mb-2 ${isEven ? 'md:justify-start' : 'md:justify-end'}`}>
                              <div className={`w-2 h-2 rounded-full ${f?.status === 'Open' ? 'bg-orange-500 animate-pulse' : 'bg-stone-700'}`} />
                              <span className="text-[9px] md:text-[10px] font-black text-white uppercase tracking-widest">THREAD: {f?.title}</span>
                           </div>
                           <p className="text-[10px] md:text-[11px] font-serif text-stone-500 italic leading-relaxed">{link.note}</p>
                        </div>
                      );
                   })}
                </div>
             </div>
           );
         })}
      </div>
    </div>
  );

  const renderLibraryTab = () => (
    <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-6 md:gap-8 h-full min-h-[600px] animate-fade-in px-4 md:px-0">
       <div className="w-full md:w-80 flex flex-col gap-4 shrink-0">
          <div className="relative">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-600" size={16} />
             <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="用語・別名を検索..." className="w-full bg-stone-900/50 border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-xs text-white outline-none focus:border-orange-400/30 transition-all" />
          </div>
          <button onClick={addLibraryEntry} className="w-full py-4 bg-stone-800 text-orange-400 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-stone-700"><Plus size={14}/> 用語を追加</button>
          <div className="flex-1 max-h-[300px] md:max-h-full overflow-y-auto space-y-2 custom-scrollbar pr-2">
             {filteredEntries.map(e => (
               <button key={e.id} onClick={() => setSelectedEntryId(e.id)} className={`w-full text-left p-4 rounded-2xl border transition-all ${selectedEntryId === e.id ? 'bg-orange-600/10 border-orange-500/40 text-white' : 'glass-bright border-transparent text-stone-500 hover:bg-white/5'}`}>
                  <div className="flex items-center justify-between mb-1">
                     <span className="text-[12px] font-serif-bold truncate">{e.title}</span>
                     <span className="text-[7px] font-black uppercase text-stone-700">{e.category}</span>
                  </div>
               </button>
             ))}
          </div>
       </div>

       <div className="flex-1 overflow-y-auto custom-scrollbar">
          {selectedEntry ? (
            <div className="glass-bright rounded-[1.5rem] md:rounded-[3rem] p-6 md:p-10 border border-white/5 space-y-8 md:space-y-12 shadow-2xl animate-fade-in relative">
                <button onClick={() => setSelectedEntryId(null)} className="md:hidden absolute top-6 right-6 p-2 text-stone-600"><X size={20}/></button>
                <div className="space-y-6">
                   <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                      <div className="w-14 h-14 md:w-16 md:h-16 bg-stone-900 rounded-2xl md:rounded-3xl flex items-center justify-center text-orange-400 shadow-xl border border-white/5"><Book size={28}/></div>
                      <div className="flex-1 w-full">
                         <input value={selectedEntry.title} onChange={e => updateLibraryEntry(selectedEntry.id, 'title', e.target.value)} className="bg-transparent text-2xl md:text-4xl font-display font-black text-white italic outline-none w-full" placeholder="用語名" />
                         <div className="flex flex-wrap gap-2 md:gap-4 mt-2">
                            <select value={selectedEntry.category} onChange={e => updateLibraryEntry(selectedEntry.id, 'category', e.target.value)} className="bg-stone-900 text-[10px] font-black text-orange-400 uppercase tracking-widest px-3 py-1 rounded-lg border-none outline-none">
                               {['History','Culture','Technology','Magic','Geography','Lore','Terminology'].map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <button onClick={() => updateLibraryEntry(selectedEntry.id, 'isSecret', !selectedEntry.isSecret)} className={`flex items-center gap-2 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${selectedEntry.isSecret ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : 'bg-stone-900 border-white/5 text-stone-600'}`}>
                               {selectedEntry.isSecret ? <EyeOff size={12}/> : <Eye size={12}/>} {selectedEntry.isSecret ? 'SECRET' : 'PUBLIC'}
                            </button>
                         </div>
                      </div>
                   </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-10">
                   <div className="space-y-3">
                      <label className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] flex items-center gap-2"><Scale size={16}/> 定義 (Definition)</label>
                      <textarea value={selectedEntry.definition} onChange={e => updateLibraryEntry(selectedEntry.id, 'definition', e.target.value)} className="w-full bg-stone-950/40 border border-white/5 rounded-2xl p-4 md:p-6 text-[13px] font-serif leading-loose text-stone-300 h-48 md:h-64 outline-none focus:border-emerald-400/20 transition-all shadow-inner" placeholder="..." />
                   </div>
                   <div className="space-y-3">
                      <label className="text-[10px] font-black text-orange-400 uppercase tracking-[0.2em] flex items-center gap-2"><Sparkles size={16}/> 役割 (Significance)</label>
                      <textarea value={selectedEntry.narrativeSignificance} onChange={e => updateLibraryEntry(selectedEntry.id, 'narrativeSignificance', e.target.value)} className="w-full bg-stone-950/40 border border-white/5 rounded-2xl p-4 md:p-6 text-[13px] font-serif leading-loose text-stone-300 h-48 md:h-64 outline-none focus:border-orange-400/20 transition-all shadow-inner" placeholder="..." />
                   </div>
                </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-stone-800 space-y-4">
               <BookOpen size={64} className="opacity-10" />
               <p className="font-serif italic text-sm">項目を選択してください</p>
            </div>
          )}
       </div>
    </div>
  );

  const renderSubTabContent = () => {
    switch (activeTab) {
      case 'characters':
        return (
          <div className="max-w-7xl mx-auto space-y-8 animate-fade-in px-4 md:px-0">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                 <h3 className="text-xl font-display font-black text-white italic">Characters</h3>
                 <div className="flex gap-2 w-full md:w-auto">
                    <button onClick={handleGenCharacterIdea} disabled={isGeneratingIdea} className="flex-1 md:flex-none px-4 py-2 bg-stone-100/10 text-orange-300 rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-2 border border-orange-400/20">{isGeneratingIdea ? <Loader2 size={14} className="animate-spin"/> : <Sparkles size={14}/>} AI案</button>
                    <button onClick={addCharacter} className="flex-1 md:flex-none px-4 py-2 bg-stone-800 text-orange-400 rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-2"><Plus size={14}/> 新規</button>
                 </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                  {project.bible.characters.map(char => (
                    <div key={char.id} className="glass-bright rounded-[1.5rem] md:rounded-[2rem] overflow-hidden flex flex-col h-[450px] md:h-[500px] border border-white/5 shadow-2xl group transition-all">
                       <div className="h-40 md:h-44 relative bg-stone-900">
                           {char.imageUrl ? <img src={char.imageUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex flex-col items-center justify-center text-stone-800 italic text-[9px] font-black uppercase">{isGeneratingImg === char.id ? <Loader2 size={20} className="animate-spin text-orange-400"/> : "No Portrait"}</div>}
                           <div className="absolute top-4 right-4 flex gap-2">
                              <button onClick={() => playCharacterVoice(char, `私は${char.name}。`)} className="p-2 bg-stone-950/80 rounded-lg text-stone-400 hover:text-orange-400"><Volume2 size={16}/></button>
                              <button onClick={() => handleGeneratePortrait(char)} className="p-2 bg-orange-600 rounded-lg text-white shadow-lg disabled:opacity-50">{isGeneratingImg === char.id ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16}/></button>
                           </div>
                           <div className="absolute bottom-4 left-6">
                              <h4 className="text-xl font-display font-black text-white italic">{char.name}</h4>
                              <span className="text-[8px] font-black uppercase text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded mt-1 inline-block">{char.role}</span>
                           </div>
                       </div>
                       <div className="p-4 md:p-6 flex-1 overflow-y-auto space-y-4 md:space-y-6 custom-scrollbar">
                          <ProfileField label="概要" value={char.description} onChange={(v: string) => updateChar(char.id, 'description' as any, v)} />
                          <ProfileField label="動機" value={char.motivation} onChange={(v: string) => updateChar(char.id, 'motivation' as any, v)} />
                       </div>
                    </div>
                  ))}
              </div>
          </div>
        );
      case 'chronicle': return renderChronicleView();
      case 'library': return renderLibraryTab();
      case 'characterState':
        return (
          <div className="max-w-6xl mx-auto space-y-12 md:space-y-16 animate-fade-in px-4 md:px-0">
            <div className="flex items-center gap-4"><Activity size={24} className="text-emerald-400"/><h3 className="text-xl font-display font-black text-white italic">Temporal Character Flows</h3></div>
            {project.bible.characters.map(char => {
              const stream = project.chapters.map((ch, idx) => ({
                index: idx + 1,
                chapterId: ch.id,
                title: ch.title,
                status: chapterProjections[ch.id][char.id],
                deltas: (ch.stateDeltas || []).filter(d => d.characterId === char.id)
              }));
              return (
                <div key={char.id} className="space-y-6 md:space-y-8 pb-10 md:pb-12 border-b border-white/5 last:border-0 overflow-x-auto no-scrollbar">
                   <div className="flex items-center gap-4 sticky left-0">
                      <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-stone-800 flex items-center justify-center font-display font-black italic text-orange-400 border border-orange-400/20 shadow-2xl">{char.name[0]}</div>
                      <h4 className="text-xl md:text-2xl font-display font-black text-white italic">{char.name}</h4>
                   </div>
                   <div className="flex gap-6 md:gap-8 items-start">
                      <StateCard label="Origin" status={char.status} isOrigin />
                      {stream.map((data) => (
                        <div key={data.chapterId} className="flex gap-6 md:gap-8 items-start animate-fade-in shrink-0">
                           <div className="pt-20 md:pt-24 shrink-0 text-stone-800"><ArrowUpRight size={20} className="rotate-90"/></div>
                           <StateCard label={`章 ${data.index}: ${data.title}`} status={data.status} deltas={data.deltas} />
                        </div>
                      ))}
                   </div>
                </div>
              );
            })}
          </div>
        );
      case 'nexus':
        return (
          <div className="max-w-4xl mx-auto space-y-10 md:space-y-12 animate-fade-in px-4 md:px-0">
            <div className="flex items-center gap-4"><GitBranch size={24} className="text-purple-400"/><h3 className="text-xl font-display font-black text-white italic">Nexus - 因果律</h3></div>
            <div className="glass-bright rounded-[1.5rem] md:rounded-[2rem] p-6 md:p-8 border border-purple-500/20 shadow-2xl space-y-6">
               <textarea value={nexusInput} onChange={e => setNexusInput(e.target.value)} placeholder="例：もしも..." className="w-full bg-stone-950/40 border border-white/10 rounded-xl p-4 text-sm text-white font-serif outline-none h-32 resize-none" />
               <button onClick={handleSimulateNexus} disabled={!nexusInput.trim() || isSimulating} className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50">
                  {isSimulating ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16}/>} 実行
               </button>
            </div>
            <div className="space-y-6">
               {project.bible.nexusBranches.map(branch => (
                 <div key={branch.id} className="p-6 md:p-8 glass-bright rounded-[1.5rem] md:rounded-[2rem] border-l-4 border-l-purple-500 space-y-4 md:space-y-6 animate-fade-in">
                    <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">仮説：{branch.hypothesis}</span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                       <div className="space-y-2"><h5 className="text-[10px] font-black text-white uppercase tracking-widest">世界への影響</h5><p className="text-[12px] md:text-[13px] font-serif text-stone-400 leading-relaxed">{branch.impactOnCanon}</p></div>
                       <div className="space-y-2"><h5 className="text-[10px] font-black text-white uppercase tracking-widest">感情への影響</h5><p className="text-[12px] md:text-[13px] font-serif text-stone-400 leading-relaxed">{branch.impactOnState}</p></div>
                    </div>
                 </div>
               ))}
            </div>
          </div>
        );
      case 'world':
        return (
          <div className="max-w-4xl mx-auto space-y-10 md:space-y-12 animate-fade-in px-4 md:px-0">
            <WorldField label="世界の理" value={project.bible.laws} onChange={(v: string) => updateBible('laws', v)} />
            <WorldField label="世界設定" value={project.bible.setting} onChange={(v: string) => updateBible('setting', v)} />
          </div>
        );
      case 'grandArc':
        return (
          <div className="max-w-4xl mx-auto space-y-6 md:space-y-8 animate-fade-in px-4 md:px-0">
             <div className="flex items-center gap-4"><Target size={24} className="text-orange-400" /><h3 className="text-xl font-display font-black text-white italic">Grand Arc</h3></div>
             <textarea value={project.bible.grandArc} onChange={e => updateBible('grandArc', e.target.value)} className="w-full bg-stone-900/40 border border-white/5 rounded-[1.5rem] md:rounded-[2rem] p-6 md:p-10 text-[14px] md:text-[15px] font-serif-bold leading-[2] text-stone-200 h-[500px] md:h-[600px] outline-none shadow-2xl" placeholder="全体の構成..." />
          </div>
        );
      default: return <div className="text-center py-40 opacity-10 font-black tracking-[1em]">UNDER DEV</div>;
    }
  };

  const CatBtn = ({ type, label, icon }: { type: CategoryType, label: string, icon: any }) => (
    <button onClick={() => { setActiveCategory(type); updateDefaultTab(type); }} className={`flex flex-col items-center gap-2 px-6 py-4 transition-all border-b-2 shrink-0 ${activeCategory === type ? 'text-orange-400 border-orange-400 bg-orange-400/5' : 'text-stone-600 border-transparent hover:text-stone-400'}`}>
       {icon} <span className="text-[9px] font-black uppercase tracking-[0.2em]">{label}</span>
    </button>
  );

  const updateDefaultTab = (cat: CategoryType) => {
    if (cat === 'CANON') setActiveTab('characters');
    else if (cat === 'PLAN') setActiveTab('grandArc');
    else if (cat === 'STATE') setActiveTab('characterState');
    else setActiveTab('history');
  };

  const SubTab = ({ id, label, icon: Icon }: { id: string, label: string, icon: any }) => (
    <button onClick={() => setActiveTab(id)} className={`px-4 py-2 rounded-xl flex items-center gap-2 text-[9px] font-black uppercase tracking-widest transition-all shrink-0 ${activeTab === id ? 'bg-orange-600 text-white' : 'text-stone-500 bg-stone-900/40'}`}>
      <Icon size={14} /> {label}
    </button>
  );

  return (
    <div className="h-full flex flex-col bg-stone-950 overflow-hidden relative">
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Architect Panel */}
        <div className={`fixed inset-0 z-[110] md:relative md:inset-auto md:z-auto w-full md:w-80 glass border-r border-white/5 flex flex-col h-full shrink-0 transform transition-transform duration-300 ${showArchitectMobile ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
          <div className="p-6 border-b border-white/5 flex items-center justify-between bg-stone-900/50">
              <div className="flex flex-col">
                  <h3 className="text-[10px] font-black text-orange-400 uppercase tracking-[0.4em]">設計士</h3>
                  <span className="md:hidden text-[8px] text-stone-500 font-black uppercase tracking-widest mt-1">Architectural Dialogue</span>
              </div>
              <div className="flex gap-2">
                 <button onClick={() => setUseSearch(!useSearch)} title="Google検索を有効にする" className={`p-2 rounded-lg ${useSearch ? 'text-emerald-400 bg-emerald-500/10' : 'text-stone-600'}`}><Search size={16} /></button>
                 <button onClick={() => setShowArchitectMobile(false)} className="md:hidden p-2 text-stone-500 hover:text-white transition-colors"><X size={20}/></button>
              </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
              {project.chatHistory?.map(m => (
                  <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in`}>
                      <div className={`max-w-[90%] p-4 rounded-2xl text-[11px] leading-relaxed shadow-xl ${m.role === 'user' ? 'bg-orange-600 text-white' : 'glass-bright text-stone-300 font-serif'}`}>{m.content}</div>
                  </div>
              ))}
              {(isChatting || isWorldGenesis) && <div className="flex items-center gap-3 px-2"><Loader2 size={12} className="animate-spin text-orange-500"/><span className="text-[10px] text-orange-500/60 uppercase font-black">{isWorldGenesis ? '世界を構築中' : '思考中'}</span></div>}
              {project.pendingChanges.map(op => (
                <div key={op.id} className="p-4 glass-bright rounded-2xl border-2 border-orange-500/40 space-y-3 relative overflow-hidden animate-fade-in">
                  <div className="flex justify-between items-center"><span className="text-[8px] font-black uppercase bg-orange-600 text-white px-2 py-0.5 rounded-full">{op.op}</span><div className="flex gap-2"><button onClick={() => setProject(p => ({...p, pendingChanges: p.pendingChanges.filter(x => x.id !== op.id)}))} className="p-1 hover:text-rose-500"><X size={14}/></button><button onClick={() => commitOp(op)} className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/40"><Check size={14}/></button></div></div>
                  <p className="text-[10px] font-black text-white truncate">{op.targetName}</p>
                  <p className="text-[9px] text-stone-400 line-clamp-2 italic font-serif leading-relaxed">理由: {op.rationale}</p>
                </div>
              ))}
              <div ref={chatEndRef} />
          </div>
          <div className="p-4 border-t border-white/5 bg-stone-900/40 pb-safe md:pb-4 space-y-2">
              <div className="relative">
                <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} className="w-full bg-stone-950 border border-white/10 rounded-xl p-4 text-[12px] h-24 outline-none font-serif resize-none" placeholder="設計を相談、または一括構想のプロンプトを入力..." />
                <button onClick={handleSendMessage} className="absolute bottom-3 right-3 p-2 bg-orange-600 text-white rounded-lg shadow-lg hover:bg-orange-500 transition-colors"><ArrowUpRight size={18}/></button>
              </div>
              <button 
                onClick={handleWorldGenesis} 
                disabled={!input.trim() || isWorldGenesis}
                className="w-full py-3 bg-gradient-to-r from-orange-600 to-rose-600 text-white rounded-xl text-[9px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 shadow-xl active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {isWorldGenesis ? <Loader2 size={12} className="animate-spin" /> : <Origami size={14} />} 一括構想 (World Genesis)
              </button>
          </div>
        </div>

        {/* Main Workspace */}
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-stone-950/50">
          <div className="flex items-center glass border-b border-white/5 overflow-x-auto no-scrollbar shrink-0 shadow-xl">
             <button onClick={() => setShowArchitectMobile(true)} className="md:hidden p-4 text-orange-400 shrink-0 border-r border-white/5"><Menu size={20}/></button>
             <CatBtn type="CANON" label="Canon" icon={<Fingerprint size={18}/>} />
             <CatBtn type="PLAN" label="Plan" icon={<Target size={18}/>} />
             <CatBtn type="STATE" label="State" icon={<Activity size={18}/>} />
             <CatBtn type="OPS" label="Ops" icon={<History size={18}/>} />
          </div>
          <div className="px-4 py-3 bg-stone-900/40 border-b border-white/5 flex gap-3 overflow-x-auto no-scrollbar items-center">
               {activeCategory === 'CANON' && <><SubTab id="characters" label="人物" icon={Users} /><SubTab id="world" label="世界" icon={Globe} /><SubTab id="library" label="資料" icon={Bookmark} /></>}
               {activeCategory === 'PLAN' && <><SubTab id="grandArc" label="構成" icon={Target} /><SubTab id="structure" label="章立て" icon={ListOrdered} /><SubTab id="chronicle" label="統合年表" icon={Calendar} /><SubTab id="nexus" label="Nexus" icon={GitBranch} /></>}
               {activeCategory === 'STATE' && <><SubTab id="characterState" label="状態" icon={Activity} /><SubTab id="relationships" label="関係" icon={Heart} /></>}
               {activeCategory === 'OPS' && <><SubTab id="history" label="履歴" icon={History} /><SubTab id="usage" label="統計" icon={Zap} /></>}
          </div>
          <div className="flex-1 overflow-y-auto p-6 md:p-12 pb-40 custom-scrollbar">{renderSubTabContent()}</div>
        </div>
      </div>
    </div>
  );

  function updateBible(field: keyof WorldBible, value: any) { setProject(prev => ({ ...prev, bible: { ...prev.bible, [field]: value } })); }
  function updateChar(charId: string, field: keyof Character, value: any) { setProject(prev => ({ ...prev, bible: { ...prev.bible, characters: prev.bible.characters.map(c => c.id === charId ? { ...c, [field]: value } : c) } })); }
  function addCharacter() { setProject(prev => ({ ...prev, bible: { ...prev.bible, characters: [...prev.bible.characters, { id: crypto.randomUUID(), name: '新キャラクター', role: 'Supporting', description: '', traits: [], motivation: '', flaw: '', arc: '', relationships: [], status: { location: '', health: '良好', inventory: [], knowledge: [], currentGoal: '', socialStanding: '', internalState: '平常' } }] } })); }
  async function handleGenCharacterIdea() { setIsGeneratingIdea(true); try { const idea = await generateCharacterIdea(project, onTokenUsage); addCharacter(); } catch (e) { addLog('error', 'Architect', e.message); } finally { setIsGeneratingIdea(false); } }
  async function handleSimulateNexus() { if (!nexusInput.trim() || isSimulating) return; setIsSimulating(true); try { const branch = await simulateBranch(nexusInput, project, onTokenUsage); setProject(prev => ({ ...prev, bible: { ...prev.bible, nexusBranches: [branch, ...prev.bible.nexusBranches].slice(0, 20) } })); setNexusInput(''); addLog('success', 'Architect', '新しい分岐可能性を記録しました。'); } catch (e: any) { addLog('error', 'Architect', e.message); } finally { setIsSimulating(false); } }
  async function handleGeneratePortrait(char: Character) { if (isGeneratingImg) return; setIsGeneratingImg(char.id); try { const b64 = await generateCharacterPortrait(char, project); if (b64) { await savePortrait(char.id, b64); updateChar(char.id, 'imageUrl' as any, b64); addLog('success', 'Artist', `${char.name}の肖像画を生成しました。`); } } catch (err: any) { addLog('error', 'Artist', err.message); } finally { setIsGeneratingImg(null); } }
  
  function addLibraryEntry() { setProject(prev => ({ ...prev, bible: { ...prev.bible, entries: [...prev.bible.entries, { id: crypto.randomUUID(), category: 'Terminology', title: '新しい用語', aliases: [], content: '', definition: '', narrativeSignificance: '', etymology: '', isSecret: false, tags: [], linkedIds: [] }] } })); setSelectedEntryId(null); }
  function updateLibraryEntry(id: string, field: keyof WorldEntry, value: any) { setProject(prev => ({ ...prev, bible: { ...prev.bible, entries: prev.bible.entries.map(e => e.id === id ? { ...e, [field]: value } : e) } })); }
  function deleteLibraryEntry(id: string) { showConfirm("用語を削除", "この用語を削除しますか？", () => { setProject(prev => ({ ...prev, bible: { ...prev.bible, entries: prev.bible.entries.filter(e => e.id !== id) } })); setSelectedEntryId(null); }); }
};

const StateCard: React.FC<{ label: string; status: CharacterStatus; isOrigin?: boolean; deltas?: StateDelta[] }> = ({ label, status, isOrigin, deltas }) => (
  <div className={`w-72 md:w-80 shrink-0 p-6 md:p-8 rounded-[1.5rem] md:rounded-[2rem] border transition-all ${isOrigin ? 'bg-stone-800/40 border-stone-700 shadow-xl' : 'glass-bright border-white/5 opacity-80 hover:opacity-100 hover:scale-[1.01]'}`}>
      <div className="flex justify-between items-start mb-6">
         <span className={`text-[9px] font-black uppercase tracking-widest ${isOrigin ? 'text-stone-400' : 'text-emerald-400'}`}>{label}</span>
         <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${status.health === '良好' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>{status.health}</div>
      </div>
      <div className="space-y-4">
         {deltas && deltas.length > 0 && (
           <div className="space-y-2 mb-4 bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/10">
              {deltas.map(d => (
                <div key={d.id} className="flex items-center gap-2 text-[9px] text-stone-300"><Zap size={10} className="text-emerald-400"/> {d.field}: {String(d.value)}</div>
              ))}
           </div>
         )}
         <div className="space-y-1"><label className="text-[8px] font-black text-stone-600 uppercase tracking-widest">現在地</label><div className="flex items-center gap-2 text-xs text-white"><MapPin size={12} className="text-orange-400"/> {status.location || '不明'}</div></div>
         <div className="space-y-1"><label className="text-[8px] font-black text-stone-600 uppercase tracking-widest">所持品</label><div className="flex flex-wrap gap-1">{status.inventory.length > 0 ? status.inventory.map((item, i) => (<span key={i} className="px-2 py-0.5 bg-stone-900 rounded text-[8px] text-stone-400">{item}</span>)) : <span className="text-[8px] text-stone-800 italic">なし</span>}</div></div>
      </div>
  </div>
);

const ProfileField = ({ label, value, onChange }: any) => (
  <div className="space-y-2"><label className="text-[9px] font-black text-stone-600 uppercase tracking-widest px-1">{label}</label><textarea value={value} onChange={e => onChange(e.target.value)} className="w-full bg-stone-950/40 border border-white/5 rounded-xl p-4 text-[12px] text-stone-300 outline-none font-serif h-28 md:h-32 resize-none" /></div>
);
const WorldField = ({ label, value, onChange }: any) => (
  <div className="space-y-4"><label className="text-[10px] md:text-[11px] font-black text-orange-400 uppercase tracking-[0.2em] md:tracking-[0.3em] flex items-center gap-3"><BookText size={18}/> {label}</label><textarea value={value} onChange={e => onChange(e.target.value)} className="w-full bg-stone-900/40 border border-white/5 rounded-[1.5rem] p-6 md:p-10 text-[13px] md:text-[14px] font-serif-bold leading-loose text-stone-200 h-64 outline-none shadow-2xl" /></div>
);
export default PlotterView;
