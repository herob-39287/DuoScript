
import React, { useState, useRef, useEffect } from 'react';
import { StoryProject, ChatMessage, SystemLog, Character, SyncOperation, HistoryEntry, NexusBranch } from '../types';
import { chatWithArchitect, extractSettingsFromChat, generateCharacterPortrait, playCharacterVoice, simulateBranch } from '../services/geminiService';
import { savePortrait } from '../services/storageService';
import { 
  Users, Globe, Search, Zap, History, X, Volume2, Sparkles, Loader2, 
  Calendar, ArrowUpRight, Activity, MapPin, Target, Bookmark, GitBranch, 
  Plus, Package, Brain, Scale, Cpu, ShieldCheck, ChevronRight, Menu, Wand2, Info
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

const PlotterView: React.FC<Props> = ({ project, setProject, addLog, onTokenUsage, initialTab, initialMessage, clearInitialMessage, showConfirm }) => {
  const [activeCategory, setActiveCategory] = useState<CategoryType>('CANON');
  const [activeTab, setActiveTab] = useState<string>(initialTab || 'characters');
  const [input, setInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const [useSearch, setUseSearch] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showArchitectMobile, setShowArchitectMobile] = useState(false);
  const [generatingPortraits, setGeneratingPortraits] = useState<Set<string>>(new Set());

  const chatEndRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => { 
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); 
  }, [project.chatHistory, project.pendingChanges]);

  // Handle initial message (e.g., from integrity scan consultation)
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
      runSync(finalHistory);
    } catch (err: any) { 
      addLog('error', 'Architect', err.message, err.details); 
    } finally { 
      setIsChatting(false); 
    }
  };

  const runSync = async (history: any[]) => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const ops = await extractSettingsFromChat(history, project, onTokenUsage, addLog);
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
    } catch (err: any) { console.warn('Sync failed:', err); } finally { setIsSyncing(false); }
  };

  const handlePortraitGenerate = async (char: Character) => {
    if (generatingPortraits.has(char.id)) return;
    setGeneratingPortraits(prev => new Set(prev).add(char.id));
    addLog('info', 'Artist', `${char.name}の肖像画を生成中...`);
    try {
      const b64 = await generateCharacterPortrait(char, project, addLog);
      if (b64) {
        await savePortrait(char.id, b64);
        setProject(prev => ({
          ...prev,
          bible: {
            ...prev.bible,
            characters: prev.bible.characters.map(c => c.id === char.id ? { ...c, imageUrl: b64 } : c)
          }
        }));
        addLog('success', 'Artist', `${char.name}の肖像画が完成しました。`);
      }
    } catch (e: any) {
      addLog('error', 'Artist', '肖像画の生成に失敗しました。', e.message);
    } finally {
      setGeneratingPortraits(prev => {
        const next = new Set(prev);
        next.delete(char.id);
        return next;
      });
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
        if (typeof rawValue === 'object' && rawValue !== null) {
          newVal = rawValue.content || rawValue.text || rawValue.value || JSON.stringify(rawValue);
        } else {
          newVal = rawValue;
        }
        (nextBible as any)[op.path] = newVal;
      } else {
        const collection = [...((nextBible as any)[op.path] || [])];
        let idx = op.targetId ? collection.findIndex((i:any) => i.id === op.targetId) : -1;
        if (idx === -1 && op.targetName) {
          idx = collection.findIndex((i:any) => (i.name || i.title || "").toLowerCase() === op.targetName?.toLowerCase());
        }

        if (op.op === 'add' || idx === -1) {
          const newItem = { id: crypto.randomUUID(), ...rawValue };
          collection.push(newItem);
          targetName = newItem.name || newItem.title || targetName;
          newVal = newItem;
        } else {
          const currentItem = { ...collection[idx] };
          targetName = currentItem.name || currentItem.title || targetName;
          
          if (op.op === 'delete') {
            oldVal = currentItem;
            collection.splice(idx, 1);
            newVal = "DELETED";
          } else {
            if (op.field) {
              oldVal = currentItem[op.field];
              newVal = (typeof rawValue === 'object' && rawValue !== null && rawValue[op.field] !== undefined) 
                ? rawValue[op.field] 
                : rawValue;
              
              if (['location', 'health', 'currentGoal', 'internalState'].includes(op.field)) {
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
        history: [{ 
          id: crypto.randomUUID(), 
          timestamp: Date.now(), 
          operationId: op.id, 
          opType: op.op, 
          path: op.path, 
          targetName, 
          oldValue: oldVal, 
          newValue: newVal, 
          rationale: op.rationale, 
          evidence: op.evidence || "NeuralSync", 
          versionAtCommit: nextBible.version 
        }, ...prev.history].slice(0, 100),
        pendingChanges: prev.pendingChanges.filter(p => p.id !== op.id)
      };
    });
  };

  const renderSyncProposal = (op: SyncOperation) => {
    const displayValue = () => {
      if (typeof op.value === 'string') return op.value;
      if (op.field && op.value[op.field] !== undefined) return String(op.value[op.field]);
      return op.value.content || op.value.text || op.value.description || JSON.stringify(op.value);
    };

    return (
      <div key={op.id} className="p-4 glass-bright rounded-2xl border-2 border-orange-500/40 space-y-3 relative animate-fade-in shadow-xl">
         <div className="flex justify-between items-center">
            <span className={`text-[7px] font-black uppercase px-2 py-0.5 rounded-full ${op.confidence > 0.8 ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>
              {Math.floor((op.confidence || 0) * 100)}% Conf.
            </span>
            <button onClick={() => setProject(p => ({...p, pendingChanges: p.pendingChanges.filter(x => x.id !== op.id)}))} className="p-1 hover:text-rose-500 text-stone-600"><X size={14}/></button>
         </div>
         <div className="space-y-1">
            <div className="text-[10px] font-black text-white flex items-center gap-2 truncate">
               <Package size={10} className="text-orange-400 shrink-0"/> {op.targetName || op.path}
            </div>
            <div className="flex items-center gap-2">
               <span className="text-[8px] font-black text-stone-500 uppercase tracking-widest bg-stone-900 px-1.5 py-0.5 rounded">{op.path}</span>
               {op.field && <ChevronRight size={8} className="text-stone-700"/>}
               {op.field && <span className="text-[8px] font-black text-orange-400 uppercase tracking-widest">{op.field}</span>}
            </div>
         </div>
         <div className="p-2.5 bg-stone-950/60 rounded-xl border border-white/5 text-[10px] font-serif text-stone-200 leading-relaxed italic line-clamp-4">
           {displayValue()}
         </div>
         <div className="px-1 space-y-1">
            <div className="flex items-center gap-1.5 text-[8px] font-black text-stone-600 uppercase tracking-widest">
               <Info size={10}/> Rationale
            </div>
            <p className="text-[9px] text-stone-500 font-serif leading-tight">{op.rationale}</p>
         </div>
         <button onClick={() => commitOp(op)} className="w-full py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-[8px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95">
            <ShieldCheck size={12}/> 設定に反映
         </button>
      </div>
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

  function renderCharacters() {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-fade-in">
        {project.bible.characters.map(c => (
          <div key={c.id} className="glass-bright rounded-3xl overflow-hidden border border-white/5 flex flex-col group">
            {c.imageUrl ? (
              <div className="aspect-square w-full relative overflow-hidden bg-stone-900">
                <img src={c.imageUrl} alt={c.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-stone-950 to-transparent" />
                <button onClick={() => handlePortraitGenerate(c)} className="absolute top-4 right-4 p-2 bg-stone-950/80 rounded-full text-orange-400 hover:text-white backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all">
                  <Wand2 size={16}/>
                </button>
              </div>
            ) : (
              <div className="aspect-square w-full bg-stone-900 flex flex-col items-center justify-center gap-4 text-stone-700 hover:text-orange-500/50 transition-colors cursor-pointer" onClick={() => handlePortraitGenerate(c)}>
                {generatingPortraits.has(c.id) ? <Loader2 size={32} className="animate-spin text-orange-400"/> : <Sparkles size={32}/>}
                <span className="text-[9px] font-black uppercase tracking-widest">Generate Portrait</span>
              </div>
            )}
            <div className="p-6 space-y-4 flex-1 flex flex-col">
               <div className="flex justify-between items-start">
                  <h4 className="text-xl font-display font-black text-white italic">{c.name}</h4>
                  <span className="text-[8px] font-black uppercase text-stone-600 tracking-widest">{c.role}</span>
               </div>
               <div className="max-h-48 overflow-y-auto no-scrollbar">
                <p className="text-[11px] text-stone-400 font-serif leading-relaxed line-clamp-[12] italic whitespace-pre-wrap">"{c.description || '説明なし'}"</p>
               </div>
               <div className="mt-auto pt-4 flex items-center justify-between border-t border-white/5">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-[9px] font-bold text-stone-500">
                      <MapPin size={10} className="text-stone-600"/> {c.status?.location || '不明'}
                    </div>
                    {c.status?.currentGoal && (
                      <div className="flex items-center gap-2 text-[8px] font-black text-orange-500 uppercase tracking-widest">
                        <Target size={10}/> {c.status.currentGoal}
                      </div>
                    )}
                  </div>
                  <button onClick={() => playCharacterVoice(c, `私は${c.name}。この物語の${c.role}です。`, addLog)} className="text-stone-700 hover:text-orange-400 transition-colors">
                    <Volume2 size={16}/>
                  </button>
               </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-stone-950 overflow-hidden relative">
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className={`fixed inset-0 z-[110] md:relative md:inset-auto md:z-auto w-full md:w-80 glass border-r border-white/5 flex flex-col h-full shrink-0 transform transition-transform duration-300 ${showArchitectMobile ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
          <div className="p-6 border-b border-white/5 flex items-center justify-between bg-stone-900/50">
              <h3 className="text-[10px] font-black text-orange-400 uppercase tracking-[0.4em]">NeuralSync</h3>
              <button onClick={() => setShowArchitectMobile(false)} className="md:hidden p-2 text-stone-500 hover:text-white"><X size={20}/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
              {project.chatHistory?.slice(-20).map(m => (
                  <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in`}>
                      <div className={`max-w-[90%] p-4 rounded-2xl text-[11px] leading-relaxed shadow-xl ${m.role === 'user' ? 'bg-orange-600 text-white' : 'glass-bright text-stone-300 font-serif'}`}>{m.content}</div>
                  </div>
              ))}
              {project.pendingChanges.map(renderSyncProposal)}
              <div ref={chatEndRef} />
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
               {activeCategory === 'PLAN' && <><SubTab id="grandArc" label="構成" icon={Target} /><SubTab id="chronicle" label="統合年表" icon={Calendar} /><SubTab id="nexus" label="Nexus" icon={GitBranch} /></>}
          </div>
          <div className="flex-1 overflow-y-auto p-6 md:p-12 pb-40 custom-scrollbar">
            {activeTab === 'characters' && renderCharacters()}
            {activeTab === 'grandArc' && (
              <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
                <h3 className="text-2xl font-display font-black text-white italic tracking-tight">The Grand Arc</h3>
                <textarea 
                  value={project.bible.grandArc} 
                  onChange={e => setProject(p => ({...p, bible: {...p.bible, grandArc: e.target.value}}))}
                  className="w-full bg-stone-900/40 border border-white/10 rounded-[2.5rem] p-10 text-lg font-serif-bold leading-[2.2] text-stone-200 min-h-[600px] outline-none shadow-2xl focus:border-orange-500/30 transition-all resize-none"
                  placeholder="物語全体の流れを記述してください..."
                />
              </div>
            )}
            {activeTab === 'world' && (
              <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
                <div className="grid grid-cols-1 gap-12">
                   <div className="space-y-4">
                      <h3 className="text-xl font-display font-black text-white italic">The Setting</h3>
                      <textarea value={project.bible.setting} onChange={e => setProject(p => ({...p, bible: {...p.bible, setting: e.target.value}}))} className="w-full bg-stone-900/40 border border-white/10 rounded-3xl p-6 text-sm font-serif leading-relaxed text-stone-300 min-h-[300px] outline-none" />
                   </div>
                   <div className="space-y-4">
                      <h3 className="text-xl font-display font-black text-white italic">The Laws</h3>
                      <textarea value={project.bible.laws} onChange={e => setProject(p => ({...p, bible: {...p.bible, laws: e.target.value}}))} className="w-full bg-stone-900/40 border border-white/10 rounded-3xl p-6 text-sm font-serif leading-relaxed text-stone-300 min-h-[300px] outline-none" />
                   </div>
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
