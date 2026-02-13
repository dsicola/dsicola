/**
 * ========================================
 * SERVIÇO GENÉRICO DE NORMALIZAÇÃO
 * ========================================
 * 
 * Funções utilitárias para normalizar dados
 * antes de salvar no banco, garantindo:
 * - Valores padrão seguros
 * - Tipos corretos
 * - Consistência institucional
 */

/**
 * Normalizar string (trim e null se vazio)
 */
export function normalizeString(value?: string | null): string | null {
  if (!value || value === '' || value === 'null' || value === 'undefined') {
    return null;
  }
  return value.trim() || null;
}

/**
 * Normalizar string obrigatória
 */
export function normalizeRequiredString(value?: string | null, fieldName: string = 'Campo'): string {
  const normalized = normalizeString(value);
  if (!normalized) {
    throw new Error(`${fieldName} é obrigatório`);
  }
  return normalized;
}

/**
 * Normalizar número decimal
 */
export function normalizeDecimal(value?: number | string | null): number | null {
  if (value === undefined || value === null || value === '' || value === 'null' || value === 'undefined') {
    return null;
  }

  const num = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(num) ? null : num;
}

/**
 * Normalizar número decimal com default
 */
export function normalizeDecimalWithDefault(value?: number | string | null, defaultValue: number = 0): number {
  const normalized = normalizeDecimal(value);
  return normalized !== null ? normalized : defaultValue;
}

/**
 * Normalizar número inteiro
 */
export function normalizeInt(value?: number | string | null): number | null {
  if (value === undefined || value === null || value === '' || value === 'null' || value === 'undefined') {
    return null;
  }

  const num = typeof value === 'string' ? parseInt(value, 10) : value;
  return isNaN(num) ? null : Math.floor(num);
}

/**
 * Normalizar número inteiro com default
 */
export function normalizeIntWithDefault(value?: number | string | null, defaultValue: number = 0): number {
  const normalized = normalizeInt(value);
  return normalized !== null ? normalized : defaultValue;
}

/**
 * Normalizar data
 */
export function normalizeDate(value?: string | Date | null): Date | null {
  if (!value || value === '' || value === 'null' || value === 'undefined') {
    return null;
  }

  try {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

/**
 * Normalizar data com default (hoje)
 */
export function normalizeDateWithDefault(value?: string | Date | null): Date {
  const normalized = normalizeDate(value);
  return normalized || new Date();
}

/**
 * Normalizar boolean
 */
export function normalizeBoolean(value?: boolean | string | null, defaultValue: boolean = false): boolean {
  if (value === undefined || value === null || value === '' || value === 'null' || value === 'undefined') {
    return defaultValue;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim();
    return lower === 'true' || lower === '1' || lower === 'yes' || lower === 'sim';
  }

  return Boolean(value);
}

/**
 * Normalizar enum (valida contra valores permitidos)
 */
export function normalizeEnum<T extends string>(
  value: string | T | null | undefined,
  allowedValues: readonly T[],
  defaultValue?: T
): T | null {
  if (!value || value === '' || value === 'null' || value === 'undefined') {
    return defaultValue || null;
  }

  const valueUpper = String(value).trim().toUpperCase();
  const allowedUpper = allowedValues.map(v => String(v).toUpperCase());

  const index = allowedUpper.indexOf(valueUpper);
  if (index !== -1) {
    return allowedValues[index];
  }

  return defaultValue || null;
}

/**
 * Normalizar ID (string UUID)
 */
export function normalizeId(value?: string | null): string | null {
  if (!value || value === '' || value === 'null' || value === 'undefined') {
    return null;
  }
  return String(value).trim() || null;
}

/**
 * Normalizar array
 */
export function normalizeArray<T>(value?: T[] | null): T[] {
  if (!value || !Array.isArray(value)) {
    return [];
  }
  return value;
}

/**
 * Garantir instituicaoId (sempre do token, nunca do body)
 */
export function ensureInstituicaoId(
  bodyInstituicaoId?: string | null,
  tokenInstituicaoId?: string | null,
  allowSuperAdmin: boolean = false
): string {
  // Se for SUPER_ADMIN e permitido, pode usar do body (para criar instituições)
  if (allowSuperAdmin && bodyInstituicaoId) {
    return bodyInstituicaoId;
  }

  // SEMPRE usar do token
  if (!tokenInstituicaoId) {
    throw new Error('Instituição não identificada. Usuário deve estar vinculado a uma instituição.');
  }

  return tokenInstituicaoId;
}

/**
 * Remover campos undefined de um objeto
 */
export function removeUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const cleaned: Partial<T> = {};
  for (const key in obj) {
    if (obj[key] !== undefined) {
      cleaned[key] = obj[key];
    }
  }
  return cleaned;
}

/**
 * Preparar dados para CREATE (aplica defaults)
 */
export function prepareCreateData<T extends Record<string, any>>(
  rawData: Partial<T>,
  defaults: Partial<T>
): T {
  return {
    ...defaults,
    ...removeUndefined(rawData),
  } as T;
}

/**
 * Preparar dados para UPDATE (apenas campos fornecidos)
 */
export function prepareUpdateData<T extends Record<string, any>>(
  rawData: Partial<T>
): Partial<T> {
  return removeUndefined(rawData);
}

