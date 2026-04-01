import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
          <div className="bg-gray-800 p-8 rounded-xl shadow-2xl max-w-2xl w-full border border-red-500/30">
            <div className="flex items-center gap-4 text-red-400 mb-6">
              <AlertTriangle size={48} />
              <h1 className="text-2xl font-bold">Une erreur inattendue est survenue</h1>
            </div>
            
            <div className="bg-black/50 p-4 rounded-lg mb-6 overflow-auto max-h-64 border border-gray-700">
              <p className="text-red-300 font-mono text-sm mb-2">
                {this.state.error && this.state.error.toString()}
              </p>
              <pre className="text-gray-400 font-mono text-xs whitespace-pre-wrap">
                {this.state.errorInfo?.componentStack}
              </pre>
            </div>

            <div className="flex justify-end gap-4">
              <button
                onClick={this.handleReload}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <RefreshCw size={18} />
                Recharger l'application
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
