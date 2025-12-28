
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { StoryProject, ChatMessage, SystemLog, Character, SyncOperation, HistoryEntry, NexusBranch, Foreshadowing, Relationship } from '../types';
import { chatWithArchitect, extractSettingsFromChat, identifyChangedCategories, generateCharacterPortrait, playCharacterVoice, simulateBranch } from '../services/geminiService';
import { applySyncOperation } from '../services/bibleManager';
import { savePortrait } from '../services/storageService';
import { 
  Users, Globe, Search, Zap, History, X, Volume2, Sparkles, Loader2, 
  Calendar, ArrowUpRight, Activity, MapPin, Target, Bookmark, GitBranch, 
  Plus, Package, Brain, Scale, Cpu, ShieldCheck, ChevronRight, Menu, Wand2, Info,
  Filter, Database, RefreshCw, Layers, AlertCircle, BarChart3, Eye, Anchor, HeartPulse, Flag,
  Briefcase, Key, Star, Heart, TrendingUp, UserPlus, MessageSquare, Quote, ArrowRight
} from 'lucide-react';

interface Props {
  project: StoryProject;
  setProject: React.Dispatch<React.SetStateAction<StoryProject>>;
  addLog: (type: SystemLog['type'], source: SystemLog['source'], message: string, details?: string) => void;
  onTokenUsage: (usage: { input: number; output: number }) => void;
  initialTab?: string;
  initialMessage?: string | null;
  clearInitialMessage?: () => void;
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
}

type CategoryType = 'CANON' | 'PLAN' | 'STATE' | 'OPS';
type SyncScope = 'characters' | 'entries' | 'timeline' | 'foreshadowing' | 'all';

const AUTO_SYNC_THRESHOLD = 3000;

const PlotterView: React.FC<Props> = ({ project, setProject, addLog, onTokenUsage, initialTab, initialMessage, clearInitialMessage, showConfirm }) => {
  const [activeCategory, setActiveCategory] = useState<CategoryType>(initialTab === 'grandArc' || initialTab === 'chronicle' || initialTab === 'nexus' || initialTab === 'foreshadowing' ? 'PLAN' : 'CANON');
  const [activeTab, setActiveTab] = useState<string>(initialTab || 'characters');
  const [input, setInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const [useSearch, setUseSearch] = useState(true);
  const [syncingScope, setSyncingScope] = useState<SyncScope | null>(null);
  const [recommendedCategories, setRecommendedCategories] = useState<string[]>([]);
  const [showArchitectMobile, setShowArchitectMobile] = useState(false);
  const [charsSinceLastSync, setCharsSinceLastSync] = useState(0);

  const [charCardModes, setCharCardModes] = useState<Record<string, 'status' | 'profile' | 'relations'>>({});

  const chatEndRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => { 
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); 
  }, [project.chatHistory, project.pendingChanges]);

  useEffect(() => {
    if (initialMessage && !isChatting) {
      handleSendMessage(initialMessage);
      if (clearInitialMessage) clearInitialMessage();
      setShowArchitectMobile(true);
    }
  }, [initialMessage]);

  const handleSendMessage = async (customMessage?: string) => {
    const textToSend = customMessage || input.trim();
    if (!textToSend || isChatting) return;
    
    if (!customMessage) setInput('');
    setIsChatting(true);
    
    try {
      const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: textToSend, timestamp: Date.now() };
      const historyWithUser = [...(project.chatHistory || []), userMsg];
      setProject(p => ({ ...p, chatHistory: historyWithUser }));
      
      const apiHistory = historyWithUser.map(m => ({ role: m.role, parts: [{ text: m.content }] }));
      const { text, sources } = await chatWithArchitect(apiHistory, textToSend, project, useSearch, onTokenUsage, addLog);
      
      const botMsg: ChatMessage = { id: (Date.now()+1).toString(), role: 'model', content: text, timestamp: Date.now(), sources };
      const finalHistory = [...historyWithUser, botMsg];
      setProject(p => ({ ...p, chatHistory: finalHistory }));

      const addedChars = textToSend.length + text.length;
      const newAccumulation = charsSinceLastSync + addedChars;
      
      const recommendations = await identifyChangedCategories(finalHistory, onTokenUsage, addLog);
      setRecommendedCategories(recommendations);

      if (newAccumulation >= AUTO_SYNC_THRESHOLD) {
        addLog('info', 'NeuralSync', `自動抽出を実行します...`);
        runSync(finalHistory, 'all');
        setCharsSinceLastSync(0);
      } else {
        setCharsSinceLastSync(newAccumulation);
      }
      
    } catch (err: any) { 
      addLog('error', 'Architect', err.message, err.details); 
    } finally { 
      setIsChatting(false); 
    }
  };

  const runSync = async (history: any[], scope: SyncScope) => {
    if (syncingScope) return;
    setSyncingScope(scope);
    setRecommendedCategories(prev => prev.filter(c => c !== scope));
    setCharsSinceLastSync(0);
    
    addLog('info', 'NeuralSync', `${scope} 設定の抽出を開始...`);
    try {
      const ops = await extractSettingsFromChat(history, project, scope as any, onTokenUsage, addLog);
      if (ops && ops.length > 0) { 
        setProject(prev => {
          const filteredNewOps = ops.filter(newOp => 
            !prev.pendingChanges.some(oldOp => 
              oldOp.targetId === newOp.targetId && oldOp.field === newOp.field && JSON.stringify(oldOp.value) === JSON.stringify(newOp.value)
            )
          );
          return { ...prev, pendingChanges: [...prev.pendingChanges, ...filteredNewOps] };
        }); 
        addLog('success', 'NeuralSync', `${ops.length}件の同期提案があります。`); 
      }
    } catch (err: any) { 
      console.warn('Sync failed:', err); 
    } finally { 
      setSyncingScope(null); 
    }
  };

  const commitOp = (op: SyncOperation) => {
    setProject(prev => applySyncOperation(prev, op));
  };

  const getPathColor = (path: string, field?: string) => {
    const isState = ['location', 'health', 'currentGoal', 'internalState', 'inventory', 'knowledge'].includes(field || '');
    if (isState) return 'border-emerald-500/40 text-emerald-400';

    switch(path) {
      case 'characters': return 'border-orange-500/40 text-orange-400';
      case 'entries': return 'border-blue-500/40 text-blue-400';
      case 'timeline': return 'border-purple-500/40 text-purple-400';
      case 'foreshadowing': return 'border-amber-500/40 text-amber-400';
      default: return 'border-stone-500/40 text-stone-400';
    }
  };

  const renderSyncProposal = (op: SyncOperation) => {
    const isState = ['location', 'health', 'currentGoal', 'internalState', 'inventory', 'knowledge'].includes(op.field || '');
    const colorClass = getPathColor(op.path, op.field);
    
    // 現在の値をプレビュー用に検索
    let currentValue: any = "未定義";
    const bible = project.bible;
    if (['setting', 'tone', 'laws', 'grandArc'].includes(op.path)) {
      currentValue = (bible as any)[op.path];
    } else {
      const collection = (bible as any)[op.path] || [];
      const item = op.targetId ? collection.find((i:any) => i.id === op.targetId) : 
                   collection.find((i:any) => (i.name || i.title || i.event || "").toLowerCase() === op.targetName?.toLowerCase());
      
      if (item) {
        if (op.field) {
           if (op.path === 'characters' && isState) {
             currentValue = item.status?.[op.field];
           } else {
             currentValue = item[op.field];
           }
        } else {
           currentValue = "(オブジェクト全体)";
        }
      }
    }

    const displayProposed = () => {
      if (typeof op.value === 'string') return op.value;
      if (op.field && typeof op.value === 'object' && op.value !== null && op.value[op.field] !== undefined) return String(op.value[op.field]);
      return op.value.content || op.value.text || op.value.description || JSON.stringify(op.value);
    };

    return (
      <div key={op.id} className={`p-4 glass-bright rounded-2xl border-2 ${colorClass.split(' ')[0]} space-y-3 relative animate-fade-in shadow-xl group/card`}>
         <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <span className={`text-[7px] font-black uppercase px-2 py-0.5 rounded-full bg-stone-800 ${colorClass.split(' ')[1]}`}>
                {isState ? 'State Update' : op.path}
              </span>
              <span className="text-[7px] font-black uppercase px-2 py-0.5 rounded-full bg-stone-900 text-stone-500">
                {Math.floor((op.confidence || 0) * 100)}% Conf.
              </span>
            </div>
            <button onClick={() => setProject(p => ({...p, pendingChanges: p.pendingChanges.filter(x => x.id !== op.id)}))} className="p-1 hover:text-rose-500 text-stone-600 transition-colors"><X size={14}/></button>
         </div>
         
         <div className="space-y-1">
            <div className="text-[10px] font-black text-white flex items-center gap-2 truncate">
               <Package size={10} className={colorClass.split(' ')[1]}/> {op.targetName || op.path}
               {op.field && <span className="text-stone-500 text-[8px] font-mono">.{op.field}</span>}
            </div>
         </div>

         <div className="space-y-2">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
               <div className="space-y-1">
                 <div className="text-[6px] font-black text-stone-600 uppercase tracking-widest">Current</div>
                 <div className="p-2 bg-stone-950/40 rounded-lg border border-white/5 text-[9px] font-serif text-stone-500 italic line-clamp-2 min-h-[32px]">
                   {String(currentValue || 'なし')}
                 </div>
               </div>
               <ArrowRight size={10} className="text-stone-700 mt-2"/>
               <div className="space-y-1">
                 <div className="text-[6px] font-black text-orange-500 uppercase tracking-widest">Proposed</div>
                 <div className="p-2 bg-orange-400/5 rounded-lg border border-orange-400/10 text-[9px] font-serif text-stone-200 leading-relaxed italic line-clamp-2 min-h-[32px]">
                   {displayProposed()}
                 </div>
               </div>
            </div>
         </div>

         <div className="text-[8px] text-stone-500 italic px-1 line-clamp-2 leading-relaxed">
           "{op.rationale}"
         </div>
         
         <button onClick={() => commitOp(op)} className="w-full py-2 bg-stone-800 hover:bg-orange-600 text-white rounded-lg text-[8px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 group-hover/card:bg-stone-700 transition-colors">
            <ShieldCheck size={12}/> 設定に反映
         </button>
      </div>
    );
  };

  const ExtractionHub = () => {
    const progress = Math.min((charsSinceLastSync / AUTO_SYNC_THRESHOLD) * 100, 100);
    return (
      <div className="p-4 bg-stone-900/60 border border-white/5 rounded-2xl space-y-4 mb-6 relative overflow-hidden group shadow-2xl">
        <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-30 transition-opacity">
          <Brain size={40} className="text-orange-400"/>
        </div>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h4 className="text-[9px] font-black text-white uppercase tracking-widest flex items-center gap-2"><Layers size={12} className="text-orange-400"/> NeuralSync Hub</h4>
          </div>
          {syncingScope && <Loader2 size={12} className="animate-spin text-orange-400"/>}
        </div>
        <div className="h-1 w-full bg-stone-950 rounded-full overflow-hidden border border-white/5">
          <div className="h-full bg-gradient-to-r from-orange-600 to-orange-400 transition-all duration-700 ease-out" style={{ width: `${progress}%` }} />
        </div>
        <div className="grid grid-cols-2 gap-2 pt-2">
          <SyncButton scope="characters" label="人物/状態抽出" icon={<Users size={12}/>} activeColor="text-emerald-400" />
          <SyncButton scope="timeline" label="年表抽出" icon={<Calendar size={12}/>} activeColor="text-purple-400" />
          <SyncButton scope="foreshadowing" label="伏線抽出" icon={<Anchor size={12}/>} activeColor="text-amber-400" />
          <SyncButton scope="all" label="全体抽出" icon={<RefreshCw size={12}/>} activeColor="text-orange-400" />
        </div>
      </div>
    );
  };

  const SyncButton = ({ scope, label, icon, activeColor }: { scope: SyncScope, label: string, icon: any, activeColor: string }) => {
    const isRecommended = recommendedCategories.includes(scope) || (scope === 'all' && recommendedCategories.length > 0);
    return (
      <button onClick={() => runSync(project.chatHistory || [], scope)} disabled={!!syncingScope} className={`flex items-center gap-2 p-2 bg-stone-950/40 hover:bg-stone-800 rounded-xl transition-all border border-white/5 group disabled:opacity-50 relative`}>
        <div className={`p-1.5 rounded-lg bg-stone-900 group-hover:bg-stone-700 ${syncingScope === scope ? activeColor : 'text-stone-500'}`}>
          {syncingScope === scope ? <Loader2 size={12} className="animate-spin"/> : icon}
        </div>
        <span className={`text-[8px] font-black uppercase tracking-widest ${isRecommended ? 'text-white' : 'text-stone-500'}`}>{label}</span>
      </button>
    );
  };

  const CatBtn = ({ type, label, icon }: { type: CategoryType, label: string, icon: any }) => (
    <button onClick={() => setActiveCategory(type)} className={`flex flex-col items-center gap-2 px-6 py-4 transition-all border-b-2 shrink-0 ${activeCategory === type ? 'text-orange-400 border-orange-400 bg-orange-400/5' : 'text-stone-600 border-transparent hover:text-stone-400'}`}>
       {icon} <span className="text-[9px] font-black uppercase tracking-[0.2em]">{label}</span>
    </button>
  );

  const SubTab = ({ id, label, icon: Icon }: { id: string, label: string, icon: any }) => (
    <button onClick={() => setActiveTab(id)} className={`px-4 py-2 rounded-xl flex items-center gap-2 text-[9px] font-black uppercase tracking-widest transition-all shrink-0 ${activeTab === id ? 'bg-orange-600 text-white' : 'text-stone-500 bg-stone-900/40'}`}>
      <Icon size={14} /> {label}
    </button>
  );

  const CharacterCard = ({ character: c }: { character: Character; key?: React.Key }) => {
    const mode = charCardModes[c.id] || 'status';
    const setMode = (m: 'status' | 'profile' | 'relations') => setCharCardModes(prev => ({ ...prev, [c.id]: m }));

    const getStatusIcon = (field: string) => {
        switch(field) {
            case 'location': return <MapPin size={12} className="text-orange-400"/>;
            case 'health': return <HeartPulse size={12} className="text-rose-400"/>;
            case 'currentGoal': return <Target size={12} className="text-blue-400"/>;
            case 'inventory': return <Briefcase size={12} className="text-amber-400"/>;
            case 'knowledge': return <Key size={12} className="text-emerald-400"/>;
            case 'socialStanding': return <Star size={12} className="text-purple-400"/>;
            default: return <Activity size={12}/>;
        }
    };

    return (
      <div key={c.id} className="glass-bright rounded-3xl overflow-hidden border border-white/5 flex flex-col group shadow-2xl h-fit min-h-[500px]">
        <div className="aspect-[16/9] w-full relative overflow-hidden bg-stone-900 shrink-0">
          {c.imageUrl ? (
            <img src={c.imageUrl} alt={c.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-stone-800 bg-stone-950/50">
               <Users size={48} className="opacity-20"/>
               <span className="text-[8px] font-black uppercase tracking-[0.4em] mt-2 opacity-20">No Portrait</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-transparent to-transparent" />
          <div className="absolute bottom-4 left-6 right-6 flex justify-between items-end">
             <div className="space-y-1">
                <h4 className="text-2xl font-display font-black text-white italic tracking-tighter drop-shadow-lg">{c.name}</h4>
                <div className="flex gap-2">
                   <span className="text-[7px] font-black uppercase text-stone-100 bg-orange-600 px-1.5 py-0.5 rounded tracking-widest shadow-lg">{c.role}</span>
                   {c.voiceId && <span className="text-[7px] font-black uppercase text-stone-400 bg-stone-900/80 px-1.5 py-0.5 rounded tracking-widest backdrop-blur-sm">Voice: {c.voiceId}</span>}
                </div>
             </div>
             <button onClick={() => playCharacterVoice(c, `私は${c.name}。${c.status?.internalState || '平常'}です。`, addLog)} className="p-2.5 bg-stone-900/80 backdrop-blur-md rounded-xl text-white hover:bg-orange-600 transition-all shadow-xl"><Volume2 size={16}/></button>
          </div>
        </div>

        <div className="flex bg-stone-900/40 border-b border-white/5">
           <button onClick={() => setMode('status')} className={`flex-1 py-3 text-[8px] font-black uppercase tracking-widest transition-all ${mode === 'status' ? 'text-orange-400 bg-orange-400/5 border-b border-orange-400' : 'text-stone-600'}`}>Status</button>
           <button onClick={() => setMode('profile')} className={`flex-1 py-3 text-[8px] font-black uppercase tracking-widest transition-all ${mode === 'profile' ? 'text-orange-400 bg-orange-400/5 border-b border-orange-400' : 'text-stone-600'}`}>Profile</button>
           <button onClick={() => setMode('relations')} className={`flex-1 py-3 text-[8px] font-black uppercase tracking-widest transition-all ${mode === 'relations' ? 'text-orange-400 bg-orange-400/5 border-b border-orange-400' : 'text-stone-600'}`}>Relations</button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto no-scrollbar max-h-[350px]">
           {mode === 'status' && (
             <div className="space-y-4 animate-fade-in">
                <div className="p-3 bg-stone-950/60 rounded-xl border border-white/5 italic">
                   <div className="text-[7px] font-black text-stone-600 uppercase tracking-widest mb-1 flex items-center gap-1"><MessageSquare size={8}/> Internal State</div>
                   <p className="text-[11px] text-stone-200 font-serif leading-relaxed">「{c.status?.internalState || '平常'}」</p>
                </div>
                
                <div className="grid grid-cols-1 gap-2.5">
                   <StatusItem icon={getStatusIcon('location')} label="Location" value={c.status?.location} />
                   <StatusItem icon={getStatusIcon('health')} label="Health" value={c.status?.health} />
                   <StatusItem icon={getStatusIcon('currentGoal')} label="Current Goal" value={c.status?.currentGoal} />
                   <StatusItem icon={getStatusIcon('socialStanding')} label="Social Standing" value={c.status?.socialStanding} />
                   <StatusItem icon={getStatusIcon('inventory')} label="Inventory" value={c.status?.inventory?.length ? c.status.inventory.join(', ') : 'なし'} />
                   <StatusItem icon={getStatusIcon('knowledge')} label="Knowledge" value={c.status?.knowledge?.length ? c.status.knowledge.join(', ') : 'なし'} />
                </div>
             </div>
           )}

           {mode === 'profile' && (
             <div className="space-y-5 animate-fade-in">
                <ProfileDetail label="Description" value={c.description} />
                <div className="flex flex-wrap gap-1.5">
                   {(c.traits || []).map((t, i) => (
                      <span key={i} className="text-[8px] font-black text-stone-400 bg-stone-800 border border-white/5 px-2 py-1 rounded-lg uppercase tracking-widest">{t}</span>
                   ))}
                </div>
                <ProfileDetail label="Motivation" value={c.motivation} />
                <ProfileDetail label="Flaw" value={c.flaw} color="text-rose-400" />
                <div className="p-4 bg-orange-400/5 rounded-2xl border border-orange-400/10">
                   <div className="text-[7px] font-black text-orange-400 uppercase tracking-widest mb-1 flex items-center gap-1"><TrendingUp size={8}/> Character Arc</div>
                   <p className="text-[10px] text-stone-300 font-serif leading-relaxed">{c.arc || '未定義'}</p>
                </div>
             </div>
           )}

           {mode === 'relations' && (
             <div className="space-y-3 animate-fade-in">
                {(c.relationships || []).length > 0 ? (
                    c.relationships.map(rel => {
                        const target = project.bible.characters.find(char => char.id === rel.targetCharacterId);
                        return (
                           <div key={rel.id} className="p-3 glass-bright rounded-2xl flex items-center gap-3 border border-white/5">
                              <div className="w-8 h-8 rounded-full bg-stone-800 flex items-center justify-center shrink-0">
                                 {target?.imageUrl ? <img src={target.imageUrl} className="w-full h-full rounded-full object-cover" /> : <Users size={12}/>}
                              </div>
                              <div className="flex-1 min-w-0">
                                 <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-black text-white truncate">{target?.name || '不明'}</span>
                                    <span className="text-[8px] font-black text-stone-600 uppercase tracking-widest">{rel.type}</span>
                                 </div>
                                 <div className="flex items-center gap-2 mt-1">
                                    <div className="flex-1 h-1 bg-stone-900 rounded-full overflow-hidden">
                                       <div className={`h-full ${rel.sentiment >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${Math.abs(rel.sentiment)}%` }} />
                                    </div>
                                    <span className={`text-[8px] font-mono ${rel.sentiment >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{rel.sentiment}%</span>
                                 </div>
                              </div>
                           </div>
                        );
                    })
                ) : (
                    <div className="py-10 text-center text-stone-700 italic text-[10px]">関係性が定義されていません</div>
                )}
                <button onClick={() => handleSendMessage(`${c.name}と他の登場人物との関係性を深めたいです。`)} className="w-full py-2.5 border border-dashed border-stone-800 hover:border-orange-500/30 rounded-xl text-[8px] font-black text-stone-600 hover:text-orange-400 uppercase tracking-widest transition-all mt-4 flex items-center justify-center gap-2">
                   <UserPlus size={10}/> 関係性を追加
                </button>
             </div>
           )}
        </div>

        <div className="p-6 pt-0 mt-auto border-t border-white/5 flex items-center justify-between shrink-0">
           <button onClick={() => handleSendMessage(`${c.name} の「${mode === 'status' ? '現在の状況' : mode === 'profile' ? '生い立ちや設定' : '他者との繋がり'}」についてもっと掘り下げたいです。`)} className="text-[9px] font-black uppercase tracking-widest text-orange-400 hover:text-white transition-all flex items-center gap-2">
              <Sparkles size={12}/> 掘り下げる
           </button>
           <button onClick={() => handleSendMessage(`${c.name} の新しい肖像画を生成してください。`)} className="p-2 text-stone-600 hover:text-orange-400 transition-colors"><Wand2 size={16}/></button>
        </div>
      </div>
    );
  };

  const StatusItem = ({ icon, label, value }: { icon: any, label: string, value: any }) => (
     <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">{icon}</div>
        <div className="min-w-0">
           <div className="text-[7px] font-black text-stone-600 uppercase tracking-widest">{label}</div>
           <p className="text-[10px] text-stone-400 font-serif leading-tight truncate">{value || '不明'}</p>
        </div>
     </div>
  );

  const ProfileDetail = ({ label, value, color = "text-stone-300" }: { label: string, value: string, color?: string }) => (
     <div className="space-y-1">
        <div className="text-[7px] font-black text-stone-600 uppercase tracking-widest">{label}</div>
        <p className={`text-[10px] ${color} font-serif leading-relaxed line-clamp-3`}>{value || '未定義'}</p>
     </div>
  );

  return (
    <div className="h-full flex flex-col bg-stone-950 overflow-hidden relative">
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className={`fixed inset-0 z-[110] md:relative md:inset-auto md:z-auto w-full md:w-80 glass border-r border-white/5 flex flex-col h-full shrink-0 transform transition-transform duration-300 ${showArchitectMobile ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
          <div className="p-6 border-b border-white/5 flex items-center justify-between bg-stone-900/50">
              <h3 className="text-[10px] font-black text-orange-400 uppercase tracking-[0.4em]">NeuralSync</h3>
              <button onClick={() => setShowArchitectMobile(false)} className="md:hidden p-2 text-stone-500 hover:text-white"><X size={20}/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
              <ExtractionHub />
              <div className="space-y-4">
                {project.chatHistory?.slice(-15).map(m => (
                    <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in`}>
                        <div className={`max-w-[90%] p-4 rounded-2xl text-[11px] leading-relaxed shadow-xl ${m.role === 'user' ? 'bg-orange-600 text-white' : 'glass-bright text-stone-300 font-serif'}`}>{m.content}</div>
                    </div>
                ))}
                <div className="space-y-4 mt-8">
                  <h4 className="text-[9px] font-black text-stone-700 uppercase tracking-[0.2em] px-2">同期提案 ({project.pendingChanges.length})</h4>
                  {project.pendingChanges.map(renderSyncProposal)}
                </div>
                <div ref={chatEndRef} />
              </div>
          </div>
          <div className="p-4 border-t border-white/5 bg-stone-900/40 space-y-3">
              <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} className="w-full bg-stone-950 border border-white/10 rounded-xl p-4 text-[12px] h-24 outline-none font-serif resize-none" placeholder="設計士と会話..." />
              <button onClick={() => handleSendMessage()} className="w-full py-3 bg-orange-600 text-white rounded-lg shadow-lg hover:bg-orange-500 transition-all active:scale-95 disabled:opacity-50" disabled={isChatting}>{isChatting ? <Loader2 size={16} className="animate-spin mx-auto"/> : <ArrowUpRight size={18} className="mx-auto"/>}</button>
          </div>
        </div>
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-stone-950/50">
          <div className="flex items-center glass border-b border-white/5 overflow-x-auto no-scrollbar shrink-0">
             <button onClick={() => setShowArchitectMobile(true)} className="md:hidden p-4 text-orange-400 shrink-0 border-r border-white/5"><Menu size={20}/></button>
             <CatBtn type="CANON" label="Canon" icon={<Users size={18}/>} />
             <CatBtn type="PLAN" label="Plan" icon={<Target size={18}/>} />
          </div>
          <div className="px-4 py-3 bg-stone-900/40 border-b border-white/5 flex gap-3 overflow-x-auto no-scrollbar items-center shrink-0">
               {activeCategory === 'CANON' && <><SubTab id="characters" label="人物/状態" icon={Users} /><SubTab id="world" label="世界" icon={Globe} /><SubTab id="library" label="資料" icon={Bookmark} /></>}
               {activeCategory === 'PLAN' && <><SubTab id="grandArc" label="構成" icon={Target} /><SubTab id="chronicle" label="統合年表" icon={Calendar} /><SubTab id="foreshadowing" label="伏線" icon={Anchor} /><SubTab id="nexus" label="Nexus" icon={GitBranch} /></>}
          </div>
          <div className="flex-1 overflow-y-auto p-6 md:p-12 pb-40 custom-scrollbar">
            {activeTab === 'characters' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-8 animate-fade-in">
                {project.bible.characters.map(c => (
                  <CharacterCard key={c.id} character={c} />
                ))}
                <button onClick={() => handleSendMessage('新しいキャラクターを追加したいです。')} className="min-h-[500px] border-2 border-dashed border-stone-800 rounded-3xl flex flex-col items-center justify-center gap-4 text-stone-700 hover:border-orange-500/30 hover:text-stone-500 transition-all group">
                   <div className="p-4 bg-stone-900 rounded-full group-hover:scale-110 transition-transform"><Plus size={32}/></div>
                   <span className="text-[10px] font-black uppercase tracking-widest">人物を召喚</span>
                </button>
              </div>
            )}
            {activeTab === 'grandArc' && (
              <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
                <h3 className="text-2xl font-display font-black text-white italic tracking-tight">The Grand Arc</h3>
                <textarea value={project.bible.grandArc} onChange={e => setProject(p => ({...p, bible: {...p.bible, grandArc: e.target.value}}))} className="w-full bg-stone-900/40 border border-white/10 rounded-[2.5rem] p-10 text-lg font-serif-bold leading-[2.2] text-stone-200 min-h-[600px] outline-none shadow-2xl focus:border-orange-500/30 transition-all resize-none" />
              </div>
            )}
            {activeTab === 'world' && (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {project.bible.entries.map(e => (
                    <div key={e.id} className="p-8 glass-bright rounded-3xl border border-white/5 space-y-4">
                       <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">{e.category}</span>
                       <h4 className="text-2xl font-display font-black text-white italic">{e.title}</h4>
                       <p className="text-[12px] text-stone-300 font-serif leading-relaxed">{e.definition}</p>
                    </div>
                  ))}
               </div>
            )}
            {activeTab === 'foreshadowing' && (
              <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-2xl font-display font-black text-white italic tracking-tight">Foreshadowing Links</h3>
                  <button onClick={() => setProject(p => ({...p, bible: {...p.bible, foreshadowing: [...p.bible.foreshadowing, {id: crypto.randomUUID(), title: '新しい伏線', description: '', status: 'Open', priority: 'Medium'}]}}))} className="p-3 bg-stone-800 rounded-xl text-orange-400 hover:bg-orange-600 hover:text-white transition-all"><Plus size={20}/></button>
                </div>
                <div className="grid grid-cols-1 gap-4">
                   {project.bible.foreshadowing.length === 0 && <div className="py-20 text-center text-stone-600 font-serif italic">伏線はまだ定義されていません。ニューラルシンクで抽出するか、手動で追加してください。</div>}
                   {project.bible.foreshadowing.map(f => (
                     <div key={f.id} className="p-6 glass-bright rounded-2xl border border-white/5 flex gap-6 items-start">
                        <div className={`p-3 rounded-xl ${f.status === 'Resolved' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                           <Anchor size={20}/>
                        </div>
                        <div className="flex-1 space-y-2">
                           <div className="flex justify-between">
                              <h4 className="text-lg font-serif-bold text-white">{f.title}</h4>
                              <div className="flex gap-2">
                                <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${f.priority === 'Critical' ? 'bg-rose-600' : 'bg-stone-800'} text-white`}>{f.priority}</span>
                                <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest bg-stone-900 ${f.status === 'Resolved' ? 'text-emerald-400' : 'text-amber-400'}`}>{f.status}</span>
                              </div>
                           </div>
                           <p className="text-[11px] text-stone-400 font-serif leading-relaxed">{f.description}</p>
                        </div>
                     </div>
                   ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlotterView;
