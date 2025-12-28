
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { StoryProject, ChatMessage, SystemLog, Character, SyncOperation, HistoryEntry, NexusBranch, Foreshadowing } from '../types';
import { chatWithArchitect, extractSettingsFromChat, identifyChangedCategories, generateCharacterPortrait, playCharacterVoice, simulateBranch } from '../services/geminiService';
import { savePortrait } from '../services/storageService';
import { 
  Users, Globe, Search, Zap, History, X, Volume2, Sparkles, Loader2, 
  Calendar, ArrowUpRight, Activity, MapPin, Target, Bookmark, GitBranch, 
  Plus, Package, Brain, Scale, Cpu, ShieldCheck, ChevronRight, Menu, Wand2, Info,
  Filter, Database, RefreshCw, Layers, AlertCircle, BarChart3, Eye, Anchor
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
    setProject(prev => {
      const nextBible = { ...prev.bible, version: prev.bible.version + 1 };
      const rawValue = op.value;
      let targetName = op.targetName || "不明";
      let oldVal: any = null;
      let newVal: any = null;

      const isStringField = ['setting', 'tone', 'laws', 'grandArc'].includes(op.path);

      if (isStringField) {
        oldVal = (nextBible as any)[op.path];
        newVal = (typeof rawValue === 'object' && rawValue !== null) ? (rawValue.content || rawValue.text || rawValue.value || JSON.stringify(rawValue)) : rawValue;
        (nextBible as any)[op.path] = newVal;
      } else {
        const collection = [...((nextBible as any)[op.path] || [])];
        let idx = op.targetId ? collection.findIndex((i:any) => i.id === op.targetId) : -1;
        if (idx === -1 && op.targetName) {
          idx = collection.findIndex((i:any) => {
            const itemName = (i.name || i.title || i.event || "").toLowerCase().trim();
            return itemName === op.targetName?.toLowerCase().trim();
          });
        }

        if (idx === -1 && op.op !== 'delete') {
          const newItem = { id: crypto.randomUUID(), ...rawValue };
          if (!newItem.name && !newItem.title && !newItem.event && op.targetName) {
             if (op.path === 'characters') newItem.name = op.targetName;
             else if (op.path === 'timeline') newItem.event = op.targetName;
             else newItem.title = op.targetName;
          }
          collection.push(newItem);
          targetName = newItem.name || newItem.title || newItem.event || targetName;
          newVal = newItem;
        } else if (idx !== -1) {
          const currentItem = { ...collection[idx] };
          targetName = currentItem.name || currentItem.title || currentItem.event || targetName;
          
          if (op.op === 'delete') {
            oldVal = currentItem;
            collection.splice(idx, 1);
            newVal = "DELETED";
          } else {
            if (op.field) {
              oldVal = currentItem[op.field];
              newVal = (typeof rawValue === 'object' && rawValue !== null && rawValue[op.field] !== undefined) ? rawValue[op.field] : rawValue;
              if (op.path === 'characters' && ['location', 'health', 'currentGoal', 'internalState'].includes(op.field)) {
                 currentItem.status = { ...currentItem.status, [op.field]: newVal };
              } else {
                 currentItem[op.field] = newVal;
              }
            } else {
              oldVal = currentItem;
              newVal = { ...currentItem, ...rawValue };
            }
            collection[idx] = newVal;
          }
        }
        (nextBible as any)[op.path] = collection;
      }

      return {
        ...prev,
        bible: nextBible,
        history: [{ id: crypto.randomUUID(), timestamp: Date.now(), operationId: op.id, opType: op.op, path: op.path, targetName, oldValue: oldVal, newValue: newVal, rationale: op.rationale, evidence: op.evidence || "NeuralSync", versionAtCommit: nextBible.version }, ...prev.history].slice(0, 100),
        pendingChanges: prev.pendingChanges.filter(p => p.id !== op.id)
      };
    });
  };

  const getPathColor = (path: string) => {
    switch(path) {
      case 'characters': return 'border-emerald-500/40 text-emerald-400';
      case 'entries': return 'border-blue-500/40 text-blue-400';
      case 'timeline': return 'border-purple-500/40 text-purple-400';
      case 'foreshadowing': return 'border-amber-500/40 text-amber-400';
      default: return 'border-orange-500/40 text-orange-400';
    }
  };

  const renderSyncProposal = (op: SyncOperation) => {
    const displayValue = () => {
      if (typeof op.value === 'string') return op.value;
      if (op.field && typeof op.value === 'object' && op.value !== null && op.value[op.field] !== undefined) return String(op.value[op.field]);
      return op.value.content || op.value.text || op.value.description || JSON.stringify(op.value);
    };
    const colorClass = getPathColor(op.path);
    return (
      <div key={op.id} className={`p-4 glass-bright rounded-2xl border-2 ${colorClass.split(' ')[0]} space-y-3 relative animate-fade-in shadow-xl`}>
         <div className="flex justify-between items-center">
            <span className={`text-[7px] font-black uppercase px-2 py-0.5 rounded-full bg-stone-800 ${colorClass.split(' ')[1]}`}>
              {Math.floor((op.confidence || 0) * 100)}% Conf.
            </span>
            <button onClick={() => setProject(p => ({...p, pendingChanges: p.pendingChanges.filter(x => x.id !== op.id)}))} className="p-1 hover:text-rose-500 text-stone-600"><X size={14}/></button>
         </div>
         <div className="space-y-1">
            <div className="text-[10px] font-black text-white flex items-center gap-2 truncate">
               <Package size={10} className={colorClass.split(' ')[1]}/> {op.targetName || op.path}
            </div>
         </div>
         <div className="p-2.5 bg-stone-950/60 rounded-xl border border-white/5 text-[10px] font-serif text-stone-200 leading-relaxed italic line-clamp-4">
           {displayValue()}
         </div>
         <button onClick={() => commitOp(op)} className="w-full py-2 bg-stone-800 hover:bg-stone-700 text-white rounded-lg text-[8px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95">
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
          <SyncButton scope="characters" label="人物抽出" icon={<Users size={12}/>} activeColor="text-emerald-400" />
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
               {activeCategory === 'CANON' && <><SubTab id="characters" label="人物" icon={Users} /><SubTab id="world" label="世界" icon={Globe} /><SubTab id="library" label="資料" icon={Bookmark} /></>}
               {activeCategory === 'PLAN' && <><SubTab id="grandArc" label="構成" icon={Target} /><SubTab id="chronicle" label="統合年表" icon={Calendar} /><SubTab id="foreshadowing" label="伏線" icon={Anchor} /><SubTab id="nexus" label="Nexus" icon={GitBranch} /></>}
          </div>
          <div className="flex-1 overflow-y-auto p-6 md:p-12 pb-40 custom-scrollbar">
            {activeTab === 'characters' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-fade-in">
                {project.bible.characters.map(c => (
                  <div key={c.id} className="glass-bright rounded-3xl overflow-hidden border border-white/5 flex flex-col group">
                    {c.imageUrl && (
                      <div className="aspect-square w-full relative overflow-hidden bg-stone-900">
                        <img src={c.imageUrl} alt={c.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                        <div className="absolute inset-0 bg-gradient-to-t from-stone-950 to-transparent" />
                      </div>
                    )}
                    <div className="p-6 space-y-4">
                       <h4 className="text-xl font-display font-black text-white italic">{c.name}</h4>
                       <p className="text-[11px] text-stone-400 font-serif leading-relaxed line-clamp-3">{c.description}</p>
                       <div className="pt-4 flex items-center justify-between border-t border-white/5">
                          <div className="text-[9px] font-bold text-stone-500"><MapPin size={10} className="inline mr-1"/> {c.status?.location || '不明'}</div>
                          <button onClick={() => playCharacterVoice(c, `私は${c.name}です。`, addLog)} className="text-stone-700 hover:text-orange-400"><Volume2 size={16}/></button>
                       </div>
                    </div>
                  </div>
                ))}
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
