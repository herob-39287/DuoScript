
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { generateDraftStream, suggestNextSentence, generateFullChapterPackage, generateSpeech, getSafetyAlternatives } from '../services/geminiService';
import { 
  useManuscript, useBible, useUI, useMetadata, 
  useManuscriptDispatch, useMetadataDispatch, useNotificationDispatch, 
  useUIDispatch, useNeuralSync 
} from '../contexts/StoryContext';
import * as Actions from '../store/actions';
import { saveChapterContent } from '../services/storageService';
import { 
  Sparkles, Plus, Maximize2, Minimize2, Loader2, Feather, LayoutDashboard, Pen, 
  X, Info, BookOpen, AlignLeft, AlignRight, CheckCircle2, MessageCircle, Zap, RotateCcw, Menu,
  Volume2, Flag, TrendingUp, Trash2, ThumbsUp, ThumbsDown, ShieldOff, Quote, ShieldAlert, RefreshCw, Brain
} from 'lucide-react';
import { ViewMode, PlotBeat, ForeshadowingLink, WhisperAdvice } from '../types';
import { useManuscriptEditor } from '../hooks/useManuscriptEditor';
import { translateSafetyCategory } from '../services/gemini/utils';

const WriterView: React.FC = () => {
  const chapters = useManuscript();
  const projectDispatch = useManuscriptDispatch();
  const bible = useBible();
  const meta = useMetadata();
  const { title: projectTitle, preferences, violationCount } = meta;
  const metaDispatch = useMetadataDispatch();
  const { addLog } = useNotificationDispatch();
  const ui = useUI();
  const uiDispatch = useUIDispatch();
  const sync = useNeuralSync();

  const project = useMemo(() => ({ meta, bible, chapters, sync }), [meta, bible, chapters, sync]);

  const [isProcessing, setIsProcessing] = useState(false);

  const {
    activeChapter,
    activeChapterId,
    setActiveChapterId,
    isLoadingContent,
    wordCount,
    setWordCount,
    whisper,
    setWhisper,
    isWhispering,
    textareaRef,
    handleTextChange,
    triggerWhisper
  } = useManuscriptEditor(chapters[0]?.id || '', isProcessing);

  const [isZenMode, setIsZenMode] = useState(false);
  const [isVertical, setIsVertical] = useState(false);
  const [copilotSuggestions, setCopilotSuggestions] = useState<string[]>([]);
  const [isCopilotLoading, setIsCopilotLoading] = useState(false);
  const [showPlanner, setShowPlanner] = useState(window.innerWidth > 1024);
  const [showManuscriptMobile, setShowManuscriptMobile] = useState(false);
  const [fontSize] = useState(window.innerWidth < 768 ? 16 : 22);
  const [completedBeats, setCompletedBeats] = useState<Set<string>>(new Set());
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [newForeshadowingId, setNewForeshadowingId] = useState('');
  const [newForeshadowingAction, setNewForeshadowingAction] = useState<ForeshadowingLink['action']>('Plant');
  const [newForeshadowingNote, setNewForeshadowingNote] = useState('');

  const [isSafetyMitigating, setIsSafetyMitigating] = useState(false);

  useEffect(() => {
    if (!newForeshadowingId && bible.foreshadowing.length > 0) {
      setNewForeshadowingId(bible.foreshadowing[0].id);
    }
  }, [newForeshadowingId, bible.foreshadowing]);

  const toggleBeat = useCallback((id: string) => {
    setCompletedBeats(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleAddForeshadowingLink = useCallback(() => {
    if (!activeChapter || !newForeshadowingId) return;
    const updatedLinks = [...(activeChapter.foreshadowingLinks ?? []), { foreshadowingId: newForeshadowingId, action: newForeshadowingAction, note: newForeshadowingNote.trim() }];
    projectDispatch(Actions.updateChapter(activeChapter.id, { foreshadowingLinks: updatedLinks }));
    setNewForeshadowingNote('');
  }, [activeChapter, newForeshadowingAction, newForeshadowingId, newForeshadowingNote, projectDispatch]);

  const handleRemoveForeshadowingLink = useCallback((index: number) => {
    if (!activeChapter) return;
    const updatedLinks = (activeChapter.foreshadowingLinks ?? []).filter((_, idx) => idx !== index);
    projectDispatch(Actions.updateChapter(activeChapter.id, { foreshadowingLinks: updatedLinks }));
  }, [activeChapter, projectDispatch]);

  const handleSuggest = async () => {
    const currentVal = textareaRef.current?.value || "";
    if (isCopilotLoading || !currentVal.trim() || !activeChapterId) return;
    setIsCopilotLoading(true);
    try {
      const suggestions = await suggestNextSentence(currentVal, project, activeChapterId, (usage) => metaDispatch(Actions.trackUsage(usage)), addLog);
      setCopilotSuggestions(suggestions);
    } catch (e: any) {
      if (e.message === 'SAFETY_BLOCK') {
        handleSafetyBlock(currentVal, e.safetyCategory);
      } else {
        addLog('error', 'Writer', '続きの提案に失敗しました。');
      }
    } finally {
      setIsCopilotLoading(false);
    }
  };

  const handleSafetyBlock = async (blockedInput: string, category?: string) => {
    metaDispatch({ type: 'RECORD_VIOLATION', payload: { timestamp: Date.now(), category, inputSnippet: blockedInput.slice(-100) } });
    addLog('error', 'Safety', `安全ポリシー「${translateSafetyCategory(category)}」に抵触した可能性があるため、生成が制限されました。`);
    
    setIsSafetyMitigating(true);
    try {
      const alternatives = await getSafetyAlternatives(blockedInput.slice(-300), translateSafetyCategory(category), addLog);
      uiDispatch(Actions.setSafetyIntervention({
        isOpen: true,
        category: translateSafetyCategory(category),
        reason: "入力された表現、または生成しようとした展開が安全フィルターを刺激しました。",
        alternatives,
        isLocked: (violationCount || 0) >= 4
      }));
    } catch (e) {
      uiDispatch(Actions.setSafetyIntervention({ isOpen: true, category: "不明", alternatives: [], isLocked: (violationCount || 0) >= 4 }));
    } finally {
      setIsSafetyMitigating(false);
    }
  };

  const handleGenDraft = async () => {
    if (!activeChapter || isProcessing) return;
    if ((violationCount || 0) >= 5) {
      addLog('error', 'Safety', '連続的な安全ポリシー違反により、一時的にAI機能がロックされています。');
      return;
    }

    setIsProcessing(true);
    addLog('info', 'Writer', '物語を紡いでいます...');
    try {
      const currentVal = textareaRef.current?.value || "";
      const stream = await generateDraftStream({ ...activeChapter, content: currentVal }, bible.tone, true, project, addLog);
      let fullDraft = currentVal + (currentVal ? "\n\n" : "");
      
      try {
        for await (const chunk of stream) {
          if (chunk.text) {
            fullDraft += chunk.text;
            if (textareaRef.current) {
              textareaRef.current.value = fullDraft;
              textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
            }
            setWordCount(fullDraft.length);
          }
        }
        projectDispatch(Actions.setChapterContent(activeChapter.id, fullDraft));
        projectDispatch(Actions.updateChapter(activeChapter.id, { status: 'Drafting' }));
        saveChapterContent(meta.id, activeChapter.id, meta.headRev || 1, fullDraft);
        addLog('success', 'Writer', '物語の紡ぎが完了しました。');
      } catch (e: any) {
        if (e.message?.includes('SAFETY')) {
           handleSafetyBlock(fullDraft, "HARM_CATEGORY_UNKNOWN");
        } else {
           throw e;
        }
      }
    } catch (e: any) { 
      if (e.message === 'SAFETY_BLOCK') {
        handleSafetyBlock(textareaRef.current?.value || "", e.safetyCategory);
      } else {
        addLog('error', 'Writer', '執筆中に不具合が発生しました。');
      }
    } finally { 
      setIsProcessing(false); 
    }
  };

  const handlePlayDialogue = async () => {
    const selection = window.getSelection()?.toString();
    if (!selection || isPlayingVoice) return;
    setIsPlayingVoice(true);
    try {
      const audioBuffer = await generateSpeech(selection, 'Zephyr', (u: any) => metaDispatch(Actions.trackUsage(u)), addLog);
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const dataInt16 = new Int16Array(audioBuffer);
      const buffer = audioCtx.createBuffer(1, dataInt16.length, 24000);
      const channelData = buffer.getChannelData(0);
      for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      source.onended = () => setIsPlayingVoice(false);
      source.start();
    } catch (e) {
      addLog('error', 'Voice', '音声再生に失敗しました。');
      setIsPlayingVoice(false);
    }
  };

  const handleWhisperFeedback = (feedback: 'Useful' | 'FalsePositive' | 'Disabled') => {
    if (!whisper) return;
    if (feedback === 'Disabled') {
      const currentDisabled = preferences.disabledLinterRules || [];
      metaDispatch(Actions.updatePreferences({ 
        disabledLinterRules: Array.from(new Set([...currentDisabled, whisper.ruleId])) 
      }));
      addLog('info', 'System', `指摘ルール "${whisper.ruleId}" を無効化しました。`);
    } else if (feedback === 'FalsePositive') {
      addLog('info', 'System', '誤検知を記録しました。今後の精度改善に役立てます。');
    }
    setWhisper(null);
  };

  if (isLoadingContent) return <div className="h-full flex flex-col items-center justify-center bg-stone-950 text-stone-500 gap-4"><Loader2 size={40} className="animate-spin text-orange-400 opacity-20" /><p className="font-serif italic animate-pulse">羊皮紙を広げています...</p></div>;

  const progressPercentage = Math.round((completedBeats.size / (activeChapter?.beats?.length || 1)) * 100);

  return (
    <div className={`h-full flex flex-col md:flex-row overflow-hidden bg-stone-950 transition-all duration-1000 ${isZenMode ? 'bg-[#100e0c]' : ''}`}>
      <aside className={`${showManuscriptMobile ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} fixed inset-0 z-[200] md:relative md:inset-auto md:z-auto w-full md:w-72 glass md:bg-stone-900/40 border-r border-white/5 flex flex-col shrink-0 transition-transform duration-500 ease-in-out`}>
        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-stone-900 shrink-0 pt-safe">
          <span className="text-[10px] font-black text-orange-400 uppercase tracking-[0.3em]">Manuscript</span>
          <div className="flex gap-2">
            <button onClick={() => { const id = crypto.randomUUID(); projectDispatch(Actions.addChapter({ id, title: '新章', summary: '', content: '', scenes: [], beats: [], strategy: { milestones: [], forbiddenResolutions: [], characterArcProgress: '', pacing: '' }, status: 'Idea', wordCount: 0, draftVersion: 0, stateDeltas: [], involvedCharacterIds: [], foreshadowingLinks: [], updatedAt: Date.now() })); setActiveChapterId(id); setShowManuscriptMobile(false); }} className="p-3 bg-stone-800 hover:bg-orange-600 text-orange-400 hover:text-white rounded-xl transition-all shadow-lg"><Plus size={18}/></button>
            <button className="md:hidden p-3 text-stone-500" onClick={() => setShowManuscriptMobile(false)}><X size={20}/></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar pb-32">
          {chapters.map((ch, idx) => (
            <button key={ch.id} onClick={() => { setActiveChapterId(ch.id); setShowManuscriptMobile(false); }} className={`w-full text-left p-5 rounded-2xl border transition-all relative group overflow-hidden ${activeChapterId === ch.id ? 'bg-orange-600/10 border-orange-500/30 text-white' : 'text-stone-500 border-transparent hover:bg-white/5'}`}>
              <div className="flex items-center gap-4 relative z-10">
                <span className="text-[10px] font-mono text-orange-500/40">{(idx+1).toString().padStart(2, '0')}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-serif-bold truncate">{ch.title}</div>
                  <div className="text-[8px] font-black uppercase tracking-widest mt-1 opacity-40">{ch.status}</div>
                </div>
              </div>
              {activeChapterId === ch.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500" />}
            </button>
          ))}
        </div>
      </aside>

      <div className="flex-1 flex flex-col relative overflow-hidden">
        <header className={`h-20 md:h-24 glass border-b border-white/5 flex items-center justify-between px-4 md:px-10 shrink-0 z-40 transition-all duration-700 ${isZenMode ? 'opacity-0 translate-y-[-100%] hover:opacity-100 hover:translate-y-0 bg-[#100e0c]/95' : ''}`}>
           <div className="flex items-center gap-2 md:gap-8 min-w-0">
              <button onClick={() => setShowManuscriptMobile(true)} className="md:hidden p-3 text-orange-400"><Menu size={22}/></button>
              <div className="flex flex-col min-w-0">
                <input defaultValue={activeChapter?.title} key={`title-${activeChapter?.id}`} onChange={e => projectDispatch(Actions.updateChapter(activeChapter!.id, { title: e.target.value }))} className="bg-transparent text-white font-display font-black italic text-lg md:text-2xl outline-none focus:text-orange-400 transition-all w-full truncate" />
                <span className="text-[8px] md:text-[9px] font-mono text-stone-500 tracking-widest uppercase">{wordCount.toLocaleString()} 文字</span>
              </div>
           </div>
           <div className="flex items-center gap-1.5 md:gap-6">
              <button onClick={handlePlayDialogue} disabled={isPlayingVoice} className={`flex items-center gap-2 px-2.5 py-2 md:px-4 md:py-2 rounded-xl border border-white/5 text-stone-500 hover:text-orange-400 transition-all ${isPlayingVoice ? 'animate-pulse text-orange-400' : ''}`}><Volume2 size={16}/><span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest">再生</span></button>
              <button onClick={() => setIsVertical(!isVertical)} className={`flex items-center gap-2 px-2.5 py-2 md:px-4 md:py-2 rounded-xl border transition-all ${isVertical ? 'bg-orange-600 border-orange-500 text-white' : 'bg-stone-800 border-white/5 text-stone-500 hover:text-stone-200'}`}>{isVertical ? <AlignRight size={16}/> : <AlignLeft size={16}/>}</button>
              <button onClick={() => setIsZenMode(!isZenMode)} className="p-2.5 md:p-4 rounded-xl bg-stone-800 text-stone-500 hover:text-white transition-all">{isZenMode ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}</button>
              {!isZenMode && <button onClick={() => setShowPlanner(!showPlanner)} className={`p-2.5 md:p-4 rounded-xl transition-all ${showPlanner ? 'bg-orange-600/20 text-orange-400 border border-orange-500/20' : 'bg-stone-800 text-stone-500'}`}><LayoutDashboard size={16}/></button>}
           </div>
        </header>

        <div className="flex-1 flex overflow-hidden relative">
          <main className={`flex-1 overflow-x-auto overflow-y-auto custom-scrollbar relative paper-texture transition-colors duration-1000 ${isZenMode ? 'bg-[#100e0c]' : 'bg-stone-950/20'}`}>
            <div className={`max-w-5xl mx-auto px-6 md:px-24 py-12 md:py-32 min-h-full flex flex-col items-center ${isVertical ? 'writing-vertical' : ''}`}>
              <textarea ref={textareaRef} className={`w-full bg-transparent text-stone-200 prose-literary outline-none resize-none min-h-[70vh] caret-orange-500 focus-ring rounded-xl p-4 transition-all ${isVertical ? 'leading-[3] tracking-[0.2em]' : ''}`} onInput={handleTextChange} style={{ fontSize: `${fontSize}px` }} placeholder="ここから物語の続きを..." />
              <div className="h-48 md:h-96 shrink-0" />
            </div>

            {/* Safety Intervention Overlay */}
            {ui.safetyIntervention.isOpen && (
               <div className="fixed inset-0 z-[500] bg-stone-950/80 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
                  <div className="bg-stone-900 max-w-lg w-full rounded-[2.5rem] border border-amber-500/30 shadow-[0_30px_60px_-15px_rgba(245,158,11,0.3)] overflow-hidden flex flex-col scale-in">
                     <div className="p-8 border-b border-amber-500/10 bg-amber-500/5 space-y-4">
                        <div className="flex items-center gap-4">
                           <div className="p-3 bg-amber-600 rounded-2xl text-white shadow-xl shadow-amber-900/20"><ShieldAlert size={28}/></div>
                           <div>
                              <h3 className="text-xl font-black text-white italic tracking-tighter uppercase">Safety Intervention</h3>
                              <p className="text-amber-500 text-[10px] font-black uppercase tracking-widest mt-0.5">ポリシーによる制限</p>
                           </div>
                        </div>
                        <div className="p-4 bg-stone-950/60 rounded-2xl border border-white/5 space-y-2">
                           <div className="flex justify-between items-center"><span className="text-[9px] font-black text-stone-500 uppercase tracking-widest">検知されたカテゴリ</span><span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">{ui.safetyIntervention.category}</span></div>
                           <p className="text-[11px] text-stone-400 font-serif leading-relaxed italic">{ui.safetyIntervention.reason}</p>
                        </div>
                     </div>

                     <div className="flex-1 p-8 space-y-6 overflow-y-auto no-scrollbar">
                        <div className="space-y-4">
                           <h4 className="text-[10px] font-black text-stone-500 uppercase tracking-[0.3em] flex items-center gap-2"><Sparkles size={14}/> 創作を継続するための代替案</h4>
                           {isSafetyMitigating ? (
                              <div className="flex items-center justify-center py-10 text-stone-600 gap-3"><Loader2 size={16} className="animate-spin" /><span className="text-[10px] font-black uppercase tracking-widest">代案を考案中...</span></div>
                           ) : ui.safetyIntervention.alternatives.length > 0 ? (
                              <div className="grid grid-cols-1 gap-3">
                                 {ui.safetyIntervention.alternatives.map((alt, i) => (
                                    <button key={i} onClick={() => { uiDispatch(Actions.setSafetyIntervention({ isOpen: false })); if (textareaRef.current) { const currentVal = textareaRef.current.value; const newVal = currentVal + (currentVal.endsWith(' ') ? '' : ' ') + alt; textareaRef.current.value = newVal; setWordCount(newVal.length); projectDispatch(Actions.setChapterContent(activeChapterId!, newVal)); } }} className="w-full text-left p-4 bg-stone-950/40 hover:bg-amber-600/10 border border-white/5 hover:border-amber-500/40 rounded-2xl text-[11px] font-serif-bold text-stone-300 hover:text-white transition-all">» {alt}</button>
                                 ))}
                              </div>
                           ) : (
                              <p className="text-[11px] text-stone-600 font-serif italic text-center">適切な代替案が見つかりませんでした。表現を少し和らげて再度お試しください。</p>
                           )}
                        </div>
                     </div>

                     <div className="p-4 bg-stone-950/60 border-t border-amber-500/10 flex gap-3">
                        <button onClick={() => uiDispatch(Actions.setSafetyIntervention({ isOpen: false }))} className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-stone-500 hover:text-white">閉じる</button>
                        <button onClick={() => { uiDispatch(Actions.setSafetyIntervention({ isOpen: false })); handleGenDraft(); }} disabled={ui.safetyIntervention.isLocked} className="flex-1 py-4 bg-stone-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-stone-700 transition-all active:scale-95 disabled:opacity-40">
                           {ui.safetyIntervention.isLocked ? "ロック中" : "修正して再試行"} <RefreshCw size={14} />
                        </button>
                     </div>
                  </div>
               </div>
            )}

            {whisper && (
              <div className="fixed bottom-32 md:bottom-auto md:top-28 right-4 md:right-12 w-[calc(100%-2rem)] md:w-96 animate-fade-in z-[60]">
                <div className={`p-5 md:p-6 rounded-3xl glass-bright border shadow-3xl relative overflow-hidden group flex flex-col gap-4 ${whisper.type === 'alert' ? 'border-rose-500/40' : 'border-orange-500/40'}`}>
                   <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <Zap size={16} className={whisper.type === 'alert' ? 'text-rose-400' : 'text-orange-400'} />
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-stone-500">Architect's Whisper</span>
                      </div>
                      <button onClick={() => setWhisper(null)} className="text-stone-700 hover:text-white p-1 transition-colors"><X size={18}/></button>
                   </div>
                   
                   <p className="text-[12px] md:text-[13px] font-serif-bold leading-relaxed text-stone-200 italic">{whisper.text}</p>
                   
                   {whisper.citations && whisper.citations.length > 0 && (
                     <div className="space-y-2 pt-2">
                        <div className="flex items-center gap-2 text-[8px] font-black text-stone-600 uppercase tracking-widest"><Quote size={10}/> 根拠の引用</div>
                        <div className="grid grid-cols-1 gap-1.5">
                          {whisper.citations.map((cite, i) => (
                            <div key={i} className="p-2 bg-stone-950/40 rounded-xl border border-white/5 space-y-1">
                               <div className="flex justify-between items-center"><span className="text-[7px] font-black text-orange-500/60 uppercase">{cite.label}</span><span className="text-[7px] text-stone-700 font-mono">{cite.sourceType}</span></div>
                               <p className="text-stone-400 font-serif leading-relaxed line-clamp-2">"{cite.textSnippet}"</p>
                            </div>
                          ))}
                        </div>
                     </div>
                   )}

                   <div className="flex items-center justify-between pt-2 border-t border-white/5">
                      <div className="flex gap-2">
                         <button onClick={() => handleWhisperFeedback('Useful')} className="p-2.5 bg-stone-800 hover:bg-emerald-600/20 text-stone-500 hover:text-emerald-400 rounded-xl transition-all" title="役に立った"><ThumbsUp size={14}/></button>
                         <button onClick={() => handleWhisperFeedback('FalsePositive')} className="p-2.5 bg-stone-800 hover:bg-rose-600/20 text-stone-500 hover:text-rose-400 rounded-xl transition-all" title="誤検知"><ThumbsDown size={14}/></button>
                         <button onClick={() => handleWhisperFeedback('Disabled')} className="p-2.5 bg-stone-800 hover:bg-stone-700 text-stone-600 hover:text-stone-200 rounded-xl transition-all" title="この種のアドバイスを停止"><ShieldOff size={14}/></button>
                      </div>
                      <span className="text-[7px] font-mono text-stone-700 uppercase tracking-widest">Rule: {whisper.ruleId}</span>
                   </div>

                   <div className="absolute bottom-0 left-0 h-1 bg-white/5 w-full"><div className={`h-full animate-[whisperLife_20s_linear_forwards] ${whisper.type === 'alert' ? 'bg-rose-500' : 'bg-orange-500'}`} /></div>
                </div>
              </div>
            )}

            {copilotSuggestions.length > 0 && (
              <div className="fixed bottom-28 md:bottom-32 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-3xl animate-fade-in z-50">
                 <div className="glass-bright rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 border border-orange-500/40 shadow-2xl space-y-4 md:space-y-6">
                    <div className="flex justify-between items-center"><span className="text-[10px] md:text-[11px] font-black text-orange-400 uppercase tracking-[0.3em] flex items-center gap-2"><Sparkles size={16} /> AI Copilot</span><button onClick={() => setCopilotSuggestions([])} className="p-2 text-stone-500 hover:text-white"><X size={20}/></button></div>
                    <div className="grid grid-cols-1 gap-3 md:gap-4">
                      {copilotSuggestions.map((text, idx) => (
                        <button key={idx} onClick={() => { const currentVal = textareaRef.current?.value || ""; const newText = currentVal + (currentVal.endsWith(' ') || currentVal.endsWith('\n') ? '' : ' ') + text; if (textareaRef.current) textareaRef.current.value = newText; setWordCount(newText.length); projectDispatch(Actions.setChapterContent(activeChapter!.id, newText)); saveChapterContent(meta.id, activeChapter!.id, meta.headRev || 1, newText); setCopilotSuggestions([]); }} className="w-full text-left p-4 md:p-6 bg-stone-900/60 hover:bg-orange-600/20 border border-white/5 hover:border-orange-500/40 rounded-[1.5rem] md:rounded-[2rem] text-[11px] md:text-sm font-serif-bold text-stone-300 hover:text-white transition-all">» {text}</button>
                      ))}
                    </div>
                 </div>
              </div>
            )}

            <div className={`fixed bottom-24 md:bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-3 md:gap-4 p-2 md:p-3 glass rounded-full md:rounded-[2.5rem] border border-white/10 z-50 shadow-2xl transition-all duration-700 ${isZenMode ? 'opacity-20 hover:opacity-100 scale-90 translate-y-4' : ''}`}>
               <div className="hidden sm:flex items-center gap-2 px-4 border-r border-white/10 mr-2"><div className="w-10 h-1 rounded-full bg-stone-800 overflow-hidden"><div className="h-full bg-orange-500 transition-all duration-1000" style={{ width: `${progressPercentage}%` }} /></div><span className="text-[9px] font-mono text-stone-500">{progressPercentage}%</span></div>
               <button onClick={handleSuggest} disabled={isCopilotLoading} className="p-4 bg-stone-800 text-orange-400 hover:bg-orange-600 hover:text-white rounded-full md:rounded-2xl transition-all disabled:opacity-50 active:scale-95 group relative">{isCopilotLoading ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}</button>
               
               <button onClick={() => triggerWhisper()} disabled={isWhispering} className={`p-4 rounded-full md:rounded-2xl transition-all disabled:opacity-50 active:scale-95 group relative ${isWhispering ? 'bg-orange-600 text-white' : 'bg-stone-800 text-stone-400 hover:text-orange-400'}`}>
                 {isWhispering ? <Loader2 size={20} className="animate-spin" /> : <Brain size={20} />}
                 {!isWhispering && <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-stone-900 text-[8px] text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-white/5">設計士のささやき</div>}
               </button>

               <button onClick={handleGenDraft} disabled={isProcessing} className="flex items-center gap-2 md:gap-4 px-6 md:px-8 py-4 md:py-5 bg-orange-600 text-white rounded-full md:rounded-[1.5rem] font-black text-[10px] md:text-[12px] uppercase tracking-[0.2em] hover:bg-orange-500 transition-all shadow-2xl active:scale-95 disabled:opacity-50">{isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Pen size={18} />}<span className="hidden xs:inline">AI執筆</span></button>
               <div className="w-px h-8 md:h-10 bg-white/10 mx-1 md:mx-2" />
               <button onClick={() => uiDispatch(Actions.setView(ViewMode.PLOTTER))} className="p-4 text-stone-500 hover:text-white"><MessageCircle size={22} /></button>
            </div>
          </main>

          {showPlanner && !isZenMode && activeChapter && (
            <aside className="fixed inset-0 z-[210] md:relative md:inset-auto md:z-auto w-full md:w-[420px] glass md:bg-stone-900 border-l border-white/5 flex flex-col p-6 md:p-10 space-y-8 md:space-y-12 animate-fade-in overflow-y-auto custom-scrollbar pt-safe">
               <div className="flex md:hidden justify-end pb-4"><button onClick={() => setShowPlanner(false)} className="p-3 text-stone-500"><X size={28}/></button></div>
               <section className="space-y-4">
                 <div className="flex items-center justify-between"><div className="flex items-center gap-3"><BookOpen size={16} className="text-orange-400" /><span className="text-[10px] font-black text-stone-500 uppercase tracking-[0.3em]">Synopsis</span></div><button className="text-stone-700 hover:text-orange-400"><RotateCcw size={14}/></button></div>
                 <textarea defaultValue={activeChapter.summary} key={`summary-${activeChapter.id}`} onChange={e => projectDispatch(Actions.updateChapter(activeChapter.id, { summary: e.target.value }))} className="w-full bg-stone-950/50 border border-white/5 rounded-2xl p-5 text-[12px] h-32 md:h-44 outline-none font-serif-bold resize-none text-stone-300 focus:border-orange-500/30 transition-all shadow-inner" placeholder="章のあらすじ..." />
               </section>
               <section className="space-y-4 md:space-y-6">
                 <div className="flex items-center justify-between"><div className="flex items-center gap-3"><Feather size={16} className="text-orange-400" /><span className="text-[10px] font-black text-stone-500 uppercase tracking-[0.3em]">Plot Beats</span></div><span className="text-[9px] font-mono text-stone-600">{completedBeats.size} / {(activeChapter.beats || []).length}</span></div>
                 <div className="space-y-3">
                    {(activeChapter.beats || []).map((beat) => (
                      <BeatItem key={beat.id} beat={beat} isCompleted={completedBeats.has(beat.id)} onToggle={toggleBeat} />
                    ))}
                 </div>
               </section>
               <section className="space-y-4">
                 <div className="flex items-center justify-between"><div className="flex items-center gap-3"><Flag size={16} className="text-orange-400" /><span className="text-[10px] font-black text-stone-500 uppercase tracking-[0.3em]">Foreshadowing</span></div><span className="text-[9px] font-mono text-stone-600">{(activeChapter.foreshadowingLinks ?? []).length}</span></div>
                 <div className="space-y-3">
                   {(activeChapter.foreshadowingLinks ?? []).map((link, idx) => (
                     <div key={idx} className="p-3 bg-stone-900/60 border border-white/5 rounded-2xl flex items-start gap-3">
                       <div className={`mt-0.5 ${link.action === 'Plant' ? 'text-orange-400' : 'text-emerald-400'}`}><Flag size={14} /></div>
                       <div className="flex-1 min-w-0">
                         <div className="text-[10px] font-black text-stone-300 uppercase tracking-widest">{link.action === 'Plant' ? '提示' : '回収'}</div>
                         <div className="text-[11px] text-stone-200 font-serif-bold truncate">{bible.foreshadowing.find(f => f.id === link.foreshadowingId)?.title || '伏線'}</div>
                       </div>
                       <button onClick={() => handleRemoveForeshadowingLink(idx)} className="p-2 text-stone-600 hover:text-rose-400"><Trash2 size={14} /></button>
                     </div>
                   ))}
                   <select value={newForeshadowingId} onChange={e => setNewForeshadowingId(e.target.value)} className="w-full bg-stone-950/60 border border-white/5 rounded-2xl px-4 py-4 text-[11px] text-stone-300 appearance-none">
                     <option value="">伏線を選択...</option>
                     {bible.foreshadowing.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
                   </select>
                   <button onClick={handleAddForeshadowingLink} disabled={!newForeshadowingId} className="w-full py-4 bg-stone-800 hover:bg-orange-600 text-stone-200 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">リンクを追加</button>
                 </div>
               </section>
               <section className="mt-auto pt-8 pb-32">
                 <button onClick={async () => { if (isProcessing || !activeChapter) return; setIsProcessing(true); try { const res = await generateFullChapterPackage(project, activeChapter, (u:any) => metaDispatch(Actions.trackUsage(u)), addLog); if (textareaRef.current) textareaRef.current.value = res.draft; setWordCount(res.draft.length); projectDispatch(Actions.setChapterContent(activeChapter.id, res.draft)); projectDispatch(Actions.updateChapter(activeChapter.id, { strategy: { ...activeChapter.strategy, ...res.strategy }, beats: res.beats, status: 'Polished' })); saveChapterContent(meta.id, activeChapter.id, meta.headRev || 1, res.draft); addLog('success', 'Writer', '構造化が完了しました。'); } catch(e: any) { if (e.message === 'SAFETY_BLOCK') { handleSafetyBlock(activeChapter.summary, e.safetyCategory); } else { addLog('error','Writer','失敗しました。'); } } finally { setIsProcessing(false); } }} disabled={isProcessing} className="w-full py-6 bg-gradient-to-br from-orange-600 to-rose-700 text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-3 shadow-2xl active:scale-95">{isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}フルオート構築</button>
               </section>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
};

const BeatItem = React.memo(({ beat, isCompleted, onToggle }: { beat: PlotBeat, isCompleted: boolean, onToggle: (id: string) => void }) => (
  <button onClick={() => onToggle(beat.id)} className={`w-full text-left flex items-start gap-4 p-4 rounded-2xl border transition-all ${isCompleted ? 'bg-emerald-500/5 border-emerald-500/20 opacity-50' : 'bg-stone-900/40 border-white/5 hover:border-orange-500/20'}`}>
    <div className={`mt-1 ${isCompleted ? 'text-emerald-500' : 'text-stone-700'}`}><CheckCircle2 size={16} fill={isCompleted ? "currentColor" : "none"} /></div>
    <div className="flex-1 min-w-0"><p className={`text-[11px] font-serif-bold leading-relaxed ${isCompleted ? 'line-through text-stone-600' : 'text-stone-300'}`}>{beat.text}</p></div>
  </button>
));

export default React.memo(WriterView);
