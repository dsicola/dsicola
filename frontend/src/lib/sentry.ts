/**
 * Sentry - Monitoramento de erros no frontend (opcional)
 * Só inicializa se VITE_SENTRY_DSN estiver definido e apenas em produção.
 * Se o init falhar ou não houver DSN, a aplicação continua normalmente.
 */
import * as Sentry from '@sentry/react';

const dsn = import.meta.env.VITE_SENTRY_DSN;
const isProd = import.meta.env.PROD;

function shouldDropEvent(event: Sentry.Event, hint: Sentry.EventHint): boolean {
  const message = event.message || '';
  const exceptionMessage = (event.exception?.values?.[0]?.value || '').toLowerCase();
  const combined = `${message} ${exceptionMessage}`;

  // Mesmos erros que main.tsx suprime - não enviar para o Sentry
  if (
    /onMessage|Extension context|chrome-extension:\/\/|content\.js|build\.js|tab\.js/i.test(combined) ||
    /Content Security Policy|CSP directive|script-src|unsafe-inline|Executing inline script violates/i.test(combined) ||
    /message channel closed before a response/i.test(combined) ||
    /Node\.removeChild|removeChild|The node to be removed is not a child/i.test(combined) ||
    /Operação requer escopo de instituição/i.test(combined) ||
    /Configuração de Ensinos|Acesso restrito à Administração Acadêmica/i.test(combined) ||
    /404 Error: User attempted to access non-existent route|non-existent route/i.test(combined)
  ) {
    return true;
  }
  return false;
}

if (dsn && isProd) {
  try {
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE || 'production',
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({ maskAllText: true }),
      ],
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0.1,
      beforeSend(event, hint) {
        if (shouldDropEvent(event, hint)) return null;
        return event;
      },
    });
  } catch (_) {
    // Se o Sentry falhar (DSN inválido, rede, etc.), a app continua normalmente
  }
}

export { Sentry };
