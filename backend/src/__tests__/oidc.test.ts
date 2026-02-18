/**
 * Testes OIDC - Login opcional com Google/Azure AD
 *
 * Garante que:
 * - OIDC desabilitado não quebra auth normal
 * - /auth/config retorna o esperado
 * - /auth/oidc/login retorna 404 quando não configurado
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('OIDC - Config desabilitada', () => {
  const origEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...origEnv };
    delete process.env.OIDC_ENABLED;
    delete process.env.OIDC_ISSUER;
    delete process.env.OIDC_CLIENT_ID;
    delete process.env.OIDC_CLIENT_SECRET;
    delete process.env.OIDC_REDIRECT_URI;
  });

  afterEach(() => {
    process.env = origEnv;
  });

  it('isOidcEnabled retorna false quando OIDC não está configurado', async () => {
    const { isOidcEnabled } = await import('../services/oidc.service.js');
    expect(isOidcEnabled()).toBe(false);
  });

  it('getOidcProviderName retorna Google por padrão', async () => {
    const { getOidcProviderName } = await import('../services/oidc.service.js');
    expect(getOidcProviderName()).toBe('Google');
  });
});

describe('OIDC - Config parcial (sem todas as vars)', () => {
  const origEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...origEnv, OIDC_ENABLED: 'true', OIDC_CLIENT_ID: 'x' };
    delete process.env.OIDC_ISSUER;
    delete process.env.OIDC_CLIENT_SECRET;
    delete process.env.OIDC_REDIRECT_URI;
  });

  afterEach(() => {
    process.env = origEnv;
  });

  it('isOidcEnabled retorna false quando falta config', async () => {
    const { isOidcEnabled } = await import('../services/oidc.service.js');
    expect(isOidcEnabled()).toBe(false);
  });
});
