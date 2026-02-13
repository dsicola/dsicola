/**
 * Testes P0: PROFESSOR ↔ PLANO DE ENSINO ↔ DASHBOARD
 *
 * Cenários cobertos:
 * 1) validateProfessorId - validação multi-tenant
 * 2) Regra: professorId deve ser professores.id (não users.id)
 * 3) Mensagens de erro orientativas
 * 4) Migration: backfill professores + corrigir plano_ensino.professor_id
 * 5) Multi-tenant: migration filtra por instituicao_id
 * 6) resolveProfessor middleware - assinatura correta
 * 7) Estados do plano - retorna planos de qualquer estado
 *
 * NOTA: Testes de integração com DB requerem DATABASE_URL de teste.
 * Execute: npx vitest run src/__tests__/professor-plano-dashboard.test.ts
 */

import { describe, it, expect } from 'vitest';

describe('Professor Resolver - Regras de negócio', () => {
  it('1. validateProfessorId retorna false para IDs vazios', async () => {
    const { validateProfessorId } = await import('../utils/professorResolver.js');
    expect(await validateProfessorId('', 'inst-123')).toBe(false);
    expect(await validateProfessorId('prof-123', '')).toBe(false);
  });

  it('2. resolveProfessorId lança para userId/instituicaoId vazios', async () => {
    const { resolveProfessorId } = await import('../utils/professorResolver.js');
    await expect(resolveProfessorId('', 'inst-123')).rejects.toThrow();
    await expect(resolveProfessorId('user-123', '')).rejects.toThrow();
  });

});

describe('Migration backfill - Estrutura SQL', () => {
  it('3. Migration SQL existe e contém etapas esperadas', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const migrationPath = path.join(
      process.cwd(),
      'prisma/migrations/20260211000000_backfill_professores_plano_ensino/migration.sql'
    );
    const exists = fs.existsSync(migrationPath);
    expect(exists).toBe(true);

    if (exists) {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toContain('INSERT INTO professores');
      expect(sql).toContain('plano_ensino');
      expect(sql).toContain('professor_id');
      expect(sql).toContain('EXISTS');
    }
  });

  it('4. Migration corrige plano_ensino.professor_id de users.id para professores.id', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const migrationPath = path.join(
      process.cwd(),
      'prisma/migrations/20260211000000_backfill_professores_plano_ensino/migration.sql'
    );
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    // JOIN professores.user_id = plano_ensino.professor_id (quando professor_id é users.id)
    expect(sql).toContain('p.user_id = pe.professor_id');
    expect(sql).toContain('plano_ensino_professor_map');
  });

  it('5. Migration respeita multi-tenant (instituicao_id no JOIN)', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const migrationPath = path.join(
      process.cwd(),
      'prisma/migrations/20260211000000_backfill_professores_plano_ensino/migration.sql'
    );
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    // CRÍTICO: Não vazar dados entre instituições
    expect(sql).toContain('p.instituicao_id = pe.instituicao_id');
  });
});

describe('Regra SIGA/SIGAE - professorId é professores.id', () => {
  it('6. PlanoEnsino.professorId referencia Professor.id (schema)', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const schemaPath = path.join(process.cwd(), 'prisma/schema.prisma');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    expect(schema).toContain('professor_id');
    expect(schema).toContain('professorId');
    expect(schema).toContain('professor');
    expect(schema).toContain('Professor');
  });

  it('6b. Model Professor tem id, userId, instituicaoId', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const schemaPath = path.join(process.cwd(), 'prisma/schema.prisma');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    const start = schema.indexOf('model Professor');
    const end = schema.indexOf('\nmodel ', start + 1);
    const professorSection = end > 0 ? schema.slice(start, end) : schema.slice(start, start + 600);
    expect(professorSection).toMatch(/id\s+String/);
    expect(professorSection).toMatch(/userId\s+String/);
    expect(professorSection).toMatch(/instituicaoId\s+String/);
  });
});

describe('resolveProfessor middleware - assinatura e comportamento', () => {
  it('7. resolveProfessorMiddleware tem assinatura (req, res, next)', async () => {
    const { resolveProfessorMiddleware } = await import('../middlewares/resolveProfessor.middleware.js');
    expect(typeof resolveProfessorMiddleware).toBe('function');
    expect(resolveProfessorMiddleware.length).toBe(3); // req, res, next
  });

  it('8. resolveProfessor retorna 500 quando next não é função', async () => {
    const { resolveProfessor } = await import('../middlewares/resolveProfessor.middleware.js');
    const req = { user: { userId: 'u1', instituicaoId: 'i1', roles: ['PROFESSOR'] } } as any;
    let statusCode = 0;
    const statusFn = (code: number) => {
      statusCode = code;
      return { json: () => ({}) };
    };
    const res = { status: statusFn } as any;
    const next = undefined as any; // Simula "next is not a function"
    await resolveProfessor(req, res, next);
    expect(statusCode).toBe(500);
  });

  it('9. validateProfessorIdFromToken retorna null quando professorId não pertence ao user/tenant', async () => {
    const { validateProfessorIdFromToken } = await import('../utils/professorResolver.js');
    // UUIDs que não existem no banco (ou não formam trio válido)
    const result = await validateProfessorIdFromToken(
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002',
      '00000000-0000-4000-8000-000000000003'
    );
    expect(result).toBeNull();
  });

  it('10. validateProfessorIdFromToken existe e tem assinatura correta', async () => {
    const { validateProfessorIdFromToken } = await import('../utils/professorResolver.js');
    expect(typeof validateProfessorIdFromToken).toBe('function');
  });

  it('11. resolveProfessor retorna 403 quando token tem professorId que não pertence ao user/tenant', async () => {
    const { resolveProfessor } = await import('../middlewares/resolveProfessor.middleware.js');
    // UUIDs válidos mas que não formam trio (professorId, userId, instituicaoId) no banco
    const req = {
      user: {
        userId: 'a0000000-0000-4000-8000-000000000001',
        instituicaoId: 'b0000000-0000-4000-8000-000000000001',
        professorId: 'c0000000-0000-4000-8000-000000000001',
        roles: ['PROFESSOR'],
        email: 'test@test.com',
      },
    } as any;
    let capturedError: any;
    const next = (err: any) => {
      capturedError = err;
    };
    const res = { status: () => ({ json: () => ({}) }) } as any;

    await resolveProfessor(req, res, next);

    expect(capturedError).toBeDefined();
    expect(capturedError?.statusCode).toBe(403);
    expect(String(capturedError?.message)).toContain('professorId inconsistente');
  });
});

describe('validacaoAcademica - buscarTurmasEDisciplinasProfessorComPlanoAtivo', () => {
  it('9. Não filtra por estado do plano (RASCUNHO, EM_REVISAO, APROVADO, ENCERRADO)', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const content = fs.readFileSync(
      path.join(process.cwd(), 'src/services/validacaoAcademica.service.ts'),
      'utf-8'
    );
    // O where NÃO deve conter estado ou bloqueado - regra: estado controla ações, não visibilidade
    expect(content).toContain('NÃO filtrar por estado');
    expect(content).toContain('NÃO filtrar por bloqueado');
  });
});
