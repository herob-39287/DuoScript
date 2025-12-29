import React, { useState, useMemo } from 'react';
import { BibleIssue, SystemLog, ViewMode } from '../types';
import { analyzeBibleIntegrity, maintainSummaryBuffer } from '../services/geminiService';
import { 
  useMetadata, useBible, useBibleDispatch, useManuscript, 
  useNotificationDispatch, useNotifications, useUIDispatch 
} from '../contexts/StoryContext';
import * as Actions from '../store/actions';
import { 
  Activity, Terminal, Trash2, ShieldCheck, Loader2, Zap, 
  ShieldAlert, RefreshCcw, MessageSquareShare, Database,
  BrainCircuit, Sparkles
} from 'lucide-react';

interface Props {
  onOpenPublication: () => void;
}

const DashboardView: React.FC<Props> = ({ onOpenPublication }) => {
  const { title, tokenUsage } = useMetadata();
  const bible = useBible();
  const bibleDispatch = useBibleDispatch();
  const chapters = useManuscript();
  const uiDispatch = useUIDispatch();
  const { logs } = useNotifications();
  const { addLog, dispatch: notifDispatch } = useNotificationDispatch();

  const [isScanning, setIsScanning] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [logLimit, setLogLimit] = useState(50);
  
  const totalTokens = useMemo(() => {
    return (tokenUsage || []).reduce((acc, entry) => acc + entry.input + entry.output, 0);
  }, [tokenUsage]);

  const handleIntegrityScan = async () => {
    if (isScanning) return;
    setIsScanning(true);
    addLog('info', 'Architect', '物語設定の整合性をスキャン中...');
    try {
      const issues = await analyzeBibleIntegrity({ bible } as any, (usage: any) => bibleDispatch(Actions.trackUsage(usage)), addLog);
      bibleDispatch(Actions.updateBible({ integrityIssues: issues }));
      if (issues.length === 0) addLog('success', 'Architect', '不整合は見つかりませんでした。完璧な理です。');
      else addLog('error', 'Architect', `${issues.length}件の潜在的な問題が発見されました。`);
    } catch (e: any) {
      addLog('error', 'Architect', 'スキャンに失敗しました。', e.message);
    } finally {
      setIsScanning(false);
    }
  };

  const handleMaintainSummary = async () => {
    if (isSummarizing) return;
    setIsSummarizing(true);
    addLog('info', 'Architect', 'コンテキスト・バッファを最適化中...');
    try {
      const newSummary = await maintainSummaryBuffer({ bible } as any, (usage: any) => bibleDispatch(Actions.trackUsage(usage)), addLog);
      bibleDispatch(Actions.updateBible({ summaryBuffer: newSummary, lastSummaryUpdate: Date.now() }));
      addLog('success', 'Architect', 'コンテキストが最新の状態に統合されました。');
    } catch (e: any) {
      addLog('error', 'Architect', '要約に失敗しました。');
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleConsultIssue = (issue: BibleIssue) => {
    const message = `不整合が見つかりました：${issue.description}\n解決策：${issue.suggestion}`;
    uiDispatch(Actions.setPendingMsg(message));
    uiDispatch(Actions.setPlotterTab('characters'));
    uiDispatch(Actions.setView(ViewMode.PLOTTER));
  };

  const visibleLogs = useMemo(() => logs.slice(0, logLimit), [logs, logLimit]);

  return (
    <div className="p-6 md:p-12 h-full overflow-y-auto custom-scrollbar bg-stone-900/20 pb-20 md:pb-12">
      <div className="max-w-[1400px] mx-auto space-y-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 animate-fade-in">
            <div className="space-y-2 md:space-y-4">
              <div className="flex items-center gap-3"><div className="w-6 md:w-8 h-[1px] bg-orange-400/30"></div><span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.4em] text-orange-400">物語の生命力</span></div>
              <h2 className="text-4xl md:text-6xl font-display font-black text-white italic tracking-tighter">StoryStudio</h2>
            </div>
            <div className="flex flex-wrap gap-3 md:gap-4 w-full md:w-auto">
              <button onClick={handleMaintainSummary} disabled={isSummarizing} className="flex-1 md:flex-none px-5 py-3 md:px-6 md:py-4 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 md:gap-3 transition-all active:scale-95 disabled:opacity-50">
                {isSummarizing ? <Loader2 size={16} className="animate-spin"/> : <BrainCircuit size={16} className="text-orange-400" />} 
                記憶整理
              </button>
              <button onClick={handleIntegrityScan} disabled={isScanning} className="flex-1 md:flex-none px-5 py-3 md:px-8 md:py-4 bg-orange-600 hover:bg-orange-500 text-white rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 md:gap-3 transition-all active:scale-95 disabled:opacity-50">
                {isScanning ? <Loader2 size={16} className="animate-spin"/> : <ShieldCheck size={16}/>} 
                整合性分析
              </button>
            </div>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            <StatCard icon={<Activity size={24}/>} label="トークン累積" value={totalTokens.toLocaleString()} unit="T" color="text-emerald-400" />
            <StatCard icon={<Zap size={24}/>} label="聖書Ver." value={bible.version.toString()} unit="V" color="text-orange-400" />
            <StatCard icon={<Database size={24}/>} label="記憶密度" value={bible.summaryBuffer ? "高" : "未"} unit="B" color="text-blue-400" />
            <StatCard icon={<Sparkles size={24}/>} label="執筆完了" value={chapters.filter(c => c.status === 'Polished').length.toString()} unit="C" color="text-purple-400" />
        </div>

        {bible.integrityIssues && bible.integrityIssues.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 animate-fade-in">
            {bible.integrityIssues.map(issue => (
              <div key={issue.id} className="p-6 glass rounded-2xl md:rounded-3xl border border-rose-500/20 space-y-4 relative overflow-hidden group">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2"><ShieldAlert size={14} className="text-rose-500"/><span className="text-[8px] font-black uppercase text-stone-500">{issue.type}</span></div>
                </div>
                <p className="text-[12px] md:text-[13px] font-serif-bold text-stone-200">"{issue.description}"</p>
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

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-10">
            <div className="lg:col-span-8 glass rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-12 flex flex-col h-[400px] md:h-[600px] shadow-2xl">
                <div className="flex justify-between items-center mb-6 px-2 shrink-0">
                  <h3 className="text-xl md:text-2xl font-display font-black text-white italic tracking-tight flex items-center gap-3">
                    <Terminal size={18} className="text-orange-400" />アトリエ日誌
                  </h3>
                  <button onClick={() => notifDispatch(Actions.clearLogs())} className="p-2 hover:bg-stone-800 rounded-lg text-stone-700 hover:text-rose-400 transition-colors"><Trash2 size={16} /></button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2 pb-4">
                    {visibleLogs.map(log => <LogItem key={log.id} log={log} />)}
                    {logs.length > logLimit && (
                      <button onClick={() => setLogLimit(l => l + 50)} className="w-full py-4 text-[10px] font-black uppercase tracking-widest text-stone-600 hover:text-orange-400 transition-colors">
                        過去のログを読み込む
                      </button>
                    )}
                    {logs.length === 0 && <div className="h-full flex items-center justify-center text-stone-700 italic font-serif text-sm">日誌はまだ空です。</div>}
                </div>
            </div>

            <div className="lg:col-span-4 space-y-6">
                <div className="glass rounded-[1.5rem] md:rounded-[2rem] p-8 md:p-10 flex flex-col justify-between h-full min-h-[300px] md:min-h-[400px] relative overflow-hidden">
                    <BrainCircuit size={150} className="absolute -bottom-8 -right-8 text-white/[0.02] rotate-12" />
                    <div className="space-y-4 md:space-y-6">
                      <span className="text-[9px] md:text-[10px] font-black text-stone-600 uppercase tracking-widest">現在の要約バッファ</span>
                      <p className="text-[11px] text-stone-400 font-serif leading-relaxed italic line-clamp-[8] md:line-clamp-[12]">
                        {bible.summaryBuffer || "未生成です。「記憶を整理」ボタンから最新の設定要約を作成し、AIの推論効率を高めることができます。"}
                      </p>
                    </div>
                    <div className="mt-auto pt-6 border-t border-white/5 shrink-0">
                       <span className="text-[8px] font-black text-stone-700 uppercase">最終同期</span>
                       <p className="text-[10px] text-stone-500">{bible.lastSummaryUpdate ? new Date(bible.lastSummaryUpdate).toLocaleString() : '---'}</p>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

interface LogItemProps {
  log: SystemLog;
}

const LogItem = React.memo(({ log }: LogItemProps) => (
  <div className={`flex flex-col p-4 md:p-6 glass-bright rounded-2xl border-l-4 animate-fade-in ${log.type === 'error' ? 'border-l-rose-500' : log.type === 'success' ? 'border-l-emerald-500' : 'border-l-orange-400/50'}`}>
      <div className="flex gap-3 md:gap-4 items-start">
         <div className="px-2 py-0.5 rounded text-[8px] font-black uppercase bg-stone-800 text-stone-500 shrink-0">{log.source}</div>
         <p className="text-[12px] md:text-sm font-serif text-stone-200">{log.message}</p>
      </div>
  </div>
));

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
  color: string;
}

const StatCard = React.memo(({ icon, label, value, unit, color }: StatCardProps) => (
  <div className="glass rounded-2xl md:rounded-[2rem] p-5 md:p-8 flex flex-col justify-between h-32 md:h-40 relative overflow-hidden group">
    <div className="absolute top-4 right-4 md:top-8 md:right-8 text-white/5 group-hover:text-white/10 transition-colors">{icon}</div>
    <span className="text-[8px] md:text-[10px] font-black text-stone-600 uppercase tracking-widest truncate">{label}</span>
    <div className="flex items-baseline gap-1 md:gap-2">
        <span className={`text-2xl md:text-4xl font-display font-black italic ${color}`}>{value}</span>
        <span className="text-[7px] md:text-[8px] font-black text-stone-700 uppercase font-mono">{unit}</span>
    </div>
  </div>
));

export default React.memo(DashboardView);
