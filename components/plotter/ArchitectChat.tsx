
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { BrainCircuit, Network, Loader2, Feather, Globe, Send, FileText, ChevronDown, ChevronUp, Check, Maximize2, Activity, Info, HelpCircle, X, Book } from 'lucide-react';
import { ChatMessage, Artifact } from '../../types/sync';
import { getArtifact } from '../../services/storageService';
import { Badge, Card, Button } from '../ui/DesignSystem';
import { useNeuralSync, useUI, useUIDispatch } from '../../contexts/StoryContext';

interface ArchitectChatProps {
  mobileMode: 'chat' | 'bible';
  isSyncing: boolean;
  displayHistory: ChatMessage[];
  input: string;
  setInput: (val: string) => void;
  isTyping: boolean;
  onSendMessage: () => void;
}

const ArtifactCard: React.FC<{ msg: ChatMessage }> = ({ msg }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [fullArtifact, setFullArtifact] = useState<Artifact | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLoad = async () => {
    if (isExpanded) {
      setIsExpanded(false);
      return;
    }
    if (fullArtifact) {
      setIsExpanded(true);
      return;
    }
    if (!msg.artifactId) return;

    setLoading(true);
    try {
      const art = await getArtifact(msg.artifactId);
      if (art) {
        setFullArtifact(art);
        setIsExpanded(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const summary = msg.collapsedContent;

  return (
    <div className="w-[90%] md:w-[85%] self-start animate-fade-in">
      <div className={`rounded-2xl border border-orange-500/20 bg-stone-900/40 overflow-hidden ${isExpanded ? 'ring-1 ring-orange-500/30' : ''}`}>
        <div className="p-3 border-b border-white/5 bg-stone-900/80 flex items-center justify-between">
           <div className="flex items-center gap-2">
             <div className="p-1.5 bg-orange-900/30 rounded text-orange-400"><FileText size={14}/></div>
             <span className="text-[10px] font-black text-stone-300 uppercase tracking-widest">{summary?.type || 'Artifact'}</span>
           </div>
           <span className="text-[9px] text-stone-600 font-mono">ID: {summary?.docId?.slice(0, 6)}</span>
        </div>
        
        <div className="p-4 space-y-3">
           <p className="text-[12px] font-bold text-stone-200">{summary?.title || "生成成果物"}</p>
           {summary?.decisions_made && summary.decisions_made.length > 0 && (
             <div className="space-y-1">
               <span className="text-[8px] font-black text-stone-600 uppercase tracking-widest flex items-center gap-1"><Check size={10} className="text-emerald-500"/> 決定事項</span>
               <ul className="text-[10px] text-stone-400 font-serif list-disc list-inside space-y-0.5 pl-1">
                 {summary.decisions_made.slice(0, 3).map((d, i) => <li key={i}>{d}</li>)}
               </ul>
             </div>
           )}
           <button onClick={handleLoad} className="w-full py-2 bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2">
             {loading ? <Loader2 size={12} className="animate-spin"/> : (isExpanded ? <ChevronUp size={12}/> : <Maximize2 size={12}/>)}
             {isExpanded ? "閉じる" : "全文を表示"}
           </button>
        </div>
        {isExpanded && fullArtifact && (
          <div className="p-4 border-t border-white/10 bg-black/20 max-h-96 overflow-y-auto custom-scrollbar">
            <pre className="text-[11px] text-stone-300 font-serif leading-relaxed whitespace-pre-wrap">{fullArtifact.content}</pre>
          </div>
        )}
      </div>
    </div>
  );
};

export const ArchitectChat: React.FC<ArchitectChatProps> = ({
  mobileMode,
  isSyncing,
  displayHistory,
  input,
  setInput,
  isTyping,
  onSendMessage
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const sync = useNeuralSync();
  const ui = useUI();
  const uiDispatch = useUIDispatch();
  const [showMemoryMonitor, setShowMemoryMonitor] = useState(false);

  const parsedMemory = useMemo(() => {
    try {
      return JSON.parse(sync.conversationMemory || '{"decisions": [], "open_questions": []}');
    } catch (e) {
      return { decisions: [], open_questions: [] };
    }
  }, [sync.conversationMemory]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayHistory.length, isTyping, mobileMode]);

  return (
    <div className={`${mobileMode === 'chat' ? 'flex' : 'hidden md:flex'} w-full md:w-[400px] lg:w-[480px] flex-col border-r border-white/5 bg-stone-900/40 relative z-10 shrink-0 h-full`}>
      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-stone-900/60 backdrop-blur-md">
         <div className="flex items-center gap-3">
           <div className="p-2 bg-stone-800 rounded-lg text-orange-400"><BrainCircuit size={20}/></div>
           <div className="min-w-0">
             <h2 className="text-sm font-black text-stone-200 uppercase tracking-widest truncate">物語の設計士</h2>
             <button onClick={() => setShowMemoryMonitor(true)} className="flex items-center gap-1.5 text-[8px] font-black text-stone-500 hover:text-orange-400 uppercase tracking-[0.2em] transition-colors">
               <Activity size={10} /> Memory Optimized
             </button>
           </div>
         </div>
         <div className="flex items-center gap-2">
            <button 
              onClick={() => uiDispatch({ type: 'TOGGLE_CONTEXT_ACTIVE', payload: !ui.isContextActive })}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${ui.isContextActive ? 'border-orange-500/50 text-orange-400 bg-orange-500/10 shadow-lg shadow-orange-950/20' : 'border-stone-800 text-stone-600 hover:border-stone-700'}`}
              title={ui.isContextActive ? "設定を参照中" : "設定を無視中（創造性優先）"}
            >
              <Book size={10} className={ui.isContextActive ? "animate-pulse" : ""} />
              {ui.isContextActive ? "Bible ON" : "Bible OFF"}
            </button>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${isSyncing ? 'border-orange-500/30 text-orange-400 bg-orange-500/5' : 'border-stone-800 text-stone-600'}`}>
              {isSyncing ? <Loader2 size={10} className="animate-spin" /> : <Network size={10} />}
              Sync
            </div>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar scroll-smooth" ref={scrollRef}>
         {displayHistory.map((msg) => (
             msg.kind === 'artifact_ref' ? <ArtifactCard key={msg.id} msg={msg} /> : (
               <div key={msg.id} className={`flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in`}>
                 <div className={`max-w-[85%] p-4 rounded-2xl text-[12px] md:text-[13px] leading-relaxed font-serif whitespace-pre-wrap shadow-lg ${msg.role === 'user' ? 'bg-stone-800 text-stone-200 rounded-br-none' : 'glass-bright text-stone-100 rounded-bl-none border border-white/5'}`}>
                   {msg.content}
                 </div>
                 {msg.sources && msg.sources.length > 0 && (
                   <div className="grid grid-cols-1 gap-2 w-[85%]">
                     {msg.sources.map((s, i) => (
                       <a key={i} href={s.uri} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-2 bg-stone-950/60 rounded-xl border border-white/5 hover:border-orange-500/30 transition-all group">
                         <div className="p-1.5 bg-stone-800 rounded text-orange-400"><Globe size={12}/></div>
                         <div className="min-w-0">
                           <div className="text-[9px] font-black text-stone-300 truncate uppercase tracking-widest">{s.title}</div>
                         </div>
                       </a>
                     ))}
                   </div>
                 )}
               </div>
             )
         ))}
         {isTyping && (
           <div className="flex items-start gap-2 animate-pulse opacity-50">
             <div className="p-4 glass-bright rounded-2xl rounded-bl-none">
               <div className="flex gap-1"><div className="w-1.5 h-1.5 bg-stone-500 rounded-full"/><div className="w-1.5 h-1.5 bg-stone-500 rounded-full"/><div className="w-1.5 h-1.5 bg-stone-500 rounded-full"/></div>
             </div>
           </div>
         )}
      </div>

      <div className="p-4 bg-stone-900/80 backdrop-blur border-t border-white/5 pb-20 md:pb-safe">
         <div className="relative group">
           <textarea 
             value={input}
             onChange={e => setInput(e.target.value)}
             onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSendMessage(); } }}
             placeholder="設計士に相談..."
             className="w-full bg-stone-950/50 border border-stone-800 rounded-xl px-4 py-3 md:py-4 pr-12 text-[13px] text-stone-200 outline-none focus:border-orange-500/30 transition-all resize-none shadow-inner h-12 md:h-14 custom-scrollbar"
           />
           <button onClick={onSendMessage} disabled={!input.trim() || isTyping} className="absolute right-2 bottom-2 md:bottom-3 p-2 bg-stone-800 text-stone-400 rounded-lg hover:bg-orange-600 hover:text-white disabled:opacity-30 transition-all active:scale-95">
             {isTyping ? <Loader2 size={16} className="animate-spin"/> : <Send size={16}/>}
           </button>
         </div>
         {!ui.isContextActive && (
           <p className="text-[8px] font-black text-orange-400/50 uppercase tracking-[0.2em] mt-2 text-center animate-pulse">Bible Reference Disabled - High Creativity Mode</p>
         )}
      </div>

      {showMemoryMonitor && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
           <div className="absolute inset-0 bg-stone-950/80 backdrop-blur-sm" onClick={() => setShowMemoryMonitor(false)} />
           <Card variant="glass-bright" padding="lg" className="w-full max-w-sm z-10 space-y-6 shadow-3xl border-orange-500/30">
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                 <div className="flex items-center gap-3">
                   <div className="p-2 bg-orange-600/20 text-orange-400 rounded-lg"><Activity size={18}/></div>
                   <h3 className="text-sm font-black text-white uppercase tracking-widest">対話記憶 (Tier 2)</h3>
                 </div>
                 <button onClick={() => setShowMemoryMonitor(false)} className="text-stone-500 hover:text-white transition-colors"><X size={20} /></button>
              </div>
              <div className="space-y-6 max-h-[60vh] overflow-y-auto no-scrollbar">
                 <div className="space-y-3">
                    <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2"><Check size={12}/> 決定事項 (Decisions)</div>
                    <ul className="space-y-2">
                       {parsedMemory.decisions.length > 0 ? parsedMemory.decisions.map((d: string, i: number) => (
                         <li key={i} className="text-[11px] text-stone-300 font-serif leading-relaxed p-3 bg-stone-950/50 rounded-xl border border-white/5">
                            {d}
                         </li>
                       )) : <li className="text-[10px] text-stone-600 italic">決定事項はありません。</li>}
                    </ul>
                 </div>
                 <div className="space-y-3">
                    <div className="text-[10px] font-black text-orange-400 uppercase tracking-widest flex items-center gap-2"><HelpCircle size={12}/> 検討課題 (Open Questions)</div>
                    <ul className="space-y-2">
                       {parsedMemory.open_questions.length > 0 ? parsedMemory.open_questions.map((q: string, i: number) => (
                         <li key={i} className="text-[11px] text-stone-300 font-serif leading-relaxed p-3 bg-stone-950/50 rounded-xl border border-white/5 border-dashed">
                            {q}
                         </li>
                       )) : <li className="text-[10px] text-stone-600 italic">検討中の課題はありません。</li>}
                    </ul>
                 </div>
              </div>
              <p className="text-[9px] text-stone-600 font-serif leading-relaxed italic text-center">
                ※ 会話が増えるとAIが自動で内容を整理し、生の履歴を破棄することで記憶精度を維持します。
              </p>
           </Card>
        </div>
      )}
    </div>
  );
};
