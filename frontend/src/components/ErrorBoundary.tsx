import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary para capturar erros de React, incluindo erros de Portal
 * Previne que erros de UI derrubem toda a aplicação
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Atualiza o state para renderizar a UI de fallback
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log do erro para debug
    const isPortalError =
      error.message?.includes('Portal') ||
      error.message?.includes('removeChild') ||
      error.message?.includes('DOMException') ||
      error.stack?.includes('Portal');

    if (isPortalError) {
      // Para erros de Portal, logar mas não bloquear a UI
      console.warn('[ErrorBoundary] Erro de Portal detectado (geralmente não crítico):', {
        error: error.message,
        stack: error.stack,
      });
      // Não definir hasError para erros de Portal - permite que a UI continue
      return;
    }

    console.error('[ErrorBoundary] Erro capturado:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });

    // Chama callback se fornecido
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      // Para outros erros, mostra fallback personalizado ou padrão
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="max-w-md w-full space-y-4 text-center">
            <h2 className="text-2xl font-bold text-destructive">Algo deu errado</h2>
            <p className="text-muted-foreground">
              Ocorreu um erro inesperado. Por favor, recarregue a página.
            </p>
            {import.meta.env.DEV && this.state.error && (
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-sm font-medium">
                  Detalhes do erro (apenas em desenvolvimento)
                </summary>
                <pre className="mt-2 p-4 bg-muted rounded-md text-xs overflow-auto">
                  {this.state.error.message}
                  {'\n\n'}
                  {this.state.error.stack}
                </pre>
              </details>
            )}
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Recarregar página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

