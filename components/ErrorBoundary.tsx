import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

interface ErrorBoundaryProps {
  children?: ReactNode;
  viewName: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary provides a fallback UI when a component tree crashes.
 * It catches JavaScript errors anywhere in their child component tree.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`Error in ${this.props.viewName}:`, error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleEmergencyReset = () => {
    if (window.confirm("現在開いているプロジェクトの表示設定をリセットしてトップに戻りますか？データ自体は削除されません。")) {
      localStorage.removeItem('duoscript_active_id');
      window.location.reload();
    }
  };

  render() {
    const { hasError, error } = this.state;
    const { viewName, children } = this.props;

    if (hasError) {
      return (
        <div className="h-full w-full flex items-center justify-center p-6 md:p-12 bg-stone-950 animate-fade-in overflow-y-auto">
          <div className="max-w-md w-full bg-stone-900 border border-stone-800 rounded-3xl p-8 shadow-2xl space-y-6">
            <div className="flex items-center gap-4 text-rose-500">
               <div className="p-3 bg-rose-500/10 rounded-2xl">
                 <AlertTriangle size={32} />
               </div>
               <div>
                 <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">{viewName} Error</h2>
                 <p className="text-xs text-rose-400 font-mono mt-1">Application Crash</p>
               </div>
            </div>
            
            <div className="p-4 bg-stone-950/50 rounded-2xl border border-white/5 overflow-auto max-h-40 custom-scrollbar">
              <p className="text-[10px] font-mono text-stone-400 whitespace-pre-wrap leading-relaxed">
                {error?.message || "Unknown Error"}
              </p>
            </div>

            <div className="space-y-3">
               <button onClick={this.handleReset} className="w-full py-4 bg-orange-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-500 shadow-lg shadow-orange-900/20 transition-all active:scale-95 flex items-center justify-center gap-2">
                 <RefreshCw size={14} /> 再試行
               </button>
               <button onClick={this.handleReload} className="w-full py-4 bg-stone-800 text-stone-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:text-white transition-all active:scale-95">
                 リロード
               </button>
               <button onClick={this.handleEmergencyReset} className="w-full py-4 bg-rose-900/20 text-rose-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-900/40 transition-all active:scale-95 flex items-center justify-center gap-2">
                 <Trash2 size={14} /> 緊急リセット
               </button>
            </div>
          </div>
        </div>
      );
    }

    return children || null;
  }
}

export default ErrorBoundary;