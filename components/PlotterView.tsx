
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage, SyncOperation, NexusBranch, HistoryEntry } from '../types';
import { chatWithArchitect, extractSettingsFromChat, detectSettingChange, simulateBranch } from '../services/geminiService';
import { useBible, useNeuralSync, useUI, useNotifications, useMetadata, useMetadataDispatch, useBibleDispatch, useNeuralSyncDispatch, useUIDispatch, useNotificationDispatch } from '../App';
import { calculateSyncResult, calculateRevertResult, getCurrentValueForDiff } from '../services/bibleManager';
import { 
  Users, Globe, ArrowUpRight, Activity, MapPin, Target, 
  Plus, Loader2, Menu, Anchor, Zap, ShieldAlert, History,
  X, ChevronDown, ChevronUp, Beaker, Check, Undo2, ArrowRight
} from 'lucide-react';

const PlotterView: React.FC = () => {
  const meta = useMetadata();
  const metaDispatch = useMetadataDispatch();
  const bible = useBible();
  const bibleDispatch = useBibleDispatch();
  const sync = useNeuralSync();
  const syncDispatch = useNeuralSyncDispatch();
  
  const { plotterTab: activeTab, pendingMsg } = useUI();
  const { setPlotterTab: setActiveTab, setPendingMsg } = useUIDispatch();
  const { addLog } = useNotificationDispatch();

  const { chatHistory, pendingChanges, history: bibleHistory } = sync;

  const [activeCategory, setActiveCategory] = useState<'CANON' | 'PLAN' | 'NEXUS' | 'HISTORY'>(
    ['characters', 'world'].includes(activeTab) ? 'CANON' : 
    ['grandArc', 'foreshadowing', 'timeline'].includes(activeTab) ? 'PLAN' : 
    activeTab === 'history' ? 'HISTORY' : 'NEXUS'
  );
  const [input, setInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const [showArchitectMobile, setShowArchitectMobile] = useState(false);
  const [expandedOpId, setExpandedOpId] = useState<string | null>(null);
  const [nexusHypothesis, setNexusHypothesis] = useState('');
  const [isSimulating, setIsSimulating] = useState(false);
  const [isSyncDetecting, setIsSyncDetecting] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatHistory, pendingChanges]);

  const handleSendMessage = useCallback(async (customMessage?: string) => {
    const textToSend = customMessage || input.trim();
    if (!textToSend || isChatting) return;
    
    if (!customMessage) setInput('');
    setIsChatting(true);
    
    try {
      const detectionPromise = detectSettingChange(textToSend, (usage: any) => metaDispatch({ type: 'TRACK_USAGE', payload: usage }), addLog);

      const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: textToSend, timestamp: Date.now() };
      const historyWithUser = [...(chatHistory || []), userMsg];
      syncDispatch({ type: 'SET_CHAT_HISTORY', payload: historyWithUser });
      
      const { text, sources } = await chatWithArchitect(
        historyWithUser.map(m => ({ role: m.role, parts: [{ text: m.content }] })),
        textToSend, 
        { meta, bible, chapters: [], sync } as any, 
        true, 
        (usage) => metaDispatch({ type: 'TRACK_USAGE', payload: usage }), 
        addLog
      );
      
      const botMsg: ChatMessage = { id: (Date.now()+1).toString(), role: 'model', content: text, timestamp: Date.now(), sources };
      const finalHistory = [...historyWithUser, botMsg];
      syncDispatch({ type: 'SET_CHAT_HISTORY', payload: finalHistory });

      setIsSyncDetecting(true);
      const detection = await detectionPromise;
      if (detection.hasChangeIntent) {
        addLog('info', 'NeuralSync', `意図を検出しました: ${detection.instructionSummary}`);
        const ops = await extractSettingsFromChat(finalHistory, { meta, bible, sync } as any, detection, (usage: any) => metaDispatch({ type: 'TRACK_USAGE', payload: usage }), addLog);
        if (ops.length > 0) {
          syncDispatch({ type: 'ADD_PENDING_OPS', payload: ops });
          addLog('success', 'NeuralSync', `${ops.length}件の同期提案を生成しました。`);
        }
      }
    } catch (err: any) { 
      addLog('error', 'Architect', err.message); 
    } finally { 
      setIsChatting(false); 
      setIsSyncDetecting(false);
    }
  }, [input, isChatting, chatHistory, meta, bible, sync, metaDispatch, syncDispatch, addLog]);

  useEffect(() => {
    if (pendingMsg && !isChatting) {
      handleSendMessage(pendingMsg);
      setPendingMsg(null);
    }
  }, [pendingMsg, isChatting, handleSendMessage, setPendingMsg]);

  const handleAcceptOp = (op: SyncOperation) => {
    try {
      const { nextBible, historyEntry } = calculateSyncResult(bible, op);
      bibleDispatch({ type: 'APPLY_SYNC_OP', payload: { nextBible, historyEntry } });
      syncDispatch({ type: 'REMOVE_PENDING_OP', id: op.id });
      syncDispatch({ type: 'ADD_HISTORY_ENTRY', payload: historyEntry });
      addLog('success', 'NeuralSync', `設定「${historyEntry.targetName}」を更新しました。`);
    } catch (e) {
      addLog('error', 'NeuralSync', '適用に失敗しました。');
    }
  };

  const handleUndo = (h: HistoryEntry) => {
    try {
      const nextBible = calculateRevertResult(bible, h);
      bibleDispatch({ type: 'UNDO_BIBLE', payload: { nextBible } });
      syncDispatch({ type: 'REMOVE_HISTORY_ENTRY', id: h.id });
      addLog('info', 'NeuralSync', `${h.targetName}への変更を復元しました。`);
    } catch (e) {
      addLog('error', 'NeuralSync', '復元に失敗しました。');
    }
  };

  const handleSimulate = async () => {
    if (!nexusHypothesis.trim() || isSimulating) return;
    setIsSimulating(true);
    try {
      const branch = await simulateBranch(nexusHypothesis, { meta, bible, sync } as any, (usage: any) => metaDispatch({ type: 'TRACK_USAGE', payload: usage }), addLog);
      bibleDispatch({ type: 'UPDATE_BIBLE', payload: { nexusBranches: [branch, ...(bible.nexusBranches || [])] } });
      setNexusHypothesis('');
      addLog('success', 'Nexus', 'シミュレーション完了');
    } catch (e) {
      addLog('error', 'Nexus', 'シミュレーションに失敗しました。');
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-stone-950 overflow-hidden relative">
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Architect Chat Sidebar */}
        <aside className={`fixed inset-0 z-[110] md:relative md:inset-auto md:z-auto w-full md:w-80 glass border-r border-white/5 flex flex-col h-full shrink-0 transform transition-transform duration-300 ${showArchitectMobile ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
          <div className="p-6 border-b border-white/5 flex justify-between bg-stone-900/50">
            <h3 className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Architect Chat</h3>
            <button className="md:hidden p-2 text-stone-500 hover:text-white" onClick={() => setShowArchitectMobile(false)}><X size={20}/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {chatHistory?.map(m => (
              <div key={m.id} className={`max-w-[90%] p-4 rounded-2xl text-[12px] font-serif leading-relaxed animate-fade-in ${m.role === 'user' ? 'bg-orange-600 text-white ml-auto' : 'glass-bright text-stone-200'}`}>
                {m.content}
              </div>
            ))}
            {isChatting && (
              <div className="glass-bright p-4 rounded-2xl max-w-[90%] flex gap-3 items-center animate-pulse">
                <Loader2 size={14} className="animate-spin text-orange-400"/>
                <span className="text-[9px] font-black text-stone-500 uppercase tracking-widest">Architect Thinking...</span>
              </div>
            )}
            {pendingChanges.length > 0 && (
              <div className="space-y-3 mt-8">
                <div className="flex items-center justify-between px-2">
                  <span className="text-[9px] font-black text-stone-600 uppercase tracking-widest">NeuralSync 提案</span>
                  <span className="bg-orange-500 text-[8px] font-black text-stone-950 px-1.5 py-0.5 rounded-full">{pendingChanges.length}</span>
                </div>
                {pendingChanges.map(op => (
                  <ProposalItem 
                    key={op.id} op={op} bible={bible}
                    isExpanded={expandedOpId === op.id} 
                    onToggle={() => setExpandedOpId(expandedOpId === op.id ? null : op.id)}
                    onAccept={() => handleAcceptOp(op)}
                    onReject={() => syncDispatch({ type: 'REMOVE_PENDING_OP', id: op.id })}
                  />
                ))}
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="p-4 bg-stone-900/40 border-t border-white/5 space-y-3 pb-safe">
            <textarea 
              value={input} onChange={e => setInput(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())} 
              className="w-full bg-stone-950 border border-white/10 rounded-2xl p-4 text-[13px] h-20 md:h-24 outline-none font-serif resize-none focus:border-orange-500/50 transition-all text-stone-200" 
              placeholder="設計士と物語を練る..." 
            />
            <button onClick={() => handleSendMessage()} disabled={isChatting} className="w-full py-4 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-orange-950/20">
              {isChatting ? <Loader2 size={16} className="animate-spin" /> : <ArrowUpRight size={18} />}
              <span className="text-[10px] font-black uppercase tracking-widest">送信</span>
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col h-full bg-stone-950/50">
          <div className="flex items-center glass border-b border-white/5 shrink-0 overflow-x-auto no-scrollbar scroll-smooth">
            <button onClick={() => setShowArchitectMobile(true)} className="md:hidden p-5 text-orange-400 border-r border-white/5 shrink-0"><Menu size={20}/></button>
            <CatBtn active={activeCategory === 'CANON'} onClick={() => { setActiveCategory('CANON'); setActiveTab('characters'); }} label="世界の理" icon={<Globe size={16}/>} />
            <CatBtn active={activeCategory === 'PLAN'} onClick={() => { setActiveCategory('PLAN'); setActiveTab('grandArc'); }} label="物語の計画" icon={<Target size={16}/>} />
            <CatBtn active={activeCategory === 'NEXUS'} onClick={() => { setActiveCategory('NEXUS'); setActiveTab('nexus'); }} label="Nexus" icon={<Beaker size={16}/>} />
            <CatBtn active={activeCategory === 'HISTORY'} onClick={() => { setActiveCategory('HISTORY'); setActiveTab('history'); }} label="履歴" icon={<History size={16}/>} />
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 max-w-7xl mx-auto pb-12">
                {bible.characters.map(c => <CharacterCard key={c.id} character={c} />)}
                <button onClick={() => handleSendMessage('新しい主要キャラクターを登場させたいです')} className="min-h-[200px] md:min-h-[300px] border-2 border-dashed border-stone-800 rounded-[2rem] flex flex-col items-center justify-center gap-4 text-stone-700 hover:text-stone-500 hover:border-orange-500/30 transition-all group">
                  <div className="w-12 h-12 md:w-16 md:h-16 bg-stone-900 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Plus size={24}/>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest">人物を追加</span>
                </button>
              </div>
            )}
            {activeTab === 'world' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-6xl mx-auto pb-12">
                {bible.entries.map(e => <EntryCard key={e.id} entry={e} />)}
              </div>
            )}
            {activeTab === 'grandArc' && (
              <div className="max-w-4xl mx-auto space-y-8 py-6 pb-20">
                <div className="space-y-2">
                  <h3 className="text-2xl md:text-3xl font-display font-black text-white italic tracking-tight uppercase">The Grand Arc</h3>
                </div>
                <textarea 
                  value={bible.grandArc} 
                  onChange={e => bibleDispatch({ type: 'UPDATE_BIBLE', payload: { grandArc: e.target.value } })} 
                  className="w-full bg-stone-900/30 border border-white/5 rounded-[1.5rem] md:rounded-[2rem] p-6 md:p-10 text-[15px] md:text-lg font-serif leading-relaxed text-stone-300 min-h-[400px] md:min-h-[600px] outline-none shadow-inner focus:border-orange-500/30 transition-all" 
                />
              </div>
            )}
            {activeTab === 'nexus' && (
              <div className="max-w-5xl mx-auto space-y-12 pb-20">
                <div className="glass-bright p-8 md:p-10 rounded-[2rem] md:rounded-[3rem] border border-orange-500/20 space-y-6 md:space-y-8 shadow-2xl">
                  <Beaker size={24} className="text-orange-400" />
                  <textarea 
                    value={nexusHypothesis} onChange={e => setNexusHypothesis(e.target.value)}
                    placeholder="例：もし主人公がここで敗北していたら？"
                    className="w-full bg-stone-950/50 border border-white/10 rounded-2xl p-6 text-sm font-serif text-stone-200 h-32 outline-none"
                  />
                  <button onClick={handleSimulate} disabled={isSimulating} className="w-full py-5 bg-orange-600 text-white rounded-2xl font-black uppercase tracking-widest">シミュレーション開始</button>
                </div>
              </div>
            )}
            {activeTab === 'history' && (
              <div className="max-w-4xl mx-auto space-y-4 pb-20">
                 <div className="flex items-center justify-between mb-8">
                   <h3 className="text-xl md:text-2xl font-display font-black text-white italic tracking-tight uppercase">History</h3>
                   <span className="text-[10px] font-black text-stone-600 uppercase tracking-widest">V{bible.version}</span>
                 </div>
                 {bibleHistory.length === 0 ? (
                   <div className="p-20 text-center text-stone-700 italic font-serif">変更履歴はまだありません。</div>
                 ) : (
                   bibleHistory.map((h, i) => (
                     <div key={h.id} className="glass-bright p-5 md:p-6 rounded-2xl md:rounded-3xl border border-white/5 flex items-center justify-between gap-4 animate-fade-in group hover:border-orange-500/20 transition-all">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-stone-900 flex items-center justify-center text-orange-500 text-[9px] md:text-[10px] font-mono shrink-0">V{h.versionAtCommit}</div>
                          <div className="min-w-0">
                             <div className="text-[11px] md:text-[12px] font-bold text-stone-200 truncate">{h.targetName} <span className="text-stone-600 font-black ml-1 uppercase text-[8px] tracking-widest">{h.opType}</span></div>
                             <div className="text-[9px] text-stone-500 truncate mt-0.5">{new Date(h.timestamp).toLocaleString()}</div>
                          </div>
                        </div>
                        <button onClick={() => handleUndo(h)} className="p-3 bg-stone-800 text-stone-500 hover:bg-rose-600 hover:text-white rounded-xl transition-all active:scale-95 group/undo">
                          <Undo2 size={16} />
                        </button>
                     </div>
                   ))
                 )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ProposalItem = React.memo(({ op, bible, isExpanded, onToggle, onAccept, onReject }: any) => {
  const currentValue = getCurrentValueForDiff(bible, op.path, op.targetName, op.field);
  return (
    <div className={`glass-bright rounded-2xl border transition-all ${isExpanded ? 'border-orange-500/40 shadow-2xl' : 'border-white/5'}`}>
      <button onClick={onToggle} className="w-full p-4 flex items-center justify-between text-left">
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[7px] font-black text-orange-400 bg-orange-400/10 px-1.5 py-0.5 rounded uppercase">{op.path}</span>
            <span className="text-[7px] font-black text-stone-500 uppercase">{op.op}</span>
          </div>
          <div className="text-[11px] font-bold text-stone-100 truncate">{op.targetName} {op.field && <span className="text-stone-600 ml-1">({op.field})</span>}</div>
        </div>
        {isExpanded ? <ChevronUp size={14} className="text-stone-600"/> : <ChevronDown size={14} className="text-stone-600"/>}
      </button>
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 animate-fade-in border-t border-white/5 pt-4 overflow-hidden">
          <div className="space-y-3">
             <span className="text-[8px] font-black text-stone-600 uppercase tracking-widest">変更のプレビュー (Diff)</span>
             <VisualDiff oldVal={currentValue} newVal={op.value} />
          </div>
          <div className="p-3 bg-stone-950/40 rounded-xl space-y-2">
            <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">アーキテクトの論理</span>
            <p className="text-[10px] text-stone-400 font-serif italic leading-relaxed">{op.rationale}</p>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={onReject} className="flex-1 py-3 bg-stone-800 text-stone-400 hover:text-white rounded-xl text-[9px] font-black uppercase transition-colors"><X size={14}/></button>
            <button onClick={onAccept} className="flex-1 py-3 bg-orange-600 text-white rounded-xl text-[9px] font-black uppercase shadow-lg shadow-orange-950/20 active:scale-95 flex items-center justify-center gap-2">適用する <ArrowRight size={14}/></button>
          </div>
        </div>
      )}
    </div>
  );
});

const VisualDiff = React.memo(({ oldVal, newVal }: { oldVal: any, newVal: any }) => {
  const formatValue = (v: any) => {
    if (v === null || v === undefined) return "---";
    if (typeof v === 'string') return v;
    if (typeof v === 'object') {
       const keys = Object.keys(v);
       if (keys.length === 1) return String(v[keys[0]]);
       return JSON.stringify(v, null, 2);
    }
    return String(v);
  };
  const oldStr = formatValue(oldVal);
  const newStr = formatValue(newVal);
  return (
    <div className="grid grid-cols-1 gap-2">
      {oldStr !== "---" && (
        <div className="p-3 bg-rose-500/5 border border-rose-500/10 rounded-xl">
           <div className="text-[8px] font-black text-rose-500 uppercase mb-1">Before</div>
           <p className="text-[10px] font-serif text-stone-500 line-through leading-relaxed">{oldStr}</p>
        </div>
      )}
      <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
         <div className="text-[8px] font-black text-emerald-500 uppercase mb-1">After</div>
         <p className="text-[10px] font-serif text-stone-200 leading-relaxed">{newStr}</p>
      </div>
    </div>
  );
});

const CharacterCard = React.memo(({ character: c }: any) => (
  <div className="glass-bright rounded-[2rem] md:rounded-[2.5rem] overflow-hidden border border-white/5 flex flex-col h-full hover:border-orange-500/20 transition-all shadow-xl">
    <div className="aspect-[16/10] bg-stone-900 relative">
      {c.imageUrl && <img src={c.imageUrl} className="w-full h-full object-cover" />}
      <div className="absolute bottom-4 left-6 md:bottom-6 md:left-8"><h4 className="text-xl md:text-2xl font-display font-black text-white italic">{c.name}</h4></div>
    </div>
    <div className="p-6 md:p-8 space-y-4 md:space-y-6">
      <p className="text-[10px] md:text-[11px] text-stone-400 font-serif leading-relaxed line-clamp-3">{c.description}</p>
    </div>
  </div>
));

const EntryCard = React.memo(({ entry: e }: any) => (
  <div className="glass-bright p-6 md:p-8 rounded-[1.5rem] md:rounded-[2rem] border border-white/5 hover:border-white/10 transition-all space-y-4">
    <h4 className="text-base md:text-lg font-serif-bold text-stone-100">{e.title}</h4>
    <p className="text-[11px] md:text-[12px] text-stone-400 font-serif leading-relaxed line-clamp-3">{e.content}</p>
  </div>
));

const CatBtn = React.memo(({ active, label, icon, onClick }: any) => (
  <button onClick={onClick} className={`flex items-center gap-2 px-6 py-4 md:px-8 md:py-5 transition-all border-b-2 shrink-0 ${active ? 'text-orange-400 border-orange-400 bg-orange-400/5' : 'text-stone-600 border-transparent hover:text-stone-400'}`}>
     {icon} <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest">{label}</span>
  </button>
));

const SubTab = React.memo(({ id, active, label, icon: Icon, onClick }: any) => (
  <button onClick={() => onClick(id)} className={`px-4 py-2 md:px-5 md:py-2.5 rounded-xl flex items-center gap-2 text-[9px] md:text-[10px] font-black uppercase transition-all shrink-0 ${active ? 'bg-orange-600 text-white' : 'text-stone-500 bg-stone-900/60'}`}>
    <Icon size={14} /> {label}
  </button>
));

export default React.memo(PlotterView);
