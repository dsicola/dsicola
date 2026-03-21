import rateLimit from 'express-rate-limit';

const isDev = process.env.NODE_ENV === 'development';

function intEnv(name: string, fallback: number): number {
  const v = process.env[name];
  if (v == null || v === '') return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Limites suaves para endpoints públicos (anti-abuso / enumeração).
 * Sobrescrever com env: PUBLIC_RATE_* (ver cada limitador).
 */

export const publicDocumentVerificarLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: intEnv('PUBLIC_RATE_DOCUMENT_VERIFICAR_MAX', isDev ? 120 : 60),
  message: { message: 'Muitas verificações. Tente novamente em 1 minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const publicLandingReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: intEnv('PUBLIC_RATE_LANDING_READ_MAX', isDev ? 400 : 200),
  message: { message: 'Muitas requisições. Tente novamente em breve.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const leadWindowMs = intEnv('PUBLIC_RATE_LEAD_CREATE_WINDOW_MS', 15 * 60 * 1000);

export const publicLeadCreateLimiter = rateLimit({
  windowMs: leadWindowMs,
  max: intEnv('PUBLIC_RATE_LEAD_CREATE_MAX', isDev ? 40 : 25),
  message: { message: 'Muitas submissões. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const candidaturaWindowMs = intEnv('PUBLIC_RATE_CANDIDATURA_CREATE_WINDOW_MS', 15 * 60 * 1000);

export const publicCandidaturaCreateLimiter = rateLimit({
  windowMs: candidaturaWindowMs,
  max: intEnv('PUBLIC_RATE_CANDIDATURA_CREATE_MAX', isDev ? 40 : 25),
  message: { message: 'Muitas candidaturas deste endereço. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Anti enumeração de emails no formulário de login (público). */
export const authCheckLockoutLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: intEnv('PUBLIC_RATE_AUTH_CHECK_LOCKOUT_MAX', isDev ? 90 : 45),
  message: { message: 'Muitas verificações. Tente novamente em 1 minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Integração biométrica (sem JWT): limite por IP para reduzir força bruta no token.
 * Valor alto para não atrapalhar picos de eventos legítimos.
 */
export const integracaoBiometriaIpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: intEnv('PUBLIC_RATE_INTEGRACAO_BIOMETRIA_MAX', isDev ? 600 : 400),
  message: { message: 'Muitas requisições de integração. Tente novamente em 1 minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
});
