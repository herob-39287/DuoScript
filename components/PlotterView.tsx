
import { 
  Users, Globe, ArrowUpRight, Target, 
  Plus, Loader2, Anchor, History,
  X, Beaker, Undo2, BrainCircuit,
  Clock, Zap, MessageSquare,
  ChevronRight, Layout, Check,
  Sparkles, Network, Book,
  Landmark, MapPin, Scale, Gem, User, Edit2, Save, Wand2, Send, Search, Trash2, GitBranch,
  Feather, Map as MapIcon, Flag, Lightbulb, Trash
} from 'lucide-react';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ChatMessage, SyncOperation, HistoryEntry, Character, WorldEntry, GeminiContent, ProjectDomain, ViewMode, ContextFocus, WorldBible, WorldLaw } from '../types';
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

  // 聖書の不足項目を分析して提案を作成する
  const blueprintSuggestions = useMemo(() => {
    const suggestions: { label: string; prompt: string; icon: React.ReactNode }[] = [];
    
    if (!foundation.grandArc || foundation.grandArc.length < 50) {
      suggestions.push({ 
        label: "物語の全体像", 
        prompt: "この物語の全体的なプロット（グランドアーク）と、目指すべき結末について一緒に考えたい。",
        icon: <Anchor size={12} />
      });
    }

    if (characters.length < 3) {
      suggestions.push({ 
        label: "主要人物の創造", 
        prompt: "物語を動かす主要な登場人物をあと2、3人追加したい。今の設定に合う魅力的な人物を提案して。",
        icon: <Users size={12} />
      });
    }

    if (foundation.laws.length === 0) {
      suggestions.push({ 
        label: "世界の理を定義", 
        prompt: "この世界の物理法則や魔法体系、あるいは社会的な絶対ルール（禁忌）について設定を詰めたい。",
        icon: <Scale size={12} />
      });
    }

    if (plot.timeline.length < 2) {
      suggestions.push({ 
        label: "歴史の刻印", 
        prompt: "物語が始まる前に起きた重要な歴史的イベントや、今後の大きな転換点を年表に組み込みたい。",
        icon: <History size={12} />
      });
    }

    if (plot.foreshadowing.length === 0) {
      suggestions.push({ 
        label: "伏線の仕掛け", 
        prompt: "物語の後半で回収するような、序盤に仕込んでおくべき伏線や謎のアイデアをいくつか出して。",
        icon: <Flag size={12} />
      });
    }

    if (geography.locations.length < 2) {
      suggestions.push({ 
        label: "舞台の拡張", 
        prompt: "物語の舞台となる主要な場所や、その土地特有の文化・雰囲気について設定を広げたい。",
        icon: <MapIcon size={12} />
      });
    }

    return suggestions;
  }, [foundation, characters, plot, geography]);

  const [input, setInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showArchitectMobile, setShowArchitectMobile] = useState(false);
  const [expandedOpId, setExpandedOpId] = useState<string | null>(null);
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
        }
        if (extraction.quarantineItems.length > 0) {
          syncDispatch(Actions.addQuarantineItems(extraction.quarantineItems));
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
      addLog('success', 'NeuralSync', `物語の断片 "${historyEntry.targetName}" が記録されました。`);
    } catch (e: any) {
      addLog('error', 'NeuralSync', '設定の記録に失敗しました。');
      syncDispatch(Actions.removePendingOp(op.id));
    }
  };

  const handleRevert = (entry: HistoryEntry) => {
    uiDispatch(Actions.openDialog({
      isOpen: true,
      type: 'confirm',
      title: '歴史の改変',
      message: `"${entry.targetName}" への変更を取り消し、以前の状態に戻しますか？`,
      onConfirm: () => {
        const { nextBible, nextChapters } = calculateRevertResult(bible, chapters, entry);
        bibleDispatch(Actions.undoBible(nextBible, nextChapters));
        syncDispatch(Actions.removeHistoryEntry(entry.id));
      }
    }));
  };

  const deleteLaw = (lawId: string) => {
    uiDispatch(Actions.openDialog({
      isOpen: true,
      type: 'confirm',
      title: '世界の理の抹消',
      message: 'この世界の法則を削除しますか？物語の整合性に影響を与える可能性があります。',
      onConfirm: () => {
        const nextLaws = foundation.laws.filter(l => l.id !== lawId);
        bibleDispatch(Actions.updateBible({ laws: nextLaws }));
        addLog('info', 'System', '世界の理を更新しました。');
      }
    }));
  };

  return (
    <div className="h-full flex flex-col md:flex-row overflow-hidden bg-stone-950">
      {/* Settings / Plotter Side */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-auto md:h-24 glass border-b border-white/5 flex flex-col md:flex-row items-center justify-between px-6 md:px-10 shrink-0 z-40 pt-safe">
           <div className="flex items-center justify-between w-full md:w-auto py-4 md:py-0">
             <div className="flex items-center gap-3">
               <div className="w-8 h-8 rounded-lg bg-orange-600/20 flex items-center justify-center text-orange-400">
                 <GitBranch size={20} />
               </div>
               <div>
                 <h2 className="text-xl font-display font-black text-white italic tracking-tight">Atelier Plotter</h2>
                 <p className="text-[9px] font-black text-stone-600 uppercase tracking-widest">Story Architecture</p>
               </div>
             </div>
             <div className="md:hidden flex items-center gap-2">
                <button onClick={() => setShowArchitectMobile(true)} className="p-3 bg-stone-800 text-orange-400 rounded-xl relative">
                  <BrainCircuit size={20}/>
                  {pendingChanges.length > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full text-[8px] flex items-center justify-center text-white font-black animate-pulse">{pendingChanges.length}</span>}
                </button>
             </div>
           </div>

           {/* Navigation Tabs - Scrollable on mobile */}
           <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar py-2 -mx-6 px-6 md:mx-0 md:px-0 w-[calc(100%+3rem)] md:w-auto border-t border-white/5 md:border-t-0">
             <TabBtn active={activeTab === 'grandArc'} onClick={() => uiDispatch(Actions.setPlotterTab('grandArc'))} icon={<Layout size={14}/>} label="Structure" />
             <TabBtn active={activeTab === 'characters'} onClick={() => uiDispatch(Actions.setPlotterTab('characters'))} icon={<Users size={14}/>} label="Entities" />
             <TabBtn active={activeTab === 'world'} onClick={() => uiDispatch(Actions.setPlotterTab('world'))} icon={<Globe size={14}/>} label="Setting" />
             <TabBtn active={activeTab === 'timeline'} onClick={() => uiDispatch(Actions.setPlotterTab('timeline'))} icon={<History size={14}/>} label="Timeline" />
             <TabBtn active={activeTab === 'history'} onClick={() => uiDispatch(Actions.setPlotterTab('history'))} icon={<Clock size={14}/>} label="Bible History" />
           </nav>
        </header>

        <main className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-12 pb-32">
          {activeTab === 'characters' && (
            <div className="space-y-8 animate-fade-in">
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-display font-black text-white italic">Characters</h3>
                <button onClick={() => handleSendMessage("新しい登場人物について語り合いたい。")} className="px-6 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">新しい出会い</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {characters.map(char => (
                  <CharacterCard 
                    key={char.id} 
                    character={char} 
                    onGeneratePortrait={() => {}}
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
              <section className="space-y-6">
                 <div className="flex justify-between items-center">
                    <h4 className="text-[10px] font-black text-stone-600 uppercase tracking-widest flex items-center gap-2"><MapPin size={14}/> World Laws</h4>
                    <button onClick={() => handleSendMessage("この世界に新しい独自の物理法則や社会的なルールを追加したい。")} className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-[8px] font-black uppercase text-stone-300 rounded-lg border border-white/5 transition-all flex items-center gap-2">
                       <Plus size={10}/> 新規ルール
                    </button>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {foundation.laws.length === 0 ? (
                      <div className="col-span-full p-8 border border-dashed border-stone-800 rounded-2xl flex items-center justify-center text-stone-700 italic text-[10px] font-serif">
                        世界の理はまだ定義されていません
                      </div>
                    ) : (
                      foundation.laws.map(law => (
                        <div key={law.id} className="p-6 glass-bright rounded-2xl border border-white/5 space-y-3 relative group">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">{law.name}</span>
                            <button onClick={() => deleteLaw(law.id)} className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-rose-600/20 text-stone-600 hover:text-rose-400 rounded-lg transition-all">
                              <Trash size={12} />
                            </button>
                          </div>
                          <p className="text-[12px] text-stone-400 font-serif leading-relaxed italic">"{law.description}"</p>
                        </div>
                      ))
                    )}
                 </div>
              </section>
            </div>
          )}

          {activeTab === 'world' && (
            <div className="space-y-12 animate-fade-in max-w-6xl mx-auto">
              <section className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-display font-black text-white italic flex items-center gap-3"><MapIcon size={24} className="text-orange-400"/> Geography & Cultures</h3>
                  <button onClick={() => handleSendMessage("新しい場所や国について設定を詰めたい。")} className="px-4 py-2 bg-stone-800 text-[9px] font-black uppercase text-stone-300 rounded-lg">+ 新規地域</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {geography.locations.map(loc => (
                    <div key={loc.id} className="p-6 glass-bright rounded-2xl border border-white/5 space-y-3">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">{loc.type}</span>
                        <Landmark size={16} className="text-stone-700" />
                      </div>
                      <h4 className="text-lg font-serif-bold text-stone-100">{loc.name}</h4>
                      <p className="text-[11px] text-stone-400 font-serif leading-relaxed italic">{loc.description}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-6">
                <h3 className="text-2xl font-display font-black text-white italic flex items-center gap-3"><Users size={24} className="text-orange-400"/> Organizations</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {geography.organizations.map(org => (
                    <div key={org.id} className="p-6 glass-bright rounded-2xl border border-white/5 space-y-3">
                      <h4 className="text-base font-serif-bold text-stone-100">{org.name}</h4>
                      <p className="text-[10px] text-stone-500 font-serif leading-relaxed">{org.description}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-display font-black text-white italic flex items-center gap-3"><History size={24} className="text-orange-400"/> Timeline of Events</h3>
                <button onClick={() => handleSendMessage("新しい歴史的イベントを年表に加えたい。")} className="px-4 py-2 bg-stone-800 text-[9px] font-black uppercase text-stone-300 rounded-lg">+ イベント追加</button>
              </div>
              <div className="relative space-y-12 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-stone-800 before:to-transparent">
                {plot.timeline.map((event, idx) => (
                  <div key={event.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border border-stone-800 bg-stone-900 text-orange-400 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                      <Flag size={16} />
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-6 glass-bright rounded-2xl border border-white/5 space-y-2">
                      <div className="flex justify-between items-center">
                        <time className="text-[10px] font-mono font-black text-stone-600 uppercase">{event.timeLabel}</time>
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${event.importance === 'Climax' ? 'bg-orange-500/20 text-orange-400' : 'bg-stone-800 text-stone-500'}`}>{event.importance}</span>
                      </div>
                      <h4 className="text-base font-serif-bold text-stone-100">{event.event}</h4>
                      <p className="text-[11px] text-stone-400 font-serif leading-relaxed italic">{event.description}</p>
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
                <h3 className="text-2xl font-display font-black text-white italic">Revision History</h3>
              </div>
              <div className="space-y-4">
                  {bibleHistory.length === 0 ? (
                    <div className="p-12 text-center text-stone-700 italic font-serif">変更履歴はまだありません。</div>
                  ) : (
                    bibleHistory.map(entry => (
                      <div key={entry.id} className="p-6 glass-bright rounded-2xl border border-white/5 flex flex-col md:flex-row gap-6 relative group">
                        <div className="shrink-0 flex md:flex-col items-center gap-2 border-r border-white/5 pr-6">
                          <div className="w-10 h-10 rounded-full bg-stone-900 flex items-center justify-center text-orange-400 font-mono text-xs">V{entry.versionAtCommit}</div>
                          <div className="text-[8px] font-mono text-stone-700">{new Date(entry.timestamp).toLocaleTimeString()}</div>
                        </div>
                        <div className="flex-1 space-y-4">
                          <h4 className="text-[11px] font-serif-bold text-stone-100">{entry.targetName}</h4>
                          <VisualDiff oldVal={entry.oldValue} newVal={entry.newValue} />
                        </div>
                        <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button onClick={() => handleRevert(entry)} className="p-3 bg-stone-800 hover:bg-rose-600/20 text-stone-500 hover:text-rose-400 rounded-xl transition-all"><Undo2 size={16}/></button>
                        </div>
                      </div>
                    ))
                  )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Companion Side (Architect) */}
      <aside className={`fixed inset-0 z-[200] md:relative md:inset-auto md:z-auto w-full md:w-[480px] lg:w-[560px] glass md:bg-stone-900 border-l border-white/5 flex flex-col shrink-0 transition-transform duration-500 ease-in-out ${showArchitectMobile ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
         <div className="p-8 border-b border-white/5 flex justify-between items-center bg-stone-900 shrink-0 pt-safe">
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 rounded-full border border-orange-500/20 flex items-center justify-center text-orange-400 shadow-xl bg-orange-500/5">
                  <Feather size={20} />
               </div>
               <div>
                 <span className="text-[11px] font-black text-white uppercase tracking-[0.3em]">Story Companion</span>
                 <p className="text-[8px] font-black text-orange-500 uppercase tracking-widest italic font-display">Neural Sympathy</p>
               </div>
            </div>
            <button onClick={() => setShowArchitectMobile(false)} className="md:hidden p-3 text-stone-500"><X size={24}/></button>
         </div>

         <div className="flex-1 flex flex-col min-h-0 relative bg-stone-950/20">
            <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-12 custom-scrollbar">
               {displayHistory.length === 0 && blueprintSuggestions.length > 0 && (
                 <div className="space-y-6 animate-fade-in mb-12">
                   <div className="flex items-center gap-3 px-4">
                      <Lightbulb size={16} className="text-orange-400" />
                      <span className="text-[10px] font-black text-stone-500 uppercase tracking-widest">Blueprint Suggestions</span>
                   </div>
                   <div className="flex flex-wrap gap-2 px-2">
                      {blueprintSuggestions.map((s, idx) => (
                        <button 
                          key={idx} 
                          onClick={() => handleSendMessage(s.prompt)}
                          className="px-4 py-2 bg-stone-800/40 hover:bg-orange-600/20 border border-white/5 hover:border-orange-500/40 rounded-full text-[10px] font-black text-stone-400 hover:text-white transition-all flex items-center gap-2 group"
                        >
                          <span className="group-hover:scale-110 transition-transform">{s.icon}</span>
                          {s.label}
                        </button>
                      ))}
                   </div>
                 </div>
               )}

               {displayHistory.map((msg, idx) => (
                 <div key={msg.id} className={`flex flex-col gap-4 ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in`}>
                   <div className={`max-w-[92%] px-6 py-5 rounded-[2rem] leading-loose tracking-wide ${msg.role === 'user' ? 'bg-stone-800 text-stone-200 shadow-xl' : 'text-stone-100 font-serif font-light'}`}>
                     <p className="text-[14px] md:text-[15px] whitespace-pre-wrap">{msg.content}</p>
                     {msg.sources && msg.sources.length > 0 && (
                       <div className="mt-6 pt-4 border-t border-white/5 flex flex-wrap gap-2">
                          {msg.sources.map((s, i) => (
                            <a key={i} href={s.uri} target="_blank" rel="noopener noreferrer" className="px-2 py-1 bg-stone-950/40 rounded text-[8px] font-black text-orange-400/60 hover:text-white transition-colors flex items-center gap-1"><Globe size={10}/> {s.title}</a>
                          ))}
                       </div>
                     )}
                   </div>
                 </div>
               ))}
               
               {(isChatting || isAnalyzing) && (
                 <div className="flex flex-col gap-3 items-start animate-fade-in">
                   <div className="flex items-center gap-4 text-stone-600 px-6">
                     <div className="relative">
                        <div className="w-8 h-8 rounded-full border border-stone-800 flex items-center justify-center">
                           <Feather size={14} className="animate-bounce" />
                        </div>
                        <div className="absolute inset-0 rounded-full border border-orange-500/20 animate-ping" />
                     </div>
                     <span className="text-[10px] font-black uppercase tracking-[0.2em] italic">伴走者が思考を巡らせています...</span>
                   </div>
                 </div>
               )}

               {sortedPendingChanges.length > 0 && (
                 <div className="space-y-6 pt-16 border-t border-white/5">
                   <div className="flex items-center justify-between px-2">
                     <h4 className="text-[10px] font-black text-orange-400 uppercase tracking-[0.4em] flex items-center gap-3">
                       <Sparkles size={14} className="animate-pulse" /> Fragments of Revelation
                     </h4>
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

            <div className="p-6 md:p-8 bg-stone-900/80 backdrop-blur-xl border-t border-white/5">
               {blueprintSuggestions.length > 0 && displayHistory.length > 0 && (
                 <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-4 -mx-2 px-2">
                    {blueprintSuggestions.slice(0, 3).map((s, idx) => (
                      <button 
                        key={idx} 
                        onClick={() => handleSendMessage(s.prompt)}
                        className="shrink-0 px-3 py-1.5 bg-stone-950/60 hover:bg-orange-600/20 border border-white/5 rounded-full text-[8px] font-black text-stone-500 hover:text-white transition-all flex items-center gap-2"
                      >
                        {s.icon} {s.label}
                      </button>
                    ))}
                 </div>
               )}
               <div className="relative">
                 <textarea 
                   value={input}
                   onChange={e => setInput(e.target.value)}
                   onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                   placeholder="物語の続き、あるいは世界の秘密について話す..."
                   className="w-full bg-stone-950 border border-white/5 rounded-[2.5rem] p-8 pr-20 text-[14px] text-stone-200 outline-none focus:border-orange-500/30 transition-all resize-none h-32 md:h-40 shadow-2xl custom-scrollbar font-serif leading-relaxed"
                 />
                 <button 
                   onClick={() => handleSendMessage()}
                   disabled={!input.trim() || isChatting}
                   className="absolute right-6 bottom-6 w-14 h-14 bg-orange-600 text-white rounded-full flex items-center justify-center shadow-2xl hover:bg-orange-500 transition-all active:scale-95 disabled:opacity-40"
                 >
                   <Send size={22} />
                 </button>
               </div>
            </div>
         </div>
      </aside>
    </div>
  );
};

const TabBtn = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
  <button onClick={onClick} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all shrink-0 ${active ? 'bg-orange-600 text-white shadow-lg' : 'text-stone-500 hover:text-stone-300 hover:bg-stone-800'}`}>
    {icon}
    <span>{label}</span>
  </button>
);

export default PlotterView;
