
import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import WelcomeScreen from './components/WelcomeScreen';
import PublicationModal from './components/PublicationModal';
import ComplianceModal from './components/ComplianceModal';
import GlobalDialog from './components/GlobalDialog';
import { ViewMode, StoryProject, SystemLog, AppNotification, DialogState, WorldBible, TokenUsageEntry } from './types';
import { 
  LayoutDashboard, PenTool, GitBranch, Share2, Home, AlertCircle, X, 
  CloudCheck, CheckCircle2, HelpCircle, Loader2
} from 'lucide-react';
import { getPortrait } from './services/storageService';

const PlotterView = lazy(() => import('./components/PlotterView'));
const WriterView = lazy(() => import('./components/WriterView'));
const DashboardView = lazy(() => import('./components/DashboardView'));

export const normalizeProject = (data: any): StoryProject => {
  const defaultBible: WorldBible = {
    version: 1,
    setting: '',
    laws: '',
    grandArc: '', 
    themes: [],
    tone: 'ニュートラル',
    characters: [],
    timeline: [],
    foreshadowing: [],
    entries: [],
    nexusBranches: [],
    integrityIssues: []
  };

  const now = Date.now();
  const incomingBible = data.bible || {};
  const normalizedBible = {
    ...defaultBible,
    ...incomingBible,
    setting: incomingBible.setting || data.setting || '',
    laws: incomingBible.laws || data.laws || '',
    grandArc: incomingBible.grandArc || data.grandArc || '',
    tone: incomingBible.tone || data.tone || 'ニュートラル',
  };

  const project: StoryProject = {
    id: data.id || crypto.randomUUID(),
    title: data.title || '無題の物語',
    author: data.author || '作者不明',
    genre: data.genre || '一般',
    createdAt: data.createdAt || now,
    updatedAt: data.updatedAt || now,
    language: data.language || 'ja',
    bible: normalizedBible,
    chapters: Array.isArray(data.chapters) ? data.chapters : [],
    tokenUsage: Array.isArray(data.tokenUsage) ? data.tokenUsage : [],
    chatHistory: Array.isArray(data.chatHistory) ? data.chatHistory : [],
    pendingChanges: Array.isArray(data.pendingChanges) ? data.pendingChanges : [],
    history: Array.isArray(data.history) ? data.history : []
  };

  if (project.chapters.length === 0) {
    project.chapters.push({
      id: crypto.randomUUID(), title: '序章', summary: '', content: '', strategy: { milestones: [], forbiddenResolutions: [], characterArcProgress: '', pacing: '' }, beats: [], status: 'Idea', wordCount: 0, stateDeltas: []
    });
  }

  return project;
};

const App: React.FC = () => {
  const [project, setProject] = useState<StoryProject | null>(null);
  const [view, setView] = useState<ViewMode>(ViewMode.WELCOME);
  const [plotterTab, setPlotterTab] = useState<string>('grandArc'); 
  const [showPubModal, setShowPubModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showCompliance, setShowCompliance] = useState(false);
  const [hasAgreedToTerms, setHasAgreedToTerms] = useState(false);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [dialog, setDialog] = useState<DialogState>({ isOpen: false, type: 'alert', title: '', message: '' });
  
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const agreed = localStorage.getItem('duoscript_agreed');
    if (agreed === 'true') setHasAgreedToTerms(true);

    const saved = localStorage.getItem('duoscript_project');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed) {
          const norm = normalizeProject(parsed);
          setProject(norm);
          setView(ViewMode.DASHBOARD);
          
          Promise.all(norm.bible.characters.map(async (char) => {
            const img = await getPortrait(char.id);
            return img ? { id: char.id, img } : null;
          })).then(results => {
            const found = results.filter((r): r is {id: string, img: string} => r !== null);
            if (found.length > 0) {
              setProject(prev => prev ? {
                ...prev,
                bible: {
                  ...prev.bible,
                  characters: prev.bible.characters.map(c => {
                    const match = found.find(f => f.id === c.id);
                    return match ? { ...c, imageUrl: match.img } : c;
                  })
                }
              } : null);
            }
          });
        }
      } catch (e) { console.error("Restore failed:", e); }
    }
  }, []);

  useEffect(() => {
    if (project) {
      setSaveStatus('saving');
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(() => {
        try {
          const stripped = { ...project, updatedAt: Date.now(), bible: { ...project.bible, characters: project.bible.characters.map(({ imageUrl, ...rest }) => rest) } };
          localStorage.setItem('duoscript_project', JSON.stringify(stripped));
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus('idle'), 3000);
        } catch (e) { setSaveStatus('idle'); }
      }, 2000);
    }
  }, [project]);

  const addLog = (type: SystemLog['type'], source: SystemLog['source'], message: string, details?: string) => {
    const newLog: SystemLog = { id: crypto.randomUUID(), timestamp: Date.now(), type, source, message, details };
    setLogs(prev => [newLog, ...prev].slice(0, 100));
    if (type === 'error' || type === 'success') {
      const notification: AppNotification = { id: crypto.randomUUID(), type, message };
      setNotifications(prev => [...prev, notification]);
      setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== notification.id)), 5000);
    }
  };

  const handleTokenUsage = (usage: any) => {
    setProject(prev => prev ? ({ ...prev, tokenUsage: [{ id: crypto.randomUUID(), timestamp: Date.now(), model: usage.model || 'Unknown', source: usage.source || 'Unknown', input: usage.input || 0, output: usage.output || 0 }, ...(prev.tokenUsage || [])].slice(0, 500) }) : null);
  };

  const handleGoHome = () => {
    setDialog({ isOpen: true, type: 'confirm', title: "ホームに戻る", message: "作品を保存してホームへ戻りますか？", onConfirm: () => { setView(ViewMode.WELCOME); setProject(null); setDialog(d => ({ ...d, isOpen: false })); } });
  };

  if (!project || view === ViewMode.WELCOME) {
    return (
      <>
        <WelcomeScreen onStart={(p) => { 
          if (!hasAgreedToTerms) { setShowCompliance(true); return; }
          setProject(normalizeProject(p)); setView(ViewMode.DASHBOARD); 
        }} onOpenHelp={() => setShowHelpModal(true)} showAlert={(t, m) => setDialog({ isOpen: true, type: 'alert', title: t, message: m })} showConfirm={(t, m, c) => setDialog({ isOpen: true, type: 'confirm', title: t, message: m, onConfirm: () => { setDialog(d => ({ ...d, isOpen: false })); c(); } })} />
        {showCompliance && <ComplianceModal onAccept={() => { localStorage.setItem('duoscript_agreed', 'true'); setHasAgreedToTerms(true); setShowCompliance(false); }} />}
        <GlobalDialog dialog={dialog} setDialog={setDialog} />
      </>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-screen bg-stone-900 text-stone-200 overflow-hidden font-sans select-none">
      <div className="fixed top-6 right-6 z-[200] flex flex-col gap-3 pointer-events-none w-full max-w-xs ml-auto p-4 md:p-0">
        {notifications.map(n => (
          <div key={n.id} className={`pointer-events-auto flex items-center gap-4 px-6 py-5 rounded-2xl shadow-2xl backdrop-blur-2xl border animate-fade-in ${n.type === 'error' ? 'bg-rose-950/90 border-rose-500/40 text-rose-200' : 'bg-orange-950/90 border-orange-500/40 text-orange-200'}`}>
            {n.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
            <p className="text-[10px] font-bold flex-1">{n.message}</p>
            <button onClick={() => setNotifications(prev => prev.filter(x => x.id !== n.id))}><X size={16} /></button>
          </div>
        ))}
      </div>

      <aside className="hidden md:flex w-24 bg-stone-900/95 border-r border-stone-800 flex-col items-center py-10 gap-10 z-[60] shadow-2xl">
        <div className="w-14 h-14 bg-orange-500 rounded-[2rem] flex items-center justify-center cursor-pointer shadow-xl shadow-orange-500/20 hover:scale-110 transition-transform" onClick={() => setView(ViewMode.DASHBOARD)}>
          <span className="font-display font-black text-stone-950 text-3xl italic">D</span>
        </div>
        <nav className="flex flex-col gap-8 w-full px-6">
          <NavBtn icon={<LayoutDashboard size={24}/>} active={view === ViewMode.DASHBOARD} onClick={() => setView(ViewMode.DASHBOARD)} />
          <NavBtn icon={<GitBranch size={24}/>} active={view === ViewMode.PLOTTER} onClick={() => { setPlotterTab('grandArc'); setView(ViewMode.PLOTTER); }} />
          <NavBtn icon={<PenTool size={24}/>} active={view === ViewMode.WRITER} onClick={() => setView(ViewMode.WRITER)} />
        </nav>
        <div className="mt-auto flex flex-col gap-6 w-full px-6 items-center">
          {saveStatus !== 'idle' && <CloudCheck className={saveStatus === 'saved' ? 'text-orange-400' : 'text-stone-500 animate-pulse'} size={24} />}
          <ActionBtn icon={<HelpCircle size={22}/>} onClick={() => setShowHelpModal(true)} />
          <ActionBtn icon={<Share2 size={22}/>} onClick={() => setShowPubModal(true)} />
          <ActionBtn icon={<Home size={22}/>} onClick={handleGoHome} />
        </div>
      </aside>

      <nav className="md:hidden fixed bottom-0 inset-x-0 h-20 bg-stone-900/95 backdrop-blur-3xl border-t border-white/5 flex items-center justify-around px-2 z-[100] pb-safe shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
        <MobileNavBtn icon={<LayoutDashboard size={20}/>} label="概況" active={view === ViewMode.DASHBOARD} onClick={() => setView(ViewMode.DASHBOARD)} />
        <MobileNavBtn icon={<GitBranch size={20}/>} label="構想" active={view === ViewMode.PLOTTER} onClick={() => { setPlotterTab('grandArc'); setView(ViewMode.PLOTTER); }} />
        <MobileNavBtn icon={<PenTool size={20}/>} label="執筆" active={view === ViewMode.WRITER} onClick={() => setView(ViewMode.WRITER)} />
        <MobileNavBtn icon={<Share2 size={20}/>} label="出力" onClick={() => setShowPubModal(true)} />
        <MobileNavBtn icon={<Home size={20}/>} label="ホーム" onClick={handleGoHome} />
      </nav>

      <main className="flex-1 overflow-hidden relative bg-stone-900/40 pb-20 md:pb-0">
        <Suspense fallback={<div className="h-full w-full flex items-center justify-center"><Loader2 size={40} className="animate-spin text-orange-400"/></div>}>
          {view === ViewMode.DASHBOARD && <DashboardView project={project} setProject={setProject} logs={logs} onClearLogs={() => setLogs([])} onNavigateToPlotter={(t) => { setPlotterTab(t); setView(ViewMode.PLOTTER); }} onTokenUsage={handleTokenUsage} onGoHome={handleGoHome} onOpenPublication={() => setShowPubModal(true)} addLog={addLog} />}
          {view === ViewMode.PLOTTER && <PlotterView project={project} setProject={setProject} addLog={addLog} onTokenUsage={handleTokenUsage} initialTab={plotterTab} showConfirm={(t, m, c) => setDialog({ isOpen: true, type: 'confirm', title: t, message: m, onConfirm: () => { setDialog(d => ({ ...d, isOpen: false })); c(); } })} />}
          {view === ViewMode.WRITER && <WriterView project={project} setProject={setProject} addLog={addLog} onTokenUsage={handleTokenUsage} showConfirm={(t, m, c) => setDialog({ isOpen: true, type: 'confirm', title: t, message: m, onConfirm: () => { setDialog(d => ({ ...d, isOpen: false })); c(); } })} />}
        </Suspense>
      </main>

      {showPubModal && <PublicationModal project={project} onClose={() => setShowPubModal(false)} />}
      <GlobalDialog dialog={dialog} setDialog={setDialog} />
    </div>
  );
};

const NavBtn = ({ icon, active, onClick }: any) => (
  <button onClick={onClick} className={`w-full aspect-square rounded-[1.25rem] flex items-center justify-center transition-all ${active ? 'bg-orange-500 text-stone-950 shadow-lg shadow-orange-500/20' : 'text-stone-600 hover:text-stone-300 hover:bg-stone-800'}`}>{icon}</button>
);
const ActionBtn = ({ icon, onClick }: any) => (
  <button onClick={onClick} className="w-full aspect-square rounded-xl flex items-center justify-center text-stone-600 hover:text-stone-100 transition-colors">{icon}</button>
);
const MobileNavBtn = ({ icon, label, active, onClick }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1.5 px-3 py-1 rounded-xl transition-all ${active ? 'text-orange-400 scale-105' : 'text-stone-600'}`}>
    {icon}
    <span className="text-[8px] font-black uppercase tracking-widest">{label}</span>
  </button>
);

export default App;
