import 'dotenv/config';

// Sentry - monitoramento de erros (opcional, só em produção com SENTRY_DSN)
if (process.env.SENTRY_DSN && process.env.NODE_ENV === 'production') {
  import('@sentry/node').then(({ init }) => {
    init({ dsn: process.env.SENTRY_DSN, environment: 'production', tracesSampleRate: 0.1 });
  });
}

import app from './app.js';
import { SchedulerService } from './services/scheduler.service.js';

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📚 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Inicializar schedulers automáticos
  SchedulerService.initialize();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  SchedulerService.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  SchedulerService.stop();
  process.exit(0);
});
