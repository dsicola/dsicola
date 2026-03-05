/**
 * Testes de integração: Campus + Configurações Instituição
 * Garante: multi-tenant, isolamento cross-tenant, ambos tipos (SECUNDARIO e SUPERIOR)
 *
 * Pré-requisitos: npm run db:seed (SUPER_ADMIN) e npm run seed:multi-tenant (inst A e B)
 *
 * Execute: npx vitest run src/__tests__/campus-config-multitenant.test.ts
 * Ou:     npm run seed:multi-tenant && npx vitest run src/__tests__/campus-config-multitenant.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import prisma from '../lib/prisma.js';
import bcrypt from 'bcryptjs';

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'superadmin@dsicola.com';
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@123';
const SENHA_ADMIN = 'TestMultiTenant123!';

let superAdminToken: string;
let adminAToken: string;
let adminBToken: string;
let instAId: string;
let instBId: string;
let campusA1Id: string;
let campusB1Id: string;

describe('Campus + Configurações: Multi-tenant e dois tipos de instituição', () => {
  beforeAll(async () => {
    const hashedPassword = await bcrypt.hash(SENHA_ADMIN, 10);

    // Instituição A (SECUNDARIO)
    let instA = await prisma.instituicao.findFirst({
      where: { subdominio: 'inst-a-secundario-test' },
    });
    if (!instA) {
      instA = await prisma.instituicao.create({
        data: {
          nome: 'Instituição A - Secundário (Teste Campus)',
          subdominio: 'inst-a-secundario-test',
          tipoInstituicao: 'ENSINO_MEDIO',
          tipoAcademico: 'SECUNDARIO',
          status: 'ativa',
        },
      });
    }
    instAId = instA.id;

    // Instituição B (SUPERIOR)
    let instB = await prisma.instituicao.findFirst({
      where: { subdominio: 'inst-b-superior-test' },
    });
    if (!instB) {
      instB = await prisma.instituicao.create({
        data: {
          nome: 'Instituição B - Superior (Teste Campus)',
          subdominio: 'inst-b-superior-test',
          tipoInstituicao: 'UNIVERSIDADE',
          tipoAcademico: 'SUPERIOR',
          status: 'ativa',
        },
      });
    }
    instBId = instB.id;

    // Garantir plano com multiCampus para testes de config
    let planoMultiCampus = await prisma.plano.findFirst({
      where: { multiCampus: true, ativo: true },
    });
    if (!planoMultiCampus) {
      planoMultiCampus = await prisma.plano.create({
        data: {
          nome: 'Plano Teste Multi-Campus',
          descricao: 'Para testes campus/config',
          valorMensal: 0,
          limiteAlunos: 2000,
          multiCampus: true,
          funcionalidades: ['gestao_alunos', 'gestao_professores', 'notas', 'frequencia', 'financeiro', 'documentos', 'comunicados', 'analytics', 'alojamentos'],
          ativo: true,
        },
      });
    }
    const umAno = new Date();
    umAno.setFullYear(umAno.getFullYear() + 1);
    for (const instId of [instAId, instBId]) {
      const ass = await prisma.assinatura.findUnique({ where: { instituicaoId: instId } });
      if (!ass) {
        await prisma.assinatura.create({
          data: {
            instituicaoId: instId,
            planoId: planoMultiCampus.id,
            status: 'ativa',
            tipo: 'PAGA',
            dataFim: umAno,
            dataProximoPagamento: umAno,
            valorAtual: 0,
          },
        });
      } else if (ass.planoId !== planoMultiCampus.id || ass.status !== 'ativa') {
        await prisma.assinatura.update({
          where: { id: ass.id },
          data: { planoId: planoMultiCampus.id, status: 'ativa' as any, dataFim: umAno, dataProximoPagamento: umAno },
        });
      }
    }

    // Admin A
    let adminA = await prisma.user.findUnique({
      where: { instituicaoId_email: { instituicaoId: instAId, email: 'admin.inst.a@teste.dsicola.com' } },
    });
    if (!adminA) {
      adminA = await prisma.user.create({
        data: {
          email: 'admin.inst.a@teste.dsicola.com',
          password: hashedPassword,
          nomeCompleto: 'Admin Inst A',
          instituicaoId: instAId,
          mustChangePassword: false,
        },
      });
      await prisma.userRole_.create({
        data: { userId: adminA.id, role: 'ADMIN', instituicaoId: instAId },
      });
    }

    // Admin B
    let adminB = await prisma.user.findUnique({
      where: { instituicaoId_email: { instituicaoId: instBId, email: 'admin.inst.b@teste.dsicola.com' } },
    });
    if (!adminB) {
      adminB = await prisma.user.create({
        data: {
          email: 'admin.inst.b@teste.dsicola.com',
          password: hashedPassword,
          nomeCompleto: 'Admin Inst B',
          instituicaoId: instBId,
          mustChangePassword: false,
        },
      });
      await prisma.userRole_.create({
        data: { userId: adminB.id, role: 'ADMIN', instituicaoId: instBId },
      });
    }

    // Login SUPER_ADMIN
    const loginSA = await request(app)
      .post('/auth/login')
      .set('Host', 'localhost')
      .send({ email: SUPER_ADMIN_EMAIL, password: SUPER_ADMIN_PASSWORD });
    if (loginSA.status !== 200) {
      throw new Error(`SUPER_ADMIN login failed: ${JSON.stringify(loginSA.body)}`);
    }
    superAdminToken = loginSA.body.accessToken;

    // Login Admin A (Host: localhost → tenantDomainMode ignored, permite login institucional)
    const loginA = await request(app)
      .post('/auth/login')
      .set('Host', 'localhost')
      .send({ email: 'admin.inst.a@teste.dsicola.com', password: SENHA_ADMIN });
    if (loginA.status !== 200) {
      throw new Error(`Admin A login failed: ${JSON.stringify(loginA.body)}`);
    }
    adminAToken = loginA.body.accessToken;

    // Login Admin B (Host: localhost → tenantDomainMode ignored, permite login institucional)
    const loginB = await request(app)
      .post('/auth/login')
      .set('Host', 'localhost')
      .send({ email: 'admin.inst.b@teste.dsicola.com', password: SENHA_ADMIN });
    if (loginB.status !== 200) {
      throw new Error(`Admin B login failed: ${JSON.stringify(loginB.body)}`);
    }
    adminBToken = loginB.body.accessToken;
  });

  afterAll(async () => {
    // Limpar campus criados nos testes
    if (campusA1Id) {
      await prisma.campus.deleteMany({ where: { id: campusA1Id } }).catch(() => {});
    }
    if (campusB1Id) {
      await prisma.campus.deleteMany({ where: { id: campusB1Id } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  describe('Campus: Multi-tenant (instituição)', () => {
    it('Admin A (SECUNDARIO) cria campus na sua instituição', async () => {
      const res = await request(app)
        .post('/campus')
        .set('Authorization', `Bearer ${adminAToken}`)
        .set('Host', 'localhost')
        .send({ nome: 'Campus Principal A', codigo: 'CPA' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.nome).toBe('Campus Principal A');
      expect(res.body.instituicaoId).toBe(instAId);
      campusA1Id = res.body.id;
    });

    it('Admin B (SUPERIOR) cria campus na sua instituição', async () => {
      const res = await request(app)
        .post('/campus')
        .set('Authorization', `Bearer ${adminBToken}`)
        .set('Host', 'localhost')
        .send({ nome: 'Campus Benguela B', codigo: 'CBB' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.nome).toBe('Campus Benguela B');
      expect(res.body.instituicaoId).toBe(instBId);
      campusB1Id = res.body.id;
    });

    it('Admin A lista apenas campus da instituição A (multi-tenant)', async () => {
      const res = await request(app)
        .get('/campus')
        .set('Authorization', `Bearer ${adminAToken}`)
        .set('Host', 'localhost');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const ids = res.body.map((c: { instituicaoId: string }) => c.instituicaoId);
      expect(ids.every((id: string) => id === instAId)).toBe(true);
      expect(res.body.some((c: { id: string }) => c.id === campusA1Id)).toBe(true);
      expect(res.body.some((c: { id: string }) => c.id === campusB1Id)).toBe(false);
    });

    it('Admin B lista apenas campus da instituição B (multi-tenant)', async () => {
      const res = await request(app)
        .get('/campus')
        .set('Authorization', `Bearer ${adminBToken}`)
        .set('Host', 'localhost');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const ids = res.body.map((c: { instituicaoId: string }) => c.instituicaoId);
      expect(ids.every((id: string) => id === instBId)).toBe(true);
      expect(res.body.some((c: { id: string }) => c.id === campusB1Id)).toBe(true);
      expect(res.body.some((c: { id: string }) => c.id === campusA1Id)).toBe(false);
    });

    it('Admin A não pode acessar campus da instituição B (cross-tenant)', async () => {
      const res = await request(app)
        .get(`/campus/${campusB1Id}`)
        .set('Authorization', `Bearer ${adminAToken}`)
        .set('Host', 'localhost');

      expect(res.status).toBe(404);
    });

    it('Admin B não pode acessar campus da instituição A (cross-tenant)', async () => {
      const res = await request(app)
        .get(`/campus/${campusA1Id}`)
        .set('Authorization', `Bearer ${adminBToken}`)
        .set('Host', 'localhost');

      expect(res.status).toBe(404);
    });

    it('Admin A não pode atualizar campus da instituição B', async () => {
      const res = await request(app)
        .put(`/campus/${campusB1Id}`)
        .set('Authorization', `Bearer ${adminAToken}`)
        .set('Host', 'localhost')
        .send({ nome: 'Tentativa Cross-Tenant' });

      expect(res.status).toBe(404);
    });

    it('Admin A não pode excluir campus da instituição B', async () => {
      const res = await request(app)
        .delete(`/campus/${campusB1Id}`)
        .set('Authorization', `Bearer ${adminAToken}`)
        .set('Host', 'localhost');

      expect(res.status).toBe(404);
    });

    it('Rejeita instituicaoId no body (segurança)', async () => {
      const res = await request(app)
        .post('/campus')
        .set('Authorization', `Bearer ${adminAToken}`)
        .set('Host', 'localhost')
        .send({ nome: 'Campus Fake', instituicaoId: instBId });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/não é permitido|instituição/i);
    });
  });

  describe('Configurações: multiCampus (instituição)', () => {
    it('Admin A (SECUNDARIO) obtém config e pode ter multiCampus', async () => {
      const res = await request(app)
        .get('/configuracoes-instituicao')
        .set('Authorization', `Bearer ${adminAToken}`)
        .set('Host', 'localhost');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('instituicaoId', instAId);
      expect(res.body).toHaveProperty('nomeInstituicao');
      expect(res.body).toHaveProperty('multiCampus');
    });

    it('Admin A atualiza multiCampus para true', async () => {
      const res = await request(app)
        .put('/configuracoes-instituicao')
        .set('Authorization', `Bearer ${adminAToken}`)
        .set('Host', 'localhost')
        .send({ multiCampus: true });

      expect(res.status).toBe(200);
      expect(res.body.multiCampus).toBe(true);
    });

    it('Admin B (SUPERIOR) obtém config da sua instituição', async () => {
      const res = await request(app)
        .get('/configuracoes-instituicao')
        .set('Authorization', `Bearer ${adminBToken}`)
        .set('Host', 'localhost');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('instituicaoId', instBId);
      expect(res.body).toHaveProperty('multiCampus');
    });

    it('Admin B atualiza multiCampus para true (independente de A)', async () => {
      const res = await request(app)
        .put('/configuracoes-instituicao')
        .set('Authorization', `Bearer ${adminBToken}`)
        .set('Host', 'localhost')
        .send({ multiCampus: true });

      expect(res.status).toBe(200);
      expect(res.body.multiCampus).toBe(true);
    });
  });

  describe('Super-admin: Configurações de ambas instituições', () => {
    it('SUPER_ADMIN obtém config da instituição A com ?instituicaoId', async () => {
      const res = await request(app)
        .get(`/configuracoes-instituicao?instituicaoId=${instAId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .set('Host', 'localhost');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('instituicaoId', instAId);
      expect(res.body).toHaveProperty('multiCampus');
    });

    it('SUPER_ADMIN obtém config da instituição B com ?instituicaoId', async () => {
      const res = await request(app)
        .get(`/configuracoes-instituicao?instituicaoId=${instBId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .set('Host', 'localhost');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('instituicaoId', instBId);
    });

    it('SUPER_ADMIN atualiza multiCampus da instituição A', async () => {
      const res = await request(app)
        .put(`/configuracoes-instituicao?instituicaoId=${instAId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .set('Host', 'localhost')
        .send({ multiCampus: false, nomeInstituicao: 'Inst A - Config SA' });

      expect(res.status).toBe(200);
      expect(res.body.nomeInstituicao).toBe('Inst A - Config SA');
    });

    it('SUPER_ADMIN atualiza multiCampus da instituição B', async () => {
      const res = await request(app)
        .put(`/configuracoes-instituicao?instituicaoId=${instBId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .set('Host', 'localhost')
        .send({ multiCampus: false, nomeInstituicao: 'Inst B - Config SA' });

      expect(res.status).toBe(200);
      expect(res.body.nomeInstituicao).toBe('Inst B - Config SA');
    });

    it('SUPER_ADMIN sem instituicaoId retorna 403', async () => {
      const res = await request(app)
        .get('/configuracoes-instituicao')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .set('Host', 'localhost');

      expect(res.status).toBe(403);
    });
  });

  describe('Dois tipos de instituição (SECUNDARIO / SUPERIOR)', () => {
    it('Instituição A tem tipoAcademico SECUNDARIO', async () => {
      const inst = await prisma.instituicao.findUnique({
        where: { id: instAId },
        select: { tipoAcademico: true },
      });
      expect(inst?.tipoAcademico).toBe('SECUNDARIO');
    });

    it('Instituição B tem tipoAcademico SUPERIOR', async () => {
      const inst = await prisma.instituicao.findUnique({
        where: { id: instBId },
        select: { tipoAcademico: true },
      });
      expect(inst?.tipoAcademico).toBe('SUPERIOR');
    });

    it('Campus criados pertencem às instituições corretas', async () => {
      const campusA = await prisma.campus.findUnique({
        where: { id: campusA1Id },
        include: { instituicao: { select: { tipoAcademico: true } } },
      });
      const campusB = await prisma.campus.findUnique({
        where: { id: campusB1Id },
        include: { instituicao: { select: { tipoAcademico: true } } },
      });
      expect(campusA?.instituicao.tipoAcademico).toBe('SECUNDARIO');
      expect(campusB?.instituicao.tipoAcademico).toBe('SUPERIOR');
    });
  });
});
