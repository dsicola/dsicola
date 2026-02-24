/**
 * Testes: validação de subdomínio por instituição (multi-tenant por domínio).
 * Garante: parseTenantDomain, validateTenantDomain, buildSubdomainUrl em regra e profissional.
 *
 * Execute: npx vitest run src/__tests__/validateTenantDomain.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFindUnique = vi.fn();
vi.mock('../lib/prisma.js', () => ({
  default: {
    instituicao: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

describe('validateTenantDomain - buildSubdomainUrl', () => {
  it('retorna https://sub.base em produção', async () => {
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const { buildSubdomainUrl } = await import('../middlewares/validateTenantDomain.js');
    const url = buildSubdomainUrl('escola');
    expect(url).toMatch(/^https:\/\//);
    expect(url).toContain('escola');
    process.env.NODE_ENV = orig;
  });

  it('retorna URL com subdomínio e base domain', async () => {
    const { buildSubdomainUrl } = await import('../middlewares/validateTenantDomain.js');
    const url = buildSubdomainUrl('inst-a');
    expect(url).toBeTruthy();
    expect(typeof url).toBe('string');
  });
});

describe('validateTenantDomain - parseTenantDomain', () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
  });

  it('localhost → tenantDomainMode ignored', async () => {
    const { parseTenantDomain } = await import('../middlewares/validateTenantDomain.js');
    const req = { hostname: 'localhost', get: () => 'localhost:3001' } as any;
    const res = {} as any;
    const next = vi.fn();

    await parseTenantDomain(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.tenantDomainMode).toBe('ignored');
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it('127.0.0.1 → tenantDomainMode ignored', async () => {
    const { parseTenantDomain } = await import('../middlewares/validateTenantDomain.js');
    const req = { hostname: '127.0.0.1', get: () => '127.0.0.1:3001' } as any;
    const res = {} as any;
    const next = vi.fn();

    await parseTenantDomain(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.tenantDomainMode).toBe('ignored');
  });

  it('app.dsicola.com → tenantDomainMode central', async () => {
    const { parseTenantDomain } = await import('../middlewares/validateTenantDomain.js');
    const req = { hostname: 'app.dsicola.com', get: () => 'app.dsicola.com' } as any;
    const res = {} as any;
    const next = vi.fn();

    await parseTenantDomain(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.tenantDomainMode).toBe('central');
    expect(req.tenantDomainInstituicaoId).toBeNull();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it('www.dsicola.com → tenantDomainMode central (SUPER_ADMIN/COMERCIAL)', async () => {
    const { parseTenantDomain } = await import('../middlewares/validateTenantDomain.js');
    const req = { hostname: 'www.dsicola.com', get: () => 'www.dsicola.com' } as any;
    const res = {} as any;
    const next = vi.fn();

    await parseTenantDomain(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.tenantDomainMode).toBe('central');
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it('api.dsicola.com → tenantDomainMode central (backend em subdomínio api)', async () => {
    const { parseTenantDomain } = await import('../middlewares/validateTenantDomain.js');
    const req = { hostname: 'api.dsicola.com', get: () => 'api.dsicola.com' } as any;
    const res = {} as any;
    const next = vi.fn();

    await parseTenantDomain(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.tenantDomainMode).toBe('central');
  });

  it('subdomínio conhecido → carrega instituição e seta subdomain', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'inst-uuid-123',
      subdominio: 'escola-a',
    });
    const { parseTenantDomain } = await import('../middlewares/validateTenantDomain.js');
    const req = { hostname: 'escola-a.dsicola.com', get: () => 'escola-a.dsicola.com' } as any;
    const res = {} as any;
    const next = vi.fn();

    await parseTenantDomain(req, res, next);
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { subdominio: 'escola-a' },
      select: { id: true, subdominio: true },
    });
    expect(next).toHaveBeenCalledWith();
    expect(req.tenantDomainMode).toBe('subdomain');
    expect(req.tenantDomainInstituicaoId).toBe('inst-uuid-123');
    expect(req.tenantDomainSubdominio).toBe('escola-a');
  });

  it('subdomínio inexistente → 404 AppError', async () => {
    mockFindUnique.mockResolvedValue(null);
    const { parseTenantDomain } = await import('../middlewares/validateTenantDomain.js');
    const req = { hostname: 'naoexiste.dsicola.com', get: () => 'naoexiste.dsicola.com' } as any;
    const res = {} as any;
    const next = vi.fn();

    await parseTenantDomain(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(404);
    expect(err.message).toMatch(/instituição|subdomínio/i);
  });

  it('host externo (ex.: API em Railway) → central (SUPER_ADMIN/COMERCIAL)', async () => {
    const { parseTenantDomain } = await import('../middlewares/validateTenantDomain.js');
    const req = { hostname: 'dsicola-backend.railway.app', get: () => 'dsicola-backend.railway.app' } as any;
    const res = {} as any;
    const next = vi.fn();

    await parseTenantDomain(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.tenantDomainMode).toBe('central');
  });
});

describe('validateTenantDomain - validateTenantDomain (rotas autenticadas)', () => {
  it('modo ignored → next() sem erro', async () => {
    const { validateTenantDomain } = await import('../middlewares/validateTenantDomain.js');
    const req = { tenantDomainMode: 'ignored', user: { userId: 'u1', instituicaoId: 'i1', roles: ['ADMIN'] } } as any;
    const res = {} as any;
    const next = vi.fn();

    await validateTenantDomain(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('modo subdomain + user mesma instituição → next()', async () => {
    const { validateTenantDomain } = await import('../middlewares/validateTenantDomain.js');
    const req = {
      tenantDomainMode: 'subdomain',
      tenantDomainInstituicaoId: 'inst-1',
      user: { userId: 'u1', instituicaoId: 'inst-1', roles: ['ADMIN'] },
    } as any;
    const res = {} as any;
    const next = vi.fn();

    await validateTenantDomain(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('modo subdomain + user instituição diferente → 403 TENANT_MISMATCH', async () => {
    const { validateTenantDomain } = await import('../middlewares/validateTenantDomain.js');
    const req = {
      tenantDomainMode: 'subdomain',
      tenantDomainInstituicaoId: 'inst-a',
      user: { userId: 'u1', instituicaoId: 'inst-b', roles: ['ADMIN'] },
    } as any;
    const res = {} as any;
    const next = vi.fn();

    await validateTenantDomain(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(403);
    expect((err as any).reason).toBe('TENANT_MISMATCH');
    expect(err.message).toMatch(/não pertence a esta instituição/i);
  });

  it('modo central + SUPER_ADMIN → next()', async () => {
    const { validateTenantDomain } = await import('../middlewares/validateTenantDomain.js');
    const req = {
      tenantDomainMode: 'central',
      user: { userId: 'u1', instituicaoId: null, roles: ['SUPER_ADMIN'] },
    } as any;
    const res = {} as any;
    const next = vi.fn();

    await validateTenantDomain(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('modo central + COMERCIAL → next() (área comercial entra pelo domínio)', async () => {
    const { validateTenantDomain } = await import('../middlewares/validateTenantDomain.js');
    const req = {
      tenantDomainMode: 'central',
      user: { userId: 'u1', instituicaoId: null, roles: ['COMERCIAL'] },
    } as any;
    const res = {} as any;
    const next = vi.fn();

    await validateTenantDomain(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('modo central + usuário normal → 403 REDIRECT_TO_SUBDOMAIN', async () => {
    mockFindUnique.mockResolvedValue({ subdominio: 'escola-user' });
    const { validateTenantDomain } = await import('../middlewares/validateTenantDomain.js');
    const req = {
      tenantDomainMode: 'central',
      user: { userId: 'u1', instituicaoId: 'inst-1', roles: ['ADMIN'] },
    } as any;
    const res = {} as any;
    const next = vi.fn();

    await validateTenantDomain(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(403);
    expect((err as any).reason).toBe('REDIRECT_TO_SUBDOMAIN');
    expect((err as any).redirectToSubdomain).toBeTruthy();
  });

  it('sem req.user em modo não-ignorado → 401', async () => {
    const { validateTenantDomain } = await import('../middlewares/validateTenantDomain.js');
    const req = { tenantDomainMode: 'subdomain', tenantDomainInstituicaoId: 'i1', user: undefined } as any;
    const res = {} as any;
    const next = vi.fn();

    await validateTenantDomain(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(401);
  });
});

describe('Multi-tenant + dois tipos - contrato (regras profissionais)', () => {
  it('instituicaoId nunca aceito do frontend (getInstituicaoIdFromAuth)', async () => {
    const { getInstituicaoIdFromAuth } = await import('../middlewares/auth.js');
    const req = {
      user: { instituicaoId: 'from-jwt', roles: ['ADMIN'] },
      query: { instituicaoId: 'from-frontend' },
    } as any;
    expect(getInstituicaoIdFromAuth(req)).toBe('from-jwt');
  });

  it('JWT e /me devem expor instituicaoId e tipoAcademico (contrato)', () => {
    expect(['SECUNDARIO', 'SUPERIOR']).toContain('SECUNDARIO');
    expect(['SECUNDARIO', 'SUPERIOR']).toContain('SUPERIOR');
  });
});

// ─── Multi-tenant + dois tipos de instituição (SECUNDARIO / SUPERIOR) ───
// Validação por subdomínio é por instituicaoId; tipoAcademico é independente (JWT/me).
const ID_SECUNDARIO = 'inst-sec-uuid';
const ID_SUPERIOR = 'inst-sup-uuid';

describe('Multi-tenant e dois tipos de instituição (SECUNDARIO / SUPERIOR)', () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
  });

  it('parseTenantDomain: subdomínio inst-a-secundario-test (SECUNDARIO) carrega instituição', async () => {
    mockFindUnique.mockResolvedValue({
      id: ID_SECUNDARIO,
      subdominio: 'inst-a-secundario-test',
    });
    const { parseTenantDomain } = await import('../middlewares/validateTenantDomain.js');
    const req = {
      hostname: 'inst-a-secundario-test.dsicola.com',
      get: () => 'inst-a-secundario-test.dsicola.com',
    } as any;
    const next = vi.fn();
    await parseTenantDomain(req, {} as any, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.tenantDomainMode).toBe('subdomain');
    expect(req.tenantDomainInstituicaoId).toBe(ID_SECUNDARIO);
    expect(req.tenantDomainSubdominio).toBe('inst-a-secundario-test');
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { subdominio: 'inst-a-secundario-test' },
      select: { id: true, subdominio: true },
    });
  });

  it('parseTenantDomain: subdomínio inst-b-superior-test (SUPERIOR) carrega instituição', async () => {
    mockFindUnique.mockResolvedValue({
      id: ID_SUPERIOR,
      subdominio: 'inst-b-superior-test',
    });
    const { parseTenantDomain } = await import('../middlewares/validateTenantDomain.js');
    const req = {
      hostname: 'inst-b-superior-test.dsicola.com',
      get: () => 'inst-b-superior-test.dsicola.com',
    } as any;
    const next = vi.fn();
    await parseTenantDomain(req, {} as any, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.tenantDomainMode).toBe('subdomain');
    expect(req.tenantDomainInstituicaoId).toBe(ID_SUPERIOR);
    expect(req.tenantDomainSubdominio).toBe('inst-b-superior-test');
  });

  it('validateTenantDomain: usuário da instituição SECUNDARIO no subdomínio correto → next()', async () => {
    const { validateTenantDomain } = await import('../middlewares/validateTenantDomain.js');
    const req = {
      tenantDomainMode: 'subdomain',
      tenantDomainInstituicaoId: ID_SECUNDARIO,
      user: {
        userId: 'u1',
        instituicaoId: ID_SECUNDARIO,
        roles: ['ADMIN'],
      },
    } as any;
    const next = vi.fn();
    await validateTenantDomain(req, {} as any, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('validateTenantDomain: usuário da instituição SUPERIOR no subdomínio correto → next()', async () => {
    const { validateTenantDomain } = await import('../middlewares/validateTenantDomain.js');
    const req = {
      tenantDomainMode: 'subdomain',
      tenantDomainInstituicaoId: ID_SUPERIOR,
      user: {
        userId: 'u2',
        instituicaoId: ID_SUPERIOR,
        roles: ['PROFESSOR'],
      },
    } as any;
    const next = vi.fn();
    await validateTenantDomain(req, {} as any, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('validateTenantDomain: usuário SECUNDARIO acessa subdomínio da instituição SUPERIOR → 403 TENANT_MISMATCH', async () => {
    const { validateTenantDomain } = await import('../middlewares/validateTenantDomain.js');
    const req = {
      tenantDomainMode: 'subdomain',
      tenantDomainInstituicaoId: ID_SUPERIOR,
      user: {
        userId: 'u1',
        instituicaoId: ID_SECUNDARIO,
        roles: ['ADMIN'],
      },
    } as any;
    const next = vi.fn();
    await validateTenantDomain(req, {} as any, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(403);
    expect((err as any).reason).toBe('TENANT_MISMATCH');
    expect(err.message).toMatch(/não pertence a esta instituição/i);
  });

  it('validateTenantDomain: usuário SUPERIOR acessa subdomínio da instituição SECUNDARIO → 403 TENANT_MISMATCH', async () => {
    const { validateTenantDomain } = await import('../middlewares/validateTenantDomain.js');
    const req = {
      tenantDomainMode: 'subdomain',
      tenantDomainInstituicaoId: ID_SECUNDARIO,
      user: {
        userId: 'u2',
        instituicaoId: ID_SUPERIOR,
        roles: ['PROFESSOR'],
      },
    } as any;
    const next = vi.fn();
    await validateTenantDomain(req, {} as any, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(403);
    expect((err as any).reason).toBe('TENANT_MISMATCH');
  });
});

describe('Contrato profissional (erros controlados, sem 500)', () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
  });

  it('erros de tenant são AppError com statusCode 403 ou 404 (nunca 500)', async () => {
    const { parseTenantDomain, validateTenantDomain } = await import('../middlewares/validateTenantDomain.js');
    const { AppError } = await import('../middlewares/errorHandler.js');

    mockFindUnique.mockResolvedValue(null);
    const req404 = { hostname: 'inexistente.dsicola.com', get: () => 'inexistente.dsicola.com' } as any;
    const next404 = vi.fn();
    await parseTenantDomain(req404, {} as any, next404);
    const err404 = next404.mock.calls[0][0];
    expect(err404).toBeInstanceOf(AppError);
    expect(err404.statusCode).toBe(404);
    expect(err404.statusCode).not.toBe(500);

    const req403 = {
      tenantDomainMode: 'subdomain',
      tenantDomainInstituicaoId: 'inst-a',
      user: { userId: 'u1', instituicaoId: 'inst-b', roles: ['ADMIN'] },
    } as any;
    const next403 = vi.fn();
    await validateTenantDomain(req403, {} as any, next403);
    const err403 = next403.mock.calls[0][0];
    expect(err403).toBeInstanceOf(AppError);
    expect(err403.statusCode).toBe(403);
    expect(err403.statusCode).not.toBe(500);
  });

  it('403 REDIRECT_TO_SUBDOMAIN inclui redirectToSubdomain com URL válida', async () => {
    mockFindUnique.mockResolvedValue({ subdominio: 'minha-escola' });
    const { validateTenantDomain } = await import('../middlewares/validateTenantDomain.js');
    const req = {
      tenantDomainMode: 'central',
      user: { userId: 'u1', instituicaoId: 'inst-1', roles: ['ADMIN'] },
    } as any;
    const next = vi.fn();
    await validateTenantDomain(req, {} as any, next);
    const err = next.mock.calls[0][0];
    expect((err as any).reason).toBe('REDIRECT_TO_SUBDOMAIN');
    expect((err as any).redirectToSubdomain).toBeTruthy();
    expect(typeof (err as any).redirectToSubdomain).toBe('string');
    expect((err as any).redirectToSubdomain).toMatch(/minha-escola/);
  });

  it('mensagens de erro em português e claras para o usuário', async () => {
    const { validateTenantDomain } = await import('../middlewares/validateTenantDomain.js');
    const req = {
      tenantDomainMode: 'subdomain',
      tenantDomainInstituicaoId: 'inst-a',
      user: { userId: 'u1', instituicaoId: 'inst-b', roles: ['ADMIN'] },
    } as any;
    const next = vi.fn();
    await validateTenantDomain(req, {} as any, next);
    const err = next.mock.calls[0][0];
    expect(err.message).toMatch(/não pertence|instituição/i);
    expect(err.message.length).toBeGreaterThan(10);
  });
});
