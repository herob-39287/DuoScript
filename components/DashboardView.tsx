
import React, { useState, useMemo } from 'react';
import { StoryProject, SystemLog, BibleIssue } from '../types';
import { analyzeBibleIntegrity } from '../services/geminiService';
import { Activity, Users, FileText, Coins, ShieldCheck, Loader2, Zap, HelpCircle, Trash2, BookOpen, Feather, ShieldAlert, Clock, Plus, Calendar, Database } from 'lucide-react';

interface Props {
  project: StoryProject;
  logs: SystemLog[];
  onClearLogs: () => void;
  onNavigateToPlotter: (tab: string) => void;
  onTokenUsage: (usage: any) => void;
  onGoHome: () => void;
  onOpenPublication: () => void;
}

const DashboardView: React.FC<Props> = ({ project, logs, onClearLogs, onTokenUsage, onGoHome, onNavigateToPlotter }) => {
  const [isScanning, setIsScanning] = useState(false);
  
  const totalWords = project.chapters.reduce((acc, c) => acc + (c.wordCount || 0), 0);
  
  const totalTokens = useMemo(() => {
    return (project.tokenUsage || []).reduce((acc, entry) => acc + entry.input + entry.output, 0);
  }, [project.tokenUsage]);

  const readiness = useMemo(() => {
    const bible = project.bible;
    let score = 0;
    if (bible.characters.some(c => c.role === 'Protagonist')) score += 20;
    if (bible.setting.length > 100) score += 30;
    if (bible.timeline.length >= 2) score += 25;
    if (bible.entries.length >= 1) score += 25;
    return Math.min(score, 100);
  }, [project.bible]);

  const usageByModel = useMemo(() => {
    const stats: { [key: string]: number } = {};
    (project.tokenUsage || []).forEach(e => {
      stats[e.model] = (stats[e.model] || 0) + e.input + e.output;
    });
    return Object.entries(stats).sort((a, b) => b[1] - a[1]);
  }, [project.tokenUsage]);

  return (
    <div className="p-4 md:p-12 h-full overflow-y-auto custom-scrollbar bg-stone-900/20">
      <div className="max-w-[1400px] mx-auto space-y-8 md:space-y-16 pb-12">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 animate-fade-in">
            <div className="space-y-4 md:space-y-6">
              <div className="flex items-center gap-3"><div className="w-8 md:w-12 h-[1px] bg-orange-400/30"></div><span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] md:tracking-[0.4em] text-orange-400/80">物語の生命力</span></div>
              <h2 className="text-5xl md:text-8xl font-display font-black text-white tracking-tighter uppercase italic leading-[0.9] flex flex-col"><span className="opacity-30">Story</span><span className="text-glow-warm">Studio</span></h2>
            </div>
            <div className="flex gap-2">
               <button onClick={onGoHome} className="px-4 py-2 bg-orange-600 text-white rounded-full text-[9px] font-black uppercase tracking-[0.2em] shadow-lg flex items-center gap-2 transition-transform active:scale-95"><Plus size={14}/> 新規</button>
            </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-10">
            {/* 進捗と完成度 */}
            <div className="lg:col-span-4 glass rounded-[1.5rem] md:rounded-[2.5rem] p-8 md:p-12 flex flex-col items-center justify-center text-center relative shadow-2xl">
                <div className="absolute top-6 left-8 flex items-center gap-2"><Activity size={14} className="text-orange-400" /><span className="text-[9px] font-black uppercase tracking-widest text-stone-500">執筆完成度</span></div>
                <div className="relative mt-4">
                    <svg className="w-48 h-48 md:w-64 md:h-64 -rotate-90">
                        <circle cx="50%" cy="50%" r="42%" stroke="currentColor" strokeWidth="2" fill="transparent" className="text-stone-800" />
                        <circle cx="50%" cy="50%" r="42%" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray="264" strokeDashoffset={264 * (1 - readiness / 100)} className="text-orange-400 transition-all duration-1000" strokeLinecap="round" style={{ strokeDasharray: 'calc(2 * 3.14159 * 42%)' }} />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center"><span className="text-5xl md:text-7xl font-display font-black italic tracking-tighter text-orange-400">{readiness}%</span></div>
                </div>
                <div className="mt-8 grid grid-cols-2 gap-4 md:gap-8 w-full">
                   <div className="text-center"><p className="text-[9px] font-black text-stone-600 uppercase tracking-widest mb-1">文字数</p><p className="text-lg md:text-xl font-display font-black italic text-white">{totalWords.toLocaleString()}</p></div>
                   <div className="text-center"><p className="text-[9px] font-black text-stone-600 uppercase tracking-widest mb-1">人物数</p><p className="text-lg md:text-xl font-display font-black italic text-white">{project.bible.characters.length}</p></div>
                </div>
            </div>

            {/* システムログ */}
            <div className="lg:col-span-8 glass rounded-[1.5rem] md:rounded-[2.5rem] p-8 md:p-12 flex flex-col h-[400px] md:h-[600px] shadow-2xl">
                <div className="flex justify-between items-center mb-6 px-2"><h3 className="text-xl md:text-2xl font-display font-black text-white italic tracking-tight flex items-center gap-3"><BookOpen size={18} className="text-orange-400" />アトリエ日誌</h3><button onClick={onClearLogs} className="p-2 hover:bg-stone-800 rounded-lg text-stone-700 hover:text-stone-400 transition-all"><Trash2 size={16} /></button></div>
                <div className="flex-1 overflow-y-auto space-y-4 md:space-y-6 custom-scrollbar pr-2">
                    {logs.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-stone-800 italic text-sm">日誌はまだ空白です。</div>
                    ) : logs.map(log => (
                        <div key={log.id} className="flex gap-4 md:gap-6 p-4 md:p-6 glass-bright rounded-2xl md:rounded-[2rem] border-l-2 border-l-transparent hover:border-l-orange-400/50 transition-all">
                            <div className="px-2 py-0.5 rounded text-[7px] md:text-[8px] font-black uppercase bg-stone-800 text-stone-500 h-fit shrink-0">{log.source}</div>
                            <div className="flex-1"><p className="text-[12px] md:text-sm font-serif text-stone-300 leading-relaxed">{log.message}</p></div>
                        </div>
                    ))}
                </div>
            </div>

            {/* トークン使用台帳 */}
            <div className="lg:col-span-12 glass rounded-[1.5rem] md:rounded-[2.5rem] p-8 md:p-12 shadow-2xl space-y-8">
               <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-white/5 pb-8 gap-4">
                  <div className="space-y-2">
                     <h3 className="text-xl md:text-2xl font-display font-black text-white italic tracking-tight flex items-center gap-3"><Database size={20} className="text-emerald-400" />トークン使用台帳</h3>
                     <p className="text-[9px] md:text-[10px] font-black text-stone-600 uppercase tracking-widest">リソース消費の監査ログ</p>
                  </div>
                  <div className="text-left md:text-right">
                     <p className="text-[9px] font-black text-stone-600 uppercase tracking-widest mb-1">累計消費</p>
                     <p className="text-3xl md:text-4xl font-display font-black italic text-emerald-400">{totalTokens.toLocaleString()}</p>
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10">
                  <div className="md:col-span-2 space-y-4">
                     <div className="flex items-center gap-2 mb-2 md:mb-4"><Clock size={14} className="text-stone-700"/><span className="text-[9px] font-black text-stone-700 uppercase tracking-widest">直近の演算履歴</span></div>
                     <div className="max-h-[300px] md:max-h-[400px] overflow-y-auto custom-scrollbar space-y-2 pr-2">
                        {(project.tokenUsage || []).map(entry => (
                           <div key={entry.id} className="flex items-center justify-between p-4 glass-bright rounded-2xl border border-white/5 hover:bg-white/[0.02] transition-all">
                              <div className="flex items-center gap-4 md:gap-6 min-w-0">
                                 <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-stone-900 flex items-center justify-center shrink-0">
                                    <Zap size={14} className={entry.output > 1000 ? 'text-orange-400' : 'text-stone-600'} />
                                 </div>
                                 <div className="min-w-0">
                                    <div className="text-[10px] md:text-[11px] font-black text-white truncate">{entry.source}</div>
                                    <div className="text-[8px] md:text-[9px] text-stone-600 font-mono">{entry.model}</div>
                                 </div>
                              </div>
                              <div className="flex items-center gap-4 md:gap-8 shrink-0">
                                 <div className="text-right">
                                    <div className="text-[9px] md:text-[10px] font-black text-emerald-400/80">{(entry.input + entry.output).toLocaleString()}</div>
                                    <div className="text-[7px] md:text-[8px] text-stone-700 uppercase font-black">tokens</div>
                                 </div>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>

                  <div className="space-y-6">
                     <div className="flex items-center gap-2 mb-2 md:mb-4"><Database size={14} className="text-stone-700"/><span className="text-[9px] font-black text-stone-700 uppercase tracking-widest">モデル別統計</span></div>
                     <div className="space-y-4">
                        {usageByModel.map(([model, count]) => (
                          <div key={model} className="p-4 md:p-6 bg-stone-950/40 rounded-2xl md:rounded-[2rem] border border-white/5">
                             <div className="text-[8px] md:text-[9px] font-black text-stone-600 uppercase tracking-widest mb-1">{model}</div>
                             <div className="flex items-end justify-between">
                                <span className="text-xl md:text-2xl font-display font-black text-white italic">{count.toLocaleString()}</span>
                                <span className="text-[7px] md:text-[8px] text-stone-700 font-black uppercase mb-1">total</span>
                             </div>
                             <div className="mt-3 md:mt-4 h-1 bg-stone-900 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${Math.min(100, (count / (totalTokens || 1)) * 100)}%` }} />
                             </div>
                          </div>
                        ))}
                     </div>
                  </div>
               </div>
            </div>
        </div>
      </div>
    </div>
  );
};
export default DashboardView;
