/**
 * Sentry - Monitoramento de erros no frontend (opcional)
 * Só inicializa se VITE_SENTRY_DSN estiver definido.
 */
import * as Sentry from '@sentry/react';

const dsn = import.meta.env.VITE_SENTRY_DSN;
if (dsn && import.meta.env.PROD) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE || 'production',
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration({ maskAllText: true })],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.1,
  });
}
export { Sentry };
