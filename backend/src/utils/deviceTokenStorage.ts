import bcrypt from 'bcryptjs';
import { timingSafeEqualString } from './cryptoCompare.js';

function bcryptRounds(): number {
  const n = parseInt(process.env.DEVICE_TOKEN_BCRYPT_ROUNDS || '10', 10);
  if (!Number.isFinite(n)) return 10;
  return Math.min(14, Math.max(8, n));
}

/** Valor na BD produzido por bcrypt.hash (compatível com bcryptjs). */
export function isStoredDeviceTokenHashed(stored: string): boolean {
  if (typeof stored !== 'string' || stored.length < 4) return false;
  return stored.startsWith('$2a$') || stored.startsWith('$2b$') || stored.startsWith('$2y$');
}

export async function hashDeviceToken(plain: string): Promise<string> {
  return bcrypt.hash(plain, bcryptRounds());
}

/**
 * Valida token enviado pelo dispositivo contra o valor na BD.
 * Suporta legado (texto plano, comparação em tempo constante) e novo formato (bcrypt).
 */
export async function verifyDeviceToken(plain: string, stored: string): Promise<boolean> {
  if (typeof plain !== 'string' || typeof stored !== 'string' || !plain.length || !stored.length) {
    return false;
  }
  if (isStoredDeviceTokenHashed(stored)) {
    try {
      return await bcrypt.compare(plain, stored);
    } catch {
      return false;
    }
  }
  return timingSafeEqualString(plain, stored);
}
