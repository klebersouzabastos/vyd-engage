import { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { isChunkLoadError, reloadForChunkError } from '../utils/chunkReload';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  isChunkError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, isChunkError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, isChunkError: isChunkLoadError(error) };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (isChunkLoadError(error)) {
      // Stale chunk after a deploy — reload once to fetch fresh assets instead
      // of re-rendering the same lazy import, which would 404 again.
      reloadForChunkError();
      return;
    }
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, isChunkError: false });
  };

  render() {
    if (this.state.hasError) {
      // Stale-chunk recovery: a reload was (or is being) triggered. Show a
      // neutral "updating" state rather than a scary error. If the reload was
      // suppressed by the cooldown guard, the button lets the user retry.
      if (this.state.isChunkError) {
        return (
          <div className="flex flex-col items-center justify-center min-h-[300px] p-8">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <RefreshCw size={32} className="text-blue-600 animate-spin" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Atualizando o aplicativo</h2>
            <p className="text-gray-600 text-center mb-4 max-w-md">
              Uma nova versão foi publicada. Estamos recarregando para aplicar as atualizações. Se a
              tela não atualizar sozinha em alguns segundos, clique abaixo.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RefreshCw size={16} />
              Recarregar agora
            </button>
          </div>
        );
      }

      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] p-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle size={32} className="text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Algo deu errado</h2>
          <p className="text-gray-600 text-center mb-4 max-w-md">
            Ocorreu um erro inesperado. Tente recarregar a página.
          </p>
          {this.state.error && (
            <p className="text-sm text-gray-400 mb-4 font-mono max-w-md text-center">
              {this.state.error.message}
            </p>
          )}
          <button
            onClick={this.handleReset}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw size={16} />
            Tentar Novamente
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
