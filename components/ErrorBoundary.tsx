import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Trash2 } from 'lucide-react';

interface Props {
  children?: ReactNode;
  viewName: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary provides a fallback UI when a component tree crashes.
 * It catches JavaScript errors anywhere in their child component tree.
 */
class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  static getDerivedStateFromError(error: Error): State {
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
          <div className="max-w-md w-full glass p-8 md:p-10 rounded-[2.5rem] border border-rose-500/20 shadow-3xl text-center space-y-6 my-auto">
            <div className="flex justify-center">
              <div className="p-4 bg-rose-600/20 text-rose-500 rounded-2xl animate-pulse">
                <AlertTriangle size={40} />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl md:text-2xl font-display font-black text-white italic">回路の不具合</h2>
              <p className="text-xs md:text-sm text-stone-500 font-serif leading-relaxed">
                {viewName}の読み込み中に予期せぬエラーが発生しました。設計士の推論またはデータの整合性に一時的な問題がある可能性があります。
              </p>
            </div>
            
            <div className="p-4 bg-stone-900/50 rounded-2xl border border-white/5 text-left max-h-32 overflow-y-auto custom-scrollbar">
              <p className="text-[10px] font-mono text-rose-400/70 break-words">
                {error?.message || "Unknown error occurred."}
              </p>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <button 
                onClick={this.handleReset}
                className="w-full py-4 bg-orange-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-orange-500 transition-all active:scale-95 shadow-lg shadow-orange-950/20"
              >
                <RefreshCw size={14} /> 再試行
              </button>
              
              <div className="flex gap-3">
                <button 
                  onClick={this.handleReload}
                  className="flex-1 py-4 bg-stone-800 text-stone-300 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-stone-700 transition-all"
                >
                  <Home size={14} /> 再起動
                </button>
                <button 
                   onClick={this.handleEmergencyReset}
                   className="flex-1 py-4 bg-stone-800 text-stone-300 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-rose-900/20 hover:text-rose-400 transition-all"
                   title="プロジェクト選択画面に戻る"
                >
                   <Trash2 size={14} /> 解除
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return children || null;
  }
}

export default ErrorBoundary;