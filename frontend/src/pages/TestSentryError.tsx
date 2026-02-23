import React from 'react';

/**
 * Página apenas para testes: ao ser montada dispara um erro que é capturado
 * pelo ErrorBoundary e reportado ao Sentry (se configurado).
 * Em produção apenas mostra uma mensagem; em desenvolvimento dispara o erro.
 */
export default function TestSentryError() {
  if (import.meta.env.DEV) {
    throw new Error('[Teste Sentry] Erro intencional para validar ErrorBoundary e report ao Sentry.');
  }
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <p className="text-muted-foreground">Rota de teste disponível apenas em desenvolvimento.</p>
    </div>
  );
}
