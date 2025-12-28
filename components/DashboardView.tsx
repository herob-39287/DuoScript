
import React, { useState, useMemo } from 'react';
import { StoryProject, SystemLog, BibleIssue } from '../types';
import { analyzeBibleIntegrity } from '../services/geminiService';
import { 
  Activity, Users, Terminal, Database, Trash2, ShieldCheck, Loader2, Zap, 
  ChevronDown, ChevronUp, Copy, Check, ShieldAlert, AlertCircle, RefreshCcw,
  MessageSquareShare
} from 'lucide-react';

interface Props {
  project: StoryProject;
  setProject: React.Dispatch<React.SetStateAction<StoryProject | null>>;
  logs: SystemLog[];
  onClearLogs: () => void;
  onNavigateToPlotter: (tab: string, initialMessage?: string) => void;
  onTokenUsage: (usage: any) => void;
  onGoHome: () => void;
  onOpenPublication: () => void;
  addLog: (type: SystemLog['type'], source: SystemLog['source'], message: string, details?: string) => void;
}

const DashboardView: React.FC<Props> = ({ project, setProject, logs, onClearLogs, onNavigateToPlotter, onTokenUsage, addLog }) => {
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  
  const totalTokens = useMemo(() => {
    return (project.tokenUsage || []).reduce((acc, entry) => acc + entry.input + entry.output, 0);
  }, [project.tokenUsage]);

  const handleIntegrityScan = async () => {
    if (isScanning) return;
    setIsScanning(true);
    addLog('info', 'Architect', '物語設定の整合性をスキャン中...');
    try {
      const issues = await analyzeBibleIntegrity(project.bible, onTokenUsage, addLog);
      setProject(prev => prev ? { ...prev, bible: { ...prev.bible, integrityIssues: issues } } : null);
      if (issues.length === 0) addLog('success', 'Architect', '不整合は見つかりませんでした。完璧な理です。');
      else addLog('error', 'Architect', `${issues.length}件の潜在的な問題が発見されました。`);
    } catch (e: any) {
      addLog('error', 'Architect', 'スキャンに失敗しました。', e.message);
    } finally {
      setIsScanning(false);
    }
  };

  const handleConsultIssue = (issue: BibleIssue) => {
    const message = `設定の不整合スキャンで以下の問題が見つかりました。解決策について相談させてください。\n\n【問題】: ${issue.description}\n【提案されていた修正案】: ${issue.suggestion}\n\nこの問題を解決するために、どのように設定を調整すべきでしょうか？`;
    onNavigateToPlotter('characters', message);
  };

  return (
    <div className="p-4 md:p-12 h-full overflow-y-auto custom-scrollbar bg-stone-900/20">
      <div className="max-w-[1400px] mx-auto space-y-8 md:space-y-16 pb-12">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 animate-fade-in">
            <div className="space-y-4 md:space-y-6">
              <div className="flex items-center gap-3"><div className="w-8 md:w-12 h-[1px] bg-orange-400/30"></div><span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.4em] text-orange-400/80">物語の生命力</span></div>
              <h2 className="text-5xl md:text-8xl font-display font-black text-white tracking-tighter uppercase italic leading-[0.9] flex flex-col"><span className="opacity-30">Story</span><span className="text-glow-warm">Studio</span></h2>
            </div>
            <button onClick={handleIntegrityScan} disabled={isScanning} className="px-8 py-4 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center gap-3 transition-all active:scale-95 disabled:opacity-50">
              {isScanning ? <Loader2 size={16} className="animate-spin"/> : <ShieldCheck size={16}/>} 
              {isScanning ? '分析中' : '不整合をスキャン'}
            </button>
        </header>

        {project.bible.integrityIssues && project.bible.integrityIssues.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
            {project.bible.integrityIssues.map(issue => (
              <div key={issue.id} className="p-6 glass rounded-3xl border border-rose-500/20 space-y-4 relative overflow-hidden group flex flex-col">
                <div className="absolute top-0 left-0 w-1 h-full bg-rose-500" />
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <ShieldAlert size={14} className="text-rose-500"/>
                    <span className="text-[8px] font-black uppercase tracking-widest text-stone-500">{issue.type}</span>
                  </div>
                  <span className={`text-[7px] font-black uppercase px-2 py-0.5 rounded-full ${issue.severity === 'High' ? 'bg-rose-600' : issue.severity === 'Medium' ? 'bg-orange-600' : 'bg-stone-800'} text-white`}>{issue.severity}</span>
                </div>
                <p className="text-[12px] font-serif-bold text-stone-200">"{issue.description}"</p>
                <div className="p-3 bg-stone-950/40 rounded-xl space-y-2 flex-1">
                   <div className="text-[8px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1"><RefreshCcw size={10}/> 解決案</div>
                   <p className="text-[10px] text-stone-400 font-serif leading-relaxed italic">{issue.suggestion}</p>
                </div>
                <button 
                  onClick={() => handleConsultIssue(issue)}
                  className="w-full py-3 bg-stone-800 hover:bg-stone-700 text-orange-400 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all mt-2"
                >
                  <MessageSquareShare size={12} /> アーキテクトに相談する
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-10">
            <div className="lg:col-span-8 glass rounded-[1.5rem] md:rounded-[2.5rem] p-8 md:p-12 flex flex-col h-[600px] shadow-2xl">
                <div className="flex justify-between items-center mb-6 px-2">
                  <h3 className="text-xl md:text-2xl font-display font-black text-white italic tracking-tight flex items-center gap-3">
                    <Terminal size={18} className="text-orange-400" />アトリエ日誌
                  </h3>
                  <button onClick={onClearLogs} className="p-2 hover:bg-stone-800 rounded-lg text-stone-700 hover:text-rose-400 transition-colors"><Trash2 size={16} /></button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2">
                    {logs.map(log => (
                        <div key={log.id} className={`flex flex-col p-4 md:p-6 glass-bright rounded-2xl border-l-4 transition-all ${log.type === 'error' ? 'border-l-rose-500 bg-rose-500/5' : log.type === 'success' ? 'border-l-emerald-500 bg-emerald-500/5' : 'border-l-orange-400/50 bg-white/5'}`}>
                            <div className="flex justify-between items-start gap-4">
                               <div className="flex gap-4 items-start flex-1">
                                  <div className="px-2 py-0.5 rounded text-[7px] md:text-[8px] font-black uppercase bg-stone-800 text-stone-500 h-fit shrink-0">{log.source}</div>
                                  <p className="text-[12px] md:text-sm font-serif text-stone-200 leading-relaxed">{log.message}</p>
                               </div>
                            </div>
                            {log.details && (
                              <div className="mt-4 p-4 bg-stone-950/80 rounded-xl border border-white/5 text-[10px] font-mono text-stone-400 whitespace-pre-wrap overflow-x-auto">
                                {log.details}
                              </div>
                            )}
                            <div className="mt-2 text-[8px] font-mono text-stone-700">{new Date(log.timestamp).toLocaleTimeString()}</div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="lg:col-span-4 space-y-6">
                <div className="glass rounded-[2rem] p-10 flex flex-col justify-between h-48 relative overflow-hidden">
                    <Activity size={100} className="absolute -bottom-4 -right-4 text-white/[0.02] rotate-12" />
                    <span className="text-[10px] font-black text-stone-600 uppercase tracking-widest">累積リソース消費</span>
                    <div className="flex items-baseline gap-2">
                        <span className="text-5xl font-display font-black italic text-emerald-400">{totalTokens.toLocaleString()}</span>
                        <span className="text-[9px] font-black text-stone-700 uppercase tracking-widest font-mono">Tokens</span>
                    </div>
                </div>
                <div className="glass rounded-[2rem] p-10 flex flex-col justify-between h-48 relative overflow-hidden">
                    <Zap size={100} className="absolute -bottom-4 -right-4 text-white/[0.02] -rotate-12" />
                    <span className="text-[10px] font-black text-stone-600 uppercase tracking-widest">聖書イテレーション</span>
                    <div className="flex items-baseline gap-2">
                        <span className="text-5xl font-display font-black italic text-orange-400">{project.bible.version}</span>
                        <span className="text-[9px] font-black text-stone-700 uppercase tracking-widest font-mono">Versions</span>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
