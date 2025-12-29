
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

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
// Fix: Explicitly extend Component to resolve inheritance recognition issues
class ErrorBoundary extends Component<Props, State> {
  // Define initial state for the component
  public state: State = {
    hasError: false,
    error: null
  };

  constructor(props: Props) {
    super(props);
  }

  // Static method to update state when a rendering error occurs
  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  // Lifecycle method called after an error is thrown
  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Fix: Access inherited props from Component base
    console.error(`Error in ${this.props.viewName}:`, error, errorInfo);
  }

  // Fix: Use setState which is inherited from Component
  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  // The render method handles the fallback UI or children rendering
  public render() {
    // Access state property inherited from Component
    if (this.state.hasError) {
      return (
        <div className="h-full w-full flex items-center justify-center p-12 bg-stone-950 animate-fade-in">
          <div className="max-w-md w-full glass p-10 rounded-[3rem] border border-rose-500/20 shadow-3xl text-center space-y-6">
            <div className="flex justify-center">
              <div className="p-4 bg-rose-600/20 text-rose-500 rounded-2xl">
                <AlertTriangle size={40} />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-display font-black text-white italic">回路の不具合</h2>
              <p className="text-sm text-stone-500 font-serif leading-relaxed">
                {/* Fix: Property 'props' recognition */}
                {this.props.viewName}の読み込み中に予期せぬエラーが発生しました。設計士の推論またはデータの整合性に一時的な問題がある可能性があります。
              </p>
            </div>
            
            <div className="p-4 bg-stone-900/50 rounded-2xl border border-white/5 text-left">
              <p className="text-[10px] font-mono text-rose-400/70 break-words overflow-hidden">
                {this.state.error?.message}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <button 
                onClick={this.handleReset}
                className="w-full py-4 bg-orange-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-orange-500 transition-all active:scale-95"
              >
                <RefreshCw size={14} /> 表示をリセット
              </button>
              <button 
                onClick={this.handleReload}
                className="w-full py-4 bg-stone-800 text-stone-300 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-stone-700 transition-all"
              >
                <Home size={14} /> アプリを再起動
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Fix: Property 'props' recognition for children
    return this.props.children || null;
  }
}

export default ErrorBoundary;
