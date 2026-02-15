import { randomBytes } from 'crypto';

let _devJwtFallback: string | null = null;
let _devRefreshFallback: string | null = null;

/**
 * Retorna JWT_SECRET - obrigatório em produção, fallback temporário em dev.
 * Nunca usa strings hardcoded como 'secret'.
 */
export function getJwtSecret(): string {
  const env = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    if (!env || env.length < 32) {
      throw new Error('JWT_SECRET obrigatório no .env em produção (mínimo 32 caracteres)');
    }
    return env;
  }
  if (env && env.length >= 32) return env;
  if (!_devJwtFallback) _devJwtFallback = randomBytes(32).toString('hex');
  return _devJwtFallback;
}

/**
 * Retorna JWT_REFRESH_SECRET - obrigatório em produção, fallback temporário em dev.
 */
export function getJwtRefreshSecret(): string {
  const env = process.env.JWT_REFRESH_SECRET;
  if (process.env.NODE_ENV === 'production') {
    if (!env || env.length < 32) {
      throw new Error('JWT_REFRESH_SECRET obrigatório no .env em produção (mínimo 32 caracteres)');
    }
    return env;
  }
  if (env && env.length >= 32) return env;
  if (!_devRefreshFallback) _devRefreshFallback = randomBytes(32).toString('hex');
  return _devRefreshFallback;
}
