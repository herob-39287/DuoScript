
import React, { useState, useMemo } from 'react';
import { BibleIssue } from '../types';
import { analyzeBibleIntegrity } from '../services/geminiService';
import { useProject, useNotifications } from '../App';
import { 
  Activity, Terminal, Trash2, ShieldCheck, Loader2, Zap, 
  ShieldAlert, RefreshCcw, MessageSquareShare
} from 'lucide-react';

interface Props {
  onOpenPublication: () => void;
}

const DashboardView: React.FC<Props> = ({ onOpenPublication }) => {
  const { project, dispatch: projectDispatch, setView, setPlotterTab, setPendingMsg } = useProject();
  const { logs, addLog, dispatch: notifDispatch } = useNotifications();
  const [isScanning, setIsScanning] = useState(false);
  
  const totalTokens = useMemo(() => {
    if (!project) return 0;
    return (project.tokenUsage || []).reduce((acc, entry) => acc + entry.input + entry.output, 0);
  }, [project?.tokenUsage]);

  const handleIntegrityScan = async () => {
    if (!project || isScanning) return;
    setIsScanning(true);
    addLog('info', 'Architect', '物語設定の整合性をスキャン中...');
    try {
      const issues = await analyzeBibleIntegrity(project.bible, (usage: any) => projectDispatch({ type: 'TRACK_USAGE', payload: usage }), addLog);
      projectDispatch({ type: 'UPDATE_BIBLE', payload: { integrityIssues: issues } });
      if (issues.length === 0) addLog('success', 'Architect', '不整合は見つかりませんでした。完璧な理です。');
      else addLog('error', 'Architect', `${issues.length}件の潜在的な問題が発見されました。`);
    } catch (e: any) {
      addLog('error', 'Architect', 'スキャンに失敗しました。', e.message);
    } finally {
      setIsScanning(false);
    }
  };

  const handleConsultIssue = (issue: BibleIssue) => {
    const message = `不整合が見つかりました：${issue.description}\n解決策：${issue.suggestion}`;
    setPendingMsg(message);
    setPlotterTab('characters');
    setView(2 as any); // ViewMode.PLOTTER
  };

  if (!project) return null;

  return (
    <div className="p-4 md:p-12 h-full overflow-y-auto custom-scrollbar bg-stone-900/20">
      <div className="max-w-[1400px] mx-auto space-y-8 pb-12">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 animate-fade-in">
            <div className="space-y-4">
              <div className="flex items-center gap-3"><div className="w-8 h-[1px] bg-orange-400/30"></div><span className="text-[10px] font-black uppercase tracking-[0.4em] text-orange-400">物語の生命力</span></div>
              <h2 className="text-6xl font-display font-black text-white italic tracking-tighter">StoryStudio</h2>
            </div>
            <button onClick={handleIntegrityScan} disabled={isScanning} className="px-8 py-4 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center gap-3 transition-all active:scale-95 disabled:opacity-50">
              {isScanning ? <Loader2 size={16} className="animate-spin"/> : <ShieldCheck size={16}/>} 
              {isScanning ? '分析中' : '不整合をスキャン'}
            </button>
        </header>

        {project.bible.integrityIssues && project.bible.integrityIssues.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
            {project.bible.integrityIssues.map(issue => (
              <div key={issue.id} className="p-6 glass rounded-3xl border border-rose-500/20 space-y-4 relative overflow-hidden group">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2"><ShieldAlert size={14} className="text-rose-500"/><span className="text-[8px] font-black uppercase text-stone-500">{issue.type}</span></div>
                </div>
                <p className="text-[12px] font-serif-bold text-stone-200">"{issue.description}"</p>
                <div className="p-3 bg-stone-950/40 rounded-xl space-y-2">
                   <div className="text-[8px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1"><RefreshCcw size={10}/> 解決案</div>
                   <p className="text-[10px] text-stone-400 font-serif leading-relaxed italic">{issue.suggestion}</p>
                </div>
                <button onClick={() => handleConsultIssue(issue)} className="w-full py-3 bg-stone-800 hover:bg-stone-700 text-orange-400 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
                  <MessageSquareShare size={12} /> アーキテクトに相談
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-8 glass rounded-[2.5rem] p-12 flex flex-col h-[600px] shadow-2xl">
                <div className="flex justify-between items-center mb-6 px-2">
                  <h3 className="text-2xl font-display font-black text-white italic tracking-tight flex items-center gap-3">
                    <Terminal size={18} className="text-orange-400" />アトリエ日誌
                  </h3>
                  <button onClick={() => notifDispatch({ type: 'CLEAR_LOGS' })} className="p-2 hover:bg-stone-800 rounded-lg text-stone-700 hover:text-rose-400 transition-colors"><Trash2 size={16} /></button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2">
                    {logs.map(log => (
                        <div key={log.id} className={`flex flex-col p-6 glass-bright rounded-2xl border-l-4 ${log.type === 'error' ? 'border-l-rose-500' : log.type === 'success' ? 'border-l-emerald-500' : 'border-l-orange-400/50'}`}>
                            <div className="flex gap-4 items-start">
                               <div className="px-2 py-0.5 rounded text-[8px] font-black uppercase bg-stone-800 text-stone-500">{log.source}</div>
                               <p className="text-sm font-serif text-stone-200">{log.message}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="lg:col-span-4 space-y-6">
                <div className="glass rounded-[2rem] p-10 flex flex-col justify-between h-48 relative overflow-hidden">
                    <Activity size={100} className="absolute -bottom-4 -right-4 text-white/[0.02] rotate-12" />
                    <span className="text-[10px] font-black text-stone-600 uppercase tracking-widest">リソース消費</span>
                    <div className="flex items-baseline gap-2">
                        <span className="text-5xl font-display font-black italic text-emerald-400">{totalTokens.toLocaleString()}</span>
                        <span className="text-[9px] font-black text-stone-700 uppercase font-mono">Tokens</span>
                    </div>
                </div>
                <div className="glass rounded-[2rem] p-10 flex flex-col justify-between h-48 relative overflow-hidden">
                    <Zap size={100} className="absolute -bottom-4 -right-4 text-white/[0.02] -rotate-12" />
                    <span className="text-[10px] font-black text-stone-600 uppercase tracking-widest">聖書バージョン</span>
                    <div className="flex items-baseline gap-2">
                        <span className="text-5xl font-display font-black italic text-orange-400">{project.bible.version}</span>
                        <span className="text-[9px] font-black text-stone-700 uppercase font-mono">Versions</span>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
