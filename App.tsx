
import React, { createContext, useContext, useReducer, Suspense, lazy, useMemo, useCallback, useState, useEffect } from 'react';
import WelcomeScreen from './components/WelcomeScreen';
import PublicationModal from './components/PublicationModal';
import ComplianceModal from './components/ComplianceModal';
import GlobalDialog from './components/GlobalDialog';
import ErrorBoundary from './components/ErrorBoundary';
import { 
  ViewMode, StoryProject, SystemLog, AppNotification, DialogState, 
  ChapterLog, WorldBible, ChatMessage, SyncOperation, HistoryEntry,
  StoryProjectMetadata, SyncState, MetaAction, BibleAction, ChapterAction, SyncAction, NotificationAction
} from './types';
import { 
  LayoutDashboard, PenTool, GitBranch, Share2, Home, AlertCircle, X, 
  CloudCheck, CheckCircle2, HelpCircle, Loader2 
} from 'lucide-react';
import { normalizeProject } from './services/bibleManager';
import { metaReducer, bibleReducer, chaptersReducer, syncReducer, notificationReducer } from './store/reducers';
import { usePersistence } from './hooks/usePersistence';

// --- Split Context Definitions ---

const MetadataStateContext = createContext<StoryProjectMetadata | undefined>(undefined);
const MetadataDispatchContext = createContext<React.Dispatch<MetaAction> | undefined>(undefined);

const ManuscriptStateContext = createContext<ChapterLog[] | undefined>(undefined);
const ManuscriptDispatchContext = createContext<React.Dispatch<ChapterAction> | undefined>(undefined);

const BibleStateContext = createContext<WorldBible | undefined>(undefined);
const BibleDispatchContext = createContext<React.Dispatch<BibleAction> | undefined>(undefined);

const NeuralSyncStateContext = createContext<SyncState | undefined>(undefined);
const NeuralSyncDispatchContext = createContext<React.Dispatch<SyncAction> | undefined>(undefined);

interface UIState {
  view: ViewMode;
  plotterTab: string;
  pendingMsg: string | null;
  saveStatus: 'idle' | 'saving' | 'saved';
}
interface UIDispatch {
  setView: (v: ViewMode) => void;
  setPlotterTab: (t: string) => void;
  setPendingMsg: (m: string | null) => void;
}
const UIStateContext = createContext<UIState | undefined>(undefined);
const UIDispatchContext = createContext<UIDispatch | undefined>(undefined);

interface NotificationState {
  logs: SystemLog[];
  notifications: AppNotification[];
}
interface NotificationDispatch {
  addLog: (type: SystemLog['type'], source: SystemLog['source'], message: string, details?: string) => void;
  dispatch: React.Dispatch<NotificationAction>;
}
const NotificationStateContext = createContext<NotificationState | undefined>(undefined);
const NotificationDispatchContext = createContext<NotificationDispatch | undefined>(undefined);

// --- Optimized Custom Hooks ---

export const useMetadata = () => {
  const state = useContext(MetadataStateContext);
  if (!state) throw new Error("useMetadata must be used within MetadataProvider");
  return state;
};
export const useMetadataDispatch = () => {
  const dispatch = useContext(MetadataDispatchContext);
  if (!dispatch) throw new Error("useMetadataDispatch must be used within MetadataProvider");
  return dispatch;
};

export const useManuscript = () => {
  const state = useContext(ManuscriptStateContext);
  if (!state) throw new Error("useManuscript must be used within ManuscriptProvider");
  return state;
};
export const useManuscriptDispatch = () => {
  const dispatch = useContext(ManuscriptDispatchContext);
  if (!dispatch) throw new Error("useManuscriptDispatch must be used within ManuscriptProvider");
  return dispatch;
};

export const useBible = () => {
  const state = useContext(BibleStateContext);
  if (!state) throw new Error("useBible must be used within BibleProvider");
  return state;
};
export const useBibleDispatch = () => {
  const dispatch = useContext(BibleDispatchContext);
  if (!dispatch) throw new Error("useBibleDispatch must be used within BibleProvider");
  return dispatch;
};

export const useNeuralSync = () => {
  const state = useContext(NeuralSyncStateContext);
  if (!state) throw new Error("useNeuralSync must be used within NeuralSyncProvider");
  return state;
};
export const useNeuralSyncDispatch = () => {
  const dispatch = useContext(NeuralSyncDispatchContext);
  if (!dispatch) throw new Error("useNeuralSyncDispatch must be used within NeuralSyncProvider");
  return dispatch;
};

export const useUI = () => {
  const context = useContext(UIStateContext);
  if (!context) throw new Error("useUI must be used within UIProvider");
  return context;
};
export const useUIDispatch = () => {
  const context = useContext(UIDispatchContext);
  if (!context) throw new Error("useUIDispatch must be used within UIProvider");
  return context;
};

export const useNotifications = () => {
  const context = useContext(NotificationStateContext);
  if (!context) throw new Error("useNotifications must be used within NotificationProvider");
  return context;
};
export const useNotificationDispatch = () => {
  const context = useContext(NotificationDispatchContext);
  if (!context) throw new Error("useNotificationDispatch must be used within NotificationProvider");
  return context;
};

// --- Lazy Loaded Components ---

const PlotterView = lazy(() => import('./components/PlotterView'));
const WriterView = lazy(() => import('./components/WriterView'));
const DashboardView = lazy(() => import('./components/DashboardView'));

const App: React.FC = () => {
  const emptyProject = normalizeProject(null);
  
  const [meta, metaDispatch] = useReducer(metaReducer, emptyProject.meta);
  const [bible, bibleDispatch] = useReducer(bibleReducer, emptyProject.bible);
  const [chapters, chaptersDispatch] = useReducer(chaptersReducer, emptyProject.chapters);
  const [sync, syncDispatch] = useReducer(syncReducer, emptyProject.sync);
  const [notifState, notifDispatch] = useReducer(notificationReducer, { logs: [], notifications: [] });
  
  const [view, setView] = useState<ViewMode>(ViewMode.WELCOME);
  const [plotterTab, setPlotterTab] = useState('grandArc');
  const [pendingMsg, setPendingMsg] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>({ isOpen: false, type: 'alert', title: '', message: '' });
  const [showPubModal, setShowPubModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [hasAgreed, setHasAgreed] = useState(localStorage.getItem('duoscript_agreed') === 'true');

  const { saveStatus } = usePersistence(
    { meta, bible, chapters, sync }, 
    { metaDispatch, bibleDispatch, chaptersDispatch, syncDispatch }, 
    setView
  );

  const addLog = useCallback((type: SystemLog['type'], source: SystemLog['source'], message: string, details?: string) => {
    notifDispatch({ 
      type: 'ADD_LOG', 
      payload: { id: crypto.randomUUID(), timestamp: Date.now(), type, source, message, details } 
    });
  }, []);

  const loadFullProject = useCallback((project: StoryProject) => {
    metaDispatch({ type: 'LOAD_META', payload: project.meta });
    bibleDispatch({ type: 'LOAD_BIBLE', payload: project.bible });
    chaptersDispatch({ type: 'LOAD_CHAPTERS', payload: project.chapters });
    syncDispatch({ type: 'LOAD_SYNC', payload: project.sync });
  }, []);

  useEffect(() => {
    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error("Unhandled Promise Rejection:", event.reason);
      addLog('error', 'System', "処理中にエラーが発生しました。詳細はログを確認してください。", event.reason?.message);
    };
    window.addEventListener('unhandledrejection', handleRejection);
    return () => window.removeEventListener('unhandledrejection', handleRejection);
  }, [addLog]);

  const uiDispatchValue = useMemo(() => ({ setView, setPlotterTab, setPendingMsg }), []);
  const uiStateValue = useMemo(() => ({ view, plotterTab, pendingMsg, saveStatus }), [view, plotterTab, pendingMsg, saveStatus]);
  const notifDispatchValue = useMemo(() => ({ addLog, dispatch: notifDispatch }), [addLog]);

  if (!hasAgreed) {
    return <ComplianceModal onAccept={() => { localStorage.setItem('duoscript_agreed', 'true'); setHasAgreed(true); }} />;
  }

  const isLoaded = !!meta.id && view !== ViewMode.WELCOME;

  return (
    <NotificationStateContext.Provider value={notifState}>
      <NotificationDispatchContext.Provider value={notifDispatchValue}>
        <UIStateContext.Provider value={uiStateValue}>
          <UIDispatchContext.Provider value={uiDispatchValue}>
            <MetadataStateContext.Provider value={meta}>
              <MetadataDispatchContext.Provider value={metaDispatch}>
                <ManuscriptStateContext.Provider value={chapters}>
                  <ManuscriptDispatchContext.Provider value={chaptersDispatch}>
                    <BibleStateContext.Provider value={bible}>
                      <BibleDispatchContext.Provider value={bibleDispatch}>
                        <NeuralSyncStateContext.Provider value={sync}>
                          <NeuralSyncDispatchContext.Provider value={syncDispatch}>
                            {!isLoaded ? (
                              <>
                                <WelcomeScreen 
                                  onStart={(p) => { 
                                    loadFullProject(normalizeProject(p));
                                    setView(ViewMode.DASHBOARD); 
                                  }} 
                                  onOpenHelp={() => setShowHelpModal(true)} 
                                  showAlert={(t, m) => setDialog({ isOpen: true, type: 'alert', title: t, message: m })} 
                                  showConfirm={(t, m, c) => setDialog({ isOpen: true, type: 'confirm', title: t, message: m, onConfirm: () => { setDialog(d => ({ ...d, isOpen: false })); c(); } })} 
                                />
                                <GlobalDialog dialog={dialog} setDialog={setDialog} />
                              </>
                            ) : (
                              <div className="flex flex-col md:flex-row h-screen bg-stone-900 text-stone-200 overflow-hidden font-sans select-none">
                                {/* Desktop Sidebar */}
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
                                        isOpen: true, type: 'confirm', title: 'ホームに戻る', message: '現在の物語を保存してホームへ戻りますか？',
                                        onConfirm: () => {
                                          localStorage.removeItem('duoscript_active_id');
                                          setView(ViewMode.WELCOME);
                                          loadFullProject(normalizeProject(null));
                                        }
                                      });
                                    }} />
                                  </div>
                                </aside>

                                <main className="flex-1 overflow-hidden relative bg-stone-900/40 pb-20 md:pb-0">
                                  <Suspense fallback={<div className="h-full w-full flex items-center justify-center bg-stone-950"><div className="flex flex-col items-center gap-6"><Loader2 size={48} className="animate-spin text-orange-400"/><span className="font-serif italic text-stone-500 text-sm animate-pulse">アトリエを準備中...</span></div></div>}>
                                    {view === ViewMode.DASHBOARD && (
                                      <ErrorBoundary viewName="Dashboard">
                                        <DashboardView onOpenPublication={() => setShowPubModal(true)} />
                                      </ErrorBoundary>
                                    )}
                                    {view === ViewMode.PLOTTER && (
                                      <ErrorBoundary viewName="Plotter">
                                        <PlotterView />
                                      </ErrorBoundary>
                                    )}
                                    {view === ViewMode.WRITER && (
                                      <ErrorBoundary viewName="Writer">
                                        <WriterView />
                                      </ErrorBoundary>
                                    )}
                                  </Suspense>
                                </main>

                                {/* Mobile Bottom Navigation */}
                                <nav className="md:hidden fixed bottom-0 left-0 right-0 glass border-t border-white/5 h-20 px-6 flex items-center justify-between z-[100] pb-safe">
                                  <MobileNavBtn icon={<LayoutDashboard size={20}/>} active={view === ViewMode.DASHBOARD} onClick={() => setView(ViewMode.DASHBOARD)} label="ダッシュボード" />
                                  <MobileNavBtn icon={<GitBranch size={20}/>} active={view === ViewMode.PLOTTER} onClick={() => setView(ViewMode.PLOTTER)} label="設計・Nexus" />
                                  <MobileNavBtn icon={<PenTool size={20}/>} active={view === ViewMode.WRITER} onClick={() => setView(ViewMode.WRITER)} label="執筆エディタ" />
                                  <button onClick={() => setShowPubModal(true)} className="flex flex-col items-center gap-1.5 text-stone-500">
                                    <Share2 size={20} />
                                    <span className="text-[8px] font-black uppercase tracking-widest">出力</span>
                                  </button>
                                </nav>

                                {showPubModal && <PublicationModal onClose={() => setShowPubModal(false)} />}
                                <GlobalDialog dialog={dialog} setDialog={setDialog} />
                              </div>
                            )}
                          </NeuralSyncDispatchContext.Provider>
                        </NeuralSyncStateContext.Provider>
                      </BibleDispatchContext.Provider>
                    </BibleStateContext.Provider>
                  </ManuscriptDispatchContext.Provider>
                </ManuscriptStateContext.Provider>
              </MetadataDispatchContext.Provider>
            </MetadataStateContext.Provider>
          </UIDispatchContext.Provider>
        </UIStateContext.Provider>
      </NotificationDispatchContext.Provider>
    </NotificationStateContext.Provider>
  );
};

const NavBtn = React.memo(({ icon, active, onClick }: any) => (
  <button onClick={onClick} className={`w-12 h-12 md:w-full md:aspect-square rounded-[1.25rem] flex items-center justify-center transition-all ${active ? 'bg-orange-500 text-stone-950 shadow-lg shadow-orange-500/20' : 'text-stone-600 hover:text-stone-300 hover:bg-stone-800'}`}>{icon}</button>
));

const MobileNavBtn = React.memo(({ icon, active, onClick, label }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1.5 transition-all ${active ? 'text-orange-400' : 'text-stone-600'}`}>
    {icon}
    <span className="text-[8px] font-black uppercase tracking-widest">{label}</span>
  </button>
));

const ActionBtn = React.memo(({ icon, onClick }: any) => (
  <button onClick={onClick} className="w-12 h-12 flex items-center justify-center text-stone-600 hover:text-stone-100 hover:bg-stone-800 rounded-xl transition-all">{icon}</button>
));

export default App;
