
import { 
  Users, Globe, ArrowUpRight, Target, 
  Plus, Loader2, Menu, Anchor, History,
  X, Beaker, Undo2, BrainCircuit,
  Clock, AlertCircle, CheckCircle2, Zap, MessageSquare,
  ChevronRight, BookOpen, Flag, Layout, Info, Check,
  AlertTriangle, ShieldAlert, Sparkles, Network
} from 'lucide-react';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ChatMessage, SyncOperation, HistoryEntry, Character, WorldEntry, GeminiContent, TimelineEvent, Foreshadowing, ProjectDomain, ViewMode, QuarantineItem } from '../types';
import { chatWithArchitect, extractSettingsFromChat, detectSettingChange, simulateBranch, generateCharacterPortrait } from '../services/geminiService';
import { 
  useBible, useNeuralSync, useUI, useMetadata, useManuscript,
  useMetadataDispatch, useBibleDispatch, useNeuralSyncDispatch, 
  useUIDispatch, useNotificationDispatch 
} from '../contexts/StoryContext';
import * as Actions from '../store/actions';
import { calculateSyncResult, calculateRevertResult, applySyncBatch } from '../services/bibleManager';
import { savePortrait } from '../services/storageService';
import { CharacterCard } from './plotter/CharacterCard';
import { ProposalItem } from './plotter/ProposalItem';

const PlotterView: React.FC = () => {
  const meta = useMetadata();
  const metaDispatch = useMetadataDispatch();
  const bible = useBible();
  const bibleDispatch = useBibleDispatch();
  const chapters = useManuscript();
  const sync = useNeuralSync();
  const syncDispatch = useNeuralSyncDispatch();
  
  const ui = useUI();
  const uiDispatch = useUIDispatch();
  const { plotterTab: activeTab, pendingMsg } = ui;
  const { addLog } = useNotificationDispatch();

  const { chatHistory, pendingChanges, quarantine, history: bibleHistory } = sync;

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
  const [activeDomains, setActiveDomains] = useState<ProjectDomain[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showArchitectMobile, setShowArchitectMobile] = useState(false);
  const [expandedOpId, setExpandedOpId] = useState<string | null>(null);
  const [nexusHypothesis, setNexusHypothesis] = useState('');
  const [isSimulating, setIsSimulating] = useState(false);
  const [generatingPortraits, setGeneratingPortraits] = useState<Set<string>>(new Set());

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { 
    if (showArchitectMobile || window.innerWidth >= 768) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, pendingChanges, showArchitectMobile]);

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

      const detectionPromise = detectSettingChange(textToSend, usageCb, logCb);

      const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: textToSend, timestamp: Date.now() };
      const historyWithUser = [...(chatHistory || []), userMsg];
      syncDispatch(Actions.setChatHistory(historyWithUser));
      
      const geminiHistory: GeminiContent[] = historyWithUser.map(m => ({
        role: m.role,
        parts: [{ text: m.content }]
      }));

      const { text, sources } = await chatWithArchitect(
        geminiHistory,
        textToSend, 
        { meta, bible, chapters, sync } as any, 
        true, 
        usageCb, 
        logCb
      );
      
      const botMsg: ChatMessage = { id: (Date.now()+1).toString(), role: 'model', content: text, timestamp: Date.now(), sources };
      const finalHistory = [...historyWithUser, botMsg];
      syncDispatch(Actions.setChatHistory(finalHistory));

      const detection = await detectionPromise;
      if (detection.hasChangeIntent) {
        setIsAnalyzing(true);
        setActiveDomains(detection.domains);
        
        if (detection.isHypothetical) {
          addLog('info', 'NeuralSync', `IF世界線の可能性を分析中... (Nexus Mode)`);
        } else {
          addLog('info', 'NeuralSync', `正史の変更を同期中... (Canon Mode)`);
        }
        
        const finalGeminiHistory: GeminiContent[] = finalHistory.map(m => ({
          role: m.role,
          parts: [{ text: m.content }]
        }));

        const extraction = await extractSettingsFromChat(finalGeminiHistory, { meta, bible, chapters, sync } as any, detection, usageCb, logCb);
        
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
  }, [input, isChatting, chatHistory, meta, bible, chapters, sync, syncDispatch, metaDispatch, addLog]);

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
          
          result.historyEntries.forEach(entry => {
            syncDispatch(Actions.addHistoryEntry(entry));
          });

          readyOps.forEach(op => {
            syncDispatch(Actions.removePendingOp(op.id));
          });

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
      bibleDispatch(Actions.updateBible({ nexusBranches: [branch, ...(bible.nexusBranches || [])] }));
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
    addLog('info', 'Artist', `${c.name} の肖像画を生成中...`);
    try {
      const url = await generateCharacterPortrait(c, { meta, bible, chapters, sync } as any, (u) => metaDispatch(Actions.trackUsage(u)), addLog);
      await savePortrait(meta.id, c.id, url);
      const updatedChars = bible.characters.map(char => char.id === c.id ? { ...char, imageUrl: c.id } : char);
      bibleDispatch(Actions.updateBible({ characters: updatedChars }));
      addLog('success', 'Artist', `${c.name} の肖像画が完成しました。`);
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

  // Node locations for Relationship Map (Circle layout)
  const nodePositions = useMemo(() => {
    const chars = bible.characters;
    const radius = Math.min(window.innerWidth * 0.3, 300);
    const centerX = 500;
    const centerY = 400;
    return chars.reduce((acc, char, idx) => {
      const angle = (idx / chars.length) * 2 * Math.PI;
      acc[char.id] = {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle)
      };
      return acc;
    }, {} as Record<string, { x: number, y: number }>);
  }, [bible.characters]);

  return (
    <div className="h-full flex flex-col md:flex-row bg-stone-900 overflow-hidden relative">
      <aside className={`fixed inset-0 z-[150] md:relative md:inset-auto md:z-auto w-full md:w-[450px] lg:w-[500px] border-r border-white/5 flex flex-col bg-stone-900/95 md:bg-stone-900/40 shrink-0 transition-transform duration-500 ease-in-out ${showArchitectMobile ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-6 md:p-10 border-b border-white/5 flex items-center justify-between shrink-0 bg-stone-900 md:bg-transparent">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-orange-600 rounded-xl text-white shadow-xl shadow-orange-900/20"><BrainCircuit size={20}/></div>
             <h2 className="text-xl md:text-2xl font-display font-black text-white italic tracking-tighter">Architect</h2>
          </div>
          <button onClick={() => setShowArchitectMobile(false)} className="md:hidden p-2 text-stone-500 hover:text-white transition-colors"><X size={24}/></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-10 custom-scrollbar pb-32">
           <div className="space-y-6">
              {chatHistory.length === 0 && (
                <div className="p-8 md:p-10 rounded-[2.5rem] bg-stone-800/20 border border-dashed border-stone-700 text-center space-y-4">
                   <Anchor size={32} className="mx-auto text-stone-700" />
                   <p className="text-[11px] md:text-[13px] text-stone-500 font-serif leading-relaxed italic">「設計士」に物語の構想を相談してください。会話の中から自動的に設定の変更を提案します。</p>
                </div>
              )}
              {chatHistory.map((m) => (
                <div key={m.id} className={`flex flex-col gap-3 ${m.role === 'user' ? 'items-end' : 'items-start animate-fade-in'}`}>
                   <div className={`max-w-[85%] px-5 py-4 md:px-6 md:py-5 rounded-3xl text-[12px] md:text-[13px] leading-relaxed font-serif-bold shadow-xl ${m.role === 'user' ? 'bg-orange-600 text-white rounded-tr-none' : 'glass-bright text-stone-200 rounded-tl-none border border-white/5'}`}>
                      {m.content}
                   </div>
                   {m.sources && m.sources.length > 0 && (
                     <div className="flex flex-wrap gap-2 px-1">
                        {m.sources.map((s, i) => (
                          <a key={i} href={s.uri} target="_blank" rel="noreferrer" className="text-[9px] text-orange-400 hover:text-white flex items-center gap-1 transition-colors">
                            <ArrowUpRight size={10}/> {s.title}
                          </a>
                        ))}
                     </div>
                   )}
                </div>
              ))}
              {isChatting && (
                <div className="flex items-center gap-3 text-stone-500 animate-pulse px-4">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest">{isAnalyzing ? '抽出中...' : '推論中...'}</span>
                </div>
              )}
              <div ref={chatEndRef} />
           </div>

           {sortedPendingChanges.length > 0 && (
             <div className="space-y-6 pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black text-orange-400 uppercase tracking-[0.3em]">Proposed Changes</span>
                    <span className="text-[8px] text-stone-600 font-serif italic">設計士による推論提案</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {sortedPendingChanges.some(op => op.status !== 'needs_resolution' && !op.isHypothetical) && (
                      <button onClick={commitAllChanges} className="text-[9px] font-black text-emerald-400 hover:text-white uppercase tracking-widest flex items-center gap-1 transition-colors">
                        <Check size={12}/> 正史を全て適用
                      </button>
                    )}
                    <span className="text-[9px] font-mono text-stone-600">{sortedPendingChanges.length} 件</span>
                  </div>
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

           {(quarantine || []).length > 0 && (
              <div className="space-y-6 pt-8 border-t border-white/5">
                <div className="flex items-center justify-between text-rose-400">
                  <div className="flex items-center gap-2">
                    <ShieldAlert size={14}/>
                    <span className="text-[10px] font-black uppercase tracking-[0.3em]">Quarantined Items</span>
                  </div>
                  <button onClick={() => syncDispatch({ type: 'LOAD_SYNC', payload: { ...sync, quarantine: [] } })} className="text-[9px] font-black uppercase tracking-widest text-stone-600 hover:text-rose-400 transition-colors">全て削除</button>
                </div>
                <div className="space-y-3">
                   {quarantine.map(item => (
                     <div key={item.id} className="p-4 bg-rose-950/20 border border-rose-500/20 rounded-2xl space-y-3 relative group">
                        <div className="flex justify-between items-start">
                          <span className="text-[8px] font-black bg-rose-500/20 text-rose-500 px-1.5 py-0.5 rounded uppercase">{item.stage} ERROR</span>
                          <button onClick={() => syncDispatch(Actions.removeQuarantineItem(item.id))} className="text-stone-700 hover:text-white"><X size={14}/></button>
                        </div>
                        <p className="text-[10px] text-rose-300 font-serif leading-relaxed italic">"{item.error}"</p>
                        <div className="p-2 bg-stone-950/40 rounded-xl max-h-24 overflow-y-auto no-scrollbar">
                           <pre className="text-[8px] font-mono text-stone-600 whitespace-pre-wrap">{item.rawText}</pre>
                        </div>
                     </div>
                   ))}
                </div>
              </div>
           )}
        </div>

        <div className="p-6 md:p-10 border-t border-white/5 bg-stone-900/90 md:bg-stone-900/60 shrink-0 absolute md:relative bottom-0 left-0 right-0 z-10 pb-safe md:pb-10">
           <div className="relative group">
              <textarea 
                value={input} 
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                placeholder="設計士への指示..." 
                className="w-full bg-stone-950/50 border border-white/5 rounded-3xl p-5 md:p-6 text-[13px] md:text-sm text-stone-200 outline-none focus:border-orange-500/30 transition-all min-h-[80px] md:min-h-[120px] resize-none font-serif shadow-inner"
              />
              <button 
                onClick={() => handleSendMessage()} 
                disabled={!input.trim() || isChatting}
                className="absolute bottom-4 right-4 md:bottom-6 md:right-6 p-3 md:p-4 bg-orange-600 text-white rounded-2xl shadow-xl hover:bg-orange-500 transition-all active:scale-90 disabled:opacity-50"
              >
                <Plus size={20} className={isChatting ? 'animate-spin' : ''} />
              </button>
           </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col relative overflow-hidden bg-stone-950/20">
         <header className="h-20 md:h-24 glass border-b border-white/5 px-6 md:px-10 flex items-center justify-between shrink-0 z-40">
            <div className="flex items-center gap-6 md:gap-12 overflow-x-auto no-scrollbar py-2">
               <div className="flex gap-4 md:gap-8 shrink-0">
                  <TabBtn active={activeCategory === 'CANON'} onClick={() => setActiveCategory('CANON')} label="Canon" sub="世界の理" />
                  <TabBtn active={activeCategory === 'PLAN'} onClick={() => setActiveCategory('PLAN')} label="Plan" sub="構成" />
                  <TabBtn active={activeCategory === 'RELATIONS'} onClick={() => setActiveCategory('RELATIONS')} label="Relations" sub="相関" />
                  <TabBtn active={activeCategory === 'NEXUS'} onClick={() => setActiveCategory('NEXUS')} label="Nexus" sub="分岐" />
                  <TabBtn active={activeCategory === 'HISTORY'} onClick={() => setActiveCategory('HISTORY')} label="History" sub="記録" />
               </div>
            </div>
            <div className="flex items-center gap-2 md:gap-3 shrink-0 ml-4">
               <button 
                 onClick={() => setShowArchitectMobile(true)}
                 className="md:hidden p-3 bg-stone-800 rounded-2xl text-orange-400 shadow-xl border border-white/5 active:scale-95 transition-all"
               >
                 <MessageSquare size={18} />
               </button>
               <div className="hidden md:flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-black uppercase text-stone-500 tracking-widest">NeuralSync Active</span>
               </div>
            </div>
         </header>

         <div className="flex-1 overflow-y-auto p-6 md:p-12 custom-scrollbar pb-32 md:pb-12">
            {activeCategory === 'CANON' && (
              <div className="space-y-12 md:space-y-20 animate-fade-in">
                 <div className="space-y-6 md:space-y-10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Users size={24} className="text-orange-400 md:w-8 md:h-8" />
                        <h3 className="text-2xl md:text-3xl font-display font-black text-white italic tracking-tighter">Entities</h3>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                       {bible.characters.map(c => (
                         <CharacterCard key={c.id} character={c} onGeneratePortrait={() => handleGenPortrait(c)} isGenerating={generatingPortraits.has(c.id)} />
                       ))}
                       <button onClick={() => handleSendMessage("新しく主要な登場人物を追加して。")} className="h-full min-h-[250px] md:min-h-[400px] border border-dashed border-stone-800 rounded-[2rem] md:rounded-[2.5rem] flex flex-col items-center justify-center gap-4 text-stone-700 hover:text-orange-400 hover:border-orange-500/20 hover:bg-stone-800/20 transition-all group">
                          <Plus size={32} className="group-hover:scale-110 transition-transform" />
                          <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.3em]">人物を創造する</span>
                       </button>
                    </div>
                 </div>

                 <div className="space-y-6 md:space-y-10">
                    <div className="flex items-center gap-4">
                      <Globe size={24} className="text-orange-400 md:w-8 md:h-8" />
                      <h3 className="text-2xl md:text-3xl font-display font-black text-white italic tracking-tighter">World Building</h3>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
                       <SettingBlock title="World Setting" value={bible.setting} onEdit={() => handleSendMessage("世界観設定を詳しく書き直したい。")} />
                       <SettingBlock title="Canon Laws" value={bible.laws} onEdit={() => handleSendMessage("世界の法則（魔法や物理）について相談したい。")} />
                    </div>
                 </div>
              </div>
            )}

            {activeCategory === 'PLAN' && (
              <div className="space-y-12 md:space-y-20 animate-fade-in max-w-6xl">
                 <div className="space-y-10">
                    <div className="flex items-center gap-4">
                      <Layout size={24} className="text-orange-400 md:w-8 md:h-8" />
                      <h3 className="text-2xl md:text-3xl font-display font-black text-white italic tracking-tighter">Story Roadmap</h3>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12">
                       <div className="lg:col-span-1 space-y-6">
                          <SettingBlock title="Core Arc Concept" value={bible.grandArc} onEdit={() => handleSendMessage("物語の全体構想（グランドアーク）を修正したい。")} />
                          <div className="p-6 md:p-8 bg-stone-800/20 rounded-[2rem] border border-dashed border-stone-700 space-y-4">
                             <div className="flex items-center gap-3 text-stone-500">
                                <Info size={16} />
                                <span className="text-[10px] font-black uppercase tracking-widest">構造化のヒント</span>
                             </div>
                             <p className="text-[11px] text-stone-500 font-serif leading-relaxed italic">グランドアークに「[第一部]」「[章名]」などのタグを含めると、設計士が章ごとのマイルストーンをより正確に把握できるようになります。</p>
                          </div>
                       </div>

                       <div className="lg:col-span-2 space-y-8 relative">
                          <div className="absolute left-[27px] top-10 bottom-10 w-px bg-gradient-to-b from-orange-500/40 via-orange-500/10 to-transparent" />
                          <div className="space-y-6">
                             {chapters.map((ch, idx) => (
                               <div key={ch.id} className="flex gap-6 md:gap-10 group relative z-10">
                                  <div className="flex flex-col items-center pt-2">
                                     <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border-2 transition-all duration-500 ${ch.status === 'Polished' ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-stone-900 border-stone-700 text-stone-500 group-hover:border-orange-500/40'}`}>
                                        <span className="font-mono text-sm font-bold">{(idx + 1).toString().padStart(2, '0')}</span>
                                     </div>
                                  </div>
                                  <div className="flex-1 p-6 md:p-8 glass-bright rounded-[1.5rem] md:rounded-[2rem] border border-white/5 hover:border-orange-500/20 transition-all cursor-pointer group/card" onClick={() => uiDispatch(Actions.setView(ViewMode.WRITER))}>
                                     <div className="flex justify-between items-start mb-3">
                                        <h4 className="text-lg md:text-xl font-serif-bold text-stone-200 group-hover/card:text-orange-400 transition-colors">{ch.title}</h4>
                                        <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${ch.status === 'Polished' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-stone-800 text-stone-600'}`}>{ch.status}</div>
                                     </div>
                                     <p className="text-[11px] md:text-[13px] text-stone-400 font-serif leading-relaxed line-clamp-3 italic mb-4">"{ch.summary || "あらすじがまだ設定されていません。"}"</p>
                                     <div className="flex items-center justify-between pt-4 border-t border-white/5">
                                        <span className="text-[9px] font-mono text-stone-600">{(Number(ch.wordCount) || 0).toLocaleString()} characters</span>
                                        <button className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-stone-500 group-hover/card:text-white transition-colors">執筆へ移動 <ChevronRight size={12}/></button>
                                     </div>
                                  </div>
                               </div>
                             ))}
                             
                             <button onClick={() => handleSendMessage("次の章の構成案を作って。")} className="w-full py-8 border-2 border-dashed border-stone-800 rounded-[2rem] flex flex-col items-center justify-center gap-3 text-stone-700 hover:text-orange-400 hover:border-orange-500/20 hover:bg-stone-800/20 transition-all group ml-[70px] max-w-[calc(100%-70px)]">
                                <Plus size={24} className="group-hover:scale-110 transition-transform" />
                                <span className="text-[10px] font-black uppercase tracking-[0.3em]">新しいチャプターを計画</span>
                             </button>
                          </div>
                       </div>
                    </div>
                 </div>
                 
                 <div className="space-y-10 pt-10 border-t border-white/5">
                   <div className="flex items-center gap-4">
                     <Clock size={24} className="text-orange-400 md:w-8 md:h-8" />
                     <h3 className="text-2xl md:text-3xl font-display font-black text-white italic tracking-tighter">Timeline</h3>
                   </div>
                   <div className="space-y-4 px-2">
                      {bible.timeline.length === 0 ? (
                        <div className="p-12 md:p-20 text-center text-stone-700 font-serif italic border border-dashed border-stone-800 rounded-[2.5rem]">年表データがまだありません。</div>
                      ) : (
                        bible.timeline.map((t, i) => (
                          <div key={t.id} className="flex gap-6 md:gap-10 group">
                             <div className="flex flex-col items-center">
                                <div className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-orange-500 ring-4 ring-orange-500/20 group-hover:scale-125 transition-transform shrink-0" />
                                {i < bible.timeline.length - 1 && <div className="w-px flex-1 bg-stone-800 my-2" />}
                             </div>
                             <div className="pb-10 md:pb-16 flex-1">
                                <span className="text-[9px] md:text-[11px] font-mono text-stone-500 uppercase tracking-widest">{t.timeLabel}</span>
                                <h4 className="text-lg md:text-xl font-serif-bold text-stone-200 mt-1 leading-snug">{t.event}</h4>
                                <p className="text-[11px] md:text-sm text-stone-500 font-serif mt-2 leading-relaxed">{t.description}</p>
                             </div>
                          </div>
                        ))
                      )}
                   </div>
                 </div>
              </div>
            )}

            {activeCategory === 'RELATIONS' && (
               <div className="h-full min-h-[600px] flex flex-col animate-fade-in relative">
                  <div className="flex items-center justify-between mb-8 px-4">
                    <div className="flex items-center gap-4">
                      <Network size={24} className="text-orange-400 md:w-8 md:h-8" />
                      <h3 className="text-2xl md:text-3xl font-display font-black text-white italic tracking-tighter">Relationship Map</h3>
                    </div>
                    <button onClick={() => handleSendMessage("キャラクター同士の相関関係を整理して図解したい。")} className="px-6 py-2 bg-stone-800 hover:bg-orange-600 text-[10px] font-black uppercase tracking-widest text-stone-300 hover:text-white rounded-xl transition-all">設計士に依頼</button>
                  </div>

                  <div className="flex-1 glass rounded-[3rem] border border-white/5 overflow-hidden relative min-h-[500px] bg-stone-950/20 shadow-inner">
                    <svg viewBox="0 0 1000 800" className="w-full h-full">
                       {/* Draw lines */}
                       {bible.characters.map(char => 
                          (char.relationships || []).map(rel => {
                             const from = nodePositions[char.id];
                             const to = nodePositions[rel.targetCharacterId];
                             if (!from || !to) return null;
                             const midX = (from.x + to.x) / 2;
                             const midY = (from.y + to.y) / 2;
                             return (
                               <g key={`${char.id}-${rel.targetCharacterId}`} className="group/link">
                                  <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="rgba(214, 138, 109, 0.2)" strokeWidth="2" strokeDasharray="5 5" className="group-hover/link:stroke-orange-400 group-hover/link:stroke-opacity-50 transition-all" />
                                  <circle cx={midX} cy={midY} r="14" fill="rgba(28, 25, 23, 0.9)" stroke="rgba(255, 255, 255, 0.05)" />
                                  <text x={midX} y={midY} dy="3" textAnchor="middle" className="text-[8px] fill-stone-500 pointer-events-none uppercase font-black tracking-widest group-hover/link:fill-orange-400 transition-colors">{rel.type}</text>
                               </g>
                             );
                          })
                       )}
                       {/* Draw nodes */}
                       {bible.characters.map(char => {
                          const pos = nodePositions[char.id];
                          if (!pos) return null;
                          return (
                            <g key={char.id} className="group/node cursor-pointer">
                               <circle cx={pos.x} cy={pos.y} r="45" fill="rgba(41, 37, 36, 0.9)" stroke="rgba(214, 138, 109, 0.3)" strokeWidth="3" className="group-hover/node:stroke-orange-400 group-hover/node:r-50 transition-all duration-500" />
                               <text x={pos.x} y={pos.y} dy="5" textAnchor="middle" className="text-[11px] font-display font-black italic fill-white group-hover/node:fill-orange-400 transition-colors">{char.name}</text>
                               <text x={pos.x} y={pos.y} dy="20" textAnchor="middle" className="text-[6px] fill-stone-600 uppercase font-black tracking-widest group-hover/node:fill-white transition-colors">{char.role}</text>
                            </g>
                          );
                       })}
                    </svg>
                  </div>
               </div>
            )}

            {activeCategory === 'NEXUS' && (
               <div className="max-w-4xl mx-auto space-y-10 md:space-y-16 animate-fade-in">
                  <div className="space-y-4 text-center px-4">
                     <div className="inline-block p-3 md:p-4 bg-indigo-900/40 rounded-3xl border border-indigo-500/20 mb-2 md:mb-4"><Beaker size={28} className="text-indigo-400 md:w-8 md:h-8" /></div>
                     <h3 className="text-2xl md:text-4xl font-display font-black text-white italic tracking-tighter">Nexus Simulation</h3>
                     <p className="text-[11px] md:text-sm text-stone-500 font-serif max-w-lg mx-auto leading-relaxed">「もしもの展開」を入力してください。設計士が世界の理とキャラクターへの影響をシミュレートします。<br/><span className="text-indigo-400 font-bold">※ ここでの対話から抽出される設定は「仮説」として隔離されます。</span></p>
                  </div>

                  <div className="relative group px-2">
                     <input 
                       value={nexusHypothesis} 
                       onChange={e => setNexusHypothesis(e.target.value)} 
                       onKeyDown={e => { if (e.key === 'Enter') handleNexusSim(); }}
                       placeholder="例: 主人公が敗北していたら？" 
                       className="w-full bg-stone-900 border border-indigo-500/20 rounded-[1.5rem] md:rounded-[3rem] px-6 py-5 md:px-12 md:py-8 text-sm md:text-lg text-white outline-none focus:border-indigo-500/50 transition-all font-serif italic shadow-2xl pr-16 md:pr-32" 
                     />
                     <button 
                       onClick={handleNexusSim} 
                       disabled={!nexusHypothesis.trim() || isSimulating}
                       className="absolute right-4 md:right-6 top-1/2 -translate-y-1/2 p-3 md:p-6 bg-indigo-600 text-white rounded-full md:rounded-[2rem] shadow-xl hover:bg-indigo-500 transition-all active:scale-95 disabled:opacity-50"
                     >
                       {isSimulating ? <Loader2 size={20} className="animate-spin md:w-6 md:h-6" /> : <Zap size={20} className="md:w-6 md:h-6" />}
                     </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 px-2">
                     {(bible.nexusBranches || []).map(branch => (
                       <div key={branch.id} className="p-6 md:p-10 glass-bright rounded-[2rem] md:rounded-[2.5rem] border border-indigo-500/10 space-y-6 shadow-2xl hover:border-indigo-500/40 transition-all group">
                          <div className="flex justify-between items-start">
                             <div className="w-10 h-10 rounded-2xl bg-indigo-950 flex items-center justify-center text-indigo-400 group-hover:rotate-12 transition-transform"><History size={20}/></div>
                             <span className="text-[8px] font-mono text-stone-600">{new Date(branch.timestamp || Date.now()).toLocaleDateString()}</span>
                          </div>
                          <div className="space-y-2">
                             <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Hypothesis</span>
                             <p className="text-[13px] md:text-sm font-serif-bold text-stone-200 leading-relaxed italic">"{branch.hypothesis}"</p>
                          </div>
                          <div className="space-y-4 pt-4 border-t border-white/5">
                             <div className="space-y-1">
                                <span className="text-[8px] font-black text-stone-600 uppercase tracking-widest">Simulated Impact</span>
                                <p className="text-[11px] text-stone-400 font-serif leading-relaxed line-clamp-4">{branch.impactOnCanon}</p>
                             </div>
                             <button 
                               onClick={() => handleSendMessage(`このシミュレーション「${branch.hypothesis}」の内容を正史(Canon)に部分的に反映させたい。`)}
                               className="text-[9px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2 hover:text-white transition-colors"
                             >
                               <Sparkles size={12}/> 正史へマッピング
                             </button>
                          </div>
                       </div>
                     ))}
                  </div>
               </div>
            )}

            {activeCategory === 'HISTORY' && (
               <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-20 px-2">
                  <div className="flex items-center justify-between mb-8">
                     <h3 className="text-xl md:text-3xl font-display font-black text-white italic tracking-tighter flex items-center gap-3"><History size={20} className="text-orange-400 md:w-6 md:h-6" />聖書編纂記録</h3>
                     <span className="text-[9px] font-mono text-stone-600">{bibleHistory.length} commits</span>
                  </div>
                  <div className="space-y-4">
                     {bibleHistory.length === 0 ? (
                       <div className="p-12 md:p-20 text-center text-stone-700 italic border border-dashed border-stone-800 rounded-[2rem]">まだ歴史は刻まれていません。</div>
                     ) : (
                       bibleHistory.map((entry) => (
                         <div key={entry.id} className="p-5 md:p-8 glass-bright rounded-[1.5rem] md:rounded-[2rem] border border-white/5 flex items-start justify-between gap-4 md:gap-6 group hover:border-orange-500/20 transition-all">
                            <div className="space-y-3 flex-1 min-w-0">
                               <div className="flex items-center gap-3 flex-wrap">
                                  <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${entry.opType === 'delete' ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>{entry.opType}</div>
                                  <span className="text-[10px] md:text-[11px] font-black text-stone-200 uppercase tracking-widest truncate">{entry.targetName}</span>
                                  <span className="text-[8px] font-mono text-stone-600 ml-auto">{new Date(entry.timestamp || Date.now()).toLocaleTimeString()}</span>
                               </div>
                               <p className="text-[11px] md:text-[13px] text-stone-400 font-serif leading-relaxed line-clamp-2 italic">"{entry.rationale}"</p>
                            </div>
                            <button onClick={() => handleRevert(entry)} className="p-3 bg-stone-800 hover:bg-orange-600 text-stone-500 hover:text-white rounded-xl transition-all shadow-xl md:opacity-0 md:group-hover:opacity-100"><Undo2 size={16}/></button>
                         </div>
                       ))
                     )}
                  </div>
               </div>
            )}
         </div>
      </div>
    </div>
  );
};

const TabBtn = ({ active, onClick, label, sub }: { active: boolean, onClick: () => void, label: string, sub: string }) => (
  <button onClick={onClick} className="flex flex-col items-center gap-0.5 md:gap-1 group">
    <span className={`text-[10px] md:text-xs font-display font-black tracking-[0.1em] transition-all uppercase ${active ? 'text-orange-400 scale-110' : 'text-stone-600 group-hover:text-stone-300'}`}>{label}</span>
    <span className={`text-[7px] md:text-[8px] font-black uppercase tracking-[0.2em] transition-opacity ${active ? 'opacity-40' : 'opacity-0'}`}>{sub}</span>
  </button>
);

const SettingBlock = ({ title, value, onEdit, large }: { title: string, value: string, onEdit: () => void, large?: boolean }) => (
  <div className={`p-6 md:p-10 glass rounded-[2rem] md:rounded-[3rem] border border-white/5 space-y-4 md:space-y-8 relative group hover:border-orange-500/20 transition-all ${large ? 'w-full' : ''}`}>
    <div className="flex justify-between items-center">
      <h4 className="text-[9px] md:text-xs font-black text-stone-600 uppercase tracking-[0.3em]">{title}</h4>
      <button onClick={onEdit} className="p-2 text-stone-700 hover:text-orange-400 transition-colors"><Plus size={16}/></button>
    </div>
    <p className={`text-[12px] md:text-sm text-stone-300 font-serif leading-relaxed whitespace-pre-wrap ${large ? 'md:text-base md:leading-loose' : 'line-clamp-6'}`}>
      {value || "未設定です。設計士との対話で形にしてください。"}
    </p>
    <div className="absolute top-6 right-6 opacity-0 md:group-hover:opacity-100 transition-opacity">
       <button onClick={onEdit} className="px-4 py-2 bg-stone-800 text-[9px] font-black text-orange-400 uppercase tracking-widest rounded-xl hover:bg-orange-600 hover:text-white transition-all">編集</button>
    </div>
  </div>
);

export default PlotterView;
