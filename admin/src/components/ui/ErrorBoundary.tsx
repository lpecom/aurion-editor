import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-[400px] p-8">
          <div className="text-center max-w-md">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-7 h-7 text-red-400" />
            </div>
            <h2 className="text-lg font-semibold text-text mb-2">Algo deu errado</h2>
            <p className="text-sm text-zinc-500 mb-6 leading-relaxed">
              Ocorreu um erro inesperado. Tente recarregar a página.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={this.handleReset}
                className="flex items-center gap-2 px-4 py-2.5 bg-surface-2 border border-border/50 text-text text-sm font-medium rounded-xl hover:bg-surface-2/80 cursor-pointer transition-all duration-200"
              >
                <RefreshCw className="w-4 h-4" />
                Tentar novamente
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary text-bg text-sm font-medium rounded-xl hover:bg-primary/90 cursor-pointer transition-all duration-200"
              >
                Recarregar página
              </button>
            </div>
            {this.state.error && (
              <details className="mt-6 text-left">
                <summary className="text-xs text-zinc-600 cursor-pointer hover:text-zinc-400 transition-colors">
                  Detalhes do erro
                </summary>
                <pre className="mt-2 p-3 bg-surface-2/50 border border-border/30 rounded-lg text-xs text-zinc-500 font-mono overflow-auto max-h-32">
                  {this.state.error.message}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
