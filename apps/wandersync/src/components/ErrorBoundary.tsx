import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center font-sans z-50 select-none">
          <div className="max-w-md w-full p-6 rounded-3xl bg-slate-900/90 border border-red-500/40 shadow-2xl backdrop-blur-xl flex flex-col items-center gap-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-red-500/20 border border-red-500/50 flex items-center justify-center text-red-400">
              <AlertTriangle className="w-7 h-7" />
            </div>
            
            <div>
              <h2 className="text-lg font-black text-white">
                {this.props.fallbackTitle || 'Navigation Experience Alert'}
              </h2>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                A rendering hiccup occurred while adjusting map perspectives. Your trip and squad state are safe.
              </p>
              {this.state.error && (
                <div className="mt-3 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] font-mono text-red-300 text-left overflow-x-auto max-h-24">
                  {this.state.error.message || 'Unknown error'}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 w-full mt-2">
              <button
                onClick={this.handleReset}
                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition active:scale-95"
              >
                Resume Navigation
              </button>
              <button
                onClick={this.handleReload}
                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 flex items-center justify-center gap-1.5 transition active:scale-95"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
