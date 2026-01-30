import React, { Suspense, lazy } from 'react';
import {
  LayoutDashboard,
  PenTool,
  GitBranch,
  Share2,
  Home,
  HelpCircle,
  Loader2,
  Cloud,
  AlertTriangle,
  RefreshCw,
  GitMerge,
  WifiOff,
  Download,
} from 'lucide-react';
import { useUI, useUIDispatch, useMetadata } from '../contexts/StoryContext';
import * as Actions from '../store/actions';
import { ViewMode, StoryProject } from '../types';
import ErrorBoundary from './ErrorBoundary';
import PublicationModal from './PublicationModal';
import GlobalDialog from './GlobalDialog';
import SafetyInterventionModal from './SafetyInterventionModal';
import WelcomeScreen from './WelcomeScreen';
import { normalizeProject } from '../services/bibleManager';
import { NavBtn, MobileNavBtn, ActionBtn } from './ui/NavigationButtons';
import { usePWA } from '../hooks/usePWA';
import { useRAG } from '../hooks/useRAG';

const PlotterView = lazy(() => import('./PlotterView'));
const WriterView = lazy(() => import('./WriterView'));
const DashboardView = lazy(() => import('./DashboardView'));

interface AppShellProps {
  onLoadProject: (project: StoryProject) => void;
}

const AppShell: React.FC<AppShellProps> = ({ onLoadProject }) => {
  const ui = useUI();
  const uiDispatch = useUIDispatch();
  const { id: projectId, headRev } = useMetadata();
  const { isInstallable, installApp } = usePWA();

  // RAGインデックスの自動管理を有効化
  useRAG();

  const isLoaded = !!projectId && ui.view !== ViewMode.WELCOME;

  // Fix: viewKey should depend only on projectId, not headRev.
  // Including headRev causes the entire view component to unmount/remount on every auto-save,
  // resetting local state (like isMobileChatOpen or scroll position).
  const viewKey = projectId;

  if (!isLoaded) {
    return (
      <>
        <WelcomeScreen
          onStart={(p) => {
            onLoadProject(normalizeProject(p));
            uiDispatch(Actions.setView(ViewMode.DASHBOARD));
          }}
          onOpenHelp={() => uiDispatch(Actions.setHelpModal(true))}
          showAlert={(t, m) =>
            uiDispatch(Actions.openDialog({ isOpen: true, type: 'alert', title: t, message: m }))
          }
          showConfirm={(t, m, c) =>
            uiDispatch(
              Actions.openDialog({
                isOpen: true,
                type: 'confirm',
                title: t,
                message: m,
                onConfirm: () => {
                  uiDispatch(Actions.closeDialog());
                  c();
                },
                onCancel: () => uiDispatch(Actions.closeDialog()),
              }),
            )
          }
        />
        <GlobalDialog
          dialog={ui.dialog}
          setDialog={(v: any) => uiDispatch(typeof v === 'function' ? v(ui.dialog) : v)}
        />
      </>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-screen bg-stone-900 text-stone-200 overflow-hidden font-sans select-none relative">
      {/* オフラインバナー */}
      {!ui.isOnline && (
        <div className="fixed top-0 inset-x-0 z-[1200] bg-stone-800 text-stone-400 text-[10px] font-bold uppercase tracking-widest py-1 flex items-center justify-center gap-2 border-b border-stone-700 shadow-xl">
          <WifiOff size={12} className="text-orange-500" />
          <span>Offline Mode: AI機能は利用できませんが、閲覧・執筆・保存は可能です。</span>
        </div>
      )}

      {/* 競合アラートオーバーレイ */}
      {ui.isConflict && (
        <div className="fixed inset-0 z-[1000] bg-stone-950/95 backdrop-blur-xl flex items-center justify-center p-6 animate-fade-in">
          <div className="max-w-lg w-full glass p-8 rounded-[3rem] border border-rose-500/30 shadow-3xl text-center space-y-8">
            <div className="flex justify-center">
              <div className="p-5 bg-rose-600/20 text-rose-500 rounded-2xl animate-pulse">
                <AlertTriangle size={48} />
              </div>
            </div>
            <div className="space-y-4">
              <h2 className="text-2xl md:text-3xl font-display font-black text-white italic tracking-tight">
                保存の競合が発生しました
              </h2>
              <p className="text-sm text-stone-400 font-serif leading-relaxed">
                別のタブ、または別のデバイスで物語が更新されています。
                <br />
                現在の作業内容をどう処理しますか？
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => window.location.reload()}
                className="w-full py-5 bg-stone-800 text-stone-400 rounded-2xl text-[10px] font-black uppercase tracking-widest flex flex-col items-center justify-center gap-2 hover:bg-stone-700 hover:text-white transition-all group border border-white/5 hover:border-white/10"
              >
                <RefreshCw
                  size={18}
                  className="group-hover:rotate-180 transition-transform duration-500"
                />
                <span>
                  最新の状態を読み込む
                  <br />
                  <span className="text-[8px] opacity-70 normal-case">(現在の変更を破棄)</span>
                </span>
              </button>

              <button
                onClick={() => uiDispatch(Actions.setForceSaveRequested(true))}
                className="w-full py-5 bg-orange-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex flex-col items-center justify-center gap-2 hover:bg-orange-500 transition-all shadow-xl shadow-orange-900/30 active:scale-95"
              >
                <GitMerge size={18} />
                <span>
                  強制保存する
                  <br />
                  <span className="text-[8px] opacity-70 normal-case">(現在の内容を優先)</span>
                </span>
              </button>
            </div>
            <p className="text-[9px] text-stone-600 font-serif italic">
              ※ 強制保存を選択すると、現在の作業内容が最新版として上書き保存されます。
            </p>
          </div>
        </div>
      )}

      <aside
        className={`hidden md:flex w-24 bg-stone-900/95 border-r border-stone-800 flex-col items-center py-10 gap-10 z-[60] ${!ui.isOnline ? 'pt-14' : ''}`}
      >
        <button
          className="w-14 h-14 bg-orange-500 rounded-[1.25rem] flex items-center justify-center cursor-pointer shadow-xl hover:scale-105 transition-transform"
          onClick={() => uiDispatch(Actions.setView(ViewMode.DASHBOARD))}
          aria-label="Dashboard Home"
        >
          <span className="font-display font-black text-stone-950 text-3xl italic">D</span>
        </button>
        <nav className="flex flex-col gap-8 w-full px-6">
          <NavBtn
            icon={<LayoutDashboard size={24} />}
            active={ui.view === ViewMode.DASHBOARD}
            onClick={() => uiDispatch(Actions.setView(ViewMode.DASHBOARD))}
          />
          <NavBtn
            icon={<GitBranch size={24} />}
            active={ui.view === ViewMode.PLOTTER}
            onClick={() => uiDispatch(Actions.setView(ViewMode.PLOTTER))}
          />
          <NavBtn
            icon={<PenTool size={24} />}
            active={ui.view === ViewMode.WRITER}
            onClick={() => uiDispatch(Actions.setView(ViewMode.WRITER))}
          />
        </nav>
        <div className="mt-auto flex flex-col gap-6 items-center">
          {isInstallable && (
            <ActionBtn
              icon={<Download size={22} className="text-orange-400 animate-bounce" />}
              onClick={installApp}
            />
          )}
          {ui.saveStatus !== 'idle' && (
            <Cloud
              className={
                ui.saveStatus === 'saved' ? 'text-orange-400' : 'text-stone-500 animate-pulse'
              }
              size={24}
            />
          )}
          <ActionBtn
            icon={<HelpCircle size={22} />}
            onClick={() => uiDispatch(Actions.setHelpModal(true))}
          />
          <ActionBtn
            icon={<Share2 size={22} />}
            onClick={() => uiDispatch(Actions.setPubModal(true))}
          />
          <ActionBtn
            icon={<Home size={22} />}
            onClick={() =>
              uiDispatch(
                Actions.openDialog({
                  isOpen: true,
                  type: 'confirm',
                  title: '終了',
                  message: 'ホームに戻りますか？',
                  onConfirm: () => {
                    localStorage.removeItem('duoscript_active_id');
                    uiDispatch(Actions.setView(ViewMode.WELCOME));
                    window.location.reload();
                  },
                }),
              )
            }
          />
        </div>
      </aside>

      <main
        className={`flex-1 overflow-hidden relative bg-stone-900/40 pb-20 md:pb-0 ${!ui.isOnline ? 'pt-6' : ''}`}
      >
        <Suspense
          fallback={
            <div className="h-full w-full flex items-center justify-center bg-stone-950">
              <Loader2 size={48} className="animate-spin text-orange-400" />
            </div>
          }
        >
          {ui.view === ViewMode.DASHBOARD && (
            <ErrorBoundary viewName="Dashboard">
              <DashboardView
                key={viewKey}
                onOpenPublication={() => uiDispatch(Actions.setPubModal(true))}
                onExit={() =>
                  uiDispatch(
                    Actions.openDialog({
                      isOpen: true,
                      type: 'confirm',
                      title: '終了',
                      message: 'プロジェクトを閉じてホームに戻りますか？',
                      onConfirm: () => {
                        localStorage.removeItem('duoscript_active_id');
                        uiDispatch(Actions.setView(ViewMode.WELCOME));
                        window.location.reload();
                      },
                    }),
                  )
                }
              />
            </ErrorBoundary>
          )}
          {ui.view === ViewMode.PLOTTER && (
            <ErrorBoundary viewName="Plotter">
              <PlotterView key={viewKey} />
            </ErrorBoundary>
          )}
          {ui.view === ViewMode.WRITER && (
            <ErrorBoundary viewName="Writer">
              <WriterView key={viewKey} />
            </ErrorBoundary>
          )}
        </Suspense>
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 glass border-t border-white/5 h-20 px-6 flex items-center justify-between z-[100] pb-safe">
        <MobileNavBtn
          icon={<LayoutDashboard size={20} />}
          active={ui.view === ViewMode.DASHBOARD}
          onClick={() => uiDispatch(Actions.setView(ViewMode.DASHBOARD))}
          label="概要"
        />
        <MobileNavBtn
          icon={<GitBranch size={20} />}
          active={ui.view === ViewMode.PLOTTER}
          onClick={() => uiDispatch(Actions.setView(ViewMode.PLOTTER))}
          label="設計"
        />
        <MobileNavBtn
          icon={<PenTool size={20} />}
          active={ui.view === ViewMode.WRITER}
          onClick={() => uiDispatch(Actions.setView(ViewMode.WRITER))}
          label="執筆"
        />
        {isInstallable ? (
          <button
            onClick={installApp}
            className="flex flex-col items-center gap-1.5 text-orange-400"
          >
            <Download size={20} className="animate-pulse" />
            <span className="text-[8px] font-black uppercase tracking-widest">保存</span>
          </button>
        ) : (
          <button
            onClick={() => uiDispatch(Actions.setPubModal(true))}
            className="flex flex-col items-center gap-1.5 text-stone-500"
          >
            <Share2 size={20} />
            <span className="text-[8px] font-black uppercase tracking-widest">出力</span>
          </button>
        )}
      </nav>

      {ui.showPubModal && (
        <PublicationModal onClose={() => uiDispatch(Actions.setPubModal(false))} />
      )}
      {ui.safetyIntervention.isOpen && <SafetyInterventionModal />}
      <GlobalDialog
        dialog={ui.dialog}
        setDialog={(v: any) => {
          if (typeof v === 'function') {
            const next = v(ui.dialog);
            if (!next.isOpen) uiDispatch(Actions.closeDialog());
          } else if (!v.isOpen) {
            uiDispatch(Actions.closeDialog());
          }
        }}
      />
    </div>
  );
};

export default AppShell;
