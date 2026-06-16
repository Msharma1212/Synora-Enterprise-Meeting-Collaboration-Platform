import React, { ErrorInfo, ReactNode } from 'react';
import { ShieldAlert } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State;
  public props: Props;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
    this.props = props;
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught React boundary error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#07090e] text-white flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden">
          {/* Subtle Ambient Glow */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-[30%] left-[30%] w-[40%] h-[45%] rounded-full bg-red-600/5 blur-[120px]"></div>
          </div>

          <div className="max-w-md w-full bg-slate-900/60 border border-slate-800/80 rounded-3xl p-8 text-center backdrop-blur-xl shadow-2xl relative z-10 flex flex-col items-center">
            <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center text-red-500 mb-6 animate-pulse">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <h2 className="text-xl font-black text-white uppercase tracking-tight mb-3">
              Application Error
            </h2>

            <p className="text-slate-400 text-sm font-medium mb-8 leading-relaxed max-w-xs">
              Something went wrong. Please refresh the page.
            </p>

            <button
              id="refresh_page_btn"
              onClick={this.handleReload}
              className="w-full py-3 px-5 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-150 active:scale-95 shadow-lg shadow-blue-600/10 border border-white/5 cursor-pointer"
            >
              Refresh Screen
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
