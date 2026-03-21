/**
 * Logger centralizado - substitui console.log em produção
 * Em desenvolvimento: saída formatada (pino-pretty)
 * Em produção: JSON para agregadores de log
 */
import type { Request } from 'express';
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

/**
 * Em produção, por omissão não gravamos stack, body nem mensagens brutas de erros não operacionais.
 * Defina LOG_ERROR_DETAILS_IN_PRODUCTION=true apenas em diagnóstico temporário (staging).
 */
export function verboseHttpErrorLogs(): boolean {
  return (
    process.env.NODE_ENV !== 'production' ||
    process.env.LOG_ERROR_DETAILS_IN_PRODUCTION === 'true'
  );
}

function prismaErrorCode(err: Error): string | undefined {
  const c = (err as { code?: unknown }).code;
  return typeof c === 'string' && /^P\d{4}$/.test(c) ? c : undefined;
}

/** Registo único por falha HTTP: detalhado em dev/staging explícito; reduzido em produção. */
export function logHttpRequestError(req: Request, err: Error, hint?: string): void {
  const route = `${req.method} ${req.path}`;
  const user = (req as { user?: { userId?: string; instituicaoId?: string | null } }).user;
  const userId = user?.userId;
  const instituicaoId = user?.instituicaoId ?? undefined;
  const code = prismaErrorCode(err);

  if (verboseHttpErrorLogs()) {
    pinoLogger.error({ err, hint, route, userId, instituicaoId, prismaCode: code }, 'http_request_error');
    return;
  }

  const operational =
    'isOperational' in err &&
    (err as { isOperational?: boolean }).isOperational === true;

  pinoLogger.error(
    {
      hint,
      route,
      userId,
      instituicaoId,
      errorName: err.name,
      prismaCode: code,
      ...(operational ? { message: err.message } : {}),
    },
    'http_request_error'
  );
}

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
