
import React, { useState, useEffect, useRef } from 'react';
import { generateDraft, suggestNextSentence, generateFullChapterPackage } from '../services/geminiService';
import { useProject, useNotifications } from '../App';
import { 
  Sparkles, Plus, Maximize2, Minimize2, Loader2, Feather, LayoutDashboard, Pen, Quote, Wand, ChevronLeft,
  Settings2, Type, Eraser, Download, Save, Send, X, Info
} from 'lucide-react';

const WriterView: React.FC = () => {
  const { project, dispatch: projectDispatch } = useProject();
  const { addLog } = useNotifications();

  const [activeChapterId, setActiveChapterId] = useState(project?.chapters[0]?.id || '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isZenMode, setIsZenMode] = useState(false);
  const [copilotSuggestions, setCopilotSuggestions] = useState<string[]>([]);
  const [isCopilotLoading, setIsCopilotLoading] = useState(false);
  const [showPlanner, setShowPlanner] = useState(true);
  const [fontSize, setFontSize] = useState(24);

  const activeChapter = project?.chapters.find(c => c.id === activeChapterId);
  const [localContent, setLocalContent] = useState(activeChapter?.content || '');
  const typingRef = useRef(false);
  const syncTimeoutRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!typingRef.current) {
      setLocalContent(activeChapter?.content || '');
    }
  }, [activeChapter?.id, activeChapter?.content]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setLocalContent(val);
    typingRef.current = true;

    if (syncTimeoutRef.current) window.clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = window.setTimeout(() => {
      projectDispatch({ type: 'UPDATE_CHAPTER', id: activeChapterId, updates: { content: val } });
      typingRef.current = false;
    }, 1000);
  };

  const handleSuggest = async () => {
    if (isCopilotLoading || !localContent.trim()) return;
    setIsCopilotLoading(true);
    try {
      const suggestions = await suggestNextSentence(localContent, project!, (usage: any) => projectDispatch({ type: 'TRACK_USAGE', payload: usage }), addLog);
      setCopilotSuggestions(suggestions);
    } catch (e) {
      addLog('error', 'Writer', '続きの提案に失敗しました。');
    } finally {
      setIsCopilotLoading(false);
    }
  };

  const handleGenDraft = async () => {
    if (!activeChapter || isProcessing || !project) return;
    setIsProcessing(true);
    addLog('info', 'Writer', '執筆中...');
    try {
      const draft = await generateDraft(activeChapter, project.bible.tone, true, project, (usage: any) => projectDispatch({ type: 'TRACK_USAGE', payload: usage }), addLog);
      const newContent = (localContent ? localContent + "\n\n" : "") + draft;
      setLocalContent(newContent);
      projectDispatch({ type: 'UPDATE_CHAPTER', id: activeChapter.id, updates: { content: newContent, status: 'Drafting' } });
      addLog('success', 'Writer', '執筆完了');
    } catch (e: any) { 
      addLog('error', 'Writer', '執筆に失敗しました。');
    } finally { 
      setIsProcessing(false); 
    }
  };

  if (!project || !activeChapter) return null;

  return (
    <div className={`h-full flex flex-col md:flex-row overflow-hidden bg-stone-950 transition-all duration-700 ${isZenMode ? 'bg-[#141210]' : ''}`}>
      {!isZenMode && (
        <aside className="hidden md:flex w-72 glass border-r border-white/5 flex-col shrink-0 animate-fade-in">
          <div className="p-6 border-b border-white/5 flex justify-between items-center bg-stone-900/40">
            <span className="text-[10px] font-black text-stone-500 uppercase tracking-widest">Chapters</span>
            <button onClick={() => {
              const id = crypto.randomUUID();
              projectDispatch({ type: 'ADD_CHAPTER', payload: { id, title: '新章', summary: '', content: '', beats: [], strategy: { milestones: [], forbiddenResolutions: [], characterArcProgress: '', pacing: '' }, status: 'Idea', wordCount: 0, stateDeltas: [] } });
              setActiveChapterId(id);
            }} className="p-1.5 bg-stone-800 hover:bg-orange-600 text-orange-400 hover:text-white rounded-lg transition-all"><Plus size={16}/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
            {project.chapters.map((ch, idx) => (
              <button 
                key={ch.id} 
                onClick={() => setActiveChapterId(ch.id)} 
                className={`w-full text-left p-5 rounded-2xl border transition-all ${activeChapterId === ch.id ? 'bg-orange-600/10 border-orange-500/30 text-white' : 'text-stone-500 border-transparent hover:bg-white/5'}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono text-orange-500/50">{(idx+1).toString().padStart(2, '0')}</span>
                  <div className="text-[12px] font-serif truncate">{ch.title}</div>
                </div>
              </button>
            ))}
          </div>
        </aside>
      )}

      <div className="flex-1 flex flex-col relative">
        <header className={`h-24 glass-bright border-b border-white/5 flex items-center justify-between px-10 shrink-0 z-20 ${isZenMode ? 'opacity-0 hover:opacity-100 transition-opacity duration-500 bg-[#141210]/95' : ''}`}>
           <div className="flex items-center gap-6">
              {isZenMode && (
                <button onClick={() => setIsZenMode(false)} className="p-3 bg-stone-800 rounded-2xl text-stone-400 hover:text-white transition-all">
                  <Minimize2 size={18}/>
                </button>
              )}
              <input 
                value={activeChapter.title} 
                onChange={e => projectDispatch({ type: 'UPDATE_CHAPTER', id: activeChapter.id, updates: { title: e.target.value } })} 
                className="bg-transparent text-white font-display font-black italic text-2xl outline-none focus:text-orange-400 transition-colors" 
              />
           </div>
           <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center bg-stone-900/50 rounded-xl px-4 py-1.5 border border-white/5 gap-4">
                <button onClick={() => setFontSize(Math.max(16, fontSize - 2))} className="text-stone-500 hover:text-stone-200"><Eraser size={14}/></button>
                <span className="text-[10px] font-mono text-stone-600">{fontSize}px</span>
                <button onClick={() => setFontSize(Math.min(32, fontSize + 2))} className="text-stone-500 hover:text-stone-200"><Type size={14}/></button>
              </div>
              {!isZenMode && (
                <button onClick={() => setIsZenMode(true)} className="p-3 bg-stone-800 rounded-2xl text-stone-500 hover:text-orange-400 transition-all">
                  <Maximize2 size={18}/>
                </button>
              )}
              <button onClick={() => setShowPlanner(!showPlanner)} className={`p-3 rounded-2xl transition-all ${showPlanner ? 'bg-orange-600/20 text-orange-400' : 'bg-stone-800 text-stone-500'}`}>
                <LayoutDashboard size={18}/>
              </button>
           </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          <main className="flex-1 overflow-y-auto custom-scrollbar relative bg-stone-900/10" ref={scrollRef}>
            <div className="max-w-4xl mx-auto px-8 md:px-12 py-20 min-h-full">
              <textarea 
                className="w-full bg-transparent text-stone-200 prose-literary outline-none resize-none min-h-[70vh] caret-orange-500 overflow-hidden"
                value={localContent}
                onChange={handleTextChange}
                style={{ fontSize: `${fontSize}px` }}
                placeholder="物語をここから始めましょう..."
              />
              
              <div className="h-64" /> {/* Spacer */}
            </div>

            {/* Suggestions Overlay */}
            {copilotSuggestions.length > 0 && (
              <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6 animate-fade-in z-30">
                 <div className="glass-bright rounded-[2.5rem] p-8 border border-orange-500/30 shadow-2xl space-y-5">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest flex items-center gap-2">
                        <Sparkles size={14} /> AI Copilot 提案
                      </span>
                      <button onClick={() => setCopilotSuggestions([])} className="text-stone-600 hover:text-white transition-colors"><X size={16}/></button>
                    </div>
                    <div className="space-y-3">
                      {copilotSuggestions.map((text, idx) => (
                        <button 
                          key={idx} 
                          onClick={() => { 
                            const newText = localContent + (localContent.endsWith(' ') ? '' : ' ') + text;
                            setLocalContent(newText);
                            projectDispatch({ type: 'UPDATE_CHAPTER', id: activeChapter.id, updates: { content: newText } });
                            setCopilotSuggestions([]); 
                          }} 
                          className="w-full text-left p-5 bg-stone-900/60 hover:bg-orange-600/10 border border-white/5 rounded-2xl text-sm font-serif text-stone-300 hover:text-white transition-all animate-fade-in"
                        >
                          {text}
                        </button>
                      ))}
                    </div>
                 </div>
              </div>
            )}

            {/* Floating Action Menu */}
            <div className={`fixed bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-3 p-2 glass-bright rounded-3xl border border-white/10 z-20 shadow-2xl transition-all duration-500 ${isZenMode ? 'opacity-20 hover:opacity-100' : ''}`}>
               <button onClick={handleSuggest} disabled={isCopilotLoading} className="p-4 bg-stone-800 text-orange-400 hover:bg-orange-600 hover:text-white rounded-2xl transition-all disabled:opacity-50">
                  {isCopilotLoading ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
               </button>
               <div className="w-px h-8 bg-white/10 mx-1" />
               <button onClick={handleGenDraft} disabled={isProcessing} className="flex items-center gap-3 px-6 py-4 bg-orange-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-orange-500 transition-all shadow-xl shadow-orange-900/20 active:scale-95 disabled:opacity-50">
                  {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Pen size={16} />}
                  AI執筆
               </button>
            </div>
          </main>

          {showPlanner && !isZenMode && (
            <aside className="w-96 glass border-l border-white/5 flex flex-col p-8 space-y-10 animate-fade-in overflow-y-auto custom-scrollbar">
               <div className="space-y-4">
                 <div className="flex items-center justify-between">
                   <span className="text-[10px] font-black text-stone-600 uppercase tracking-widest">Chapter Synopsis</span>
                   <Settings2 size={14} className="text-stone-700"/>
                 </div>
                 <textarea 
                   value={activeChapter.summary} 
                   onChange={e => projectDispatch({ type: 'UPDATE_CHAPTER', id: activeChapter.id, updates: { summary: e.target.value } })} 
                   className="w-full bg-stone-950/50 border border-white/10 rounded-2xl p-5 text-[12px] h-40 outline-none font-serif resize-none text-stone-300 focus:border-orange-500/30 transition-all leading-relaxed" 
                   placeholder="この章で何が起きるのか..." 
                 />
               </div>

               <div className="space-y-5">
                 <span className="text-[10px] font-black text-stone-600 uppercase tracking-widest">Plot Beats</span>
                 <div className="space-y-3">
                    {activeChapter.beats.map((beat, i) => (
                      <div key={beat.id} className="group relative flex items-start gap-3 p-4 bg-stone-900/40 border border-white/5 rounded-2xl hover:border-orange-500/20 transition-all">
                        <span className="text-[10px] font-mono text-orange-400/30 mt-0.5">{i+1}</span>
                        <p className="text-[11px] text-stone-400 font-serif leading-relaxed">{beat.text}</p>
                      </div>
                    ))}
                    <button className="w-full py-4 border-2 border-dashed border-stone-800 rounded-2xl text-[9px] font-black text-stone-700 uppercase tracking-widest hover:text-stone-400 hover:border-stone-700 transition-all">
                      ビートを手動で追加
                    </button>
                 </div>
               </div>
               
               <div className="mt-auto space-y-4 pt-6">
                 <div className="p-5 bg-orange-400/5 rounded-2xl border border-orange-400/10 space-y-2">
                    <div className="flex items-center gap-2 text-orange-400"><Info size={14}/><span className="text-[9px] font-black uppercase tracking-widest">Tip</span></div>
                    <p className="text-[10px] text-stone-500 font-serif leading-relaxed italic">「フルオート構築」は、あらすじから展開案を自動生成し、本文の初稿まで一気通貫で行います。</p>
                 </div>
                 <button 
                  onClick={async () => {
                    if (isProcessing) return;
                    setIsProcessing(true);
                    addLog('info', 'Writer', '章全体を構築中...');
                    try {
                      const res = await generateFullChapterPackage(project, activeChapter, (u:any) => projectDispatch({type:'TRACK_USAGE',payload:u}), addLog);
                      projectDispatch({ type: 'UPDATE_CHAPTER', id: activeChapter.id, updates: { strategy: res.strategy, beats: res.beats, content: res.draft, status: 'Polished' } });
                      addLog('success', 'Writer', '構築完了');
                    } catch(e) { addLog('error','Writer','構築失敗'); }
                    finally { setIsProcessing(false); }
                  }}
                  disabled={isProcessing} 
                  className="w-full py-6 bg-gradient-to-r from-orange-600 to-rose-600 text-white rounded-3xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-2xl shadow-orange-900/30 active:scale-95 transition-all"
                 >
                   {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Wand size={18} />}
                   フルオート構築
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
