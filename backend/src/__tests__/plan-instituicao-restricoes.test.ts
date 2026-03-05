/**
 * Testes de restrições por plano da instituição
 * Verifica que /stats/uso-instituicao retorna funcionalidades e multiCampus corretos
 * conforme o plano de cada instituição.
 *
 * Execute: npx vitest run src/__tests__/plan-instituicao-restricoes.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import prisma from '../lib/prisma.js';
import bcrypt from 'bcryptjs';

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'superadmin@dsicola.com';
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@123';
const SENHA_ADMIN = 'TestRestricoes123!';

let adminRestritoToken: string;
let adminCompletoToken: string;
let instRestritoId: string;
let instCompletoId: string;

describe('Restrições por plano da instituição', () => {
  beforeAll(async () => {
    const hashedPassword = await bcrypt.hash(SENHA_ADMIN, 10);

    // Plano BÁSICO: sem comunicados, alojamentos, analytics, multiCampus
    let planoBasico = await prisma.plano.findFirst({
      where: {
        nome: 'Plano Teste Restrito',
        ativo: true,
      },
    });
    if (!planoBasico) {
      planoBasico = await prisma.plano.create({
        data: {
          nome: 'Plano Teste Restrito',
          descricao: 'Plano básico para testes de restrições',
          valorMensal: 0,
          limiteAlunos: 100,
          limiteProfessores: 10,
          limiteCursos: 5,
          multiCampus: false,
          funcionalidades: ['gestao_alunos', 'gestao_professores', 'notas', 'frequencia', 'financeiro', 'documentos'],
          ativo: true,
        },
      });
    }

    // Plano COMPLETO: com comunicados, alojamentos, analytics, multiCampus
    let planoCompleto = await prisma.plano.findFirst({
      where: {
        nome: 'Plano Teste Completo',
        ativo: true,
      },
    });
    if (!planoCompleto) {
      planoCompleto = await prisma.plano.create({
        data: {
          nome: 'Plano Teste Completo',
          descricao: 'Plano completo para testes de restrições',
          valorMensal: 0,
          limiteAlunos: 2000,
          limiteProfessores: 100,
          limiteCursos: 50,
          multiCampus: true,
          funcionalidades: ['gestao_alunos', 'gestao_professores', 'notas', 'frequencia', 'financeiro', 'documentos', 'comunicados', 'analytics', 'alojamentos'],
          ativo: true,
        },
      });
    }

    // Instituição com plano RESTRITO
    let instRestrito = await prisma.instituicao.findFirst({
      where: { subdominio: 'inst-restrito-test' },
    });
    if (!instRestrito) {
      instRestrito = await prisma.instituicao.create({
        data: {
          nome: 'Instituição Restrita (Teste)',
          subdominio: 'inst-restrito-test',
          tipoInstituicao: 'ENSINO_MEDIO',
          tipoAcademico: 'SECUNDARIO',
          status: 'ativa',
        },
      });
    }
    instRestritoId = instRestrito.id;

    // Instituição com plano COMPLETO
    let instCompleto = await prisma.instituicao.findFirst({
      where: { subdominio: 'inst-completo-test' },
    });
    if (!instCompleto) {
      instCompleto = await prisma.instituicao.create({
        data: {
          nome: 'Instituição Completa (Teste)',
          subdominio: 'inst-completo-test',
          tipoInstituicao: 'UNIVERSIDADE',
          tipoAcademico: 'SUPERIOR',
          status: 'ativa',
        },
      });
    }
    instCompletoId = instCompleto.id;

    const umAno = new Date();
    umAno.setFullYear(umAno.getFullYear() + 1);

    // Assinatura restrita
    let assRestrito = await prisma.assinatura.findUnique({ where: { instituicaoId: instRestritoId } });
    if (!assRestrito) {
      await prisma.assinatura.create({
        data: {
          instituicaoId: instRestritoId,
          planoId: planoBasico.id,
          status: 'ativa',
          tipo: 'PAGA',
          dataFim: umAno,
          dataProximoPagamento: umAno,
          valorAtual: 0,
        },
      });
    } else {
      await prisma.assinatura.update({
        where: { id: assRestrito.id },
        data: { planoId: planoBasico.id, status: 'ativa' as any },
      });
    }

    // Assinatura completa
    let assCompleto = await prisma.assinatura.findUnique({ where: { instituicaoId: instCompletoId } });
    if (!assCompleto) {
      await prisma.assinatura.create({
        data: {
          instituicaoId: instCompletoId,
          planoId: planoCompleto.id,
          status: 'ativa',
          tipo: 'PAGA',
          dataFim: umAno,
          dataProximoPagamento: umAno,
          valorAtual: 0,
        },
      });
    } else {
      await prisma.assinatura.update({
        where: { id: assCompleto.id },
        data: { planoId: planoCompleto.id, status: 'ativa' as any },
      });
    }

    // Admin instituição restrita
    let adminRestrito = await prisma.user.findUnique({
      where: { instituicaoId_email: { instituicaoId: instRestritoId, email: 'admin.restrito@teste.dsicola.com' } },
    });
    if (!adminRestrito) {
      adminRestrito = await prisma.user.create({
        data: {
          email: 'admin.restrito@teste.dsicola.com',
          password: hashedPassword,
          nomeCompleto: 'Admin Restrito',
          instituicaoId: instRestritoId,
          mustChangePassword: false,
        },
      });
      await prisma.userRole_.create({
        data: { userId: adminRestrito.id, role: 'ADMIN', instituicaoId: instRestritoId },
      });
    }

    // Admin instituição completa
    let adminCompleto = await prisma.user.findUnique({
      where: { instituicaoId_email: { instituicaoId: instCompletoId, email: 'admin.completo@teste.dsicola.com' } },
    });
    if (!adminCompleto) {
      adminCompleto = await prisma.user.create({
        data: {
          email: 'admin.completo@teste.dsicola.com',
          password: hashedPassword,
          nomeCompleto: 'Admin Completo',
          instituicaoId: instCompletoId,
          mustChangePassword: false,
        },
      });
      await prisma.userRole_.create({
        data: { userId: adminCompleto.id, role: 'ADMIN', instituicaoId: instCompletoId },
      });
    }

    // Login Admin Restrito
    const loginRestrito = await request(app)
      .post('/auth/login')
      .set('Host', 'localhost')
      .send({ email: 'admin.restrito@teste.dsicola.com', password: SENHA_ADMIN });
    if (loginRestrito.status !== 200) {
      throw new Error(`Admin Restrito login failed: ${JSON.stringify(loginRestrito.body)}`);
    }
    adminRestritoToken = loginRestrito.body.accessToken;

    // Login Admin Completo
    const loginCompleto = await request(app)
      .post('/auth/login')
      .set('Host', 'localhost')
      .send({ email: 'admin.completo@teste.dsicola.com', password: SENHA_ADMIN });
    if (loginCompleto.status !== 200) {
      throw new Error(`Admin Completo login failed: ${JSON.stringify(loginCompleto.body)}`);
    }
    adminCompletoToken = loginCompleto.body.accessToken;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('GET /stats/uso-instituicao - funcionalidades e multiCampus', () => {
    it('Instituição com plano restrito: retorna funcionalidades limitadas e multiCampus false', async () => {
      const res = await request(app)
        .get('/stats/uso-instituicao')
        .set('Authorization', `Bearer ${adminRestritoToken}`)
        .set('Host', 'localhost');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('funcionalidades');
      expect(res.body).toHaveProperty('multiCampus');
      expect(res.body).toHaveProperty('plano_nome');

      expect(Array.isArray(res.body.funcionalidades)).toBe(true);
      const funcs = res.body.funcionalidades as string[];

      // Deve ter as funcionalidades básicas
      expect(funcs).toContain('gestao_alunos');
      expect(funcs).toContain('gestao_professores');
      expect(funcs).toContain('notas');
      expect(funcs).toContain('frequencia');
      expect(funcs).toContain('financeiro');
      expect(funcs).toContain('documentos');

      // NÃO deve ter comunicados, alojamentos, analytics
      expect(funcs).not.toContain('comunicados');
      expect(funcs).not.toContain('alojamentos');
      expect(funcs).not.toContain('analytics');

      expect(res.body.multiCampus).toBe(false);
      expect(res.body.plano_nome).toContain('Restrito');
    });

    it('Instituição com plano completo: retorna todas as funcionalidades e multiCampus true', async () => {
      const res = await request(app)
        .get('/stats/uso-instituicao')
        .set('Authorization', `Bearer ${adminCompletoToken}`)
        .set('Host', 'localhost');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('funcionalidades');
      expect(res.body).toHaveProperty('multiCampus');
      expect(res.body).toHaveProperty('plano_nome');

      expect(Array.isArray(res.body.funcionalidades)).toBe(true);
      const funcs = res.body.funcionalidades as string[];

      // Deve ter comunicados, alojamentos, analytics
      expect(funcs).toContain('comunicados');
      expect(funcs).toContain('alojamentos');
      expect(funcs).toContain('analytics');

      expect(res.body.multiCampus).toBe(true);
      expect(res.body.plano_nome).toContain('Completo');
    });

    it('Resposta inclui limites e contagens (alunos, professores, cursos)', async () => {
      const res = await request(app)
        .get('/stats/uso-instituicao')
        .set('Authorization', `Bearer ${adminRestritoToken}`)
        .set('Host', 'localhost');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('alunos_atual');
      expect(res.body).toHaveProperty('alunos_limite');
      expect(res.body).toHaveProperty('professores_atual');
      expect(res.body).toHaveProperty('professores_limite');
      expect(res.body).toHaveProperty('cursos_atual');
      expect(res.body).toHaveProperty('cursos_limite');
      expect(res.body).toHaveProperty('assinatura_status');
    });
  });

  describe('Validação de API por plano (license middleware)', () => {
    it('Instituição restrita: /alojamentos retorna 403 (plano sem alojamentos)', async () => {
      const res = await request(app)
        .get('/alojamentos')
        .set('Authorization', `Bearer ${adminRestritoToken}`)
        .set('Host', 'localhost');

      expect(res.status).toBe(403);
      expect(res.body?.message).toMatch(/alojamento|plano/i);
    });

    it('Instituição completa: /alojamentos retorna 200 (plano com alojamentos)', async () => {
      const res = await request(app)
        .get('/alojamentos')
        .set('Authorization', `Bearer ${adminCompletoToken}`)
        .set('Host', 'localhost');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('Instituição restrita: /comunicados retorna 403 (plano sem comunicados)', async () => {
      const res = await request(app)
        .get('/comunicados')
        .set('Authorization', `Bearer ${adminRestritoToken}`)
        .set('Host', 'localhost');

      expect(res.status).toBe(403);
      expect(res.body?.message).toMatch(/comunicado|plano/i);
    });

    it('Instituição completa: /comunicados retorna 200 (plano com comunicados)', async () => {
      const res = await request(app)
        .get('/comunicados')
        .set('Authorization', `Bearer ${adminCompletoToken}`)
        .set('Host', 'localhost');

      expect(res.status).toBe(200);
    });
  });
});
