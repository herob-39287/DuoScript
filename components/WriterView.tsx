
import React, { useState, useRef } from 'react';
import { StoryProject, ChapterLog, SystemLog, ChapterStrategy, SyncOperation, WorldBible, HistoryEntry, CharacterStatus, StateDelta } from '../types';
import { generateBeats, generateDraft, suggestNextSentence, generateChapterSummary, extractSettingsFromText, decomposeArcIntoStrategy, generateFullChapterPackage } from '../services/geminiService';
import { 
  Sparkles, RefreshCw, Plus, Maximize2, Minimize2, 
  Loader2, X, Feather, LayoutDashboard, Zap, Target, Ban, FastForward, Wand2, Wand, UserCircle, List, Pen, 
  Activity, Check, ArrowRight, Bookmark, Map, ShieldAlert, TrendingUp, Menu, ChevronLeft
} from 'lucide-react';

interface Props {
  project: StoryProject;
  setProject: React.Dispatch<React.SetStateAction<StoryProject>>;
  addLog: (type: SystemLog['type'], source: SystemLog['source'], message: string) => void;
  onTokenUsage: (usage: { input: number; output: number }) => void;
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
}

const WriterView: React.FC<Props> = ({ project, setProject, addLog, onTokenUsage, showConfirm }) => {
  const [activeChapterId, setActiveChapterId] = useState<string>(project.chapters[0]?.id || '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isZenMode, setIsZenMode] = useState(false);
  const [isHQ, setIsHQ] = useState(true);
  const [copilotSuggestions, setCopilotSuggestions] = useState<string[]>([]);
  const [isCopilotLoading, setIsCopilotLoading] = useState(false);
  const [showPlanner, setShowPlanner] = useState(true);
  const [showDraftsMobile, setShowDraftsMobile] = useState(false);
  const [plannerTab, setPlannerTab] = useState<'STRATEGY' | 'BEATS' | 'SYNC'>('STRATEGY');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isFullGenesis, setIsFullGenesis] = useState(false);
  
  const activeChapter = project.chapters.find(c => c.id === activeChapterId);

  const updateChapter = (id: string, updates: Partial<ChapterLog>) => {
    setProject(prev => ({
      ...prev,
      chapters: prev.chapters.map(c => c.id === id ? { ...c, ...updates, wordCount: updates.content !== undefined ? updates.content.trim().length : c.wordCount } : c)
    }));
  };

  const handleFullGenesis = async () => {
    if (!activeChapter || isFullGenesis) return;
    setIsFullGenesis(true);
    addLog('info', 'Writer', `章「${activeChapter.title}」を全自動構築中...`);
    try {
      const result = await generateFullChapterPackage(project, activeChapter, onTokenUsage);
      updateChapter(activeChapter.id, {
        strategy: result.strategy,
        beats: result.beats,
        content: result.draft,
        status: 'Polished'
      });
      addLog('success', 'Writer', `章の構築が完了しました。内容を確認してください。`);
    } catch (err: any) { addLog('error', 'Writer', err.message); } finally { setIsFullGenesis(false); }
  };

  const handleGenSummary = async () => {
    if (!activeChapter || isProcessing) return;
    setIsProcessing(true);
    try {
      const currentIndex = project.chapters.findIndex(c => c.id === activeChapterId);
      const prevChapter = currentIndex > 0 ? project.chapters[currentIndex - 1] : null;
      const summary = await generateChapterSummary(project, activeChapter, prevChapter, onTokenUsage);
      updateChapter(activeChapter.id, { summary });
    } catch (e: any) { addLog('error', 'Architect', e.message); } finally { setIsProcessing(false); }
  };

  const handleDecomposeStrategy = async () => {
    if (!activeChapter || isProcessing) return;
    setIsProcessing(true);
    addLog('info', 'Architect', '戦略を解析中...');
    try {
      const strategyUpdate = await decomposeArcIntoStrategy(project, activeChapter, onTokenUsage);
      updateChapter(activeChapter.id, { strategy: { ...activeChapter.strategy, ...strategyUpdate } });
      addLog('success', 'Architect', '戦略を同期しました。');
    } catch (e: any) { addLog('error', 'Architect', e.message); } finally { setIsProcessing(false); }
  };

  const handleGenBeats = async () => {
    if (!activeChapter || isProcessing || !activeChapter.summary) return;
    setIsProcessing(true);
    try {
      const beats = await generateBeats(activeChapter.summary, project, activeChapter.beats || [], onTokenUsage);
      updateChapter(activeChapter.id, { beats, status: 'Beats' });
      setPlannerTab('BEATS');
    } catch (e: any) { addLog('error', 'Writer', 'ビート生成失敗'); } finally { setIsProcessing(false); }
  };

  const handleGenDraft = async () => {
    if (!activeChapter || isProcessing) return;
    setIsProcessing(true);
    try {
      addLog('info', 'Writer', `執筆を開始...`);
      const draft = await generateDraft(activeChapter, project.bible.tone, isHQ, project, onTokenUsage);
      updateChapter(activeChapter.id, { content: (activeChapter.content ? activeChapter.content + "\n\n" : "") + draft, status: 'Drafting' });
    } catch (e: any) { addLog('error', 'Writer', e.message); } finally { setIsProcessing(false); }
  };

  const handleGetSuggestions = async () => {
    if (!activeChapter || !activeChapter.content || isCopilotLoading) return;
    setIsCopilotLoading(true);
    try {
      const suggestions = await suggestNextSentence(activeChapter.content, project, onTokenUsage);
      setCopilotSuggestions(suggestions);
    } catch (e: any) { addLog('error', 'Writer', e.message); } finally { setIsCopilotLoading(false); }
  };

  const handleSyncStateFromText = async () => {
    if (!activeChapter || !activeChapter.content || isSyncing) return;
    setIsSyncing(true);
    setPlannerTab('SYNC');
    try {
      const ops = await extractSettingsFromText(activeChapter.content, project.bible, activeChapter, onTokenUsage);
      if (ops.length > 0) {
        setProject(prev => ({ ...prev, pendingChanges: [...prev.pendingChanges, ...ops] }));
        addLog('success', 'NeuralSync', `${ops.length}件の変化。`);
      }
    } catch (e: any) { addLog('error', 'NeuralSync', e.message); } finally { setIsSyncing(false); }
  };

  const commitOp = (op: SyncOperation) => {
    setProject(prev => {
      const char = prev.bible.characters.find(c => c.id === op.targetId);
      if (!char || op.path !== 'characters') return prev;

      const field = op.field as keyof CharacterStatus;
      const newValue = op.value;

      const delta: StateDelta = {
        id: crypto.randomUUID(),
        characterId: char.id,
        beatId: op.beatId,
        field: field,
        op: op.op as 'set' | 'add' | 'remove',
        value: newValue,
        rationale: op.rationale,
        evidence: op.evidence,
        timestamp: Date.now()
      };

      const nextBible = { ...prev.bible, version: prev.bible.version + 1 };
      const nextChars = nextBible.characters.map(c => {
        if (c.id === char.id) {
          const nextStatus = { ...c.status };
          if (delta.op === 'set') (nextStatus as any)[field] = newValue;
          else if (delta.op === 'add') (nextStatus as any)[field] = [...(nextStatus as any)[field], newValue];
          else if (delta.op === 'remove') (nextStatus as any)[field] = (nextStatus as any)[field].filter((v: any) => v !== newValue);
          return { ...c, status: nextStatus };
        }
        return c;
      });
      nextBible.characters = nextChars;

      const nextChapters = prev.chapters.map(c => {
        if (c.id === activeChapterId) {
          return { ...c, stateDeltas: [...(c.stateDeltas || []), delta] };
        }
        return c;
      });

      return { 
        ...prev, 
        bible: nextBible, 
        chapters: nextChapters, 
        pendingChanges: prev.pendingChanges.filter(p => p.id !== op.id) 
      };
    });
    addLog('success', 'NeuralSync', `記録完了。`);
  };

  return (
    <div className="h-full flex flex-col md:flex-row overflow-hidden bg-stone-950 relative">
      {/* Draft List Panel */}
      <aside className={`fixed inset-0 z-[110] md:relative md:inset-auto md:z-auto w-full md:w-80 glass border-r border-white/5 flex flex-col shrink-0 transform transition-transform duration-300 ${showDraftsMobile ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
          <div className="p-6 border-b border-white/5 flex justify-between items-center bg-stone-900/40">
            <h3 className="text-[11px] font-black text-stone-500 uppercase tracking-[0.4em]">Drafts</h3>
            <div className="flex gap-2">
              <button onClick={() => {
                const newId = crypto.randomUUID();
                setProject(p => ({
                  ...p,
                  chapters: [...p.chapters, {
                    id: newId, title: '新章', summary: '', content: '', beats: [], stateDeltas: [],
                    strategy: { milestones: [], forbiddenResolutions: [], characterArcProgress: '', pacing: '' },
                    status: 'Idea', wordCount: 0
                  }]
                }));
                setActiveChapterId(newId);
                setShowDraftsMobile(false);
              }} className="p-2 bg-stone-800 rounded-lg text-orange-400"><Plus size={18}/></button>
              <button onClick={() => setShowDraftsMobile(false)} className="md:hidden p-2 text-stone-500"><X size={18}/></button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
            {project.chapters.map((ch, idx) => (
              <button key={ch.id} onClick={() => { setActiveChapterId(ch.id); setShowDraftsMobile(false); }} className={`w-full text-left p-6 rounded-[2rem] border transition-all ${activeChapterId === ch.id ? 'bg-orange-600/10 border-orange-500/30 text-white' : 'text-stone-500 border-transparent hover:bg-white/5'}`}>
                <div className="flex items-center gap-3"><span className="text-[10px] font-mono text-orange-400">{String(idx+1).padStart(2, '0')}</span><div className="text-[13px] font-serif-bold truncate">{ch.title}</div></div>
              </button>
            ))}
          </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 bg-stone-950/30 relative">
        <header className="h-16 md:h-24 glass-bright border-b border-white/5 flex items-center justify-between px-4 md:px-10 shrink-0">
           <div className="flex items-center gap-4 md:gap-8 flex-1 min-w-0">
              <button onClick={() => setShowDraftsMobile(true)} className="md:hidden p-2 text-orange-400"><Menu size={20}/></button>
              <button onClick={() => setIsZenMode(!isZenMode)} className={`hidden md:block p-3 rounded-2xl transition-all ${isZenMode ? 'bg-orange-600 text-white shadow-xl shadow-orange-900/20' : 'bg-stone-800 text-stone-500'}`}>{isZenMode ? <Maximize2 size={20}/> : <Minimize2 size={20}/>}</button>
              <input value={activeChapter?.title} onChange={e => updateChapter(activeChapterId, { title: e.target.value })} className="bg-transparent text-white font-display font-black italic text-lg md:text-2xl outline-none truncate" placeholder="章題..."/>
           </div>
           <div className="flex items-center gap-2 md:gap-4">
             <button onClick={handleSyncStateFromText} title="本文から状態変化を抽出" className="p-2 md:p-3 bg-stone-800 text-emerald-400 rounded-xl hover:bg-stone-700 transition-all flex items-center gap-2">
                {isSyncing ? <Loader2 size={16} className="animate-spin" /> : <Activity size={16}/>}
                <span className="hidden lg:inline text-[8px] font-black uppercase tracking-widest">分析</span>
             </button>
             <button onClick={() => setShowPlanner(!showPlanner)} className={`p-2 md:p-3 rounded-xl transition-all ${showPlanner ? 'text-orange-400 bg-stone-800' : 'text-stone-600'}`}><LayoutDashboard size={18}/></button>
           </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          <main className={`flex-1 overflow-y-auto custom-scrollbar transition-all ${isZenMode ? 'px-6 md:px-48 py-10 md:py-24 max-w-7xl mx-auto' : 'p-6 md:p-12'}`}>
            <textarea 
              className={`w-full bg-transparent text-stone-200 prose-literary outline-none resize-none min-h-[75vh] ${isZenMode ? 'text-2xl md:text-3xl' : 'text-xl md:text-2xl'}`}
              value={activeChapter?.content}
              onChange={e => updateChapter(activeChapterId, { content: e.target.value })}
              placeholder="綴りましょう..."
            />
            {copilotSuggestions.length > 0 && (
              <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-[90%] md:w-full max-w-2xl glass-bright rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-8 border border-orange-500/30 shadow-3xl animate-fade-in z-50">
                <div className="flex justify-between mb-4"><div className="flex items-center gap-3"><Wand2 size={16} className="text-orange-400" /><span className="text-[10px] font-black uppercase tracking-[0.2em]">副筆者</span></div><button onClick={() => setCopilotSuggestions([])}><X size={18}/></button></div>
                <div className="space-y-3">
                  {copilotSuggestions.map((s, i) => <button key={i} onClick={() => { updateChapter(activeChapterId, { content: (activeChapter?.content || "").trim() + "。" + s }); setCopilotSuggestions([]); }} className="w-full p-4 text-left bg-stone-950/60 border border-white/5 rounded-xl text-[14px] font-serif text-stone-300 hover:text-white transition-all hover:bg-stone-900">{s}</button>)}
                </div>
              </div>
            )}
            <div className="fixed bottom-24 md:bottom-12 right-6 md:right-12">
                 <button onClick={handleGetSuggestions} className="w-14 h-14 md:w-16 md:h-16 bg-stone-900 border border-white/10 text-orange-400 rounded-full flex items-center justify-center hover:bg-orange-600 hover:text-white transition-all shadow-2xl">{isCopilotLoading ? <Loader2 size={24} className="animate-spin" /> : <Wand size={24}/>}</button>
            </div>
          </main>

          {showPlanner && !isZenMode && (
            <aside className={`fixed inset-0 z-[110] md:relative md:inset-auto md:z-auto w-full md:w-96 glass border-l border-white/5 flex flex-col overflow-hidden animate-fade-in transform transition-transform duration-300 ${showPlanner ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
               <div className="flex border-b border-white/5 shrink-0">
                 <button onClick={() => setShowPlanner(false)} className="md:hidden p-4 text-stone-500"><ChevronLeft size={20}/></button>
                 <button onClick={() => setPlannerTab('STRATEGY')} className={`flex-1 py-4 text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${plannerTab === 'STRATEGY' ? 'text-orange-400 bg-orange-400/5' : 'text-stone-600'}`}>戦略</button>
                 <button onClick={() => setPlannerTab('BEATS')} className={`flex-1 py-4 text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${plannerTab === 'BEATS' ? 'text-orange-400 bg-orange-400/5' : 'text-stone-600'}`}>ビート</button>
                 <button onClick={() => setPlannerTab('SYNC')} className={`flex-1 py-4 text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${plannerTab === 'SYNC' ? 'text-orange-400 bg-orange-400/5' : 'text-stone-600'}`}>Sync</button>
                 <button onClick={() => setShowPlanner(false)} className="hidden md:block p-4 text-stone-700 hover:text-white"><X size={18}/></button>
               </div>
               
               <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 md:space-y-8 custom-scrollbar">
                 {plannerTab === 'STRATEGY' && (
                   <div className="space-y-6 md:space-y-8">
                     <div className="p-4 md:p-6 bg-orange-500/5 border border-orange-500/10 rounded-2xl md:rounded-3xl space-y-4">
                        <div className="flex items-center justify-between">
                           <div className="flex items-center gap-2"><Map size={14} className="text-orange-400"/><span className="text-[9px] font-black uppercase text-orange-400">連動</span></div>
                           <button onClick={handleDecomposeStrategy} disabled={isProcessing} className="p-1.5 bg-orange-600/20 text-orange-400 rounded-lg hover:bg-orange-600 transition-all">
                              {isProcessing ? <Loader2 size={12} className="animate-spin" /> : <TrendingUp size={12}/>}
                           </button>
                        </div>
                        <p className="text-[9px] font-serif text-stone-500 italic leading-relaxed">設計士が大筋を解析し、章のマイルストーンを抽出・提案します。</p>
                     </div>

                     <div className="space-y-3">
                        <div className="flex justify-between items-center"><label className="text-[9px] font-black text-stone-600 uppercase tracking-widest">あらすじ案</label><button onClick={handleGenSummary} disabled={isProcessing} className="text-orange-400"><RefreshCw size={12} className={isProcessing ? 'animate-spin' : ''}/></button></div>
                        <textarea value={activeChapter?.summary} onChange={e => updateChapter(activeChapterId, { summary: e.target.value })} className="w-full bg-stone-950/50 border border-white/10 rounded-xl p-4 text-[11px] h-28 md:h-32 outline-none font-serif resize-none" />
                     </div>

                     <div className="space-y-3">
                        <label className="text-[9px] font-black text-white uppercase tracking-widest flex items-center gap-2"><Bookmark size={14} className="text-orange-400"/> マイルストーン</label>
                        <div className="space-y-2">
                           {(activeChapter?.strategy.milestones || []).map((m, i) => (
                             <div key={i} className="flex gap-3 items-start p-3 bg-stone-900/40 border border-white/5 rounded-xl">
                                <Check size={12} className="text-emerald-400 mt-0.5 shrink-0" />
                                <span className="text-[10px] md:text-[11px] font-serif text-stone-300">{m}</span>
                             </div>
                           ))}
                        </div>
                     </div>
                   </div>
                 )}
                 {plannerTab === 'BEATS' && (
                   <div className="space-y-6">
                     <div className="flex justify-between items-center"><label className="text-[9px] font-black text-stone-600 uppercase tracking-widest">プロットビート</label><button onClick={handleGenBeats} className="text-orange-400"><Sparkles size={16}/></button></div>
                     <div className="space-y-3">
                       {activeChapter?.beats.map((beat, idx) => (
                         <div key={beat.id} className="group relative">
                           <textarea value={beat.text} onChange={e => {
                             const newBeats = [...activeChapter.beats];
                             newBeats[idx] = { ...beat, text: e.target.value };
                             updateChapter(activeChapterId, { beats: newBeats });
                           }} className="w-full bg-stone-900/40 border border-white/5 rounded-xl p-3 text-[10px] font-serif leading-relaxed text-stone-300 outline-none hover:border-orange-500/20 resize-none h-16" />
                         </div>
                       ))}
                       <button onClick={() => updateChapter(activeChapterId, { beats: [...activeChapter.beats, { id: crypto.randomUUID(), text: '' }] })} className="w-full py-3 border border-dashed border-stone-800 rounded-xl text-stone-700 hover:text-stone-400 flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-widest"><Plus size={14}/> 追加</button>
                     </div>
                   </div>
                 )}
                 {plannerTab === 'SYNC' && (
                   <div className="space-y-6 animate-fade-in">
                      <div className="flex items-center gap-3 pb-4 border-b border-white/5">
                         <Activity size={18} className="text-emerald-400" />
                         <span className="text-[9px] font-black uppercase text-white tracking-widest">Neural Sync</span>
                      </div>
                      <div className="space-y-4">
                        {project.pendingChanges.filter(op => op.path === 'characters').length === 0 ? (
                          <div className="p-8 text-center text-stone-700 border border-dashed border-stone-800 rounded-2xl italic text-[10px]">提案はありません。</div>
                        ) : project.pendingChanges.filter(op => op.path === 'characters').map(op => {
                          const char = project.bible.characters.find(c => c.id === op.targetId);
                          const field = op.field as keyof CharacterStatus;
                          const before = char ? (char.status as any)[field] : '不明';

                          return (
                            <div key={op.id} className="p-4 glass-bright rounded-2xl border border-emerald-500/30 space-y-4 animate-fade-in relative">
                               <div className="flex justify-between items-center">
                                  <div className="flex items-center gap-2">
                                     <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                     <span className="text-[9px] font-black uppercase text-white tracking-widest">{char?.name}</span>
                                  </div>
                                  <div className="flex gap-2">
                                     <button onClick={() => setProject(p => ({ ...p, pendingChanges: p.pendingChanges.filter(x => x.id !== op.id) }))} className="p-1 text-stone-600"><X size={14}/></button>
                                     <button onClick={() => commitOp(op)} className="p-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500"><Check size={14}/></button>
                                  </div>
                               </div>
                               <div className="space-y-2 bg-stone-950/40 p-3 rounded-xl border border-white/5">
                                  <div className="text-[10px] font-serif flex items-center gap-2">
                                     <span className="text-stone-500 truncate max-w-[60px] line-through">{String(before)}</span>
                                     <ArrowRight size={10} className="text-emerald-400 shrink-0" />
                                     <span className="text-white font-bold">{String(op.value)}</span>
                                  </div>
                               </div>
                            </div>
                          );
                        })}
                      </div>
                   </div>
                 )}
               </div>

               <div className="p-6 md:p-8 border-t border-white/5 bg-stone-900/20 pb-safe md:pb-8 space-y-3">
                 <button 
                  onClick={handleFullGenesis} 
                  disabled={isFullGenesis || isProcessing}
                  className="w-full py-4 md:py-5 bg-gradient-to-r from-orange-600 to-rose-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-xl hover:opacity-90 transition-all active:scale-95 disabled:opacity-50"
                 >
                   {isFullGenesis ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16}/>}
                   フルオート執筆 (Chapter Genesis)
                 </button>
                 <button onClick={handleGenDraft} disabled={isProcessing || !activeChapter?.beats.length} className="w-full py-4 md:py-5 bg-stone-800 text-orange-400 border border-orange-400/20 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl hover:bg-stone-700 transition-all active:scale-95 disabled:opacity-50">
                   {isProcessing ? <Loader2 size={16} className="animate-spin"/> : <Pen size={16}/>}
                   AIによる下書き
                 </button>
               </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
};
export default WriterView;
