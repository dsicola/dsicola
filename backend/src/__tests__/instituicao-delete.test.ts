/**
 * Testes de exclusão de instituição com termo de responsabilidade
 * Verifica que DELETE /instituicoes/:id exige justificativa e grava em auditoria.
 *
 * Execute: npx vitest run src/__tests__/instituicao-delete.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import prisma from '../lib/prisma.js';
import bcrypt from 'bcryptjs';

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'superadmin@dsicola.com';
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@123';

let superAdminToken: string;
let instToDeleteId: string;

describe('Exclusão de instituição com justificativa', () => {
  beforeAll(async () => {
    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email: SUPER_ADMIN_EMAIL, password: SUPER_ADMIN_PASSWORD });
    if (loginRes.status !== 200) {
      throw new Error(`Login falhou: ${loginRes.body?.message || 'sem token'}`);
    }
    superAdminToken = loginRes.body.accessToken;

    const inst = await prisma.instituicao.create({
      data: {
        nome: 'Instituição para Exclusão (Teste)',
        subdominio: `inst-delete-test-${Date.now()}`,
        tipoInstituicao: 'EM_CONFIGURACAO',
        status: 'ativa',
      },
    });
    instToDeleteId = inst.id;
  });

  afterAll(async () => {
    await prisma.instituicao.deleteMany({ where: { subdominio: { startsWith: 'inst-delete-test-' } } });
  });

  it('DELETE sem justificativa retorna 400', async () => {
    const inst = await prisma.instituicao.create({
      data: {
        nome: 'Inst sem justificativa',
        subdominio: `inst-delete-test-no-just-${Date.now()}`,
        tipoInstituicao: 'EM_CONFIGURACAO',
        status: 'ativa',
      },
    });
    const res = await request(app)
      .delete(`/instituicoes/${inst.id}`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body?.message).toContain('Justificativa');
    await prisma.instituicao.delete({ where: { id: inst.id } }).catch(() => {});
  });

  it('DELETE com justificativa curta (< 10 chars) retorna 400', async () => {
    const inst = await prisma.instituicao.create({
      data: {
        nome: 'Inst justificativa curta',
        subdominio: `inst-delete-test-short-${Date.now()}`,
        tipoInstituicao: 'EM_CONFIGURACAO',
        status: 'ativa',
      },
    });
    const res = await request(app)
      .delete(`/instituicoes/${inst.id}`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ justificativa: 'Curta' });
    expect(res.status).toBe(400);
    expect(res.body?.message).toContain('Justificativa');
    await prisma.instituicao.delete({ where: { id: inst.id } }).catch(() => {});
  });

  it('DELETE com justificativa válida exclui e grava em auditoria', async () => {
    const justificativa = 'Teste de exclusão: instituição criada apenas para testes automatizados.';
    const res = await request(app)
      .delete(`/instituicoes/${instToDeleteId}`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ justificativa });
    expect(res.status).toBe(200);
    expect(res.body?.message).toContain('excluída');

    const instituicao = await prisma.instituicao.findUnique({ where: { id: instToDeleteId } });
    expect(instituicao).toBeNull();

    const log = await prisma.logAuditoria.findFirst({
      where: {
        entidade: 'INSTITUICAO',
        entidadeId: instToDeleteId,
        acao: 'DELETE',
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(log).toBeTruthy();
    expect(log?.observacao).toContain(justificativa);
  });
});
