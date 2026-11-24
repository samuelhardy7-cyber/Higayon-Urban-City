import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'An unexpected error occurred.',
    };
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Application ErrorBoundary caught error:', error, info);
  }

  public render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 p-4 text-white">
        <div className="max-w-md w-full rounded-xl border border-rose-400/40 bg-slate-900 p-6 shadow-2xl space-y-4">
          <div className="flex items-center gap-2.5 text-rose-400">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <h2 className="font-display text-lg font-bold">Application Error</h2>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed break-words">
            {this.state.message}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-semibold text-xs hover:bg-amber-400 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reload Game</span>
          </button>
        </div>
      </div>
    );
  }
}
