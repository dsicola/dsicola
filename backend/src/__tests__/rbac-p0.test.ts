/**
 * Testes P0 RBAC - Padrão SIGA/SIGAE
 *
 * Cenários:
 * 1) 401 sem token
 * 2) 403 por role insuficiente
 * 3) Multi-tenant: instituicaoId apenas do JWT
 * 4) Professor: resolveProfessor obrigatório em rotas de professor
 *
 * Execute: npx vitest run src/__tests__/rbac-p0.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('RBAC P0 - Auth middleware', () => {
  it('1. authorize retorna 401 quando req.user não existe', async () => {
    const { authorize } = await import('../middlewares/auth.js');
    const middleware = authorize('ADMIN', 'SECRETARIA');
    const req = { user: undefined } as any;
    const res = {} as any;
    const next = vi.fn();

    await new Promise<void>((resolve) => {
      middleware(req, res, (err: any) => {
        expect(err).toBeDefined();
        expect(err.statusCode).toBe(401);
        expect(err.message).toMatch(/não autenticado|autenticado/i);
        resolve();
      });
    });
  });

  it('2. authorize retorna 403 quando role insuficiente', async () => {
    const { authorize } = await import('../middlewares/auth.js');
    const middleware = authorize('ADMIN', 'SECRETARIA');
    const req = {
      user: { userId: 'u1', instituicaoId: 'inst1', roles: ['PROFESSOR'] },
    } as any;
    const res = {} as any;
    const next = vi.fn();

    await new Promise<void>((resolve) => {
      middleware(req, res, (err: any) => {
        expect(err).toBeDefined();
        expect(err.statusCode).toBe(403);
        expect(err.message).toMatch(/acesso negado|permissão insuficiente|negado/i);
        resolve();
      });
    });
  });

  it('3. authorize permite quando usuário tem role permitida', async () => {
    const { authorize } = await import('../middlewares/auth.js');
    const middleware = authorize('ADMIN', 'SECRETARIA');
    const req = {
      user: { userId: 'u1', instituicaoId: 'inst1', roles: ['SECRETARIA'] },
    } as any;
    const res = {} as any;
    const next = vi.fn();

    middleware(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });
});

describe('RBAC P0 - Multi-tenant (getInstituicaoIdFromAuth)', () => {
  it('4. Não-SUPER_ADMIN: instituicaoId vem apenas do JWT', async () => {
    const { getInstituicaoIdFromAuth } = await import('../middlewares/auth.js');
    const req = {
      user: { instituicaoId: 'inst-from-jwt', roles: ['SECRETARIA'] },
      query: { instituicaoId: 'inst-from-frontend' },
    } as any;

    const result = getInstituicaoIdFromAuth(req);
    expect(result).toBe('inst-from-jwt');
    expect(result).not.toBe('inst-from-frontend');
  });

  it('5. SUPER_ADMIN pode usar query.instituicaoId para filtrar', async () => {
    const { getInstituicaoIdFromAuth } = await import('../middlewares/auth.js');
    const req = {
      user: { instituicaoId: null, roles: ['SUPER_ADMIN'] },
      query: { instituicaoId: 'inst-query' },
    } as any;

    const result = getInstituicaoIdFromAuth(req);
    expect(result).toBe('inst-query');
  });
});

describe('RBAC P0 - Rotas críticas têm authorize', () => {
  it('6. documentoOficial: rotas sensíveis têm authorize', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const docPath = path.join(process.cwd(), 'src/routes/documentoOficial.routes.ts');
    const content = fs.readFileSync(docPath, 'utf-8');
    expect(content).toContain('authorize');
    expect(content).toContain("router.get('/', authorize");
    expect(content).toContain("router.get('/:id', authorize");
  });

  it('7. recibo inclui FINANCEIRO nas roles', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const reciboPath = path.join(process.cwd(), 'src/routes/recibo.routes.ts');
    const content = fs.readFileSync(reciboPath, 'utf-8');
    expect(content).toContain('FINANCEIRO');
  });

  it('8. bloqueioAcademico usa DIRECAO (não DIRETOR)', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const bloqueioPath = path.join(process.cwd(), 'src/routes/bloqueioAcademico.routes.ts');
    const content = fs.readFileSync(bloqueioPath, 'utf-8');
    expect(content).toContain('DIRECAO');
    expect(content).not.toContain("'DIRETOR'");
  });
});

describe('RBAC P0 - UserRole enum', () => {
  it('9. Schema inclui RH e FINANCEIRO em UserRole', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const schemaPath = path.join(process.cwd(), 'prisma/schema.prisma');
    const content = fs.readFileSync(schemaPath, 'utf-8');
    const enumMatch = content.match(/enum UserRole \{[\s\S]*?\}/);
    expect(enumMatch).toBeTruthy();
    expect(enumMatch![0]).toContain('RH');
    expect(enumMatch![0]).toContain('FINANCEIRO');
  });
});
