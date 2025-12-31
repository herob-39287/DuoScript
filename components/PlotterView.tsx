
import { 
  Users, Globe, ArrowUpRight, Target, 
  Plus, Loader2, Anchor, History,
  X, Beaker, Undo2, BrainCircuit,
  Clock, Zap, MessageSquare,
  ChevronRight, Layout, Check,
  Sparkles, Network, Book,
  Landmark, MapPin, Scale, Gem, User, Edit2, Save, Wand2, Send, Search, Trash2, GitBranch
} from 'lucide-react';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ChatMessage, SyncOperation, HistoryEntry, Character, WorldEntry, GeminiContent, ProjectDomain, ViewMode, ContextFocus } from '../types';
import { chatWithArchitect, extractSettingsFromChat, detectSettingChange, simulateBranch, generateCharacterPortrait, summarizeConversation } from '../services/geminiService';
import { 
  useNeuralSync, useUI, useMetadata, useManuscript,
  useMetadataDispatch, useBibleDispatch, useNeuralSyncDispatch, 
  useUIDispatch, useNotificationDispatch,
  useCharacters, useWorldFoundation, useGeography, usePlotPlan, useKnowledge, useBible
} from '../contexts/StoryContext';
import * as Actions from '../store/actions';
import { calculateSyncResult, calculateRevertResult, applySyncBatch } from '../services/bibleManager';
import { savePortrait } from '../services/storageService';
import { CharacterCard } from './plotter/CharacterCard';
import { ProposalItem } from './plotter/ProposalItem';
import { VisualDiff } from './plotter/VisualDiff';

const PlotterView: React.FC = () => {
  const meta = useMetadata();
  const metaDispatch = useMetadataDispatch();
  const bibleDispatch = useBibleDispatch();
  const chapters = useManuscript();
  const sync = useNeuralSync();
  const syncDispatch = useNeuralSyncDispatch();
  
  const characters = useCharacters();
  const foundation = useWorldFoundation();
  const geography = useGeography();
  const plot = usePlotPlan();
  const knowledge = useKnowledge();
  const bible = useBible(); 

  const ui = useUI();
  const uiDispatch = useUIDispatch();
  const { plotterTab: activeTab, pendingMsg } = ui;
  const { addLog } = useNotificationDispatch();

  const { chatHistory, archivedChat, conversationMemory, pendingChanges, history: bibleHistory } = sync;

  const displayHistory = useMemo(() => {
    return [...(archivedChat || []), ...chatHistory];
  }, [archivedChat, chatHistory]);

  const sortedPendingChanges = useMemo(() => {
    return [...pendingChanges].sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0));
  }, [pendingChanges]);

  const [activeCategory, setActiveCategory] = useState<'CANON' | 'PLAN' | 'NEXUS' | 'RELATIONS' | 'HISTORY' | 'QUARANTINE'>(
    ['characters', 'world'].includes(activeTab) ? 'CANON' : 
    ['grandArc', 'foreshadowing', 'timeline'].includes(activeTab) ? 'PLAN' : 
    activeTab === 'history' ? 'HISTORY' : 'NEXUS'
  );
  
  const [input, setInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const [isConsolidating, setIsConsolidating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showArchitectMobile, setShowArchitectMobile] = useState(false);
  const [expandedOpId, setExpandedOpId] = useState<string | null>(null);
  const [nexusHypothesis, setNexusHypothesis] = useState('');
  const [isSimulating, setIsSimulating] = useState(false);
  const [generatingPortraits, setGeneratingPortraits] = useState<Set<string>>(new Set());
  const [contextFocus, setContextFocus] = useState<ContextFocus>('AUTO');
  
  const [selectedThreadFilter, setSelectedThreadFilter] = useState<string>('ALL');

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { 
    if (showArchitectMobile || window.innerWidth >= 768) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [displayHistory, pendingChanges, showArchitectMobile]);

  const handleSendMessage = useCallback(async (customMessage?: string) => {
    const textToSend = customMessage || input.trim();
    if (!textToSend || isChatting) return;
    
    if (!customMessage) setInput('');
    setIsChatting(true);
    setIsAnalyzing(false);
    
    const logCb = (type: any, source: any, msg: any, detail?: any) => addLog(type, source, msg, detail);
    const usageCb = (usage: any) => metaDispatch(Actions.trackUsage(usage));

    let currentHistory = [...chatHistory];
    let currentMemory = conversationMemory || "";

    if (currentHistory.length >= 20) {
       setIsConsolidating(true);
       try {
         const archivedCount = 10;
         const toArchive = currentHistory.slice(0, archivedCount);
         const messagesToSummarize = toArchive.map(m => ({ role: m.role, parts: [{ text: m.content }] }));
         const newMemory = await summarizeConversation(currentMemory, messagesToSummarize, usageCb, logCb);
         syncDispatch(Actions.consolidateChat(newMemory, archivedCount));
         currentHistory = currentHistory.slice(archivedCount);
         currentMemory = newMemory;
         addLog('info', 'System', '長期記憶を更新し、古いログをアーカイブしました。');
       } catch (e) {
         console.error("Consolidation failed", e);
       } finally {
         setIsConsolidating(false);
       }
    }

    try {
      const detectionPromise = detectSettingChange(textToSend, usageCb, logCb);
      const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: textToSend, timestamp: Date.now() };
      const historyWithUser = [...currentHistory, userMsg];
      syncDispatch(Actions.setChatHistory(historyWithUser));

      const { text, sources } = await chatWithArchitect(
        historyWithUser.slice(-10).map(m => ({ role: m.role, parts: [{ text: m.content }] })),
        textToSend, 
        { meta, bible, chapters, sync } as any, 
        currentMemory,
        true, 
        contextFocus,
        usageCb, 
        logCb
      );
      
      const botMsg: ChatMessage = { id: (Date.now()+1).toString(), role: 'model', content: text, timestamp: Date.now(), sources };
      const finalHistory = [...historyWithUser, botMsg];
      syncDispatch(Actions.setChatHistory(finalHistory));

      const detection = await detectionPromise;
      if (detection.hasChangeIntent) {
        setIsAnalyzing(true);
        if (detection.isHypothetical) {
          addLog('info', 'NeuralSync', `IF世界線の可能性を分析中... (Nexus Mode)`);
        } else {
          addLog('info', 'NeuralSync', `正史の変更を同期中... (Canon Mode)`);
        }
        
        const extraction = await extractSettingsFromChat(
          finalHistory.slice(-7).map(m => ({ role: m.role, parts: [{ text: m.content }] })), 
          { meta, bible, chapters, sync } as any, 
          currentMemory,
          detection, 
          usageCb, 
          logCb
        );
        
        if (extraction.readyOps.length > 0) {
          syncDispatch(Actions.addPendingOps(extraction.readyOps));
          addLog('success', 'NeuralSync', `${extraction.readyOps.length}件の${detection.isHypothetical ? '仮説' : '設定'}提案を生成しました。`);
        }
        if (extraction.quarantineItems.length > 0) {
          syncDispatch(Actions.addQuarantineItems(extraction.quarantineItems));
          addLog('error', 'NeuralSync', `${extraction.quarantineItems.length}件の破損した提案を隔離しました。`);
        }
      }
    } catch (e: any) {
      addLog('error', 'Architect', '設計士との同期に失敗しました。');
    } finally {
      setIsChatting(false);
      setIsAnalyzing(false);
    }
  }, [input, isChatting, chatHistory, conversationMemory, meta, bible, chapters, sync, syncDispatch, metaDispatch, addLog, contextFocus]);

  useEffect(() => {
    if (pendingMsg) {
      handleSendMessage(pendingMsg);
      uiDispatch(Actions.setPendingMsg(null));
      if (window.innerWidth < 768) setShowArchitectMobile(true);
    }
  }, [pendingMsg, handleSendMessage, uiDispatch]);

  const commitChange = (op: SyncOperation) => {
    try {
      const { nextBible, nextChapters, historyEntry } = calculateSyncResult(bible, chapters, op, bibleHistory);
      bibleDispatch(Actions.applySyncOp(nextBible, nextChapters, historyEntry));
      syncDispatch(Actions.addHistoryEntry(historyEntry));
      syncDispatch(Actions.removePendingOp(op.id));
      addLog('success', 'NeuralSync', `設定 "${historyEntry.targetName}" を記録しました。`);
    } catch (e: any) {
      addLog('error', 'NeuralSync', '設定の記録に失敗しました。', e.message);
      syncDispatch(Actions.addQuarantineItems([{
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        rawText: JSON.stringify(op),
        error: `Semantic Logic Error: ${e.message}`,
        stage: 'SEMANTIC',
        partialOp: op
      }]));
      syncDispatch(Actions.removePendingOp(op.id));
    }
  };

  const commitAllChanges = () => {
    const readyOps = sortedPendingChanges.filter(op => op.status === 'proposal' && !op.isHypothetical);
    if (readyOps.length === 0) return;
    
    uiDispatch(Actions.openDialog({
      isOpen: true,
      type: 'confirm',
      title: '一括適用',
      message: `${readyOps.length}件の正史(Canon)提案をすべて反映させますか？`,
      onConfirm: () => {
        const result = applySyncBatch(bible, chapters, readyOps, bibleHistory);
        if (result.success && result.nextBible && result.nextChapters && result.historyEntries) {
          bibleDispatch(Actions.updateBible(result.nextBible));
          bibleDispatch(Actions.loadChapters(result.nextChapters));
          result.historyEntries.forEach(entry => syncDispatch(Actions.addHistoryEntry(entry)));
          readyOps.forEach(op => syncDispatch(Actions.removePendingOp(op.id)));
          addLog('success', 'NeuralSync', `${result.historyEntries.length}件の提案をすべて反映しました。`);
        } else if (result.failedOps) {
          addLog('error', 'NeuralSync', '一括適用に失敗しました。不整合な提案を個別に隔離します。');
          result.failedOps.forEach(({ op, error }) => {
            syncDispatch(Actions.addQuarantineItems([{
              id: crypto.randomUUID(),
              timestamp: Date.now(),
              rawText: JSON.stringify(op),
              error: `Transaction Fail: ${error}`,
              stage: 'SEMANTIC',
              partialOp: op
            }]));
            syncDispatch(Actions.removePendingOp(op.id));
          });
        }
      }
    }));
  };

  const handleRevert = (entry: HistoryEntry) => {
    uiDispatch(Actions.openDialog({
      isOpen: true,
      type: 'confirm',
      title: '歴史の改変',
      message: `"${entry.targetName}" への変更を取り消し、以前の状態（V${entry.versionAtCommit - 1}）に戻しますか？`,
      onConfirm: () => {
        const { nextBible, nextChapters } = calculateRevertResult(bible, chapters, entry);
        bibleDispatch(Actions.undoBible(nextBible, nextChapters));
        syncDispatch(Actions.removeHistoryEntry(entry.id));
        addLog('info', 'NeuralSync', `歴史を遡り、"${entry.targetName}" を復元しました。`);
      }
    }));
  };

  const handleNexusSim = async () => {
    if (!nexusHypothesis.trim() || isSimulating) return;
    setIsSimulating(true);
    addLog('info', 'Nexus', '因果の分岐を計算中...');
    try {
      const branch = await simulateBranch(nexusHypothesis, { meta, bible, chapters, sync } as any, (u) => metaDispatch(Actions.trackUsage(u)), addLog);
      bibleDispatch(Actions.updateBible({ nexusBranches: [branch, ...(knowledge.nexusBranches || [])] }));
      setNexusHypothesis('');
      addLog('success', 'Nexus', 'シミュレーションが完了しました。');
    } catch (e) {
      addLog('error', 'Nexus', 'シミュレーションに失敗しました。');
    } finally {
      setIsSimulating(false);
    }
  };

  const handleGenPortrait = async (c: Character) => {
    if (generatingPortraits.has(c.id)) return;
    setGeneratingPortraits(prev => new Set(prev).add(c.id));
    addLog('info', 'Artist', `${c.profile.name} の肖像画を生成中...`);
    try {
      const url = await generateCharacterPortrait(c, { meta, bible, chapters, sync } as any, (u) => metaDispatch(Actions.trackUsage(u)), addLog);
      await savePortrait(meta.id, c.id, url);
      const updatedChars = characters.map(char => char.id === c.id ? { ...char, imageUrl: c.id } : char);
      bibleDispatch(Actions.updateBible({ characters: updatedChars }));
      addLog('success', 'Artist', `${c.profile.name} の肖像画が完成しました。`);
    } catch (e) {
      addLog('error', 'Artist', '肖像画の生成に失敗しました。');
    } finally {
      setGeneratingPortraits(prev => {
        const next = new Set(prev);
        next.delete(c.id);
        return next;
      });
    }
  };

  return (
    <div className="h-full flex flex-col md:flex-row overflow-hidden bg-stone-950">
      {/* Settings / Plotter Side (Main on Desktop) */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-20 md:h-24 glass border-b border-white/5 flex items-center justify-between px-6 md:px-10 shrink-0 z-40">
           <div className="flex items-center gap-6">
             <div className="flex items-center gap-3">
               <div className="w-8 h-8 rounded-lg bg-orange-600/20 flex items-center justify-center text-orange-400">
                 <GitBranch size={20} />
               </div>
               <div>
                 <h2 className="text-xl font-display font-black text-white italic tracking-tight">Atelier Plotter</h2>
                 <p className="text-[9px] font-black text-stone-600 uppercase tracking-widest">Story Architecture Management</p>
               </div>
             </div>
           </div>
           <nav className="hidden lg:flex items-center gap-2">
             <TabBtn active={activeTab === 'grandArc'} onClick={() => uiDispatch(Actions.setPlotterTab('grandArc'))} icon={<Layout size={14}/>} label="Structure" />
             <TabBtn active={activeTab === 'characters'} onClick={() => uiDispatch(Actions.setPlotterTab('characters'))} icon={<Users size={14}/>} label="Entities" />
             <TabBtn active={activeTab === 'world'} onClick={() => uiDispatch(Actions.setPlotterTab('world'))} icon={<Globe size={14}/>} label="Setting" />
             <TabBtn active={activeTab === 'timeline'} onClick={() => uiDispatch(Actions.setPlotterTab('timeline'))} icon={<History size={14}/>} label="Timeline" />
             <TabBtn active={activeTab === 'history'} onClick={() => uiDispatch(Actions.setPlotterTab('history'))} icon={<Clock size={14}/>} label="Bible History" />
           </nav>
           <div className="md:hidden">
              <button onClick={() => setShowArchitectMobile(true)} className="p-3 bg-stone-800 text-orange-400 rounded-xl relative">
                <BrainCircuit size={20}/>
                {pendingChanges.length > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full text-[8px] flex items-center justify-center text-white font-black animate-pulse">{pendingChanges.length}</span>}
              </button>
           </div>
        </header>

        <main className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-12 pb-32">
          {activeTab === 'characters' && (
            <div className="space-y-8 animate-fade-in">
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-display font-black text-white italic">Characters</h3>
                <button onClick={() => handleSendMessage("新しい主要キャラクターの設定を一緒に考えたい。")} className="px-6 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">新規作成</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {characters.map(char => (
                  <CharacterCard 
                    key={char.id} 
                    character={char} 
                    onGeneratePortrait={() => handleGenPortrait(char)}
                    isGenerating={generatingPortraits.has(char.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {activeTab === 'grandArc' && (
            <div className="max-w-4xl mx-auto space-y-12 animate-fade-in">
              <section className="space-y-4">
                 <h3 className="text-xl font-display font-black text-white italic flex items-center gap-3"><Anchor size={20} className="text-orange-400"/> Grand Story Arc</h3>
                 <textarea 
                   value={foundation.grandArc} 
                   onChange={e => bibleDispatch(Actions.updateBible({ grandArc: e.target.value }))}
                   className="w-full bg-stone-900/40 border border-white/5 rounded-[2rem] p-8 text-[13px] md:text-base text-stone-200 font-serif leading-loose h-64 md:h-96 outline-none focus:border-orange-500/20 transition-all shadow-inner" 
                   placeholder="物語の全体的な流れ、結末、テーマをここに..."
                 />
              </section>
              
              <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-stone-600 uppercase tracking-widest flex items-center gap-2"><MapPin size={14}/> World Laws</h4>
                    <div className="space-y-3">
                       {foundation.laws.map(law => (
                         <div key={law.id} className="p-5 glass-bright rounded-2xl border border-white/5 space-y-2">
                           <div className="flex justify-between items-center">
                             <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">{law.name}</span>
                             <span className="text-[8px] font-mono text-stone-600">{law.type} / {law.importance}</span>
                           </div>
                           <p className="text-[11px] text-stone-400 font-serif leading-relaxed italic">"{law.description}"</p>
                         </div>
                       ))}
                       <button onClick={() => handleSendMessage("この世界における新しい魔法体系（または物理法則）を提案して。")} className="w-full py-4 border border-dashed border-stone-800 rounded-2xl text-[10px] font-black text-stone-600 hover:text-orange-400 hover:border-orange-500/20 transition-all uppercase tracking-widest">法則を追加</button>
                    </div>
                 </div>
                 
                 <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-stone-600 uppercase tracking-widest flex items-center gap-2"><Target size={14}/> Story Structure</h4>
                    <div className="space-y-3">
                       {plot.storyStructure.map(phase => (
                         <div key={phase.id} className="p-5 glass-bright rounded-2xl border border-white/5 space-y-2">
                            <span className="text-[10px] font-black text-stone-200 uppercase tracking-widest">{phase.name}</span>
                            <p className="text-[11px] text-stone-500 font-serif leading-relaxed line-clamp-2">{phase.summary}</p>
                         </div>
                       ))}
                    </div>
                 </div>
              </section>
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-display font-black text-white italic">Timeline</h3>
                <div className="flex gap-4">
                  <select value={selectedThreadFilter} onChange={e => setSelectedThreadFilter(e.target.value)} className="bg-stone-900 border border-white/5 rounded-xl px-4 py-2 text-[10px] font-black uppercase text-stone-400 outline-none">
                    <option value="ALL">All Threads</option>
                    {plot.storyThreads.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-6 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-stone-800">
                {plot.timeline.map((event, idx) => (
                  <div key={event.id} className="pl-10 relative">
                    <div className="absolute left-0 top-1.5 w-6 h-6 rounded-full bg-stone-900 border-4 border-stone-800 z-10 flex items-center justify-center">
                       <div className={`w-1.5 h-1.5 rounded-full ${event.importance === 'Climax' ? 'bg-orange-500' : 'bg-stone-600'}`} />
                    </div>
                    <div className="glass-bright p-6 rounded-2xl border border-white/5 space-y-3 hover:border-orange-500/20 transition-all group">
                       <div className="flex justify-between items-center">
                         <span className="text-[10px] font-mono text-orange-500/60">{event.timeLabel}</span>
                         <span className="text-[7px] font-black bg-stone-800 text-stone-500 px-1.5 py-0.5 rounded uppercase tracking-widest">{event.importance}</span>
                       </div>
                       <h4 className="text-[13px] font-serif-bold text-white">{event.event}</h4>
                       <p className="text-[11px] text-stone-500 font-serif leading-relaxed italic">{event.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
              <div className="flex items-center gap-3">
                <History size={24} className="text-stone-500" />
                <h3 className="text-2xl font-display font-black text-white italic">Bible Revision History</h3>
              </div>
              <div className="space-y-4">
                {bibleHistory.length === 0 ? (
                  <div className="p-20 text-center text-stone-700 italic font-serif">歴史の記録はありません。</div>
                ) : (
                  bibleHistory.map(entry => (
                    <div key={entry.id} className="p-6 glass-bright rounded-2xl border border-white/5 flex flex-col md:flex-row gap-6 relative group">
                      <div className="shrink-0 flex md:flex-col items-center gap-2 border-r border-white/5 pr-6">
                        <div className="w-10 h-10 rounded-full bg-stone-900 flex items-center justify-center text-orange-400 font-mono text-xs">V{entry.versionAtCommit}</div>
                        <div className="text-[8px] font-mono text-stone-700">{new Date(entry.timestamp).toLocaleTimeString()}</div>
                      </div>
                      <div className="flex-1 space-y-4">
                        <div className="flex items-center gap-3">
                           <span className="text-[8px] font-black bg-orange-600/20 text-orange-400 px-1.5 py-0.5 rounded uppercase">{entry.path}</span>
                           <span className="text-[8px] font-black text-stone-500 uppercase">{entry.opType}</span>
                           <h4 className="text-[11px] font-serif-bold text-stone-100">{entry.targetName}</h4>
                        </div>
                        <VisualDiff oldVal={entry.oldValue} newVal={entry.newValue} />
                        <div className="flex items-center gap-4 text-[9px] text-stone-600 font-serif italic">
                           <span>Rationale: {entry.rationale}</span>
                           <span>Evidence: {entry.evidence}</span>
                        </div>
                      </div>
                      <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={() => handleRevert(entry)} className="p-3 bg-stone-800 hover:bg-rose-600/20 text-stone-500 hover:text-rose-400 rounded-xl transition-all" title="この時点の状態に戻す"><Undo2 size={16}/></button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'world' && (
             <div className="max-w-4xl mx-auto space-y-12 animate-fade-in">
               <section className="space-y-4">
                  <h3 className="text-xl font-display font-black text-white italic flex items-center gap-3"><Landmark size={20} className="text-orange-400"/> World Entry (Lexicon)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {knowledge.entries.map(entry => (
                      <div key={entry.id} className="p-6 glass-bright rounded-2xl border border-white/5 space-y-2 group relative">
                        <div className="flex justify-between items-center">
                           <span className="text-[9px] font-black text-orange-400 uppercase tracking-widest">{entry.category}</span>
                           <div className="flex gap-2">
                             {entry.isSecret && <Landmark size={12} className="text-emerald-500" />}
                             <button onClick={() => handleSendMessage(`${entry.title}という用語について詳しく相談したい。`)} className="opacity-0 group-hover:opacity-100 transition-opacity text-stone-600 hover:text-orange-400"><MessageSquare size={14}/></button>
                           </div>
                        </div>
                        <h4 className="text-[13px] font-serif-bold text-stone-100">{entry.title}</h4>
                        <p className="text-[10px] text-stone-500 font-serif leading-relaxed italic line-clamp-3">{entry.definition}</p>
                      </div>
                    ))}
                    <button onClick={() => handleSendMessage("新しい用語（組織、地名、現象など）の設定を追加したい。")} className="p-6 border border-dashed border-stone-800 rounded-2xl flex items-center justify-center text-[10px] font-black text-stone-600 hover:text-orange-400 hover:border-orange-500/20 transition-all uppercase tracking-widest gap-2">
                      <Plus size={16}/> 用語を追加
                    </button>
                  </div>
               </section>

               <section className="space-y-4">
                  <h3 className="text-xl font-display font-black text-white italic flex items-center gap-3"><Gem size={20} className="text-orange-400"/> Key Artifacts</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {knowledge.keyItems.map(item => (
                      <div key={item.id} className="p-6 glass-bright rounded-2xl border border-white/5 space-y-3">
                         <div className="flex justify-between items-center">
                           <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">{item.type}</span>
                           <span className="text-[8px] font-mono text-stone-600">Possessed by: {characters.find(c => c.id === item.currentOwnerId)?.profile.name || 'None'}</span>
                         </div>
                         <h4 className="text-[13px] font-serif-bold text-stone-100">{item.name}</h4>
                         <p className="text-[10px] text-stone-500 font-serif leading-relaxed italic">{item.description}</p>
                      </div>
                    ))}
                  </div>
               </section>
             </div>
          )}
        </main>
      </div>

      {/* Architect Side (Right Bar) */}
      <aside className={`fixed inset-0 z-[200] md:relative md:inset-auto md:z-auto w-full md:w-[480px] lg:w-[560px] glass md:bg-stone-900 border-l border-white/5 flex flex-col shrink-0 transition-transform duration-500 ease-in-out ${showArchitectMobile ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
         <div className="p-8 border-b border-white/5 flex justify-between items-center bg-stone-900 shrink-0 pt-safe">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center text-white shadow-lg">
                  <BrainCircuit size={20} />
               </div>
               <div>
                 <span className="text-[11px] font-black text-white uppercase tracking-[0.3em]">Architect AI</span>
                 <p className="text-[8px] font-black text-orange-500 uppercase tracking-widest">Neural Sync Engine</p>
               </div>
            </div>
            <div className="flex items-center gap-4">
               <button onClick={() => setShowArchitectMobile(false)} className="md:hidden p-3 text-stone-500"><X size={24}/></button>
            </div>
         </div>

         <div className="flex-1 flex flex-col min-h-0 relative">
            <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 custom-scrollbar">
               {displayHistory.map((msg, idx) => (
                 <div key={msg.id} className={`flex flex-col gap-3 ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in`}>
                   <div className={`max-w-[90%] p-6 rounded-3xl ${msg.role === 'user' ? 'bg-orange-600 text-white shadow-xl shadow-orange-950/20' : 'glass-bright border border-white/5 text-stone-200 shadow-xl'}`}>
                     <p className="text-[13px] md:text-sm font-serif leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                     {msg.sources && msg.sources.length > 0 && (
                       <div className="mt-4 pt-4 border-t border-white/5 flex flex-wrap gap-2">
                          {msg.sources.map((s, i) => (
                            <a key={i} href={s.uri} target="_blank" rel="noopener noreferrer" className="px-2 py-1 bg-stone-950/40 rounded text-[8px] font-black text-orange-400 hover:text-white transition-colors flex items-center gap-1"><Globe size={10}/> {s.title}</a>
                          ))}
                       </div>
                     )}
                   </div>
                 </div>
               ))}
               
               {isChatting && (
                 <div className="flex flex-col gap-3 items-start animate-pulse">
                   <div className="p-6 rounded-3xl glass-bright border border-white/5 text-stone-500 flex items-center gap-3">
                     <Loader2 size={16} className="animate-spin" />
                     <span className="text-[10px] font-black uppercase tracking-widest">設計士が思案中...</span>
                   </div>
                 </div>
               )}

               {isConsolidating && (
                 <div className="flex items-center justify-center py-4">
                   <div className="px-4 py-2 bg-stone-800 rounded-full text-[8px] font-black text-stone-500 uppercase tracking-widest flex items-center gap-2">
                     <Clock size={12}/> コンテキストの整理と要約を行っています
                   </div>
                 </div>
               )}

               {sortedPendingChanges.length > 0 && (
                 <div className="space-y-6 pt-10">
                   <div className="flex items-center justify-between px-2">
                     <h4 className="text-[10px] font-black text-orange-400 uppercase tracking-[0.4em] flex items-center gap-3">
                       <Zap size={14} className="animate-pulse" /> NeuralSync Proposals
                     </h4>
                     <button onClick={commitAllChanges} className="text-[9px] font-black text-stone-500 hover:text-white uppercase tracking-widest transition-colors">一括適用</button>
                   </div>
                   <div className="space-y-4">
                     {sortedPendingChanges.map(op => (
                       <ProposalItem 
                         key={op.id} 
                         op={op} 
                         bible={bible} 
                         chapters={chapters} 
                         isExpanded={expandedOpId === op.id}
                         onToggle={() => setExpandedOpId(expandedOpId === op.id ? null : op.id)}
                         onAccept={() => commitChange(op)}
                         onReject={() => syncDispatch(Actions.removePendingOp(op.id))}
                       />
                     ))}
                   </div>
                 </div>
               )}
               <div ref={chatEndRef} />
            </div>

            <div className="p-6 md:p-8 bg-stone-900/80 backdrop-blur-xl border-t border-white/5 space-y-4">
               <div className="flex gap-2">
                  <button onClick={() => setContextFocus('AUTO')} className={`px-3 py-1.5 rounded-full text-[8px] font-black uppercase transition-all ${contextFocus === 'AUTO' ? 'bg-orange-500 text-stone-950' : 'bg-stone-800 text-stone-500'}`}>Auto Context</button>
                  <button onClick={() => setContextFocus('CHARACTERS')} className={`px-3 py-1.5 rounded-full text-[8px] font-black uppercase transition-all ${contextFocus === 'CHARACTERS' ? 'bg-orange-500 text-stone-950' : 'bg-stone-800 text-stone-500'}`}>Entity Focus</button>
                  <button onClick={() => setContextFocus('WORLD')} className={`px-3 py-1.5 rounded-full text-[8px] font-black uppercase transition-all ${contextFocus === 'WORLD' ? 'bg-orange-500 text-stone-950' : 'bg-stone-800 text-stone-500'}`}>World Focus</button>
               </div>
               <div className="relative">
                 <textarea 
                   value={input}
                   onChange={e => setInput(e.target.value)}
                   onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                   placeholder="設計士に相談..."
                   className="w-full bg-stone-950 border border-white/5 rounded-[2rem] p-6 pr-16 text-[13px] text-stone-200 outline-none focus:border-orange-500/30 transition-all resize-none h-24 md:h-32 shadow-2xl custom-scrollbar font-serif"
                 />
                 <button 
                   onClick={() => handleSendMessage()}
                   disabled={!input.trim() || isChatting}
                   className="absolute right-4 bottom-4 w-12 h-12 bg-orange-600 text-white rounded-2xl flex items-center justify-center shadow-xl hover:bg-orange-500 transition-all active:scale-95 disabled:opacity-40"
                 >
                   <Send size={20} />
                 </button>
               </div>
            </div>
         </div>
      </aside>
    </div>
  );
};

const TabBtn = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
  <button onClick={onClick} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${active ? 'bg-orange-600 text-white shadow-lg' : 'text-stone-500 hover:text-stone-300 hover:bg-stone-800'}`}>
    {icon}
    <span>{label}</span>
  </button>
);

export default PlotterView;
