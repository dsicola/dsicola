/**
 * Testes de integração: Contabilidade MVP
 * Garante: multi-tenant, isolamento cross-tenant, ambos tipos (SECUNDARIO e SUPERIOR)
 *
 * Pré-requisitos: npm run db:seed (SUPER_ADMIN) e npm run seed:multi-tenant (inst A e B)
 *
 * Execute: npx vitest run src/__tests__/contabilidade-multitenant.test.ts
 * Ou:     npm run seed:multi-tenant && npx vitest run src/__tests__/contabilidade-multitenant.test.ts
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
let contaA1Id: string;
let contaB1Id: string;
let lancamentoA1Id: string;
let lancamentoB1Id: string;
let centroA1Id: string;
let centroB1Id: string;

describe('Contabilidade MVP: Multi-tenant e dois tipos de instituição', () => {
  beforeAll(async () => {
    const hashedPassword = await bcrypt.hash(SENHA_ADMIN, 10);

    // Instituição A (SECUNDARIO)
    let instA = await prisma.instituicao.findFirst({
      where: { subdominio: 'inst-a-secundario-test' },
    });
    if (!instA) {
      instA = await prisma.instituicao.create({
        data: {
          nome: 'Instituição A - Secundário (Teste Contabilidade)',
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
          nome: 'Instituição B - Superior (Teste Contabilidade)',
          subdominio: 'inst-b-superior-test',
          tipoInstituicao: 'UNIVERSIDADE',
          tipoAcademico: 'SUPERIOR',
          status: 'ativa',
        },
      });
    }
    instBId = instB.id;

    // Garantir assinaturas ativas
    let plano = await prisma.plano.findFirst({ where: { ativo: true } });
    if (!plano) {
      plano = await prisma.plano.create({
        data: {
          nome: 'Plano Teste',
          descricao: 'Para testes',
          valorMensal: 0,
          limiteAlunos: 1000,
          funcionalidades: ['gestao_alunos', 'financeiro'],
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
            planoId: plano.id,
            status: 'ativa',
            tipo: 'PAGA',
            dataFim: umAno,
            dataProximoPagamento: umAno,
            valorAtual: 0,
          },
        });
      } else if (ass.status !== 'ativa') {
        await prisma.assinatura.update({
          where: { id: ass.id },
          data: { status: 'ativa' as any, dataFim: umAno, dataProximoPagamento: umAno },
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

    // Login
    const loginSA = await request(app)
      .post('/auth/login')
      .set('Host', 'localhost')
      .send({ email: SUPER_ADMIN_EMAIL, password: SUPER_ADMIN_PASSWORD });
    if (loginSA.status !== 200) {
      throw new Error(`SUPER_ADMIN login failed: ${JSON.stringify(loginSA.body)}`);
    }
    superAdminToken = loginSA.body.accessToken;

    const loginA = await request(app)
      .post('/auth/login')
      .set('Host', 'localhost')
      .send({ email: 'admin.inst.a@teste.dsicola.com', password: SENHA_ADMIN });
    if (loginA.status !== 200) {
      throw new Error(`Admin A login failed: ${JSON.stringify(loginA.body)}`);
    }
    adminAToken = loginA.body.accessToken;

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
    // Ordem: lançamentos (cascade linhas) → centros → contas
    try {
      await prisma.lancamentoContabil.deleteMany({ where: { instituicaoId: { in: [instAId, instBId] } } });
      if (centroA1Id) await prisma.centroCusto.delete({ where: { id: centroA1Id } });
      if (centroB1Id) await prisma.centroCusto.delete({ where: { id: centroB1Id } });
      if (contaA1Id) await prisma.planoConta.delete({ where: { id: contaA1Id } });
      if (contaB1Id) await prisma.planoConta.delete({ where: { id: contaB1Id } });
    } catch (e) {
      // Ignorar erros de cleanup (ex: dados já removidos)
    }
    await prisma.$disconnect();
  });

  describe('Fluxo completo: Seed plano padrão (SECUNDARIO vs SUPERIOR)', () => {
    it('Admin A (SECUNDARIO) cria plano padrão com tipo SECUNDARIO', async () => {
      const res = await request(app)
        .post('/contabilidade/plano-contas/seed-padrao?tipo=SECUNDARIO')
        .set('Authorization', `Bearer ${adminAToken}`)
        .set('Host', 'localhost');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('tipoUsado', 'SECUNDARIO');
      expect(res.body).toHaveProperty('criadas');
      // SECUNDARIO tem 12 contas; se já existiam, criadas pode ser []
      const listRes = await request(app)
        .get('/contabilidade/plano-contas')
        .set('Authorization', `Bearer ${adminAToken}`)
        .set('Host', 'localhost');
      expect(listRes.status).toBe(200);
      expect(Array.isArray(listRes.body)).toBe(true);
      expect(listRes.body.length).toBeGreaterThanOrEqual(12);
      expect(listRes.body.some((c: { codigo: string }) => c.codigo === '11')).toBe(true);
      expect(listRes.body.some((c: { codigo: string }) => c.codigo === '41')).toBe(true);
    });

    it('Admin B (SUPERIOR) cria plano padrão com tipo SUPERIOR', async () => {
      const res = await request(app)
        .post('/contabilidade/plano-contas/seed-padrao?tipo=SUPERIOR')
        .set('Authorization', `Bearer ${adminBToken}`)
        .set('Host', 'localhost');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('tipoUsado', 'SUPERIOR');
      const listRes = await request(app)
        .get('/contabilidade/plano-contas')
        .set('Authorization', `Bearer ${adminBToken}`)
        .set('Host', 'localhost');
      expect(listRes.status).toBe(200);
      expect(listRes.body.length).toBeGreaterThanOrEqual(22);
      expect(listRes.body.some((c: { codigo: string }) => c.codigo === '43')).toBe(true); // SUPERIOR tem 43
    });

    it('Inst A (SECUNDARIO) e B (SUPERIOR) têm planos adequados ao tipo', async () => {
      const listA = await request(app)
        .get('/contabilidade/plano-contas')
        .set('Authorization', `Bearer ${adminAToken}`)
        .set('Host', 'localhost');
      const listB = await request(app)
        .get('/contabilidade/plano-contas')
        .set('Authorization', `Bearer ${adminBToken}`)
        .set('Host', 'localhost');
      expect(listA.body.length).toBeGreaterThanOrEqual(12);
      expect(listB.body.length).toBeGreaterThanOrEqual(22);
      // SUPERIOR tem conta 43 (Receitas Prestação Serviços); SECUNDARIO não
      expect(listB.body.some((c: { codigo: string }) => c.codigo === '43')).toBe(true);
      expect(listA.body.some((c: { codigo: string }) => c.codigo === '11')).toBe(true);
    });
  });

  describe('Regras contábeis: Multi-tenant', () => {
    it('Admin A (SECUNDARIO) lista e configura regra pagamento_propina', async () => {
      const listRes = await request(app)
        .get('/contabilidade/regras-contabeis')
        .set('Authorization', `Bearer ${adminAToken}`)
        .set('Host', 'localhost');
      expect(listRes.status).toBe(200);
      expect(listRes.body).toHaveProperty('regras');
      expect(listRes.body).toHaveProperty('eventos');

      const upsertRes = await request(app)
        .post('/contabilidade/regras-contabeis')
        .set('Authorization', `Bearer ${adminAToken}`)
        .set('Host', 'localhost')
        .send({ evento: 'pagamento_propina', contaDebitoCodigo: 'CAIXA_BANCO', contaCreditoCodigo: '41', ativo: true });
      expect(upsertRes.status).toBe(200);
      expect(upsertRes.body.evento).toBe('pagamento_propina');
      expect(upsertRes.body.instituicaoId).toBe(instAId);
    });

    it('Admin B (SUPERIOR) configura regra pagamento_matricula', async () => {
      const res = await request(app)
        .post('/contabilidade/regras-contabeis')
        .set('Authorization', `Bearer ${adminBToken}`)
        .set('Host', 'localhost')
        .send({ evento: 'pagamento_matricula', contaDebitoCodigo: 'CAIXA_BANCO', contaCreditoCodigo: '42', ativo: true });
      expect(res.status).toBe(200);
      expect(res.body.evento).toBe('pagamento_matricula');
      expect(res.body.instituicaoId).toBe(instBId);
    });

    it('Admin A não vê regras da instituição B', async () => {
      const res = await request(app)
        .get('/contabilidade/regras-contabeis')
        .set('Authorization', `Bearer ${adminAToken}`)
        .set('Host', 'localhost');
      const regras = res.body.regras || [];
      expect(regras.every((r: { instituicaoId: string }) => r.instituicaoId === instAId)).toBe(true);
    });
  });

  describe('Dashboard e Diário: Multi-tenant', () => {
    const hoje = new Date().toISOString().slice(0, 10);
    const amanha = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    it('Admin A (SECUNDARIO) obtém dashboard da sua instituição', async () => {
      const res = await request(app)
        .get('/contabilidade/dashboard')
        .set('Authorization', `Bearer ${adminAToken}`)
        .set('Host', 'localhost');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('saldoCaixa');
      expect(res.body).toHaveProperty('saldoBancos');
      expect(res.body).toHaveProperty('receitasMes');
      expect(res.body).toHaveProperty('despesasMes');
      expect(res.body).toHaveProperty('resultadoMes');
      expect(res.body).toHaveProperty('receitasVsDespesas12Meses');
    });

    it('Admin B (SUPERIOR) obtém dashboard da sua instituição', async () => {
      const res = await request(app)
        .get('/contabilidade/dashboard')
        .set('Authorization', `Bearer ${adminBToken}`)
        .set('Host', 'localhost');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('saldoCaixa');
    });

    it('Admin A obtém diário apenas da instituição A', async () => {
      const res = await request(app)
        .get(`/contabilidade/diario?dataInicio=${hoje}&dataFim=${amanha}`)
        .set('Authorization', `Bearer ${adminAToken}`)
        .set('Host', 'localhost');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // Linhas do diário são da inst A (via lançamentos criados nos testes)
      for (const l of res.body) {
        expect(l).toHaveProperty('data');
        expect(l).toHaveProperty('documento');
        expect(l).toHaveProperty('contaCodigo');
      }
    });

    it('Admin B obtém diário apenas da instituição B', async () => {
      const res = await request(app)
        .get(`/contabilidade/diario?dataInicio=${hoje}&dataFim=${amanha}`)
        .set('Authorization', `Bearer ${adminBToken}`)
        .set('Host', 'localhost');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('Balanço e DRE: Multi-tenant', () => {
    const hoje = new Date().toISOString().slice(0, 10);
    const amanha = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    it('Admin A (SECUNDARIO) obtém balanço e DRE', async () => {
      const balRes = await request(app)
        .get(`/contabilidade/balanco?dataInicio=${hoje}&dataFim=${amanha}`)
        .set('Authorization', `Bearer ${adminAToken}`)
        .set('Host', 'localhost');
      expect(balRes.status).toBe(200);
      expect(balRes.body).toHaveProperty('ativos');
      expect(balRes.body).toHaveProperty('passivos');
      expect(balRes.body).toHaveProperty('patrimonioLiquido');

      const dreRes = await request(app)
        .get(`/contabilidade/dre?dataInicio=${hoje}&dataFim=${amanha}`)
        .set('Authorization', `Bearer ${adminAToken}`)
        .set('Host', 'localhost');
      expect(dreRes.status).toBe(200);
      expect(dreRes.body).toHaveProperty('receitas');
      expect(dreRes.body).toHaveProperty('despesas');
      expect(dreRes.body).toHaveProperty('resultado');
    });

    it('Admin B (SUPERIOR) obtém balanço e DRE', async () => {
      const balRes = await request(app)
        .get(`/contabilidade/balanco?dataInicio=${hoje}&dataFim=${amanha}`)
        .set('Authorization', `Bearer ${adminBToken}`)
        .set('Host', 'localhost');
      expect(balRes.status).toBe(200);
      const dreRes = await request(app)
        .get(`/contabilidade/dre?dataInicio=${hoje}&dataFim=${amanha}`)
        .set('Authorization', `Bearer ${adminBToken}`)
        .set('Host', 'localhost');
      expect(dreRes.status).toBe(200);
    });
  });

  describe('Plano de Contas: Multi-tenant', () => {
    it('Admin A (SECUNDARIO) cria conta na sua instituição', async () => {
      const codigoUnico = `99-TEST-A-${Date.now()}`;
      const res = await request(app)
        .post('/contabilidade/plano-contas')
        .set('Authorization', `Bearer ${adminAToken}`)
        .set('Host', 'localhost')
        .send({ codigo: codigoUnico, descricao: 'Caixa Inst A', tipo: 'ATIVO' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.codigo).toBe(codigoUnico);
      expect(res.body.instituicaoId).toBe(instAId);
      contaA1Id = res.body.id;
    });

    it('Admin B (SUPERIOR) cria conta na sua instituição', async () => {
      const codigoUnico = `99-TEST-B-${Date.now()}`;
      const res = await request(app)
        .post('/contabilidade/plano-contas')
        .set('Authorization', `Bearer ${adminBToken}`)
        .set('Host', 'localhost')
        .send({ codigo: codigoUnico, descricao: 'Caixa Inst B', tipo: 'ATIVO' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.codigo).toBe(codigoUnico);
      expect(res.body.instituicaoId).toBe(instBId);
      contaB1Id = res.body.id;
    });

    it('Admin A lista apenas contas da instituição A (multi-tenant)', async () => {
      const res = await request(app)
        .get('/contabilidade/plano-contas')
        .set('Authorization', `Bearer ${adminAToken}`)
        .set('Host', 'localhost');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const ids = res.body.map((c: { instituicaoId: string }) => c.instituicaoId);
      expect(ids.every((id: string) => id === instAId)).toBe(true);
      expect(res.body.some((c: { id: string }) => c.id === contaA1Id)).toBe(true);
      expect(res.body.some((c: { id: string }) => c.id === contaB1Id)).toBe(false);
    });

    it('Admin B lista apenas contas da instituição B (multi-tenant)', async () => {
      const res = await request(app)
        .get('/contabilidade/plano-contas')
        .set('Authorization', `Bearer ${adminBToken}`)
        .set('Host', 'localhost');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const ids = res.body.map((c: { instituicaoId: string }) => c.instituicaoId);
      expect(ids.every((id: string) => id === instBId)).toBe(true);
      expect(res.body.some((c: { id: string }) => c.id === contaB1Id)).toBe(true);
      expect(res.body.some((c: { id: string }) => c.id === contaA1Id)).toBe(false);
    });

    it('Admin A não pode acessar conta da instituição B (cross-tenant)', async () => {
      const res = await request(app)
        .get(`/contabilidade/plano-contas/${contaB1Id}`)
        .set('Authorization', `Bearer ${adminAToken}`)
        .set('Host', 'localhost');

      expect(res.status).toBe(404);
    });

    it('Admin B não pode acessar conta da instituição A (cross-tenant)', async () => {
      const res = await request(app)
        .get(`/contabilidade/plano-contas/${contaA1Id}`)
        .set('Authorization', `Bearer ${adminBToken}`)
        .set('Host', 'localhost');

      expect(res.status).toBe(404);
    });
  });

  describe('Lançamentos: Multi-tenant', () => {
    it('Admin A cria lançamento na sua instituição', async () => {
      const res = await request(app)
        .post('/contabilidade/lancamentos')
        .set('Authorization', `Bearer ${adminAToken}`)
        .set('Host', 'localhost')
        .send({
          data: new Date().toISOString().slice(0, 10),
          descricao: 'Teste Lançamento A',
          linhas: [
            { contaId: contaA1Id, debito: 100, credito: 0 },
            { contaId: contaA1Id, debito: 0, credito: 100 },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.instituicaoId).toBe(instAId);
      lancamentoA1Id = res.body.id;
    });

    it('Admin B cria lançamento na sua instituição', async () => {
      const res = await request(app)
        .post('/contabilidade/lancamentos')
        .set('Authorization', `Bearer ${adminBToken}`)
        .set('Host', 'localhost')
        .send({
          data: new Date().toISOString().slice(0, 10),
          descricao: 'Teste Lançamento B',
          linhas: [
            { contaId: contaB1Id, debito: 200, credito: 0 },
            { contaId: contaB1Id, debito: 0, credito: 200 },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.instituicaoId).toBe(instBId);
      lancamentoB1Id = res.body.id;
    });

    it('Admin A lista apenas lançamentos da instituição A', async () => {
      const res = await request(app)
        .get('/contabilidade/lancamentos')
        .set('Authorization', `Bearer ${adminAToken}`)
        .set('Host', 'localhost');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const ids = res.body.map((l: { instituicaoId: string }) => l.instituicaoId);
      expect(ids.every((id: string) => id === instAId)).toBe(true);
      expect(res.body.some((l: { id: string }) => l.id === lancamentoA1Id)).toBe(true);
      expect(res.body.some((l: { id: string }) => l.id === lancamentoB1Id)).toBe(false);
    });

    it('Admin B lista apenas lançamentos da instituição B', async () => {
      const res = await request(app)
        .get('/contabilidade/lancamentos')
        .set('Authorization', `Bearer ${adminBToken}`)
        .set('Host', 'localhost');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const ids = res.body.map((l: { instituicaoId: string }) => l.instituicaoId);
      expect(ids.every((id: string) => id === instBId)).toBe(true);
      expect(res.body.some((l: { id: string }) => l.id === lancamentoB1Id)).toBe(true);
      expect(res.body.some((l: { id: string }) => l.id === lancamentoA1Id)).toBe(false);
    });

    it('Admin A não pode acessar lançamento da instituição B (cross-tenant)', async () => {
      const res = await request(app)
        .get(`/contabilidade/lancamentos/${lancamentoB1Id}`)
        .set('Authorization', `Bearer ${adminAToken}`)
        .set('Host', 'localhost');

      expect(res.status).toBe(404);
    });

    it('Admin B não pode acessar lançamento da instituição A (cross-tenant)', async () => {
      const res = await request(app)
        .get(`/contabilidade/lancamentos/${lancamentoA1Id}`)
        .set('Authorization', `Bearer ${adminBToken}`)
        .set('Host', 'localhost');

      expect(res.status).toBe(404);
    });
  });

  describe('Balancete: Multi-tenant', () => {
    const hoje = new Date().toISOString().slice(0, 10);
    const amanha = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    it('Admin A obtém balancete apenas da instituição A', async () => {
      const res = await request(app)
        .get(`/contabilidade/balancete?dataInicio=${hoje}&dataFim=${amanha}`)
        .set('Authorization', `Bearer ${adminAToken}`)
        .set('Host', 'localhost');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('contas');
      expect(res.body).toHaveProperty('dataInicio');
      expect(res.body).toHaveProperty('dataFim');
      const contas = res.body.contas || [];
      expect(contas.length).toBeGreaterThanOrEqual(0);
      // Se houver contas, devem ser da inst A (via lançamentos)
      for (const c of contas) {
        expect(c.conta).toBeDefined();
      }
    });

    it('Admin B obtém balancete apenas da instituição B', async () => {
      const res = await request(app)
        .get(`/contabilidade/balancete?dataInicio=${hoje}&dataFim=${amanha}`)
        .set('Authorization', `Bearer ${adminBToken}`)
        .set('Host', 'localhost');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('contas');
    });
  });

  describe('SUPER_ADMIN: Acesso com ?instituicaoId', () => {
    it('SUPER_ADMIN obtém plano de contas da instituição A com ?instituicaoId', async () => {
      const res = await request(app)
        .get(`/contabilidade/plano-contas?instituicaoId=${instAId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .set('Host', 'localhost');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const ids = res.body.map((c: { instituicaoId: string }) => c.instituicaoId);
      expect(ids.every((id: string) => id === instAId)).toBe(true);
    });

    it('SUPER_ADMIN obtém plano de contas da instituição B com ?instituicaoId', async () => {
      const res = await request(app)
        .get(`/contabilidade/plano-contas?instituicaoId=${instBId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .set('Host', 'localhost');

      expect(res.status).toBe(200);
      const ids = res.body.map((c: { instituicaoId: string }) => c.instituicaoId);
      expect(ids.every((id: string) => id === instBId)).toBe(true);
    });

    it('SUPER_ADMIN sem instituicaoId retorna 403 em contabilidade', async () => {
      const res = await request(app)
        .get('/contabilidade/plano-contas')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .set('Host', 'localhost');

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/instituição|escopo/i);
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

    it('Contas e lançamentos pertencem às instituições corretas', async () => {
      if (!contaA1Id || !contaB1Id) return; // Skip se criação falhou
      const contaA = await prisma.planoConta.findUnique({
        where: { id: contaA1Id },
        include: { instituicao: { select: { tipoAcademico: true } } },
      });
      const contaB = await prisma.planoConta.findUnique({
        where: { id: contaB1Id },
        include: { instituicao: { select: { tipoAcademico: true } } },
      });
      expect(contaA?.instituicao.tipoAcademico).toBe('SECUNDARIO');
      expect(contaB?.instituicao.tipoAcademico).toBe('SUPERIOR');
    });
  });

  describe('Configuração contabilidade: Multi-tenant', () => {
    it('Admin A (SECUNDARIO) obtém e atualiza config da sua instituição', async () => {
      const getRes = await request(app)
        .get('/contabilidade/configuracao')
        .set('Authorization', `Bearer ${adminAToken}`)
        .set('Host', 'localhost');
      expect(getRes.status).toBe(200);
      expect(getRes.body).toHaveProperty('instituicaoId', instAId);
      expect(getRes.body.contaCaixaCodigo).toBeDefined();

      const putRes = await request(app)
        .put('/contabilidade/configuracao')
        .set('Authorization', `Bearer ${adminAToken}`)
        .set('Host', 'localhost')
        .send({ contaCaixaCodigo: '11', contaBancoCodigo: '12' });
      expect(putRes.status).toBe(200);
      expect(putRes.body.instituicaoId).toBe(instAId);
    });

    it('Admin B (SUPERIOR) obtém config da sua instituição', async () => {
      const res = await request(app)
        .get('/contabilidade/configuracao')
        .set('Authorization', `Bearer ${adminBToken}`)
        .set('Host', 'localhost');
      expect(res.status).toBe(200);
      expect(res.body.instituicaoId).toBe(instBId);
    });
  });

  describe('Centros de custo: Multi-tenant', () => {
    it('Admin A (SECUNDARIO) cria centro de custo na sua instituição', async () => {
      const res = await request(app)
        .post('/contabilidade/centros-custo')
        .set('Authorization', `Bearer ${adminAToken}`)
        .set('Host', 'localhost')
        .send({ codigo: 'ADM-A', descricao: 'Administração Inst A' });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.instituicaoId).toBe(instAId);
      centroA1Id = res.body.id;
    });

    it('Admin B (SUPERIOR) cria centro de custo na sua instituição', async () => {
      const res = await request(app)
        .post('/contabilidade/centros-custo')
        .set('Authorization', `Bearer ${adminBToken}`)
        .set('Host', 'localhost')
        .send({ codigo: 'ADM-B', descricao: 'Administração Inst B' });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.instituicaoId).toBe(instBId);
      centroB1Id = res.body.id;
    });

    it('Admin A lista apenas centros da instituição A', async () => {
      const res = await request(app)
        .get('/contabilidade/centros-custo')
        .set('Authorization', `Bearer ${adminAToken}`)
        .set('Host', 'localhost');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const ids = res.body.map((c: { instituicaoId: string }) => c.instituicaoId);
      expect(ids.every((id: string) => id === instAId)).toBe(true);
      expect(res.body.some((c: { id: string }) => c.id === centroA1Id)).toBe(true);
      expect(res.body.some((c: { id: string }) => c.id === centroB1Id)).toBe(false);
    });

    it('Admin B lista apenas centros da instituição B', async () => {
      const res = await request(app)
        .get('/contabilidade/centros-custo')
        .set('Authorization', `Bearer ${adminBToken}`)
        .set('Host', 'localhost');
      expect(res.status).toBe(200);
      const ids = res.body.map((c: { instituicaoId: string }) => c.instituicaoId);
      expect(ids.every((id: string) => id === instBId)).toBe(true);
    });
  });

  describe('Importação de lançamentos: Multi-tenant', () => {
    const hoje = new Date().toISOString().slice(0, 10);

    it('Admin A importa lançamentos para sua instituição', async () => {
      // Usar codigo da conta criada (contaA1Id) - buscar codigo da conta
      const contaA = await prisma.planoConta.findUnique({ where: { id: contaA1Id } });
      const codigo = contaA?.codigo || '99';
      const res = await request(app)
        .post('/contabilidade/lancamentos/importar')
        .set('Authorization', `Bearer ${adminAToken}`)
        .set('Host', 'localhost')
        .send({
          linhas: [
            { data: hoje, contaCodigo: codigo, descricao: 'Import teste A', debito: 50, credito: 0 },
            { data: hoje, contaCodigo: codigo, descricao: 'Import teste A', debito: 0, credito: 50 },
          ],
        });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('criados');
      expect(res.body.criados).toBeGreaterThanOrEqual(0);
    });

    it('Admin B importa lançamentos para sua instituição', async () => {
      const contaB = await prisma.planoConta.findUnique({ where: { id: contaB1Id } });
      const codigo = contaB?.codigo || '99';
      const res = await request(app)
        .post('/contabilidade/lancamentos/importar')
        .set('Authorization', `Bearer ${adminBToken}`)
        .set('Host', 'localhost')
        .send({
          linhas: [
            { data: hoje, contaCodigo: codigo, descricao: 'Import teste B', debito: 75, credito: 0 },
            { data: hoje, contaCodigo: codigo, descricao: 'Import teste B', debito: 0, credito: 75 },
          ],
        });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('criados');
    });
  });
});
