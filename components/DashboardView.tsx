
import React, { useState, useMemo, useEffect } from 'react';
import { BibleIssue, SystemLog, ViewMode, Foreshadowing, AssetMetadata, TokenUsageEntry } from '../types';
import { analyzeBibleIntegrity, maintainSummaryBuffer } from '../services/geminiService';
import { 
  useMetadata, useMetadataDispatch, useBibleDispatch, useManuscript, 
  useNotificationDispatch, useNotifications, useUIDispatch,
  useCharacters, useWorldFoundation, useGeography, usePlotPlan, useKnowledge, useBible
} from '../contexts/StoryContext';
import * as Actions from '../store/actions';
import { 
  Activity, Terminal, Trash2, ShieldCheck, Loader2, Zap, 
  ShieldAlert, Database,
  BrainCircuit, Sparkles, Flag, TrendingUp, CheckCircle2,
  HardDrive, Image as ImageIcon, Quote, ThumbsUp, ThumbsDown, ShieldOff, AlertTriangle, BarChart3,
  Shuffle, EyeOff, MessageSquareShare, Info, ArrowUpRight, ArrowDownLeft, Cpu
} from 'lucide-react';
import { getAllAssetMetadata, deletePortrait, getPortrait } from '../services/storageService';
import { translateSafetyCategory } from '../services/gemini/utils';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  PieChart, Pie, Cell, BarChart, Bar, Legend
} from 'recharts';

interface Props {
  onOpenPublication: () => void;
}

const DashboardView: React.FC<Props> = ({ onOpenPublication }) => {
  const meta = useMetadata();
  const { id: projectId, tokenUsage, preferences, violationCount, violationHistory } = meta;
  const metaDispatch = useMetadataDispatch();
  const bibleDispatch = useBibleDispatch();
  const chapters = useManuscript();
  const uiDispatch = useUIDispatch();
  const { logs } = useNotifications();
  const { addLog, dispatch: notifDispatch } = useNotificationDispatch();

  // Use granular hooks
  const characters = useCharacters();
  const foundation = useWorldFoundation();
  const plot = usePlotPlan();
  const knowledge = useKnowledge();
  const bible = useBible();

  const [isScanning, setIsScanning] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [logLimit, setLogLimit] = useState(30);
  const [assets, setAssets] = useState<AssetMetadata[]>([]);
  const [usageViewMode, setUsageViewMode] = useState<'source' | 'model'>('source');
  
  const totalTokens = useMemo(() => {
    return (tokenUsage || []).reduce((acc, entry) => acc + (Number(entry.input) || 0) + (Number(entry.output) || 0), 0);
  }, [tokenUsage]);

  const totalInputTokens = useMemo(() => {
    return (tokenUsage || []).reduce((acc, entry) => acc + (Number(entry.input) || 0), 0);
  }, [tokenUsage]);

  const totalOutputTokens = useMemo(() => {
    return (tokenUsage || []).reduce((acc, entry) => acc + (Number(entry.output) || 0), 0);
  }, [tokenUsage]);

  // 機能別の使用量集計
  const usageBySource = useMemo(() => {
    const raw = (tokenUsage || []).reduce((acc, entry) => {
      const src = entry.source || 'Unknown';
      if (!acc[src]) acc[src] = { label: src, input: 0, output: 0, total: 0 };
      acc[src].input += Number(entry.input) || 0;
      acc[src].output += Number(entry.output) || 0;
      acc[src].total += (Number(entry.input) || 0) + (Number(entry.output) || 0);
      return acc;
    }, {} as Record<string, { label: string; input: number; output: number; total: number }>);

    return (Object.values(raw) as Array<{ label: string; input: number; output: number; total: number }>).sort((a, b) => b.total - a.total);
  }, [tokenUsage]);

  // モデル別の使用量集計
  const usageByModel = useMemo(() => {
    const raw = (tokenUsage || []).reduce((acc, entry) => {
      let modelLabel = entry.model || 'Unknown';
      if (modelLabel.includes('pro')) modelLabel = 'Gemini Pro';
      else if (modelLabel.includes('flash') && !modelLabel.includes('image')) modelLabel = 'Gemini Flash';
      else if (modelLabel.includes('image')) modelLabel = 'Image Gen';
      else if (modelLabel.includes('tts')) modelLabel = 'Voice (TTS)';

      if (!acc[modelLabel]) acc[modelLabel] = { label: modelLabel, input: 0, output: 0, total: 0 };
      acc[modelLabel].input += Number(entry.input) || 0;
      acc[modelLabel].output += Number(entry.output) || 0;
      acc[modelLabel].total += (Number(entry.input) || 0) + (Number(entry.output) || 0);
      return acc;
    }, {} as Record<string, { label: string; input: number; output: number; total: number }>);

    return (Object.values(raw) as Array<{ label: string; input: number; output: number; total: number }>).sort((a, b) => b.total - a.total);
  }, [tokenUsage]);

  const activeUsageData = usageViewMode === 'source' ? usageBySource : usageByModel;

  useEffect(() => {
    const fetchAssets = async () => {
      try {
        const meta = await getAllAssetMetadata(projectId);
        setAssets(meta);
      } catch (e) {
        console.error("Failed to load asset metadata", e);
      }
    };
    fetchAssets();
  }, [projectId]);

  const totalAssetSize = useMemo(() => {
    return assets.reduce((acc, a) => acc + (a.size || 0), 0);
  }, [assets]);

  const progressData = useMemo(() => {
    return chapters.map((ch, i) => ({
      name: `第${i+1}章`,
      wordCount: ch.wordCount || 0,
      status: ch.status
    }));
  }, [chapters]);

  const roleDistribution = useMemo(() => {
    const counts = characters.reduce((acc, char) => {
      acc[char.profile.role] = (acc[char.profile.role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [characters]);

  const handleDeleteAsset = async (assetId: string) => {
    uiDispatch(Actions.openDialog({
      isOpen: true,
      type: 'confirm',
      title: 'アセットの削除',
      message: 'この肖像画データを削除しますか？プロジェクトからは削除されませんが、表示されなくなります。',
      onConfirm: async () => {
        await deletePortrait(assetId);
        setAssets(prev => prev.filter(a => a.id !== assetId));
        addLog('info', 'Artist', 'アセットを削除しました。');
      }
    }));
  };

  const foreshadowingTrace = useMemo(() => {
    const entries = new Map<string, ForeshadowingTraceEntry>();

    const ensureEntry = (id: string, fallbackTitle = '未登録の伏線'): ForeshadowingTraceEntry => {
      const existing = entries.get(id);
      if (existing) return existing;
      const foreshadowing = plot.foreshadowing.find((item) => item.id === id) ?? {
        id, title: fallbackTitle, description: '', status: 'Open', priority: 'Low'
      };
      const created = { foreshadowing, plant: [], progress: [], twist: [], redHerring: [], payoff: [] };
      entries.set(id, created);
      return created;
    };

    plot.foreshadowing.forEach((item) => {
      ensureEntry(item.id, item.title);
    });

    chapters.forEach((chapter, index) => {
      (chapter.foreshadowingLinks ?? []).forEach((link) => {
        const entry = ensureEntry(link.foreshadowingId);
        const action = link.action || 'Plant';
        const linkData = {
          chapterId: chapter.id,
          chapterIndex: index + 1,
          chapterTitle: chapter.title,
          note: link.note
        };
        
        if (action === 'Plant') entry.plant.push(linkData);
        else if (action === 'Progress') entry.progress.push(linkData);
        else if (action === 'Twist') entry.twist.push(linkData);
        else if (action === 'RedHerring') entry.redHerring.push(linkData);
        else if (action === 'Payoff') entry.payoff.push(linkData);
      });
    });

    return Array.from(entries.values());
  }, [plot.foreshadowing, chapters]);

  const unresolvedForeshadowing = useMemo(
    () => foreshadowingTrace.filter((entry) => entry.payoff.length === 0),
    [foreshadowingTrace]
  );

  const handleIntegrityScan = async () => {
    if (isScanning) return;
    setIsScanning(true);
    addLog('info', 'Architect', '物語設定の整合性をスキャン中...');
    try {
      const issues = await analyzeBibleIntegrity({ meta, bible, chapters, sync: { history: [] } } as any, (usage: any) => metaDispatch(Actions.trackUsage(usage)), addLog);
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
      const newSummary = await maintainSummaryBuffer({ bible } as any, (usage: any) => metaDispatch(Actions.trackUsage(usage)), addLog);
      bibleDispatch(Actions.updateBible({ summaryBuffer: newSummary, lastSummaryUpdate: Date.now() }));
      addLog('success', 'Architect', 'コンテキストが最新の状態に統合されました。');
    } catch (e: any) {
      addLog('error', 'Architect', '要約に失敗しました。');
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleConsultIssue = (issue: BibleIssue) => {
    const message = `不整合の可能性について相談があります：${issue.description}`;
    uiDispatch(Actions.setPendingMsg(message));
    uiDispatch(Actions.setView(ViewMode.PLOTTER));
  };

  const handleIssueFeedback = (issue: BibleIssue, feedback: 'Useful' | 'FalsePositive' | 'Disabled') => {
    if (feedback === 'Disabled') {
      const currentDisabled = preferences.disabledLinterRules || [];
      metaDispatch(Actions.updatePreferences({ 
        disabledLinterRules: Array.from(new Set([...currentDisabled, issue.ruleId])) 
      }));
      const nextIssues = knowledge.integrityIssues.filter(i => i.ruleId !== issue.ruleId);
      bibleDispatch(Actions.updateBible({ integrityIssues: nextIssues }));
      addLog('info', 'System', `判定ルール "${issue.ruleId}" を無効化しました。`);
    } else {
      const nextIssues = knowledge.integrityIssues.map(i => i.id === issue.id ? { ...i, feedback } : i);
      bibleDispatch(Actions.updateBible({ integrityIssues: nextIssues }));
      if (feedback === 'FalsePositive') addLog('info', 'System', '誤検知を記録しました。');
    }
  };

  const visibleLogs = useMemo(() => logs.slice(0, logLimit), [logs, logLimit]);

  const COLORS = ['#d68a6d', '#6366f1', '#10b981', '#f59e0b', '#ef4444'];
  const MODEL_COLORS: Record<string, string> = {
    'Gemini Pro': '#d68a6d',
    'Gemini Flash': '#10b981',
    'Image Gen': '#6366f1',
    'Voice (TTS)': '#f59e0b',
    'Unknown': '#57534e'
  };

  return (
    <div className="p-4 md:p-12 h-full overflow-y-auto custom-scrollbar bg-stone-900/20 pb-32 md:pb-12 pt-safe">
      <div className="max-w-[1400px] mx-auto space-y-6 md:space-y-10">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 animate-fade-in px-2">
            <div className="space-y-1 md:space-y-4">
              <div className="flex items-center gap-3"><div className="w-6 md:w-8 h-[1px] bg-orange-400/30"></div><span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.4em] text-orange-400">Story Vitality</span></div>
              <h2 className="text-3xl md:text-6xl font-display font-black text-white italic tracking-tighter">StoryStudio</h2>
            </div>
            <div className="flex gap-3 w-full md:w-auto">
              <button onClick={handleMaintainSummary} disabled={isSummarizing} className="flex-1 md:flex-none px-4 py-3 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl md:rounded-2xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 md:gap-3 transition-all active:scale-95 disabled:opacity-50">
                {isSummarizing ? <Loader2 size={14} className="animate-spin"/> : <BrainCircuit size={14} className="text-orange-400" />} 
                記憶整理
              </button>
              <button onClick={handleIntegrityScan} disabled={isScanning} className="flex-1 md:flex-none px-4 py-3 md:px-8 bg-orange-600 hover:bg-orange-500 text-white rounded-xl md:rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 md:gap-3 transition-all active:scale-95 disabled:opacity-50">
                {isScanning ? <Loader2 size={14} className="animate-spin"/> : <ShieldCheck size={14}/>} 
                整合性分析
              </button>
            </div>
        </header>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 px-1">
            <StatCard icon={<Activity size={20}/>} label="トークン累積" value={totalTokens.toLocaleString()} unit="T" color="text-emerald-400" />
            <StatCard icon={<Zap size={20}/>} label="聖書項目" value={(characters.length + foundation.laws.length + plot.timeline.length + knowledge.entries.length).toString()} unit="Item" color="text-orange-400" />
            <StatCard icon={<HardDrive size={20}/>} label="アセット容量" value={(totalAssetSize / 1024 / 1024).toFixed(1)} unit="MB" color="text-blue-400" />
            <StatCard icon={<Sparkles size={20}/>} label="執筆完了" value={chapters.filter(c => c.status === 'Polished').length.toString()} unit="C" color="text-purple-400" />
        </div>

        {/* トークン消費内訳セクション */}
        <div className="glass rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-10 space-y-8 mx-1">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <h3 className="text-xl md:text-2xl font-display font-black text-white italic tracking-tight flex items-center gap-3">
                <Database size={20} className="text-emerald-400" /> リソース消費分析
              </h3>
              <p className="text-[11px] text-stone-500 font-serif">どの機能やAIモデルがどれだけのコンテキストを消費しているか可視化します。</p>
            </div>
            
            <div className="flex flex-col md:flex-row items-center gap-6">
              {/* 切り替えトグル */}
              <div className="p-1.5 bg-stone-950/60 rounded-xl border border-white/5 flex gap-1">
                <button 
                  onClick={() => setUsageViewMode('source')}
                  className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${usageViewMode === 'source' ? 'bg-stone-800 text-white shadow-lg' : 'text-stone-500 hover:text-stone-300'}`}
                >
                  <Database size={12}/> 機能別
                </button>
                <button 
                  onClick={() => setUsageViewMode('model')}
                  className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${usageViewMode === 'model' ? 'bg-orange-600 text-white shadow-lg' : 'text-stone-500 hover:text-stone-300'}`}
                >
                  <Cpu size={12}/> モデル別
                </button>
              </div>

              <div className="flex gap-4">
                <div className="flex flex-col items-end">
                  <span className="text-[8px] font-black text-stone-600 uppercase tracking-widest flex items-center gap-1"><ArrowDownLeft size={10} className="text-emerald-500"/> Total Input</span>
                  <span className="text-lg font-mono font-black text-emerald-400">{totalInputTokens.toLocaleString()}</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[8px] font-black text-stone-600 uppercase tracking-widest flex items-center gap-1"><ArrowUpRight size={10} className="text-orange-400"/> Total Output</span>
                  <span className="text-lg font-mono font-black text-orange-400">{totalOutputTokens.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* 棒グラフ: 使用量 */}
            <div className="lg:col-span-8 h-[300px] min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activeUsageData} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" horizontal={true} vertical={false} />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="label" 
                    type="category" 
                    stroke="#57534e" 
                    fontSize={10} 
                    width={100} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <Tooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                    contentStyle={{ backgroundColor: '#1c1917', border: '1px solid #ffffff10', borderRadius: '12px' }}
                    itemStyle={{ fontSize: '11px' }}
                  />
                  <Bar dataKey="input" name="入力 (Context)" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} barSize={20} />
                  <Bar dataKey="output" name="出力 (Generation)" stackId="a" fill="#d68a6d" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 数値リスト: 詳細 */}
            <div className="lg:col-span-4 space-y-3 max-h-[300px] overflow-y-auto no-scrollbar pr-2">
              <div className="text-[9px] font-black text-stone-600 uppercase tracking-widest border-b border-white/5 pb-2">
                {usageViewMode === 'source' ? '機能別' : 'AIモデル別'}詳細内訳
              </div>
              {activeUsageData.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-stone-950/40 rounded-xl border border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: usageViewMode === 'model' ? (MODEL_COLORS[item.label] || COLORS[idx % COLORS.length]) : COLORS[idx % COLORS.length] }} />
                    <span className="text-[10px] font-black text-stone-300 uppercase truncate max-w-[120px]">{item.label}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-mono text-stone-100">{item.total.toLocaleString()}</span>
                    <span className="text-[7px] font-mono text-stone-600">IN: {item.input.toLocaleString()} / OUT: {item.output.toLocaleString()}</span>
                  </div>
                </div>
              ))}
              {activeUsageData.length === 0 && (
                <div className="h-full flex items-center justify-center text-stone-700 italic font-serif text-xs py-10">
                  使用データがまだありません。
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-1">
            <div className="lg:col-span-2 glass rounded-[2rem] p-6 md:p-10 space-y-6 h-[400px] flex flex-col">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-stone-600 uppercase tracking-widest flex items-center gap-2">
                  <BarChart3 size={16} className="text-orange-400" /> 執筆文字数推移
                </h3>
                <span className="text-[9px] font-mono text-stone-700">Total: {chapters.reduce((a,c) => a+(c.wordCount||0),0).toLocaleString()} chars</span>
              </div>
              <div className="flex-1 w-full min-h-0 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={progressData}>
                    <defs>
                      <linearGradient id="colorWords" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#d68a6d" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#d68a6d" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                    <XAxis dataKey="name" stroke="#57534e" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#57534e" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1c1917', border: '1px solid #ffffff10', borderRadius: '12px' }}
                      itemStyle={{ color: '#d68a6d', fontSize: '12px' }}
                    />
                    <Area type="monotone" dataKey="wordCount" stroke="#d68a6d" strokeWidth={2} fillOpacity={1} fill="url(#colorWords)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass rounded-[2rem] p-6 md:p-10 space-y-6 h-[400px] flex flex-col">
              <h3 className="text-sm font-black text-stone-600 uppercase tracking-widest flex items-center gap-2">
                <Activity size={16} className="text-indigo-400" /> 役割分布
              </h3>
              <div className="flex-1 w-full flex items-center justify-center min-h-0 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={roleDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {roleDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1c1917', border: '1px solid #ffffff10', borderRadius: '12px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {roleDistribution.map((r, i) => (
                  <div key={r.name} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-[9px] font-black text-stone-500 uppercase">{r.name}: {r.value}</span>
                  </div>
                ))}
              </div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
           <div className="lg:col-span-4 glass rounded-[1.5rem] md:rounded-[2.5rem] p-8 md:p-10 space-y-6 mx-1 border border-amber-500/10">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-display font-black text-white italic tracking-tight flex items-center gap-3">
                  <AlertTriangle size={20} className="text-amber-500" /> Safety Status
                </h3>
                {violationCount > 0 && (
                  <button onClick={() => metaDispatch({ type: 'RESET_VIOLATIONS' })} className="text-[9px] font-black text-stone-600 hover:text-white uppercase tracking-widest transition-colors">リセット</button>
                )}
              </div>
              <div className="flex items-center justify-center py-4">
                 <div className={`relative w-24 h-24 rounded-full border-4 flex items-center justify-center ${violationCount >= 4 ? 'border-rose-500 bg-rose-500/10' : violationCount > 0 ? 'border-amber-500 bg-amber-500/10' : 'border-emerald-500 bg-emerald-500/10'}`}>
                    <div className="text-center">
                       <div className="text-2xl font-black italic">{violationCount}</div>
                       <div className="text-[7px] font-black uppercase">Violations</div>
                    </div>
                 </div>
              </div>
              <p className="text-[11px] text-stone-500 font-serif leading-relaxed text-center italic">
                {violationCount >= 4 ? "連続的な警告により、AI機能が一部制限されています。" : violationCount > 0 ? "不適切な可能性のある表現が検知されました。婉曲的な表現を検討してください。" : "安全ポリシーを順守した健全な執筆環境です。"}
              </p>
           </div>
           
           <div className="lg:col-span-8 glass rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-10 space-y-4 mx-1 overflow-hidden h-auto lg:h-[300px] flex flex-col">
              <div className="text-[9px] font-black text-stone-600 uppercase tracking-widest">Policy Detection History</div>
              <div className="flex-1 overflow-y-auto no-scrollbar space-y-3">
                 {violationHistory && violationHistory.length > 0 ? violationHistory.map((v, i) => (
                    <div key={i} className="p-4 bg-stone-950/40 rounded-2xl border border-white/5 flex items-center justify-between gap-4">
                       <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                             <span className="text-[8px] font-black bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded uppercase">{translateSafetyCategory(v.category)}</span>
                             <span className="text-[8px] font-mono text-stone-700">{new Date(v.timestamp).toLocaleString()}</span>
                          </div>
                          <p className="text-[10px] text-stone-500 italic truncate">"{v.inputSnippet}..."</p>
                       </div>
                    </div>
                 )) : (
                    <div className="h-full flex items-center justify-center text-stone-700 italic font-serif text-xs">検知履歴はありません。</div>
                 )}
              </div>
           </div>
        </div>

        {knowledge.integrityIssues && knowledge.integrityIssues.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 px-2">
              <ShieldAlert size={20} className="text-rose-500"/>
              <h3 className="text-xl font-display font-black text-white italic tracking-tight uppercase">Integrity Alerts</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 animate-fade-in px-1">
              {knowledge.integrityIssues.filter(i => i.feedback !== 'FalsePositive').map(issue => (
                <div key={issue.id} className="p-6 md:p-8 glass rounded-[2rem] border border-rose-500/20 space-y-5 relative overflow-hidden group">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${issue.severity === 'High' ? 'bg-rose-500/20 text-rose-500' : 'bg-orange-500/20 text-orange-400'}`}>
                        {issue.severity} Severity
                      </span>
                      <span className="text-[8px] font-black text-stone-600 uppercase tracking-widest">{issue.ruleId}</span>
                    </div>
                  </div>
                  
                  <p className="text-[13px] md:text-[14px] font-serif-bold text-stone-200 leading-relaxed italic">"{issue.description}"</p>
                  
                  <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 space-y-1">
                     <div className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">解決への提案</div>
                     <p className="text-[11px] text-stone-400 font-serif leading-relaxed italic">{issue.suggestion}</p>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button onClick={() => handleConsultIssue(issue)} className="flex-1 py-3 bg-stone-800 hover:bg-stone-700 text-orange-400 rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-2 transition-all">
                      <MessageSquareShare size={14} /> 相談
                    </button>
                    <div className="flex gap-1.5">
                      <button onClick={() => handleIssueFeedback(issue, 'Useful')} className="p-3 bg-stone-800 hover:bg-emerald-600/20 text-stone-500 hover:text-emerald-400 rounded-xl transition-all"><ThumbsUp size={14}/></button>
                      <button onClick={() => handleIssueFeedback(issue, 'FalsePositive')} className="p-3 bg-stone-800 hover:bg-rose-600/20 text-stone-500 hover:text-rose-400 rounded-xl transition-all"><ThumbsDown size={14}/></button>
                      <button onClick={() => handleIssueFeedback(issue, 'Disabled')} className="p-3 bg-stone-800 hover:bg-stone-700 text-stone-600 hover:text-stone-200 rounded-xl transition-all"><ShieldOff size={14}/></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="glass rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-10 space-y-8 mx-1">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-xl md:text-2xl font-display font-black text-white italic tracking-tight flex items-center gap-3">
                <ImageIcon size={20} className="text-orange-400" /> Asset Library
              </h3>
              <p className="text-[11px] text-stone-500 font-serif">生成された画像アセットを一括管理・最適化します。</p>
            </div>
            <div className="text-[10px] font-mono text-stone-500 bg-stone-950/40 px-3 py-1.5 rounded-lg border border-white/5">
              {assets.length} items / {(totalAssetSize / 1024).toFixed(0)} KB
            </div>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
            {assets.length === 0 ? (
              <div className="col-span-full py-12 text-center text-stone-700 italic font-serif border border-dashed border-stone-800 rounded-2xl">
                アセットライブラリは空です。
              </div>
            ) : (
              assets.map(asset => (
                <AssetThumbnail key={asset.id} asset={asset} onDelete={() => handleDeleteAsset(asset.id)} />
              ))
            )}
          </div>
        </div>

        <div className="glass rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-10 space-y-6 md:space-y-8 mx-1">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <Flag size={18} className="text-orange-400" />
                <h3 className="text-xl md:text-2xl font-display font-black text-white italic tracking-tight">伏線トレーサビリティ</h3>
              </div>
              <p className="text-[11px] text-stone-500 font-serif">章ごとの提示 (Plant)、展開 (Progress)、回収 (Payoff) を可視化します。</p>
            </div>
            <div className="flex gap-2">
              <TraceStat label="総数" value={foreshadowingTrace.length.toString()} color="text-orange-400" />
              <TraceStat label="未回収" value={unresolvedForeshadowing.length.toString()} color="text-rose-400" />
            </div>
          </div>
          {foreshadowingTrace.length === 0 ? (
            <div className="p-10 text-center text-stone-700 italic font-serif text-xs border border-dashed border-stone-800 rounded-3xl">伏線データがありません。</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-4">
              {foreshadowingTrace.map((entry) => (
                <ForeshadowingTraceCard key={entry.foreshadowing.id} entry={entry} />
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-10 px-1">
            <div className="lg:col-span-8 glass rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-12 flex flex-col h-[450px] md:h-[600px] shadow-2xl relative">
                <div className="flex justify-between items-center mb-6 shrink-0">
                  <h3 className="text-lg md:text-2xl font-display font-black text-white italic tracking-tight flex items-center gap-3">
                    <Terminal size={18} className="text-orange-400" />アトリエ日誌
                  </h3>
                  <button onClick={() => notifDispatch(Actions.clearLogs())} className="p-3 hover:bg-stone-800 rounded-xl text-stone-700 hover:text-rose-400 transition-colors"><Trash2 size={18} /></button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-4 no-scrollbar pb-10">
                    {visibleLogs.map(log => <LogItem key={log.id} log={log} />)}
                    {logs.length > logLimit && (
                      <button onClick={() => setLogLimit(l => l + 30)} className="w-full py-4 text-[10px] font-black uppercase tracking-widest text-stone-600 hover:text-orange-400 transition-colors">
                        過去のログを表示
                      </button>
                    )}
                    {logs.length === 0 && <div className="h-full flex items-center justify-center text-stone-700 italic font-serif text-xs">日誌は空です。</div>}
                </div>
            </div>

            <div className="lg:col-span-4 glass rounded-[1.5rem] md:rounded-[2.5rem] p-8 md:p-10 flex flex-col justify-between h-auto md:h-full min-h-[250px] relative overflow-hidden shadow-2xl">
                <BrainCircuit size={100} className="absolute -bottom-4 -right-4 text-white/[0.02] rotate-12" />
                <div className="space-y-4 md:space-y-6">
                  <span className="text-[9px] md:text-[10px] font-black text-stone-600 uppercase tracking-widest">現在の要約バッファ</span>
                  <p className="text-[11px] md:text-xs text-stone-400 font-serif leading-relaxed italic line-clamp-[6] md:line-clamp-[15]">
                    {foundation.summaryBuffer || "記憶を整理してAIの推論を効率化してください。"}
                  </p>
                </div>
                <div className="mt-6 pt-6 border-t border-white/5 shrink-0">
                   <span className="text-[8px] font-black text-stone-700 uppercase">最終同期</span>
                   <p className="text-[10px] text-stone-500">{bible.lastSummaryUpdate ? new Date(bible.lastSummaryUpdate).toLocaleString() : '---'}</p>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

const AssetThumbnail: React.FC<{ asset: AssetMetadata; onDelete: () => void | Promise<void> }> = ({ asset, onDelete }) => {
  const [data, setData] = useState<string | null>(null);

  useEffect(() => {
    getPortrait(asset.id).then(setData);
  }, [asset.id]);

  return (
    <div className="relative group aspect-square rounded-xl overflow-hidden bg-stone-900 border border-white/5 shadow-lg">
      {data ? (
        <img src={data} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-stone-800">
          <Loader2 size={16} className="animate-spin" />
        </div>
      )}
      <div className="absolute inset-0 bg-stone-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
        <button onClick={onDelete} className="p-2 bg-rose-600 text-white rounded-full hover:bg-rose-500 transition-colors shadow-xl">
          <Trash2 size={14} />
        </button>
        <span className="text-[8px] font-mono text-white/70">{(asset.size / 1024).toFixed(0)}KB</span>
      </div>
    </div>
  );
};

interface LogItemProps {
  log: SystemLog;
}

interface ChapterForeshadowLink {
  chapterId: string;
  chapterIndex: number;
  chapterTitle: string;
  note: string;
}

interface ForeshadowingTraceEntry {
  foreshadowing: Foreshadowing;
  plant: ChapterForeshadowLink[];
  progress: ChapterForeshadowLink[];
  twist: ChapterForeshadowLink[];
  redHerring: ChapterForeshadowLink[];
  payoff: ChapterForeshadowLink[];
}

const LogItem = React.memo(({ log }: LogItemProps) => (
  <div className={`flex flex-col p-4 md:p-6 glass-bright rounded-2xl border-l-4 animate-fade-in ${log.type === 'error' ? 'border-l-rose-500' : log.type === 'success' ? 'border-l-emerald-500' : 'border-l-orange-400/50'}`}>
      <div className="flex gap-3 md:gap-4 items-start">
         <div className="px-2 py-0.5 rounded-[4px] text-[7px] md:text-[8px] font-black uppercase bg-stone-800 text-stone-500 shrink-0">{log.source}</div>
         <p className="text-[11px] md:text-sm font-serif text-stone-200 leading-relaxed">{log.message}</p>
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
  <div className="glass rounded-[1.25rem] md:rounded-[2rem] p-5 md:p-8 flex flex-col justify-between h-28 md:h-40 relative overflow-hidden group">
    <div className="absolute top-4 right-4 md:top-8 md:right-8 text-white/5 group-hover:text-white/10 transition-colors">{icon}</div>
    <span className="text-[7px] md:text-[9px] font-black text-stone-600 uppercase tracking-widest truncate">{label}</span>
    <div className="flex items-baseline gap-1">
        <span className={`text-xl md:text-4xl font-display font-black italic ${color}`}>{value}</span>
        <span className="text-[6px] md:text-[8px] font-black text-stone-700 uppercase font-mono">{unit}</span>
    </div>
  </div>
));

const TraceStat = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <div className="px-3 py-2 bg-stone-900/60 border border-white/5 rounded-xl flex-1 text-center md:text-left">
    <div className="text-[7px] font-black uppercase tracking-widest text-stone-600">{label}</div>
    <div className={`text-lg font-display font-black italic ${color}`}>{value}</div>
  </div>
);

const TraceSection = ({ label, icon, links, color }: { label: string; icon: React.ReactNode; links: ChapterForeshadowLink[], color?: string }) => (
  <div className="space-y-1.5 min-w-0">
    <div className={`flex items-center gap-2 text-[8px] font-black uppercase tracking-widest ${color || 'text-stone-500'}`}>
      {icon}
      {label}
    </div>
    {links.length === 0 ? (
      <div className="text-[9px] text-stone-700 italic font-serif py-1.5">---</div>
    ) : (
      <div className="flex flex-wrap gap-1.5">
        {links.map((link, index) => (
          <div key={`${link.chapterId}-${index}`} className="px-2 py-1.5 bg-stone-900/80 border border-white/5 rounded-lg flex items-center gap-2 group max-w-full">
            <div className="text-[8px] font-black text-stone-400 uppercase shrink-0">第{link.chapterIndex}章</div>
            {link.note && <div className="hidden group-hover:block absolute bg-stone-950 p-3 rounded-xl border border-white/10 text-[9px] z-50 mt-8 w-48 shadow-xl font-serif">{link.note}</div>}
          </div>
        ))}
      </div>
    )}
  </div>
);

const ForeshadowingTraceCard = React.memo(({ entry }: { entry: ForeshadowingTraceEntry }) => {
  const unresolved = entry.payoff.length === 0;
  return (
    <div className={`glass-bright p-5 md:p-7 rounded-[1.5rem] md:rounded-[2rem] border transition-all space-y-5 ${unresolved ? 'border-rose-500/20' : 'border-white/5'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5 min-w-0">
          <div className="text-[7px] font-black uppercase tracking-widest text-stone-600">{entry.foreshadowing.id.slice(0, 8)}</div>
          <div className="text-sm md:text-lg font-serif-bold text-stone-100 truncate">{entry.foreshadowing.title}</div>
        </div>
        <div className={`shrink-0 px-2 py-0.5 rounded-[4px] text-[7px] font-black uppercase ${unresolved ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
          {unresolved ? '未回収' : '完了'}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
        <TraceSection label="提示" icon={<Flag size={10} />} links={entry.plant} color="text-orange-500/70" />
        <TraceSection label="展開" icon={<TrendingUp size={10} />} links={entry.progress} color="text-blue-500/70" />
        <TraceSection label="転換" icon={<Shuffle size={10} />} links={entry.twist} color="text-purple-500/70" />
        <TraceSection label="偽装" icon={<EyeOff size={10} />} links={entry.redHerring} color="text-pink-500/70" />
        <TraceSection label="回収" icon={<CheckCircle2 size={10} />} links={entry.payoff} color="text-emerald-500/70" />
      </div>
    </div>
  );
});

export default React.memo(DashboardView);
