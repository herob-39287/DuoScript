import React, { useState, useMemo, useCallback } from 'react';
import { generateDraftStream, suggestNextSentence, generateFullChapterPackage, generateSpeech } from '../services/geminiService';
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
  Volume2
} from 'lucide-react';
import { ViewMode, PlotBeat } from '../types';
import { useManuscriptEditor } from '../hooks/useManuscriptEditor';

const WriterView: React.FC = () => {
  const chapters = useManuscript();
  const projectDispatch = useManuscriptDispatch();
  const bible = useBible();
  const meta = useMetadata();
  const { title: projectTitle } = meta;
  const metaDispatch = useMetadataDispatch();
  const { addLog } = useNotificationDispatch();
  const uiDispatch = useUIDispatch();

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
    handleTextChange
  } = useManuscriptEditor(chapters[0]?.id || '');

  const [isProcessing, setIsProcessing] = useState(false);
  const [isZenMode, setIsZenMode] = useState(false);
  const [isVertical, setIsVertical] = useState(false);
  const [copilotSuggestions, setCopilotSuggestions] = useState<string[]>([]);
  const [isCopilotLoading, setIsCopilotLoading] = useState(false);
  const [showPlanner, setShowPlanner] = useState(window.innerWidth > 1024);
  const [showManuscriptMobile, setShowManuscriptMobile] = useState(false);
  const [fontSize] = useState(window.innerWidth < 768 ? 18 : 22);
  const [completedBeats, setCompletedBeats] = useState<Set<string>>(new Set());
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);

  const toggleBeat = useCallback((id: string) => {
    setCompletedBeats(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSuggest = async () => {
    const currentVal = textareaRef.current?.value || "";
    if (isCopilotLoading || !currentVal.trim()) return;
    setIsCopilotLoading(true);
    try {
      const suggestions = await suggestNextSentence(currentVal, { bible, chapters, title: projectTitle, meta } as any, (usage: any) => metaDispatch(Actions.trackUsage(usage)), addLog);
      setCopilotSuggestions(suggestions);
    } catch (e) {
      addLog('error', 'Writer', '続きの提案に失敗しました。');
    } finally {
      setIsCopilotLoading(false);
    }
  };

  const handleGenDraft = async () => {
    if (!activeChapter || isProcessing) return;
    setIsProcessing(true);
    addLog('info', 'Writer', '物語を紡いでいます...');
    
    try {
      const currentVal = textareaRef.current?.value || "";
      const stream = await generateDraftStream(
        { ...activeChapter, content: currentVal }, 
        bible.tone, 
        true, 
        { bible, chapters, meta } as any, 
        addLog
      );

      let fullDraft = currentVal + (currentVal ? "\n\n" : "");
      
      for await (const chunk of stream) {
        const textChunk = chunk.text;
        if (textChunk) {
          fullDraft += textChunk;
          if (textareaRef.current) {
            textareaRef.current.value = fullDraft;
            textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
          }
          setWordCount(fullDraft.length);
        }
      }

      projectDispatch(Actions.setChapterContent(activeChapter.id, fullDraft));
      projectDispatch(Actions.updateChapter(activeChapter.id, { status: 'Drafting' }));
      saveChapterContent(activeChapter.id, fullDraft);
      addLog('success', 'Writer', '物語の紡ぎが完了しました。');
    } catch (e: any) { 
      addLog('error', 'Writer', '執筆中に不具合が発生しました。');
      console.error(e);
    } finally { 
      setIsProcessing(false); 
    }
  };

  const handlePlayDialogue = async () => {
    const selection = window.getSelection()?.toString();
    if (!selection || isPlayingVoice) return;

    setIsPlayingVoice(true);
    try {
      const audioBuffer = await generateSpeech(
        selection, 
        'Zephyr', 
        (u: any) => metaDispatch(Actions.trackUsage(u)), 
        addLog
      );
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const decoded = await decodeAudioData(new Uint8Array(audioBuffer), audioCtx, 24000, 1);
      const source = audioCtx.createBufferSource();
      source.buffer = decoded;
      source.connect(audioCtx.destination);
      source.onended = () => setIsPlayingVoice(false);
      source.start();
    } catch (e) {
      addLog('error', 'Voice', '音声再生に失敗しました。');
      setIsPlayingVoice(false);
    }
  };

  async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  }

  if (isLoadingContent) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-stone-950 text-stone-500 gap-4">
        <Loader2 size={40} className="animate-spin text-orange-400 opacity-20" />
        <p className="font-serif italic animate-pulse">羊皮紙を広げています...</p>
      </div>
    );
  }

  const progressPercentage = Math.round((completedBeats.size / (activeChapter?.beats?.length || 1)) * 100);

  return (
    <div className={`h-full flex flex-col md:flex-row overflow-hidden bg-stone-950 transition-all duration-1000 ${isZenMode ? 'bg-[#100e0c]' : ''}`}>
      <aside className={`${showManuscriptMobile ? 'fixed inset-0 z-[120] translate-x-0' : 'fixed inset-0 z-[120] -translate-x-full md:relative md:translate-x-0 md:z-auto'} md:flex w-full md:w-72 glass border-r border-white/5 flex flex-col shrink-0 transition-transform duration-300`}>
        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-stone-900/40 shrink-0">
          <span className="text-[10px] font-black text-orange-400 uppercase tracking-[0.3em]">Manuscript</span>
          <div className="flex gap-2">
            <button onClick={() => {
              const id = crypto.randomUUID();
              projectDispatch(Actions.addChapter({ id, title: '新章', summary: '', content: '', beats: [], strategy: { milestones: [], forbiddenResolutions: [], characterArcProgress: '', pacing: '' }, status: 'Idea', wordCount: 0, stateDeltas: [], updatedAt: Date.now() }));
              setActiveChapterId(id);
              setShowManuscriptMobile(false);
            }} className="p-2 bg-stone-800 hover:bg-orange-600 text-orange-400 hover:text-white rounded-xl transition-all shadow-lg active:scale-90"><Plus size={16}/></button>
            <button className="md:hidden p-2 text-stone-500" onClick={() => setShowManuscriptMobile(false)}><X size={16}/></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
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
        <header className={`h-20 md:h-24 glass border-b border-white/5 flex items-center justify-between px-6 md:px-10 shrink-0 z-40 transition-all duration-700 ${isZenMode ? 'opacity-0 translate-y-[-100%] hover:opacity-100 hover:translate-y-0 bg-[#100e0c]/95' : ''}`}>
           <div className="flex items-center gap-4 md:gap-8 min-w-0">
              <button onClick={() => setShowManuscriptMobile(true)} className="md:hidden p-2 text-orange-400"><Menu size={20}/></button>
              <div className="flex flex-col">
                <input defaultValue={activeChapter?.title} key={`title-${activeChapter?.id}`} onChange={e => projectDispatch(Actions.updateChapter(activeChapter!.id, { title: e.target.value }))} className="bg-transparent text-white font-display font-black italic text-xl md:text-2xl outline-none focus:text-orange-400 transition-all min-w-[150px] md:min-w-[300px] truncate" />
                <span className="text-[9px] font-mono text-stone-500 tracking-widest uppercase">{wordCount.toLocaleString()} 文字</span>
              </div>
           </div>
           <div className="flex items-center gap-2 md:gap-6">
              <button onClick={handlePlayDialogue} disabled={isPlayingVoice} className={`flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-xl border border-white/5 text-stone-500 hover:text-orange-400 transition-all ${isPlayingVoice ? 'animate-pulse text-orange-400' : ''}`}>
                <Volume2 size={14}/>
                <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest">セリフ再生</span>
              </button>
              <button onClick={() => setIsVertical(!isVertical)} className={`flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-xl border transition-all ${isVertical ? 'bg-orange-600 border-orange-500 text-white' : 'bg-stone-800 border-white/5 text-stone-500 hover:text-stone-200'}`}>
                {isVertical ? <AlignRight size={14}/> : <AlignLeft size={14}/>}
                <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest">{isVertical ? '縦書き' : '横書き'}</span>
              </button>
              <button onClick={() => setIsZenMode(!isZenMode)} className={`p-3 md:p-4 rounded-2xl transition-all shadow-xl bg-stone-800 text-stone-500 hover:text-white`}>
                {isZenMode ? <Minimize2 size={18}/> : <Maximize2 size={18}/>}
              </button>
              {!isZenMode && (
                <button onClick={() => setShowPlanner(!showPlanner)} className={`p-3 md:p-4 rounded-2xl transition-all shadow-xl ${showPlanner ? 'bg-orange-600/20 text-orange-400 border border-orange-500/20' : 'bg-stone-800 text-stone-500'}`}>
                  <LayoutDashboard size={18}/>
                </button>
              )}
           </div>
        </header>

        <div className="flex-1 flex overflow-hidden relative">
          <main className={`flex-1 overflow-x-auto overflow-y-auto custom-scrollbar relative paper-texture transition-colors duration-1000 ${isZenMode ? 'bg-[#100e0c]' : 'bg-stone-950/20'}`} >
            <div className={`max-w-5xl mx-auto px-6 md:px-24 py-12 md:py-32 min-h-full flex flex-col items-center ${isVertical ? 'writing-vertical' : ''}`}>
              <textarea ref={textareaRef} className={`w-full bg-transparent text-stone-200 prose-literary outline-none resize-none min-h-[70vh] caret-orange-500 focus-ring rounded-xl p-4 transition-all ${isVertical ? 'leading-[3] tracking-[0.2em]' : ''}`} onInput={handleTextChange} style={{ fontSize: `${fontSize}px` }} placeholder="物語の続きをここに..." />
              <div className="h-48 md:h-96 shrink-0" />
            </div>

            {whisper && (
              <div className="fixed top-24 md:top-28 right-6 md:right-12 w-72 md:w-80 animate-fade-in z-[60]">
                <div className={`p-4 md:p-5 rounded-2xl glass-bright border shadow-2xl relative overflow-hidden group ${whisper.type === 'alert' ? 'border-rose-500/30' : 'border-orange-500/30'}`}>
                   <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <Zap size={14} className={whisper.type === 'alert' ? 'text-rose-400' : 'text-orange-400'} />
                        <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-stone-500">Architect's Whisper</span>
                      </div>
                      <button onClick={() => setWhisper(null)} className="text-stone-700 hover:text-white transition-colors"><X size={14}/></button>
                   </div>
                   <p className="text-[10px] md:text-[11px] font-serif-bold leading-relaxed text-stone-300 italic">{whisper.text}</p>
                   <div className="absolute bottom-0 left-0 h-1 bg-white/5 w-full"><div className={`h-full animate-[whisperLife_15s_linear_forwards] ${whisper.type === 'alert' ? 'bg-rose-500' : 'bg-orange-500'}`} /></div>
                </div>
              </div>
            )}

            {copilotSuggestions.length > 0 && (
              <div className="absolute bottom-28 md:bottom-32 left-1/2 -translate-x-1/2 w-full max-w-3xl px-6 md:px-8 animate-fade-in z-50">
                 <div className="glass-bright rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 border border-orange-500/40 shadow-[0_30px_100px_-20px_rgba(0,0,0,0.8)] space-y-4 md:space-y-6">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] md:text-[11px] font-black text-orange-400 uppercase tracking-[0.3em] flex items-center gap-2 md:gap-3"><Sparkles size={16} /> AI Copilot</span>
                      <button onClick={() => setCopilotSuggestions([])} className="p-2 hover:bg-stone-800 rounded-full text-stone-500 hover:text-white transition-all"><X size={18}/></button>
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:gap-4">
                      {copilotSuggestions.map((text, idx) => (
                        <button key={idx} onClick={() => { const currentVal = textareaRef.current?.value || ""; const newText = currentVal + (currentVal.endsWith(' ') || currentVal.endsWith('\n') ? '' : ' ') + text; if (textareaRef.current) textareaRef.current.value = newText; setWordCount(newText.length); projectDispatch(Actions.setChapterContent(activeChapter!.id, newText)); saveChapterContent(activeChapter!.id, newText); setCopilotSuggestions([]); }} className="w-full text-left p-4 md:p-6 bg-stone-900/60 hover:bg-orange-600/20 border border-white/5 hover:border-orange-500/40 rounded-[1.5rem] md:rounded-[2rem] text-xs md:text-sm font-serif-bold text-stone-300 hover:text-white transition-all group">
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity mr-2 text-orange-400">»</span>{text}
                        </button>
                      ))}
                    </div>
                 </div>
              </div>
            )}

            <div className={`fixed bottom-24 md:bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-3 md:gap-4 p-2 md:p-3 glass rounded-full md:rounded-[2.5rem] border border-white/10 z-50 shadow-2xl transition-all duration-700 ${isZenMode ? 'opacity-20 hover:opacity-100 scale-90 translate-y-4' : ''}`}>
               <div className="hidden md:flex items-center gap-2 px-4 border-r border-white/10 mr-2"><div className="w-10 h-1 rounded-full bg-stone-800 overflow-hidden"><div className="h-full bg-orange-500 transition-all duration-1000" style={{ width: `${progressPercentage}%` }} /></div><span className="text-[10px] font-mono text-stone-500">{progressPercentage}%</span></div>
               <button onClick={handleSuggest} disabled={isCopilotLoading} className="p-3 md:p-4 bg-stone-800 text-orange-400 hover:bg-orange-600 hover:text-white rounded-full md:rounded-2xl transition-all disabled:opacity-50 active:scale-95 group relative">{isCopilotLoading ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}</button>
               <button onClick={handleGenDraft} disabled={isProcessing} className="flex items-center gap-2 md:gap-4 px-5 md:px-8 py-3 md:py-5 bg-orange-600 text-white rounded-full md:rounded-[1.5rem] font-black text-[10px] md:text-[12px] uppercase tracking-[0.2em] hover:bg-orange-500 transition-all shadow-2xl active:scale-95 disabled:opacity-50">{isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Pen size={16} />}AI執筆</button>
               <div className="w-px h-8 md:h-10 bg-white/10 mx-1 md:mx-2" />
               <button onClick={() => uiDispatch(Actions.setView(ViewMode.PLOTTER))} className="p-3 md:p-4 text-stone-500 hover:text-white transition-colors"><MessageCircle size={20} /></button>
            </div>
          </main>

          {showPlanner && !isZenMode && activeChapter && (
            <aside className={`fixed inset-0 z-[130] md:relative md:inset-auto md:z-auto w-full md:w-[420px] glass border-l border-white/5 flex flex-col p-6 md:p-10 space-y-8 md:space-y-12 animate-fade-in overflow-y-auto custom-scrollbar shrink-0`}>
               <div className="flex md:hidden justify-end"><button onClick={() => setShowPlanner(false)} className="p-2 text-stone-500"><X size={24}/></button></div>
               <section className="space-y-4 md:space-y-5">
                 <div className="flex items-center justify-between"><div className="flex items-center gap-3"><BookOpen size={16} className="text-orange-400" /><span className="text-[9px] md:text-[10px] font-black text-stone-500 uppercase tracking-[0.3em]">Synopsis</span></div><button className="text-stone-700 hover:text-orange-400 transition-colors"><RotateCcw size={14}/></button></div>
                 <textarea defaultValue={activeChapter.summary} key={`summary-${activeChapter.id}`} onChange={e => projectDispatch(Actions.updateChapter(activeChapter.id, { summary: e.target.value }))} className="w-full bg-stone-950/50 border border-white/5 rounded-2xl md:rounded-3xl p-5 md:p-6 text-[12px] md:text-[13px] h-40 md:h-44 outline-none font-serif-bold resize-none text-stone-300 focus:border-orange-500/30 transition-all leading-relaxed shadow-inner" placeholder="この章のあらすじを記す..." />
               </section>
               <section className="space-y-4 md:space-y-6">
                 <div className="flex items-center justify-between"><div className="flex items-center gap-3"><Feather size={16} className="text-orange-400" /><span className="text-[9px] md:text-[10px] font-black text-stone-500 uppercase tracking-[0.3em]">Plot Beats</span></div><span className="text-[9px] font-mono text-stone-600">{completedBeats.size} / {(activeChapter.beats || []).length}</span></div>
                 <div className="space-y-3 md:space-y-4">
                    {(activeChapter.beats || []).map((beat) => (
                      <BeatItem key={beat.id} beat={beat} isCompleted={completedBeats.has(beat.id)} onToggle={toggleBeat} />
                    ))}
                 </div>
               </section>
               <section className="mt-auto space-y-4 md:space-y-5 pt-8 pb-10 md:pb-0">
                 <div className="p-4 md:p-6 bg-orange-400/5 rounded-2xl md:rounded-3xl border border-orange-400/10 space-y-2 md:space-y-3"><div className="flex items-center gap-3 text-orange-400"><Info size={14}/><span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest">Architect Tip</span></div><p className="text-[10px] md:text-[11px] text-stone-500 font-serif-bold leading-relaxed italic">「フルオート構築」を実行すると、あらすじから展開案を自動生成し、本文の初稿まで一気通貫で設計士が仕上げます。</p></div>
                 <button onClick={async () => { if (isProcessing || !activeChapter) return; setIsProcessing(true); addLog('info', 'Writer', '章全体を再構築中...'); try { const res = await generateFullChapterPackage({ bible, chapters, meta } as any, activeChapter, (u:any) => metaDispatch(Actions.trackUsage(u)), addLog); if (textareaRef.current) textareaRef.current.value = res.draft; setWordCount(res.draft.length); projectDispatch(Actions.setChapterContent(activeChapter.id, res.draft)); projectDispatch(Actions.updateChapter(activeChapter.id, { strategy: { ...activeChapter.strategy, ...res.strategy }, beats: res.beats, status: 'Polished' })); saveChapterContent(activeChapter.id, res.draft); addLog('success', 'Writer', '物語の構造化が完了しました。'); if (window.innerWidth < 1024) setShowPlanner(false); } catch(e) { addLog('error','Writer','構築に失敗しました。'); } finally { setIsProcessing(false); } }} disabled={isProcessing} className="w-full py-5 md:py-7 bg-gradient-to-br from-orange-600 to-rose-700 text-white rounded-[1.5rem] md:rounded-[2rem] text-[10px] md:text-[12px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-3 md:gap-4 shadow-2xl active:scale-95 hover:brightness-110 transition-all">{isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}フルオート構築</button>
               </section>
            </aside>
          )}
        </div>
      </div>
      <style>{`
        @keyframes whisperLife { from { width: 100%; } to { width: 0%; } }
        
        .writing-vertical {
          writing-mode: vertical-rl;
          -webkit-writing-mode: vertical-rl;
          text-orientation: upright;
          height: 100%;
          padding: 4rem;
          margin-left: auto;
          overflow-x: auto;
          direction: rtl;
        }
        .writing-vertical textarea {
          direction: ltr;
          height: 80vh !important;
          width: auto !important;
          min-width: 50vw;
          white-space: pre-wrap;
          line-height: 2.8;
          letter-spacing: 0.15em;
        }
      `}</style>
    </div>
  );
};

interface BeatItemProps {
  beat: PlotBeat;
  isCompleted: boolean;
  onToggle: (id: string) => void;
}

const BeatItem = React.memo(({ beat, isCompleted, onToggle }: BeatItemProps) => (
  <button onClick={() => onToggle(beat.id)} className={`w-full text-left flex items-start gap-3 md:gap-4 p-4 md:p-5 rounded-2xl md:rounded-3xl border transition-all group ${isCompleted ? 'bg-emerald-500/5 border-emerald-500/20 opacity-50' : 'bg-stone-900/40 border-white/5 hover:border-orange-500/20'}`}>
    <div className={`mt-0.5 md:mt-1 transition-colors ${isCompleted ? 'text-emerald-500' : 'text-stone-700 group-hover:text-orange-400'}`}>
      <CheckCircle2 size={16} fill={isCompleted ? "currentColor" : "none"} />
    </div>
    <div className="flex-1 min-w-0">
      <p className={`text-[11px] md:text-[12px] font-serif-bold leading-relaxed ${isCompleted ? 'line-through text-stone-600' : 'text-stone-300'}`}>{beat.text}</p>
    </div>
  </button>
));

export default React.memo(WriterView);