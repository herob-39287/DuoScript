
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, Character, SyncOperation, WorldEntry, Foreshadowing, NexusBranch } from '../types';
import { chatWithArchitect, extractSettingsFromChat, identifyChangedCategories, simulateBranch } from '../services/geminiService';
import { useProject, useNotifications } from '../App';
import { 
  Users, Globe, ArrowUpRight, Activity, MapPin, Target, 
  Plus, Loader2, Menu, Anchor, Zap, ShieldAlert, History,
  Trash2, Check, X, ChevronDown, ChevronUp, Beaker
} from 'lucide-react';

const AUTO_SYNC_THRESHOLD = 3000;

const PlotterView: React.FC = () => {
  const { project, dispatch: projectDispatch, plotterTab: activeTab, setPlotterTab: setActiveTab, pendingMsg, setPendingMsg } = useProject();
  const { addLog } = useNotifications();

  const [activeCategory, setActiveCategory] = useState<'CANON' | 'PLAN' | 'NEXUS'>(
    ['characters', 'world'].includes(activeTab) ? 'CANON' : 
    ['grandArc', 'foreshadowing', 'timeline'].includes(activeTab) ? 'PLAN' : 'NEXUS'
  );
  const [input, setInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const [syncingScope, setSyncingScope] = useState<string | null>(null);
  const [showArchitectMobile, setShowArchitectMobile] = useState(false);
  const [charsSinceLastSync, setCharsSinceLastSync] = useState(0);
  const [expandedOpId, setExpandedOpId] = useState<string | null>(null);
  const [nexusHypothesis, setNexusHypothesis] = useState('');
  const [isSimulating, setIsSimulating] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [project?.chatHistory, project?.pendingChanges]);

  useEffect(() => {
    if (pendingMsg && !isChatting) {
      handleSendMessage(pendingMsg);
      setPendingMsg(null);
    }
  }, [pendingMsg]);

  const handleSendMessage = async (customMessage?: string) => {
    const textToSend = customMessage || input.trim();
    if (!textToSend || isChatting || !project) return;
    
    if (!customMessage) setInput('');
    setIsChatting(true);
    
    try {
      const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: textToSend, timestamp: Date.now() };
      const historyWithUser = [...(project.chatHistory || []), userMsg];
      projectDispatch({ type: 'SET_CHAT_HISTORY', payload: historyWithUser });
      
      const { text, sources } = await chatWithArchitect(
        historyWithUser.map(m => ({ role: m.role, parts: [{ text: m.content }] })),
        textToSend, 
        project, 
        true, 
        (usage) => projectDispatch({ type: 'TRACK_USAGE', payload: usage }), 
        addLog
      );
      
      const botMsg: ChatMessage = { id: (Date.now()+1).toString(), role: 'model', content: text, timestamp: Date.now(), sources };
      const finalHistory = [...historyWithUser, botMsg];
      projectDispatch({ type: 'SET_CHAT_HISTORY', payload: finalHistory });

      const addedChars = textToSend.length + text.length;
      const newAccumulation = charsSinceLastSync + addedChars;
      setCharsSinceLastSync(newAccumulation);

      // Trigger automatic sync analysis if enough text has been exchanged
      if (newAccumulation >= AUTO_SYNC_THRESHOLD) {
        runSync(finalHistory, 'all');
      } else {
        const recommendations = await identifyChangedCategories(finalHistory, (usage: any) => projectDispatch({ type: 'TRACK_USAGE', payload: usage }), addLog);
        if (recommendations.length > 0) {
          runSync(finalHistory, recommendations[0]);
        }
      }
    } catch (err: any) { 
      addLog('error', 'Architect', err.message); 
    } finally { 
      setIsChatting(false); 
    }
  };

  const runSync = async (history: any[], scope: string) => {
    if (syncingScope || !project) return;
    setSyncingScope(scope);
    setCharsSinceLastSync(0);
    
    try {
      const ops = await extractSettingsFromChat(history, project, scope as any, (usage: any) => projectDispatch({ type: 'TRACK_USAGE', payload: usage }), addLog);
      if (ops.length > 0) {
        projectDispatch({ type: 'ADD_PENDING_OPS', payload: ops });
        addLog('success', 'NeuralSync', `${ops.length}件の同期提案があります。`);
      }
    } catch (err: any) { 
      addLog('error', 'NeuralSync', '設定の抽出に失敗しました。');
    } finally { 
      setSyncingScope(null); 
    }
  };

  const handleSimulate = async () => {
    if (!nexusHypothesis.trim() || isSimulating || !project) return;
    setIsSimulating(true);
    try {
      const branch = await simulateBranch(nexusHypothesis, project, (usage: any) => projectDispatch({ type: 'TRACK_USAGE', payload: usage }), addLog);
      projectDispatch({ type: 'UPDATE_BIBLE', payload: { nexusBranches: [branch, ...(project.bible.nexusBranches || [])] } });
      setNexusHypothesis('');
      addLog('success', 'Nexus', 'シミュレーション完了');
    } catch (e) {
      addLog('error', 'Nexus', 'シミュレーションに失敗しました。');
    } finally {
      setIsSimulating(false);
    }
  };

  if (!project) return null;

  return (
    <div className="h-full flex flex-col bg-stone-950 overflow-hidden relative">
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Architect Side Panel */}
        <aside className={`fixed inset-0 z-[110] md:relative md:inset-auto md:z-auto w-full md:w-80 glass border-r border-white/5 flex flex-col h-full shrink-0 transform transition-transform duration-300 ${showArchitectMobile ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
          <div className="p-6 border-b border-white/5 flex justify-between bg-stone-900/50">
            <h3 className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Architect Chat</h3>
            <button className="md:hidden text-stone-500" onClick={() => setShowArchitectMobile(false)}>閉じる</button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {project.chatHistory?.map(m => (
              <div key={m.id} className={`max-w-[90%] p-4 rounded-2xl text-[12px] font-serif leading-relaxed ${m.role === 'user' ? 'bg-orange-600 text-white ml-auto' : 'glass-bright text-stone-200'}`}>
                {m.content}
                {m.sources && m.sources.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-white/10 space-y-1">
                    <span className="text-[8px] font-black uppercase text-stone-500">Sources:</span>
                    {m.sources.map((s, i) => (
                      <a key={i} href={s.uri} target="_blank" rel="noopener noreferrer" className="block text-[10px] text-orange-400 hover:underline truncate">
                        • {s.title}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {isChatting && (
              <div className="glass-bright p-4 rounded-2xl max-w-[90%] flex gap-3 items-center">
                <Loader2 size={14} className="animate-spin text-orange-400"/>
                <span className="text-[9px] font-black text-stone-500 uppercase tracking-widest">Thinking...</span>
              </div>
            )}

            {project.pendingChanges.length > 0 && (
              <div className="space-y-3 mt-8">
                <div className="flex items-center justify-between px-2">
                  <span className="text-[9px] font-black text-stone-600 uppercase tracking-widest">NeuralSync 提案</span>
                  <span className="bg-orange-500 text-[8px] font-black text-stone-950 px-1.5 py-0.5 rounded-full">{project.pendingChanges.length}</span>
                </div>
                {project.pendingChanges.map(op => (
                  <ProposalItem 
                    key={op.id} 
                    op={op} 
                    isExpanded={expandedOpId === op.id} 
                    onToggle={() => setExpandedOpId(expandedOpId === op.id ? null : op.id)}
                    onAccept={() => projectDispatch({ type: 'COMMIT_SYNC_OP', payload: op })}
                    onReject={() => projectDispatch({ type: 'REJECT_SYNC_OP', payload: op.id })}
                  />
                ))}
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="p-4 bg-stone-900/40 border-t border-white/5 space-y-3">
            <textarea 
              value={input} 
              onChange={e => setInput(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())} 
              className="w-full bg-stone-950 border border-white/10 rounded-2xl p-4 text-[13px] h-24 outline-none font-serif resize-none focus:border-orange-500/50 transition-all text-stone-200" 
              placeholder="設計士と物語を練る..." 
            />
            <button 
              onClick={() => handleSendMessage()} 
              disabled={isChatting} 
              className="w-full py-3 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              {isChatting ? <Loader2 size={16} className="animate-spin" /> : <ArrowUpRight size={18} />}
              <span className="text-[10px] font-black uppercase tracking-widest">送信</span>
            </button>
          </div>
        </aside>

        {/* Content Area */}
        <div className="flex-1 flex flex-col h-full bg-stone-950/50">
          <div className="flex items-center glass border-b border-white/5 shrink-0 overflow-x-auto no-scrollbar">
            <button onClick={() => setShowArchitectMobile(true)} className="md:hidden p-5 text-orange-400 border-r border-white/5"><Menu size={20}/></button>
            <CatBtn active={activeCategory === 'CANON'} onClick={() => { setActiveCategory('CANON'); setActiveTab('characters'); }} label="世界の理 (Canon)" icon={<Globe size={18}/>} />
            <CatBtn active={activeCategory === 'PLAN'} onClick={() => { setActiveCategory('PLAN'); setActiveTab('grandArc'); }} label="物語の計画 (Plan)" icon={<Target size={18}/>} />
            <CatBtn active={activeCategory === 'NEXUS'} onClick={() => { setActiveCategory('NEXUS'); setActiveTab('nexus'); }} label="Nexus (実験室)" icon={<Beaker size={18}/>} />
          </div>
          
          <div className="px-6 py-4 bg-stone-900/20 border-b border-white/5 flex gap-3 shrink-0 overflow-x-auto no-scrollbar">
             {activeCategory === 'CANON' && (
               <>
                 <SubTab id="characters" active={activeTab === 'characters'} onClick={setActiveTab} label="登場人物" icon={Users}/>
                 <SubTab id="world" active={activeTab === 'world'} onClick={setActiveTab} label="用語・設定" icon={Globe}/>
               </>
             )}
             {activeCategory === 'PLAN' && (
               <>
                 <SubTab id="grandArc" active={activeTab === 'grandArc'} onClick={setActiveTab} label="大筋" icon={Target}/>
                 <SubTab id="foreshadowing" active={activeTab === 'foreshadowing'} onClick={setActiveTab} label="伏線" icon={Anchor}/>
                 <SubTab id="timeline" active={activeTab === 'timeline'} onClick={setActiveTab} label="年表" icon={History}/>
               </>
             )}
          </div>

          <div className="flex-1 overflow-y-auto p-6 md:p-12 custom-scrollbar">
            {activeTab === 'characters' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
                {project.bible.characters.map(c => <CharacterCard key={c.id} character={c} />)}
                <button onClick={() => handleSendMessage('新しい主要キャラクターを登場させたいです')} className="min-h-[300px] border-2 border-dashed border-stone-800 rounded-[2rem] flex flex-col items-center justify-center gap-4 text-stone-700 hover:text-stone-500 hover:border-orange-500/30 transition-all group">
                  <div className="w-16 h-16 bg-stone-900 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Plus size={32}/>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest">人物を追加</span>
                </button>
              </div>
            )}

            {activeTab === 'world' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-6xl mx-auto">
                {project.bible.entries.map(e => <EntryCard key={e.id} entry={e} />)}
                <button onClick={() => handleSendMessage('新しい世界設定や用語を追加したいです')} className="p-8 border-2 border-dashed border-stone-800 rounded-[2rem] flex items-center gap-6 text-stone-700 hover:text-stone-500 transition-all group">
                   <Plus size={24} />
                   <span className="text-[10px] font-black uppercase tracking-widest">用語・設定を追加</span>
                </button>
              </div>
            )}

            {activeTab === 'foreshadowing' && (
               <div className="max-w-4xl mx-auto space-y-6">
                 {project.bible.foreshadowing.map(f => <ForeshadowingCard key={f.id} f={f} />)}
                 {project.bible.foreshadowing.length === 0 && (
                   <div className="text-center py-20 text-stone-700 italic font-serif">まだ伏線は引かれていません。</div>
                 )}
               </div>
            )}

            {activeTab === 'grandArc' && (
              <div className="max-w-4xl mx-auto space-y-8 py-6">
                <div className="space-y-2">
                  <h3 className="text-3xl font-display font-black text-white italic tracking-tight uppercase">The Grand Arc</h3>
                  <p className="text-stone-500 text-sm font-serif">物語全体の骨組み、主題、そして終着点。</p>
                </div>
                <textarea 
                  value={project.bible.grandArc} 
                  onChange={e => projectDispatch({ type: 'UPDATE_BIBLE', payload: { grandArc: e.target.value } })} 
                  className="w-full bg-stone-900/30 border border-white/5 rounded-[2rem] p-10 text-lg font-serif leading-relaxed text-stone-300 min-h-[600px] outline-none shadow-inner focus:border-orange-500/30 transition-all" 
                  placeholder="物語がどのように始まり、どのように終わるのか..."
                />
              </div>
            )}

            {activeTab === 'nexus' && (
              <div className="max-w-5xl mx-auto space-y-12">
                <div className="glass-bright p-10 rounded-[3rem] border border-orange-500/20 space-y-8">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-orange-600 rounded-2xl text-white shadow-xl"><Beaker size={24}/></div>
                    <div>
                      <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Nexus Simulation</h3>
                      <p className="text-stone-500 text-xs font-serif italic">「もしも」の世界を演算し、本編への影響を予測します。</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <textarea 
                      value={nexusHypothesis}
                      onChange={e => setNexusHypothesis(e.target.value)}
                      placeholder="例：もし主人公がここで敗北していたら？"
                      className="w-full bg-stone-950/50 border border-white/10 rounded-2xl p-6 text-sm font-serif text-stone-200 h-32 outline-none resize-none focus:border-orange-500/50 transition-all"
                    />
                    <button 
                      onClick={handleSimulate}
                      disabled={isSimulating || !nexusHypothesis.trim()}
                      className="w-full py-5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-2xl font-black uppercase tracking-widest shadow-2xl transition-all flex items-center justify-center gap-3"
                    >
                      {isSimulating ? <Loader2 size={18} className="animate-spin"/> : <Zap size={18}/>}
                      演算を開始
                    </button>
                  </div>
                </div>

                <div className="space-y-6">
                  <span className="text-[10px] font-black text-stone-600 uppercase tracking-widest px-4">シミュレーション履歴</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {project.bible.nexusBranches.map(branch => (
                      <div key={branch.id} className="p-8 glass-bright rounded-[2rem] border border-white/5 space-y-6 hover:border-orange-500/20 transition-all group">
                        <div className="flex items-start gap-4">
                           <div className="w-10 h-10 rounded-full bg-stone-900 flex items-center justify-center text-orange-400 shrink-0"><History size={18}/></div>
                           <p className="text-sm font-serif-bold text-stone-100 italic leading-relaxed">"{branch.hypothesis}"</p>
                        </div>
                        <div className="space-y-3">
                           <div className="p-4 bg-stone-950/60 rounded-xl space-y-1">
                              <span className="text-[8px] font-black text-rose-400 uppercase">Impact on Canon</span>
                              <p className="text-[11px] text-stone-400 font-serif leading-relaxed">{branch.impactOnCanon}</p>
                           </div>
                           <div className="p-4 bg-stone-950/60 rounded-xl space-y-1">
                              <span className="text-[8px] font-black text-emerald-400 uppercase">New Possibility</span>
                              <p className="text-[11px] text-stone-400 font-serif leading-relaxed">{branch.impactOnState}</p>
                           </div>
                        </div>
                      </div>
                    ))}
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

// Fix: Using React.FC to handle reserved props like 'key' correctly in lists
const ProposalItem: React.FC<{ 
  op: SyncOperation; 
  isExpanded: boolean; 
  onToggle: () => void; 
  onAccept: () => void; 
  onReject: () => void; 
}> = ({ op, isExpanded, onToggle, onAccept, onReject }) => (
  <div className={`glass-bright rounded-2xl border transition-all ${isExpanded ? 'border-orange-500/40 shadow-2xl' : 'border-white/5 hover:border-white/10'}`}>
    <button onClick={onToggle} className="w-full p-4 flex items-center justify-between text-left">
      <div className="flex-1 min-w-0 pr-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[7px] font-black text-orange-400 bg-orange-400/10 px-1.5 py-0.5 rounded uppercase">{op.path}</span>
          <span className="text-[7px] font-black text-stone-500 uppercase">{op.op}</span>
        </div>
        <div className="text-[11px] font-bold text-stone-100 truncate">{op.targetName}</div>
      </div>
      {isExpanded ? <ChevronUp size={14} className="text-stone-600"/> : <ChevronDown size={14} className="text-stone-600"/>}
    </button>
    
    {isExpanded && (
      <div className="px-4 pb-4 space-y-4 animate-fade-in border-t border-white/5 pt-4">
        <div className="space-y-2">
          <span className="text-[8px] font-black text-stone-600 uppercase">Rationale</span>
          <p className="text-[10px] text-stone-400 font-serif italic leading-relaxed">{op.rationale}</p>
        </div>
        <div className="p-3 bg-stone-950/60 rounded-xl space-y-2">
           <span className="text-[8px] font-black text-emerald-400 uppercase">Proposed Diff</span>
           <div className="text-[10px] text-stone-200 font-mono space-y-1 break-all">
              {op.field && <div className="text-stone-500">{op.field}:</div>}
              <div className="text-emerald-400">+ {JSON.stringify(op.value, null, 2)}</div>
           </div>
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={onReject} className="flex-1 py-2 bg-stone-800 hover:bg-stone-700 text-stone-400 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
            <X size={12}/> 却下
          </button>
          <button onClick={onAccept} className="flex-1 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-orange-900/20">
            <Check size={12}/> 採用
          </button>
        </div>
      </div>
    )}
  </div>
);

// Fix: Using React.FC to handle reserved props like 'key' correctly in lists
const CharacterCard: React.FC<{ character: Character }> = ({ character: c }) => (
  <div className="glass-bright rounded-[2.5rem] overflow-hidden border border-white/5 flex flex-col h-full hover:border-orange-500/20 transition-all group shadow-xl relative">
    <div className="aspect-[16/10] w-full relative overflow-hidden bg-stone-900">
      {c.imageUrl && <img src={c.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" />}
      <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/40 to-transparent" />
      <div className="absolute bottom-6 left-8 right-8">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[7px] font-black uppercase text-orange-400 tracking-widest bg-orange-400/10 px-1.5 py-0.5 rounded">{c.role}</span>
        </div>
        <h4 className="text-2xl font-display font-black text-white italic tracking-tight">{c.name}</h4>
      </div>
    </div>
    <div className="p-8 space-y-6 flex-1 flex flex-col">
      <div className="space-y-1.5">
        <span className="text-[8px] font-black text-stone-600 uppercase tracking-widest">Description</span>
        <p className="text-[11px] text-stone-400 font-serif leading-relaxed line-clamp-3">{c.description || '詳細未設定...'}</p>
      </div>
      <div className="mt-auto grid grid-cols-2 gap-3 pt-4 border-t border-white/5">
        <StatusItem icon={<MapPin size={12}/>} label="Location" value={c.status?.location} color="text-orange-400" />
        <StatusItem icon={<Activity size={12}/>} label="Status" value={c.status?.internalState} color="text-emerald-400" />
      </div>
    </div>
  </div>
);

// Fix: Using React.FC to handle reserved props like 'key' correctly in lists
const EntryCard: React.FC<{ entry: WorldEntry }> = ({ entry: e }) => (
  <div className="glass-bright p-8 rounded-[2rem] border border-white/5 hover:border-white/10 transition-all space-y-4 shadow-lg group">
    <div className="flex justify-between items-start">
      <div className="space-y-1">
        <span className="text-[8px] font-black text-stone-600 uppercase tracking-widest bg-stone-900 px-2 py-0.5 rounded">{e.category}</span>
        <h4 className="text-lg font-serif-bold text-stone-100">{e.title}</h4>
      </div>
      {e.isSecret && <ShieldAlert size={16} className="text-rose-500 opacity-40"/>}
    </div>
    <p className="text-[12px] text-stone-400 font-serif leading-relaxed line-clamp-3">{e.content}</p>
    <div className="flex flex-wrap gap-2 pt-2">
      {e.tags?.map(tag => (
        <span key={tag} className="text-[8px] font-black text-stone-600 uppercase border border-stone-800 px-1.5 py-0.5 rounded-full">{tag}</span>
      ))}
    </div>
  </div>
);

// Fix: Using React.FC to handle reserved props like 'key' correctly in lists
const ForeshadowingCard: React.FC<{ f: Foreshadowing }> = ({ f }) => (
  <div className="glass-bright p-6 rounded-2xl border border-white/5 flex items-center gap-6 group hover:border-orange-500/20 transition-all">
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${f.status === 'Resolved' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-orange-500/10 text-orange-400'}`}>
       {f.status === 'Resolved' ? <Check size={20}/> : <Anchor size={20}/>}
    </div>
    <div className="flex-1 min-w-0">
       <div className="flex items-center gap-2 mb-1">
         <span className={`text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${f.priority === 'Critical' ? 'bg-rose-500 text-stone-950' : 'bg-stone-800 text-stone-400'}`}>
           {f.priority}
         </span>
         <span className="text-[8px] font-serif text-stone-600">{f.status}</span>
       </div>
       <h4 className="text-sm font-serif-bold text-stone-200 truncate">{f.title}</h4>
       <p className="text-[11px] text-stone-500 font-serif line-clamp-1">{f.description}</p>
    </div>
  </div>
);

const StatusItem = ({ icon, label, value, color }: any) => (
  <div className="space-y-1">
    <div className="flex items-center gap-1.5 opacity-40">
      <span className={color}>{icon}</span>
      <span className="text-[8px] font-black text-stone-400 uppercase">{label}</span>
    </div>
    <p className="text-[10px] text-stone-200 font-serif truncate pl-5">{value || '不明'}</p>
  </div>
);

const CatBtn = ({ active, label, icon, onClick }: any) => (
  <button onClick={onClick} className={`flex items-center gap-3 px-8 py-5 transition-all border-b-2 shrink-0 ${active ? 'text-orange-400 border-orange-400 bg-orange-400/5' : 'text-stone-600 border-transparent hover:text-stone-400'}`}>
     {icon} <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">{label}</span>
  </button>
);

const SubTab = ({ id, active, label, icon: Icon, onClick }: any) => (
  <button onClick={() => onClick(id)} className={`px-5 py-2.5 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all shrink-0 ${active ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/20' : 'text-stone-500 bg-stone-900/60 hover:text-stone-300'}`}>
    <Icon size={14} /> {label}
  </button>
);

export default PlotterView;
