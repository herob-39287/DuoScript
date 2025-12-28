
import React, { createContext, useContext, useReducer, useEffect, useRef, Suspense, lazy, useMemo, useCallback, useState } from 'react';
import WelcomeScreen from './components/WelcomeScreen';
import PublicationModal from './components/PublicationModal';
import ComplianceModal from './components/ComplianceModal';
import GlobalDialog from './components/GlobalDialog';
import { 
  ViewMode, StoryProject, SystemLog, AppNotification, DialogState, 
  ProjectAction, NotificationAction, WorldBible
} from './types';
import { 
  LayoutDashboard, PenTool, GitBranch, Share2, Home, AlertCircle, X, 
  CloudCheck, CheckCircle2, HelpCircle, Loader2, Info 
} from 'lucide-react';
import { applySyncOperation, normalizeProject } from './services/bibleManager';
import { getPortrait } from './services/storageService';

// --- Reducers ---

const projectReducer = (state: StoryProject | null, action: ProjectAction): StoryProject | null => {
  if (action.type === 'LOAD_PROJECT') return action.payload;
  if (action.type === 'CLEAR_DATA') return null;
  if (!state) return null;

  switch (action.type) {
    case 'UPDATE_PROJECT_META':
      return { ...state, ...action.payload, updatedAt: Date.now() };
    case 'UPDATE_BIBLE':
      return { ...state, bible: { ...state.bible, ...action.payload }, updatedAt: Date.now() };
    case 'COMMIT_SYNC_OP':
      return applySyncOperation(state, action.payload);
    case 'REJECT_SYNC_OP':
      return { ...state, pendingChanges: state.pendingChanges.filter(op => op.id !== action.payload) };
    case 'ADD_PENDING_OPS':
      const newOps = action.payload.filter(nop => !state.pendingChanges.some(sop => sop.id === nop.id));
      return { ...state, pendingChanges: [...state.pendingChanges, ...newOps] };
    case 'UPDATE_CHAPTER':
      return {
        ...state,
        chapters: state.chapters.map(c => 
          c.id === action.id 
            ? { ...c, ...action.updates, wordCount: action.updates.content !== undefined ? action.updates.content.length : c.wordCount } 
            : c
        ),
        updatedAt: Date.now()
      };
    case 'ADD_CHAPTER':
      return { ...state, chapters: [...state.chapters, action.payload], updatedAt: Date.now() };
    case 'SET_CHAT_HISTORY':
      return { ...state, chatHistory: action.payload };
    case 'TRACK_USAGE':
      const entry = { id: crypto.randomUUID(), timestamp: Date.now(), ...action.payload };
      return { ...state, tokenUsage: [entry, ...(state.tokenUsage || [])].slice(0, 500) };
    default:
      return state;
  }
};

const notificationReducer = (state: { logs: SystemLog[], notifications: AppNotification[] }, action: NotificationAction) => {
  switch (action.type) {
    case 'ADD_LOG':
      const newLog = action.payload;
      const updatedLogs = [newLog, ...state.logs].slice(0, 100);
      let newNotifs = [...state.notifications];
      if (newLog.type === 'error' || newLog.type === 'success') {
        newNotifs.push({ id: newLog.id, type: newLog.type, message: newLog.message });
      }
      return { logs: updatedLogs, notifications: newNotifs };
    case 'CLEAR_LOGS':
      return { ...state, logs: [] };
    case 'DISMISS_NOTIFICATION':
      return { ...state, notifications: state.notifications.filter(n => n.id !== action.id) };
    default:
      return state;
  }
};

// --- Contexts ---

interface ProjectContextType {
  project: StoryProject | null;
  dispatch: React.Dispatch<ProjectAction>;
  view: ViewMode;
  setView: (v: ViewMode) => void;
  plotterTab: string;
  setPlotterTab: (t: string) => void;
  pendingMsg: string | null;
  setPendingMsg: (m: string | null) => void;
  saveStatus: 'idle' | 'saving' | 'saved';
}

interface NotificationContextType {
  logs: SystemLog[];
  notifications: AppNotification[];
  addLog: (type: SystemLog['type'], source: SystemLog['source'], message: string, details?: string) => void;
  dispatch: React.Dispatch<NotificationAction>;
}

export const ProjectContext = createContext<ProjectContextType | undefined>(undefined);
export const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) throw new Error("useProject must be used within ProjectProvider");
  return context;
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotifications must be used within NotificationProvider");
  return context;
};

// --- Views ---

const PlotterView = lazy(() => import('./components/PlotterView'));
const WriterView = lazy(() => import('./components/WriterView'));
const DashboardView = lazy(() => import('./components/DashboardView'));

const App: React.FC = () => {
  const [project, projectDispatch] = useReducer(projectReducer, null);
  const [notifState, notifDispatch] = useReducer(notificationReducer, { logs: [], notifications: [] });
  
  const [view, setView] = React.useState<ViewMode>(ViewMode.WELCOME);
  const [plotterTab, setPlotterTab] = React.useState('grandArc');
  const [pendingMsg, setPendingMsg] = React.useState<string | null>(null);
  const [saveStatus, setSaveStatus] = React.useState<'idle' | 'saving' | 'saved'>('idle');
  const [dialog, setDialog] = React.useState<DialogState>({ isOpen: false, type: 'alert', title: '', message: '' });
  const [showPubModal, setShowPubModal] = React.useState(false);
  const [showHelpModal, setShowHelpModal] = React.useState(false);
  const [hasAgreed, setHasAgreed] = React.useState(localStorage.getItem('duoscript_agreed') === 'true');

  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('duoscript_project');
    if (saved) {
      try {
        const norm = normalizeProject(JSON.parse(saved));
        projectDispatch({ type: 'LOAD_PROJECT', payload: norm });
        
        // Restore portraits from IndexedDB
        Promise.all(norm.bible.characters.map(async (char) => {
          const img = await getPortrait(char.id);
          if (img) return { id: char.id, img };
          return null;
        })).then(results => {
          const found = results.filter(r => r !== null) as {id: string, img: string}[];
          if (found.length > 0) {
            projectDispatch({ 
              type: 'UPDATE_BIBLE', 
              payload: { 
                characters: norm.bible.characters.map(c => {
                  const match = found.find(f => f.id === c.id);
                  return match ? { ...c, imageUrl: match.img } : c;
                }) 
              } 
            });
          }
        });

        setView(ViewMode.DASHBOARD);
      } catch (e) {
        console.error("Restore failed", e);
      }
    }
  }, []);

  useEffect(() => {
    if (project) {
      setSaveStatus('saving');
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(() => {
        // Strip images before saving to localStorage to avoid QuotaExceededError
        const stripped = { 
          ...project, 
          bible: { 
            ...project.bible, 
            characters: project.bible.characters.map(({ imageUrl, ...rest }: any) => rest) 
          } 
        };
        localStorage.setItem('duoscript_project', JSON.stringify(stripped));
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      }, 2000);
    }
  }, [project]);

  const addLog = useCallback((type: SystemLog['type'], source: SystemLog['source'], message: string, details?: string) => {
    notifDispatch({ 
      type: 'ADD_LOG', 
      payload: { id: crypto.randomUUID(), timestamp: Date.now(), type, source, message, details } 
    });
  }, []);

  const projectContextValue = useMemo(() => ({
    project, dispatch: projectDispatch, view, setView, plotterTab, setPlotterTab, pendingMsg, setPendingMsg, saveStatus
  }), [project, view, plotterTab, pendingMsg, saveStatus]);

  const notifContextValue = useMemo(() => ({
    logs: notifState.logs, notifications: notifState.notifications, addLog, dispatch: notifDispatch
  }), [notifState.logs, notifState.notifications, addLog]);

  if (!hasAgreed) {
    return <ComplianceModal onAccept={() => { localStorage.setItem('duoscript_agreed', 'true'); setHasAgreed(true); }} />;
  }

  if (!project || view === ViewMode.WELCOME) {
    return (
      <ProjectContext.Provider value={projectContextValue}>
        <NotificationContext.Provider value={notifContextValue}>
          <WelcomeScreen 
            onStart={(p) => { 
              projectDispatch({ type: 'LOAD_PROJECT', payload: normalizeProject(p) }); 
              setView(ViewMode.DASHBOARD); 
            }} 
            onOpenHelp={() => setShowHelpModal(true)} 
            showAlert={(t, m) => setDialog({ isOpen: true, type: 'alert', title: t, message: m })} 
            showConfirm={(t, m, c) => setDialog({ isOpen: true, type: 'confirm', title: t, message: m, onConfirm: () => { setDialog(d => ({ ...d, isOpen: false })); c(); } })} 
          />
          <GlobalDialog dialog={dialog} setDialog={setDialog} />
        </NotificationContext.Provider>
      </ProjectContext.Provider>
    );
  }

  return (
    <ProjectContext.Provider value={projectContextValue}>
      <NotificationContext.Provider value={notifContextValue}>
        <div className="flex flex-col md:flex-row h-screen bg-stone-900 text-stone-200 overflow-hidden font-sans select-none">
          {/* Notifications Overlay */}
          <div className="fixed top-6 right-6 z-[200] flex flex-col gap-3 pointer-events-none w-full max-w-xs">
            {notifState.notifications.map(n => (
              <div key={n.id} className={`pointer-events-auto flex items-center gap-4 px-6 py-5 rounded-2xl shadow-2xl backdrop-blur-2xl border animate-fade-in ${n.type === 'error' ? 'bg-rose-950/90 border-rose-500/40 text-rose-200' : 'bg-orange-950/90 border-orange-500/40 text-orange-200'}`}>
                {n.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
                <p className="text-[10px] font-bold flex-1">{n.message}</p>
                <button onClick={() => notifDispatch({ type: 'DISMISS_NOTIFICATION', id: n.id })}><X size={16} /></button>
              </div>
            ))}
          </div>

          {/* Sidebar */}
          <aside className="hidden md:flex w-24 bg-stone-900/95 border-r border-stone-800 flex-col items-center py-10 gap-10 z-[60]">
            <div className="w-14 h-14 bg-orange-500 rounded-[1.25rem] flex items-center justify-center cursor-pointer shadow-xl hover:scale-105 transition-transform" onClick={() => setView(ViewMode.DASHBOARD)}>
              <span className="font-display font-black text-stone-950 text-3xl italic">D</span>
            </div>
            <nav className="flex flex-col gap-8 w-full px-6">
              <NavBtn icon={<LayoutDashboard size={24}/>} active={view === ViewMode.DASHBOARD} onClick={() => setView(ViewMode.DASHBOARD)} />
              <NavBtn icon={<GitBranch size={24}/>} active={view === ViewMode.PLOTTER} onClick={() => setView(ViewMode.PLOTTER)} />
              <NavBtn icon={<PenTool size={24}/>} active={view === ViewMode.WRITER} onClick={() => setView(ViewMode.WRITER)} />
            </nav>
            <div className="mt-auto flex flex-col gap-6 items-center">
              {saveStatus !== 'idle' && <CloudCheck className={saveStatus === 'saved' ? 'text-orange-400' : 'text-stone-500 animate-pulse'} size={24} />}
              <ActionBtn icon={<HelpCircle size={22}/>} onClick={() => setShowHelpModal(true)} />
              <ActionBtn icon={<Share2 size={22}/>} onClick={() => setShowPubModal(true)} />
              <ActionBtn icon={<Home size={22}/>} onClick={() => {
                setDialog({
                  isOpen: true,
                  type: 'confirm',
                  title: 'ホームに戻る',
                  message: '現在の物語を保存してホームへ戻りますか？',
                  onConfirm: () => {
                    setView(ViewMode.WELCOME);
                    projectDispatch({ type: 'CLEAR_DATA' });
                  }
                });
              }} />
            </div>
          </aside>

          {/* Mobile Nav */}
          <nav className="md:hidden fixed bottom-0 inset-x-0 h-20 bg-stone-900/95 backdrop-blur-3xl border-t border-white/5 flex items-center justify-around px-2 z-[100] pb-safe shadow-2xl">
            <NavBtn icon={<LayoutDashboard size={20}/>} active={view === ViewMode.DASHBOARD} onClick={() => setView(ViewMode.DASHBOARD)} />
            <NavBtn icon={<GitBranch size={20}/>} active={view === ViewMode.PLOTTER} onClick={() => setView(ViewMode.PLOTTER)} />
            <NavBtn icon={<PenTool size={20}/>} active={view === ViewMode.WRITER} onClick={() => setView(ViewMode.WRITER)} />
            <NavBtn icon={<Share2 size={20}/>} onClick={() => setShowPubModal(true)} />
          </nav>

          <main className="flex-1 overflow-hidden relative bg-stone-900/40">
            <Suspense fallback={<div className="h-full w-full flex items-center justify-center"><Loader2 size={40} className="animate-spin text-orange-400"/></div>}>
              {view === ViewMode.DASHBOARD && <DashboardView onOpenPublication={() => setShowPubModal(true)} />}
              {view === ViewMode.PLOTTER && <PlotterView />}
              {view === ViewMode.WRITER && <WriterView />}
            </Suspense>
          </main>

          {showPubModal && <PublicationModal project={project} onClose={() => setShowPubModal(false)} />}
          <GlobalDialog dialog={dialog} setDialog={setDialog} />
        </div>
      </NotificationContext.Provider>
    </ProjectContext.Provider>
  );
};

const NavBtn = ({ icon, active, onClick }: any) => (
  <button onClick={onClick} className={`w-12 h-12 md:w-full md:aspect-square rounded-[1.25rem] flex items-center justify-center transition-all ${active ? 'bg-orange-500 text-stone-950 shadow-lg shadow-orange-500/20' : 'text-stone-600 hover:text-stone-300 hover:bg-stone-800'}`}>{icon}</button>
);
const ActionBtn = ({ icon, onClick }: any) => (
  <button onClick={onClick} className="w-12 h-12 flex items-center justify-center text-stone-600 hover:text-stone-100 hover:bg-stone-800 rounded-xl transition-all">{icon}</button>
);

export default App;
