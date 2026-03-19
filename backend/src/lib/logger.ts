/**
 * Logger centralizado - substitui console.log em produção
 * Em desenvolvimento: saída formatada (pino-pretty)
 * Em produção: JSON para agregadores de log
 */
import pino from 'pino';

const isProd = process.env.NODE_ENV === 'production';

const pinoLogger = pino({
  level: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
  ...(isProd
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:standard' },
        },
      }),
});

/** API compatível com console (msg, ...args) para facilitar migração */
export const logger = {
  debug: (msg: string, ...args: unknown[]) =>
    args.length ? pinoLogger.debug({ args }, msg) : pinoLogger.debug(msg),
  info: (msg: string, ...args: unknown[]) =>
    args.length ? pinoLogger.info({ args }, msg) : pinoLogger.info(msg),
  warn: (msg: string, ...args: unknown[]) =>
    args.length ? pinoLogger.warn({ args }, msg) : pinoLogger.warn(msg),
  error: (msg: string, ...args: unknown[]) =>
    args.length ? pinoLogger.error({ args }, msg) : pinoLogger.error(msg),
};
