
import { 
  Users, Globe, ArrowUpRight, Target, 
  Plus, Loader2, Menu, Anchor, History,
  X, Beaker, Undo2, BrainCircuit,
  Clock, AlertCircle, CheckCircle2, Zap
} from 'lucide-react';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage, SyncOperation, HistoryEntry, Character, WorldEntry, GeminiContent, TimelineEvent, Foreshadowing, ProjectDomain } from '../types';
import { chatWithArchitect, extractSettingsFromChat, detectSettingChange, simulateBranch, generateCharacterPortrait } from '../services/geminiService';
import { 
  useBible, useNeuralSync, useUI, useMetadata, 
  useMetadataDispatch, useBibleDispatch, useNeuralSyncDispatch, 
  useUIDispatch, useNotificationDispatch 
} from '../contexts/StoryContext';
import * as Actions from '../store/actions';
import { calculateSyncResult, calculateRevertResult } from '../services/bibleManager';
import { savePortrait } from '../services/storageService';
import { CharacterCard } from './plotter/CharacterCard';
import { ProposalItem } from './plotter/ProposalItem';

const PlotterView: React.FC = () => {
  const meta = useMetadata();
  const metaDispatch = useMetadataDispatch();
  const bible = useBible();
  const bibleDispatch = useBibleDispatch();
  const sync = useNeuralSync();
  const syncDispatch = useNeuralSyncDispatch();
  
  const ui = useUI();
  const uiDispatch = useUIDispatch();
  const { plotterTab: activeTab, pendingMsg } = ui;
  const { addLog } = useNotificationDispatch();

  const { chatHistory, pendingChanges, history: bibleHistory } = sync;

  const [activeCategory, setActiveCategory] = useState<'CANON' | 'PLAN' | 'NEXUS' | 'HISTORY'>(
    ['characters', 'world'].includes(activeTab) ? 'CANON' : 
    ['grandArc', 'foreshadowing', 'timeline'].includes(activeTab) ? 'PLAN' : 
    activeTab === 'history' ? 'HISTORY' : 'NEXUS'
  );
  const [input, setInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const [activeDomains, setActiveDomains] = useState<ProjectDomain[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showArchitectMobile, setShowArchitectMobile] = useState(false);
  const [expandedOpId, setExpandedOpId] = useState<string | null>(null);
  const [nexusHypothesis, setNexusHypothesis] = useState('');
  const [isSimulating, setIsSimulating] = useState(false);
  const [generatingPortraits, setGeneratingPortraits] = useState<Set<string>>(new Set());

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatHistory, pendingChanges]);

  const handleSendMessage = useCallback(async (customMessage?: string) => {
    const textToSend = customMessage || input.trim();
    if (!textToSend || isChatting) return;
    
    if (!customMessage) setInput('');
    setIsChatting(true);
    setIsAnalyzing(false);
    setActiveDomains([]);
    
    try {
      const logCb = (type: any, source: any, msg: any, detail?: any) => addLog(type, source, msg, detail);
      const usageCb = (usage: any) => metaDispatch(Actions.trackUsage(usage));

      // 1. 意図検出を先行
      const detectionPromise = detectSettingChange(textToSend, usageCb, logCb);

      const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: textToSend, timestamp: Date.now() };
      const historyWithUser = [...(chatHistory || []), userMsg];
      syncDispatch(Actions.setChatHistory(historyWithUser));
      
      const geminiHistory: GeminiContent[] = historyWithUser.map(m => ({
        role: m.role,
        parts: [{ text: m.content }]
      }));

      // 2. アーキテクトとの対話
      const { text, sources } = await chatWithArchitect(
        geminiHistory,
        textToSend, 
        { meta, bible, chapters: [], sync } as any, 
        true, 
        usageCb, 
        logCb
      );
      
      const botMsg: ChatMessage = { id: (Date.now()+1).toString(), role: 'model', content: text, timestamp: Date.now(), sources };
      const finalHistory = [...historyWithUser, botMsg];
      syncDispatch(Actions.setChatHistory(finalHistory));

      // 3. 意図があれば、ドメインベースで一括抽出
      const detection = await detectionPromise;
      if (detection.hasChangeIntent) {
        setIsAnalyzing(true);
        setActiveDomains(detection.domains);
        addLog('info', 'NeuralSync', `物語ドメインを分析中: ${detection.domains.join(', ')}`);
        
        const finalGeminiHistory: GeminiContent[] = finalHistory.map(m => ({
          role: m.role,
          parts: [{ text: m.content }]
        }));

        const ops = await extractSettingsFromChat(finalGeminiHistory, { meta, bible, sync } as any, detection, usageCb, logCb);
        if (ops.length > 0) {
          syncDispatch(Actions.addPendingOps(ops.map(op => ({ ...op, domain: detection.domains[0] }))));
          addLog('success', 'NeuralSync', `${ops.length}件の同期提案を生成しました。`);
        }
        setIsAnalyzing(false);
        setActiveDomains([]);
      }
    } catch (err: any) { 
      addLog('error', 'Architect', err.message); 
      setIsAnalyzing(false);
    } finally { 
      setIsChatting(false); 
    }
  }, [input, isChatting, chatHistory, meta, bible, sync, metaDispatch, syncDispatch, addLog]);

  useEffect(() => {
    if (pendingMsg && !isChatting) {
      handleSendMessage(pendingMsg);
      uiDispatch(Actions.setPendingMsg(null));
    }
  }, [pendingMsg, isChatting, handleSendMessage, uiDispatch]);

  const handleAcceptOp = (op: SyncOperation) => {
    try {
      const { nextBible, historyEntry } = calculateSyncResult(bible, op);
      bibleDispatch(Actions.applySyncOp(nextBible, historyEntry));
      syncDispatch(Actions.removePendingOp(op.id));
      syncDispatch(Actions.addHistoryEntry(historyEntry));
      addLog('success', 'NeuralSync', `設定「${historyEntry.targetName}」を更新しました。`);
    } catch (e) {
      addLog('error', 'NeuralSync', '適用に失敗しました。');
    }
  };

  const handleUndo = (h: HistoryEntry) => {
    try {
      const nextBible = calculateRevertResult(bible, h);
      bibleDispatch(Actions.undoBible(nextBible));
      syncDispatch(Actions.removeHistoryEntry(h.id));
      addLog('info', 'NeuralSync', `${h.targetName}への変更を復元しました。`);
    } catch (e) {
      addLog('error', 'NeuralSync', '復元に失敗しました。');
    }
  };

  const handleSimulate = async () => {
    if (!nexusHypothesis.trim() || isSimulating) return;
    setIsSimulating(true);
    try {
      const logCb = (type: any, source: any, msg: any, detail?: any) => addLog(type, source, msg, detail);
      const usageCb = (usage: any) => metaDispatch(Actions.trackUsage(usage));
      
      const branch = await simulateBranch(nexusHypothesis, { meta, bible, sync } as any, usageCb, logCb);
      bibleDispatch(Actions.updateBible({ nexusBranches: [branch, ...(bible.nexusBranches || [])] }));
      setNexusHypothesis('');
      addLog('success', 'Nexus', 'シミュレーション完了');
    } catch (e) {
      addLog('error', 'Nexus', 'シミュレーションに失敗しました。');
    } finally {
      setIsSimulating(false);
    }
  };

  const handleGeneratePortrait = async (char: Character) => {
    if (generatingPortraits.has(char.id)) return;
    setGeneratingPortraits(prev => new Set(prev).add(char.id));
    addLog('info', 'Artist', `${char.name} の肖像画を描いています...`);
    try {
      const logCb = (type: any, source: any, msg: any, detail?: any) => addLog(type, source, msg, detail);
      const usageCb = (usage: any) => metaDispatch(Actions.trackUsage(usage));

      const base64 = await generateCharacterPortrait(
        `${char.name}, ${char.description}, ${char.personality}`,
        usageCb,
        logCb
      );
      await savePortrait(char.id, base64);
      bibleDispatch(Actions.updateBible({
        characters: bible.characters.map(c => c.id === char.id ? { ...c, imageUrl: base64 } : c)
      }));
      addLog('success', 'Artist', `${char.name} の肖像画が完成しました。`);
    } catch (e) {
      addLog('error', 'Artist', '画像の生成に失敗しました。');
    } finally {
      setGeneratingPortraits(prev => {
        const next = new Set(prev);
        next.delete(char.id);
        return next;
      });
    }
  };

  const setActiveTab = (tab: string) => uiDispatch(Actions.setPlotterTab(tab));

  return (
    <div className="h-full flex flex-col bg-stone-950 overflow-hidden relative">
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Architect Chat Sidebar */}
        <aside className={`fixed inset-0 z-[110] md:relative md:inset-auto md:z-auto w-full md:w-80 glass border-r border-white/5 flex flex-col h-full shrink-0 transform transition-transform duration-300 ${showArchitectMobile ? 'translate-x-0' : '-translate-x-full md:relative md:translate-x-0'}`}>
          <div className="p-6 border-b border-white/5 flex justify-between bg-stone-900/50">
            <h3 className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Architect Chat</h3>
            <button className="md:hidden p-2 text-stone-500 hover:text-white" onClick={() => setShowArchitectMobile(false)}><X size={20}/></button>
          </div>
          
          {/* Neural Sync Status Bar */}
          {(isAnalyzing || isChatting) && (
            <div className="bg-orange-500/10 border-b border-orange-500/20 px-4 py-2 flex items-center gap-3 animate-fade-in">
              <div className="relative">
                <BrainCircuit size={14} className="text-orange-400 animate-pulse" />
                {isAnalyzing && <Zap size={8} className="absolute -top-1 -right-1 text-orange-200 animate-bounce" />}
              </div>
              <div className="flex-1">
                <div className="text-[8px] font-black text-orange-400 uppercase tracking-widest">
                  {isAnalyzing ? "NeuralSync Analysis" : "Architect Reasoning"}
                </div>
                <div className="flex gap-1.5 mt-0.5">
                  {activeDomains.map(d => (
                    <span key={d} className="text-[6px] font-bold bg-orange-500/20 text-orange-300 px-1 rounded-sm uppercase">{d}</span>
                  ))}
                  {activeDomains.length === 0 && <div className="h-1 w-12 bg-orange-500/20 rounded-full overflow-hidden"><div className="h-full bg-orange-500 animate-[loading_1s_infinite]" /></div>}
                </div>
              </div>
            </div>
          )}

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
                    onReject={() => syncDispatch(Actions.removePendingOp(op.id))}
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
                 <SubTab id="timeline" active={activeTab === 'timeline'} onClick={setActiveTab} label="年表" icon={Clock}/>
               </>
             )}
          </div>
          <div className="flex-1 overflow-y-auto p-6 md:p-12 custom-scrollbar">
            {activeTab === 'characters' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 max-w-7xl mx-auto pb-12">
                {bible.characters.map(c => (
                  <CharacterCard 
                    key={c.id} 
                    character={c} 
                    onGeneratePortrait={() => handleGeneratePortrait(c)} 
                    isGenerating={generatingPortraits.has(c.id)}
                  />
                ))}
                <AddButton onClick={() => handleSendMessage('新しい主要キャラクターを登場させたいです')} label="人物を追加" />
              </div>
            )}
            {activeTab === 'world' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-6xl mx-auto pb-12">
                {bible.entries.map(e => <EntryCard key={e.id} entry={e} />)}
                <AddButton onClick={() => handleSendMessage('新しい用語や歴史背景を設定したいです')} label="項目を追加" />
              </div>
            )}
            {activeTab === 'grandArc' && (
              <div className="max-w-4xl mx-auto space-y-8 py-6 pb-20">
                <div className="space-y-2">
                  <h3 className="text-2xl md:text-3xl font-display font-black text-white italic tracking-tight uppercase">The Grand Arc</h3>
                </div>
                <textarea 
                  value={bible.grandArc} 
                  onChange={e => bibleDispatch(Actions.updateBible({ grandArc: e.target.value }))} 
                  className="w-full bg-stone-900/30 border border-white/5 rounded-[1.5rem] md:rounded-[2rem] p-6 md:p-10 text-[15px] md:text-lg font-serif-bold leading-relaxed text-stone-300 min-h-[400px] md:min-h-[600px] outline-none shadow-inner focus:border-orange-500/30 transition-all" 
                />
              </div>
            )}
            {activeTab === 'foreshadowing' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto pb-12">
                {bible.foreshadowing.map(f => <ForeshadowingCard key={f.id} f={f} />)}
                <AddButton onClick={() => handleSendMessage('新しい謎や伏線を配置したいです')} label="伏線を追加" />
              </div>
            )}
            {activeTab === 'timeline' && (
              <div className="max-w-4xl mx-auto py-10 relative">
                <div className="absolute left-[31px] md:left-[39px] top-0 bottom-0 w-px bg-stone-800 border-dashed border-l" />
                <div className="space-y-12">
                   {bible.timeline.sort((a, b) => (a.timeLabel > b.timeLabel ? 1 : -1)).map((ev, idx) => (
                     <TimelineItem key={ev.id} event={ev} isFirst={idx === 0} />
                   ))}
                   <AddButton onClick={() => handleSendMessage('年表に新しい歴史的イベントを追加したいです')} label="イベント追加" variant="timeline" />
                </div>
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
                <div className="space-y-6">
                  {bible.nexusBranches.map(branch => (
                    <div key={branch.id} className="glass p-8 rounded-3xl border border-white/5 space-y-4">
                      <div className="flex items-center gap-3 text-orange-400 font-display italic font-bold">
                        <ArrowUpRight size={18}/> {branch.hypothesis}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                        <div className="space-y-2">
                          <span className="text-[9px] font-black text-stone-600 uppercase">Canon Impact</span>
                          <p className="text-[12px] text-stone-300 font-serif">{branch.impactOnCanon}</p>
                        </div>
                        <div className="space-y-2">
                          <span className="text-[9px] font-black text-stone-600 uppercase">State Impact</span>
                          <p className="text-[12px] text-stone-300 font-serif">{branch.impactOnState}</p>
                        </div>
                      </div>
                    </div>
                  ))}
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
                   bibleHistory.map((h) => (
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
      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};

const AddButton = ({ onClick, label, variant = 'card' }: { onClick: () => void, label: string, variant?: 'card' | 'timeline' }) => (
  <button onClick={onClick} className={`${variant === 'timeline' ? 'ml-0 md:ml-1 mt-6' : 'min-h-[200px] md:min-h-[300px] border-2 border-dashed'} border-stone-800 rounded-[2rem] flex flex-col items-center justify-center gap-4 text-stone-700 hover:text-stone-500 hover:border-orange-500/30 transition-all group w-full`}>
    <div className="w-12 h-12 md:w-16 md:h-16 bg-stone-900 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
      <Plus size={24}/>
    </div>
    <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
  </button>
);

// Explicitly type components as React.FC to allow 'key' prop when used in JSX maps
const TimelineItem: React.FC<{ event: TimelineEvent, isFirst: boolean }> = ({ event, isFirst }) => (
  <div className="flex gap-6 md:gap-10 animate-fade-in group">
    <div className="relative z-10">
      <div className={`w-16 h-16 md:w-20 md:h-20 rounded-full glass border-2 flex flex-col items-center justify-center transition-all ${event.importance === 'Climax' ? 'border-orange-500 text-orange-500' : 'border-stone-700 text-stone-500'}`}>
        <span className="text-[8px] font-black uppercase tracking-tighter text-center leading-none mb-1">{event.timeLabel}</span>
        <Clock size={16} />
      </div>
    </div>
    <div className="flex-1 pb-10">
      <div className="glass-bright p-6 md:p-8 rounded-[1.5rem] md:rounded-[2rem] border border-white/5 hover:border-white/10 transition-all space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-base md:text-xl font-serif-bold text-stone-100">{event.event}</h4>
          <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${event.importance === 'Climax' ? 'bg-orange-600 text-white' : 'bg-stone-800 text-stone-500'}`}>{event.importance}</span>
        </div>
        <p className="text-[12px] text-stone-400 font-serif leading-relaxed">{event.description}</p>
      </div>
    </div>
  </div>
);

// Explicitly type components as React.FC to allow 'key' prop when used in JSX maps
const ForeshadowingCard: React.FC<{ f: Foreshadowing }> = ({ f }) => (
  <div className="glass-bright p-6 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] border border-white/5 hover:border-white/10 transition-all space-y-4 relative overflow-hidden group">
    <div className={`absolute top-0 left-0 w-1 h-full ${f.status === 'Open' ? 'bg-orange-500' : f.status === 'Resolved' ? 'bg-emerald-500' : 'bg-stone-700'}`} />
    <div className="flex justify-between items-start">
      <div className={`p-2 rounded-xl ${f.status === 'Open' ? 'bg-orange-500/10 text-orange-400' : f.status === 'Resolved' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-stone-800 text-stone-500'}`}>
        {f.status === 'Resolved' ? <CheckCircle2 size={16}/> : <AlertCircle size={16}/>}
      </div>
      <span className={`text-[8px] font-black uppercase tracking-widest ${f.priority === 'Critical' ? 'text-rose-500' : 'text-stone-600'}`}>{f.priority} PRIORITY</span>
    </div>
    <h4 className="text-base md:text-lg font-serif-bold text-stone-100">{f.title}</h4>
    <p className="text-[11px] md:text-[12px] text-stone-400 font-serif leading-relaxed line-clamp-3">{f.description}</p>
    <div className="pt-4 flex items-center justify-between border-t border-white/5">
      <span className="text-[8px] font-black text-stone-600 uppercase tracking-widest">{f.status}</span>
    </div>
  </div>
);

const EntryCard = React.memo(({ entry: e }: { entry: WorldEntry }) => (
  <div className="glass-bright p-6 md:p-8 rounded-[1.5rem] md:rounded-[2rem] border border-white/5 hover:border-white/10 transition-all space-y-4">
    <div className="flex items-center justify-between">
      <h4 className="text-base md:text-lg font-serif-bold text-stone-100">{e.title}</h4>
      <span className="text-[8px] font-black bg-stone-800 text-stone-500 px-2 py-1 rounded uppercase">{e.category}</span>
    </div>
    <p className="text-[11px] md:text-[12px] text-stone-400 font-serif leading-relaxed line-clamp-3">{e.content}</p>
    {e.tags?.length > 0 && (
      <div className="flex gap-2 flex-wrap pt-2">
        {e.tags.map(t => <span key={t} className="text-[8px] font-bold text-stone-600">#{t}</span>)}
      </div>
    )}
  </div>
));

interface CatBtnProps {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

const CatBtn = React.memo(({ active, label, icon, onClick }: CatBtnProps) => (
  <button onClick={onClick} className={`flex items-center gap-2 px-6 py-4 md:px-8 md:py-5 transition-all border-b-2 shrink-0 ${active ? 'text-orange-400 border-orange-400 bg-orange-400/5' : 'text-stone-600 border-transparent hover:text-stone-400'}`}>
     {icon} <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest">{label}</span>
  </button>
));

interface SubTabProps {
  id: string;
  active: boolean;
  label: string;
  icon: React.ElementType;
  onClick: (id: string) => void;
}

const SubTab = React.memo(({ id, active, label, icon: Icon, onClick }: SubTabProps) => (
  <button onClick={() => onClick(id)} className={`px-4 py-2 md:px-5 md:py-2.5 rounded-xl flex items-center gap-2 text-[9px] md:text-[10px] font-black uppercase transition-all shrink-0 ${active ? 'bg-orange-600 text-white' : 'text-stone-500 bg-stone-900/60'}`}>
    <Icon size={14} /> {label}
  </button>
));

export default React.memo(PlotterView);
