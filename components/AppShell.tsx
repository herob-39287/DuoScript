
import React, { Suspense, lazy } from 'react';
import { 
  LayoutDashboard, PenTool, GitBranch, Share2, Home, 
  HelpCircle, Loader2, CloudCheck 
} from 'lucide-react';
import { useUI, useUIDispatch, useMetadata } from '../contexts/StoryContext';
import { ViewMode, StoryProject } from '../types';
import ErrorBoundary from './ErrorBoundary';
import PublicationModal from './PublicationModal';
import GlobalDialog from './GlobalDialog';
import WelcomeScreen from './WelcomeScreen';
import { normalizeProject } from '../services/bibleManager';
import { NavBtn, MobileNavBtn, ActionBtn } from './ui/NavigationButtons';

const PlotterView = lazy(() => import('./PlotterView'));
const WriterView = lazy(() => import('./WriterView'));
const DashboardView = lazy(() => import('./DashboardView'));

interface AppShellProps {
  onLoadProject: (project: StoryProject) => void;
}

const AppShell: React.FC<AppShellProps> = ({ onLoadProject }) => {
  const ui = useUI();
  const uiDispatch = useUIDispatch();
  const { id: projectId } = useMetadata();

  const isLoaded = !!projectId && ui.view !== ViewMode.WELCOME;

  if (!isLoaded) {
    return (
      <>
        <WelcomeScreen 
          onStart={(p) => { 
            onLoadProject(normalizeProject(p)); 
            uiDispatch({ type: 'SET_VIEW', payload: ViewMode.DASHBOARD }); 
          }} 
          onOpenHelp={() => uiDispatch({ type: 'SET_HELP_MODAL', payload: true })} 
          showAlert={(t, m) => uiDispatch({ type: 'OPEN_DIALOG', payload: { isOpen: true, type: 'alert', title: t, message: m } })} 
          showConfirm={(t, m, c) => uiDispatch({ type: 'OPEN_DIALOG', payload: { 
            isOpen: true, 
            type: 'confirm', 
            title: t, 
            message: m, 
            onConfirm: () => { 
              uiDispatch({ type: 'CLOSE_DIALOG' }); 
              c(); 
            },
            onCancel: () => uiDispatch({ type: 'CLOSE_DIALOG' })
          } })} 
        />
        <GlobalDialog dialog={ui.dialog} setDialog={(v: any) => uiDispatch(typeof v === 'function' ? v(ui.dialog) : v)} />
      </>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-screen bg-stone-900 text-stone-200 overflow-hidden font-sans select-none">
      <aside className="hidden md:flex w-24 bg-stone-900/95 border-r border-stone-800 flex-col items-center py-10 gap-10 z-[60]">
        <div className="w-14 h-14 bg-orange-500 rounded-[1.25rem] flex items-center justify-center cursor-pointer shadow-xl hover:scale-105 transition-transform" onClick={() => uiDispatch({ type: 'SET_VIEW', payload: ViewMode.DASHBOARD })}>
          <span className="font-display font-black text-stone-950 text-3xl italic">D</span>
        </div>
        <nav className="flex flex-col gap-8 w-full px-6">
          <NavBtn icon={<LayoutDashboard size={24}/>} active={ui.view === ViewMode.DASHBOARD} onClick={() => uiDispatch({ type: 'SET_VIEW', payload: ViewMode.DASHBOARD })} />
          <NavBtn icon={<GitBranch size={24}/>} active={ui.view === ViewMode.PLOTTER} onClick={() => uiDispatch({ type: 'SET_VIEW', payload: ViewMode.PLOTTER })} />
          <NavBtn icon={<PenTool size={24}/>} active={ui.view === ViewMode.WRITER} onClick={() => uiDispatch({ type: 'SET_VIEW', payload: ViewMode.WRITER })} />
        </nav>
        <div className="mt-auto flex flex-col gap-6 items-center">
          {ui.saveStatus !== 'idle' && <CloudCheck className={ui.saveStatus === 'saved' ? 'text-orange-400' : 'text-stone-500 animate-pulse'} size={24} />}
          <ActionBtn icon={<HelpCircle size={22}/>} onClick={() => uiDispatch({ type: 'SET_HELP_MODAL', payload: true })} />
          <ActionBtn icon={<Share2 size={22}/>} onClick={() => uiDispatch({ type: 'SET_PUB_MODAL', payload: true })} />
          <ActionBtn icon={<Home size={22}/>} onClick={() => uiDispatch({ type: 'OPEN_DIALOG', payload: { 
            isOpen: true, 
            type: 'confirm', 
            title: '終了', 
            message: 'ホームに戻りますか？', 
            onConfirm: () => { 
              localStorage.removeItem('duoscript_active_id'); 
              uiDispatch({ type: 'SET_VIEW', payload: ViewMode.WELCOME }); 
              window.location.reload(); 
            } 
          } })} />
        </div>
      </aside>

      <main className="flex-1 overflow-hidden relative bg-stone-900/40 pb-20 md:pb-0">
        <Suspense fallback={<div className="h-full w-full flex items-center justify-center bg-stone-950"><Loader2 size={48} className="animate-spin text-orange-400"/></div>}>
          {ui.view === ViewMode.DASHBOARD && <ErrorBoundary viewName="Dashboard"><DashboardView onOpenPublication={() => uiDispatch({ type: 'SET_PUB_MODAL', payload: true })} /></ErrorBoundary>}
          {ui.view === ViewMode.PLOTTER && <ErrorBoundary viewName="Plotter"><PlotterView /></ErrorBoundary>}
          {ui.view === ViewMode.WRITER && <ErrorBoundary viewName="Writer"><WriterView /></ErrorBoundary>}
        </Suspense>
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 glass border-t border-white/5 h-20 px-6 flex items-center justify-between z-[100] pb-safe">
        <MobileNavBtn icon={<LayoutDashboard size={20}/>} active={ui.view === ViewMode.DASHBOARD} onClick={() => uiDispatch({ type: 'SET_VIEW', payload: ViewMode.DASHBOARD })} label="概要" />
        <MobileNavBtn icon={<GitBranch size={20}/>} active={ui.view === ViewMode.PLOTTER} onClick={() => uiDispatch({ type: 'SET_VIEW', payload: ViewMode.PLOTTER })} label="設計" />
        <MobileNavBtn icon={<PenTool size={20}/>} active={ui.view === ViewMode.WRITER} onClick={() => uiDispatch({ type: 'SET_VIEW', payload: ViewMode.WRITER })} label="執筆" />
        <button onClick={() => uiDispatch({ type: 'SET_PUB_MODAL', payload: true })} className="flex flex-col items-center gap-1.5 text-stone-500"><Share2 size={20} /><span className="text-[8px] font-black uppercase tracking-widest">出力</span></button>
      </nav>

      {ui.showPubModal && <PublicationModal onClose={() => uiDispatch({ type: 'SET_PUB_MODAL', payload: false })} />}
      <GlobalDialog dialog={ui.dialog} setDialog={(v: any) => {
        if (typeof v === 'function') {
           const next = v(ui.dialog);
           if (!next.isOpen) uiDispatch({ type: 'CLOSE_DIALOG' });
        } else if (!v.isOpen) {
           uiDispatch({ type: 'CLOSE_DIALOG' });
        }
      }} />
    </div>
  );
};

export default AppShell;
