
import React, { useState, useEffect, useRef } from 'react';
import { StoryProject, ChapterLog, SystemLog, PlotBeat } from '../types';
import { generateBeats, generateDraft, suggestNextSentence, generateFullChapterPackage } from '../services/geminiService';
import { 
  Sparkles, Plus, Maximize2, Minimize2, Loader2, X, Feather, LayoutDashboard, 
  Pen, Check, Quote, Wand, ChevronLeft
} from 'lucide-react';

interface Props {
  project: StoryProject;
  setProject: React.Dispatch<React.SetStateAction<StoryProject | null>>;
  addLog: (type: SystemLog['type'], source: SystemLog['source'], message: string, details?: string) => void;
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
  const [plannerTab, setPlannerTab] = useState<'STRATEGY' | 'BEATS'>('STRATEGY');
  const [isFullGenesis, setIsFullGenesis] = useState(false);
  const [genesisStatus, setGenesisStatus] = useState('');

  // エディタパフォーマンス向上のためのローカルステート
  const activeChapter = project.chapters.find(c => c.id === activeChapterId);
  const [localContent, setLocalContent] = useState(activeChapter?.content || '');
  const typingRef = useRef(false);
  const syncTimeoutRef = useRef<number | null>(null);

  // チャプター切り替えまたは外部更新（AI執筆など）時の同期
  useEffect(() => {
    if (!typingRef.current) {
      setLocalContent(activeChapter?.content || '');
    }
  }, [activeChapter?.content, activeChapterId]);

  const updateChapter = (id: string, updates: Partial<ChapterLog>) => {
    setProject(prev => {
      if (!prev) return null;
      return {
        ...prev,
        chapters: prev.chapters.map(c => 
          c.id === id 
            ? { ...c, ...updates, wordCount: updates.content !== undefined ? updates.content.trim().length : c.wordCount } 
            : c
        )
      };
    });
  };

  // テキスト入力ハンドラ（ローカルのみ更新）
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setLocalContent(val);
    typingRef.current = true;

    // デバウンス同期: 800ms入力がない場合に親ステートへ反映
    if (syncTimeoutRef.current) window.clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = window.setTimeout(() => {
      updateChapter(activeChapterId, { content: val });
      typingRef.current = false;
    }, 800);
  };

  const handleFullGenesis = async () => {
    if (!activeChapter || isFullGenesis) return;
    setIsFullGenesis(true);
    setGenesisStatus('設計士が戦略を策定中...');
    addLog('info', 'Writer', `章「${activeChapter.title}」を全自動構築中...`);
    try {
      const result = await generateFullChapterPackage(project, activeChapter, onTokenUsage, addLog);
      setGenesisStatus('本文を情緒的に展開中...');
      updateChapter(activeChapter.id, {
        strategy: result.strategy,
        beats: result.beats,
        content: result.draft,
        status: 'Polished'
      });
      addLog('success', 'Writer', `章の構築が完了しました。`);
    } catch (err: any) { 
      addLog('error', 'Writer', err.message, err.details); 
    } finally { 
      setIsFullGenesis(false); 
      setGenesisStatus('');
    }
  };

  const handleGenBeats = async () => {
    if (!activeChapter || isProcessing || !activeChapter.summary) return;
    setIsProcessing(true);
    try {
      const beats = await generateBeats(activeChapter.summary, project, onTokenUsage, addLog);
      updateChapter(activeChapter.id, { beats, status: 'Beats' });
      setPlannerTab('BEATS');
    } catch (e: any) { 
      addLog('error', 'Writer', e.message, e.details); 
    } finally { 
      setIsProcessing(false); 
    }
  };

  const handleGenDraft = async () => {
    if (!activeChapter || isProcessing) return;
    setIsProcessing(true);
    try {
      addLog('info', 'Writer', `執筆を開始...`);
      const draft = await generateDraft(activeChapter, project.bible.tone, isHQ, project, onTokenUsage, addLog);
      const newContent = (activeChapter.content ? activeChapter.content + "\n\n" : "") + draft;
      updateChapter(activeChapter.id, { content: newContent, status: 'Drafting' });
    } catch (e: any) { 
      addLog('error', 'Writer', e.message, e.details); 
    } finally { 
      setIsProcessing(false); 
    }
  };

  const handleGetSuggestions = async () => {
    if (!activeChapter || !localContent || isCopilotLoading) return;
    setIsCopilotLoading(true);
    try {
      const suggestions = await suggestNextSentence(localContent, project, onTokenUsage, addLog);
      setCopilotSuggestions(suggestions);
    } catch (e: any) { 
      addLog('error', 'Writer', e.message, e.details); 
    } finally { 
      setIsCopilotLoading(false); 
    }
  };

  const useSuggestion = (text: string) => {
    if (!activeChapter) return;
    const current = localContent || "";
    const space = (current.endsWith('。') || current.endsWith('」') || current.endsWith('！')) ? "" : " ";
    const combined = current + space + text;
    setLocalContent(combined);
    updateChapter(activeChapter.id, { content: combined });
    setCopilotSuggestions([]);
  };

  return (
    <div className={`h-full flex flex-col md:flex-row overflow-hidden bg-stone-950 transition-all duration-700 ${isZenMode ? 'bg-[#1a1816]' : ''}`}>
      {!isZenMode && (
        <aside className="fixed inset-0 z-[110] md:relative md:inset-auto md:z-auto w-full md:w-80 glass border-r border-white/5 flex flex-col shrink-0 transform transition-transform duration-300 -translate-x-full md:translate-x-0">
            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-stone-900/40">
              <h3 className="text-[11px] font-black text-stone-500 uppercase tracking-[0.4em]">Drafts</h3>
              <button onClick={() => {
                  const newId = crypto.randomUUID();
                  setProject(p => p ? ({ ...p, chapters: [...p.chapters, { id: newId, title: '新章', summary: '', content: '', beats: [], stateDeltas: [], strategy: { milestones: [], forbiddenResolutions: [], characterArcProgress: '', pacing: '' }, status: 'Idea', wordCount: 0 }] }) : null);
                  setActiveChapterId(newId);
                }} className="p-2 bg-stone-800 rounded-lg text-orange-400 hover:text-white"><Plus size={18}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              {project.chapters.map((ch, idx) => (
                <button key={ch.id} onClick={() => setActiveChapterId(ch.id)} className={`w-full text-left p-6 rounded-[2rem] border transition-all ${activeChapterId === ch.id ? 'bg-orange-600/10 border-orange-500/30 text-white shadow-lg' : 'text-stone-500 border-transparent hover:bg-white/5'}`}>
                  <div className="flex items-center gap-3"><span className="text-[10px] font-mono text-orange-400">{String(idx+1).padStart(2, '0')}</span><div className="text-[13px] font-serif-bold truncate">{ch.title}</div></div>
                </button>
              ))}
            </div>
        </aside>
      )}

      <div className="flex-1 flex flex-col min-w-0 bg-stone-950/30 relative">
        <header className={`h-16 md:h-24 glass-bright border-b border-white/5 flex items-center justify-between px-4 md:px-10 shrink-0 transition-opacity duration-700 ${isZenMode ? 'opacity-20 hover:opacity-100' : 'opacity-100'}`}>
           <div className="flex items-center gap-4">
              {isZenMode && <button onClick={() => setIsZenMode(false)} className="p-3 bg-stone-800 rounded-xl text-stone-400 hover:text-white"><Minimize2 size={18}/></button>}
              <input value={activeChapter?.title || ''} onChange={e => updateChapter(activeChapterId, { title: e.target.value })} className="bg-transparent text-white font-display font-black italic text-lg md:text-2xl outline-none truncate" placeholder="章題..."/>
           </div>
           <div className="flex items-center gap-2 md:gap-4">
             <div className="hidden md:flex flex-col items-end mr-4">
                <span className="text-[8px] font-black text-stone-600 uppercase tracking-widest">Word Count</span>
                <span className="text-xs font-mono text-orange-400">{localContent.length.toLocaleString()}</span>
             </div>
             {!isZenMode && (
               <>
                 <button onClick={() => setIsZenMode(true)} className="p-2 bg-stone-800 text-stone-400 rounded-xl hover:bg-stone-700 transition-all"><Maximize2 size={16}/></button>
                 <button onClick={() => setShowPlanner(!showPlanner)} className={`p-2 rounded-xl transition-all ${showPlanner ? 'text-orange-400 bg-stone-800' : 'text-stone-600'}`}><LayoutDashboard size={18}/></button>
               </>
             )}
           </div>
        </header>

        <div className="flex-1 flex overflow-hidden relative">
          <main className={`flex-1 overflow-y-auto custom-scrollbar p-6 md:p-12 relative ${isZenMode ? 'max-w-4xl mx-auto' : ''}`}>
            {isZenMode && <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/p6.png')]"></div>}
            
            <textarea 
              className="w-full bg-transparent text-stone-200 prose-literary outline-none resize-none min-h-[75vh] text-xl md:text-2xl caret-orange-500"
              value={localContent}
              onChange={handleTextChange}
              placeholder="綴りましょう..."
            />

            {copilotSuggestions.length > 0 && (
              <div className="fixed bottom-32 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 animate-fade-in z-[150]">
                 <div className="glass-bright rounded-[2rem] p-6 border border-orange-500/30 shadow-2xl space-y-4">
                    <div className="flex justify-between items-center mb-2">
                       <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest flex items-center gap-2"><Quote size={12}/> AI Copilot Suggestions</span>
                       <button onClick={() => setCopilotSuggestions([])} className="text-stone-600 hover:text-rose-500"><X size={14}/></button>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                       {copilotSuggestions.map((text, idx) => (
                         <button key={idx} onClick={() => useSuggestion(text)} className="w-full text-left p-4 bg-stone-900/60 hover:bg-orange-600/20 border border-white/5 rounded-xl text-[12px] font-serif text-stone-300 leading-relaxed transition-all hover:border-orange-500/30">
                            {text}
                         </button>
                       ))}
                    </div>
                 </div>
              </div>
            )}

            <div className={`fixed bottom-12 right-12 transition-all duration-700 ${isZenMode ? 'opacity-20 hover:opacity-100' : ''}`}>
                 <button onClick={handleGetSuggestions} className="w-16 h-16 bg-stone-900 border border-white/10 text-orange-400 rounded-full flex items-center justify-center hover:bg-orange-600 hover:text-white shadow-2xl transition-all">
                   {isCopilotLoading ? <Loader2 size={24} className="animate-spin" /> : <Wand size={24}/>}
                 </button>
            </div>
          </main>

          {showPlanner && !isZenMode && (
            <aside className="w-96 glass border-l border-white/5 flex flex-col overflow-hidden animate-fade-in shrink-0">
               <div className="flex border-b border-white/5">
                 <button onClick={() => setPlannerTab('STRATEGY')} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest ${plannerTab === 'STRATEGY' ? 'text-orange-400 bg-orange-400/5' : 'text-stone-600'}`}>戦略</button>
                 <button onClick={() => setPlannerTab('BEATS')} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest ${plannerTab === 'BEATS' ? 'text-orange-400 bg-orange-400/5' : 'text-stone-600'}`}>ビート</button>
               </div>
               
               <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                 {plannerTab === 'STRATEGY' && (
                   <div className="space-y-6">
                     <textarea value={activeChapter?.summary || ''} onChange={e => updateChapter(activeChapterId, { summary: e.target.value })} className="w-full bg-stone-950/50 border border-white/10 rounded-xl p-4 text-[11px] h-32 outline-none font-serif resize-none" placeholder="章のあらすじ..." />
                     <div className="space-y-2">
                        <div className="text-[9px] font-black text-stone-700 uppercase tracking-widest">Milestones</div>
                        {activeChapter?.strategy.milestones.map((m, i) => (
                           <div key={i} className="flex items-center gap-2 p-3 bg-stone-900/40 rounded-lg text-[10px] font-serif text-stone-400">
                              <Check size={10} className="text-orange-500"/> {m}
                           </div>
                        ))}
                        {(!activeChapter?.strategy.milestones || activeChapter.strategy.milestones.length === 0) && (
                          <div className="text-[9px] text-stone-600 font-serif italic text-center py-4">マイルストーン未設定</div>
                        )}
                     </div>
                   </div>
                 )}
                 {plannerTab === 'BEATS' && (
                   <div className="space-y-6">
                     <button onClick={handleGenBeats} className="w-full py-4 bg-stone-800 text-orange-400 rounded-xl flex items-center justify-center gap-2 hover:bg-stone-700 transition-all"><Sparkles size={14}/> ビート生成</button>
                     {activeChapter?.beats.map((beat, idx) => (
                       <div key={beat.id} className="p-3 bg-stone-900/40 border border-white/5 rounded-xl text-[10px] font-serif text-stone-300">
                         {beat.text}
                       </div>
                     ))}
                     {(!activeChapter?.beats || activeChapter.beats.length === 0) && (
                       <div className="text-[9px] text-stone-600 font-serif italic text-center py-4">ビート未生成</div>
                     )}
                   </div>
                 )}
               </div>

               <div className="p-8 border-t border-white/5 bg-stone-900/20 space-y-3">
                 {isFullGenesis && (
                    <div className="mb-4 text-center animate-pulse">
                       <span className="text-[9px] font-black text-orange-400 uppercase tracking-[0.2em]">{genesisStatus}</span>
                    </div>
                 )}
                 <button onClick={handleFullGenesis} disabled={isFullGenesis} className="w-full py-5 bg-gradient-to-r from-orange-600 to-rose-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 hover:scale-[1.02] transition-all disabled:opacity-50">
                   {isFullGenesis ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16}/>} フルオート構築
                 </button>
                 <button onClick={handleGenDraft} disabled={isProcessing} className="w-full py-5 bg-stone-800 text-orange-400 border border-orange-400/20 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-stone-700 transition-all">
                   {isProcessing ? <Loader2 size={16} className="animate-spin"/> : <Pen size={16}/>} AI執筆
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
