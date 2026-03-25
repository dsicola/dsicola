/**
 * Integração: módulo social + funcionalidade de plano `comunidade`.
 *
 * Requer: base com migrações aplicadas (`npx prisma migrate deploy`) — tabelas `social_*`.
 * Executar: npm run test:social:integration
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import prisma from '../lib/prisma.js';
import bcrypt from 'bcryptjs';

const SUB_OFF = 'inst-e2e-social-off';
const SUB_ON = 'inst-e2e-social-on';
const EMAIL_OFF = 'admin.e2e.social.off@teste.dsicola.com';
const EMAIL_ON = 'admin.e2e.social.on@teste.dsicola.com';
const SENHA = 'E2eSocialMod123!';
const PLANO_OFF_NOME = 'E2E Plano Sem Comunidade v2';
const PLANO_ON_NOME = 'E2E Plano Com Comunidade v2';

describe('API social / plano comunidade', { timeout: 120_000 }, () => {
  let instOff = '';
  let instOn = '';
  let planOff = '';
  let planOn = '';
  let tokenOff = '';
  let tokenOn = '';

  beforeAll(async () => {
    const hash = await bcrypt.hash(SENHA, 10);

    let pOff = await prisma.plano.findFirst({ where: { nome: PLANO_OFF_NOME } });
    if (!pOff) {
      pOff = await prisma.plano.create({
        data: {
          nome: PLANO_OFF_NOME,
          descricao: 'E2E — sem comunidade',
          valorMensal: 0,
          funcionalidades: ['gestao_alunos', 'gestao_professores', 'comunicados'],
          ativo: true,
        },
      });
    } else {
      await prisma.plano.update({
        where: { id: pOff.id },
        data: {
          funcionalidades: ['gestao_alunos', 'gestao_professores', 'comunicados'],
        },
      });
    }
    planOff = pOff.id;

    let pOn = await prisma.plano.findFirst({ where: { nome: PLANO_ON_NOME } });
    if (!pOn) {
      pOn = await prisma.plano.create({
        data: {
          nome: PLANO_ON_NOME,
          descricao: 'E2E — com comunidade',
          valorMensal: 0,
          funcionalidades: ['gestao_alunos', 'gestao_professores', 'comunicados', 'comunidade'],
          ativo: true,
        },
      });
    } else {
      await prisma.plano.update({
        where: { id: pOn.id },
        data: {
          funcionalidades: ['gestao_alunos', 'gestao_professores', 'comunicados', 'comunidade'],
        },
      });
    }
    planOn = pOn.id;

    let iOff = await prisma.instituicao.findUnique({ where: { subdominio: SUB_OFF } });
    if (!iOff) {
      iOff = await prisma.instituicao.create({
        data: {
          nome: 'E2E Social Off',
          subdominio: SUB_OFF,
          tipoInstituicao: 'ENSINO_MEDIO',
          tipoAcademico: 'SECUNDARIO',
          status: 'ativa',
        },
      });
    }
    instOff = iOff.id;

    let iOn = await prisma.instituicao.findUnique({ where: { subdominio: SUB_ON } });
    if (!iOn) {
      iOn = await prisma.instituicao.create({
        data: {
          nome: 'E2E Social On',
          subdominio: SUB_ON,
          tipoInstituicao: 'ENSINO_MEDIO',
          tipoAcademico: 'SECUNDARIO',
          status: 'ativa',
        },
      });
    }
    instOn = iOn.id;

    const fim = new Date();
    fim.setFullYear(fim.getFullYear() + 1);

    await prisma.assinatura.upsert({
      where: { instituicaoId: instOff },
      create: {
        instituicaoId: instOff,
        planoId: planOff,
        status: 'ativa',
        tipo: 'PAGA',
        dataFim: fim,
        dataProximoPagamento: fim,
        valorAtual: 0,
      },
      update: { planoId: planOff, status: 'ativa', dataFim: fim, dataProximoPagamento: fim },
    });
    await prisma.assinatura.upsert({
      where: { instituicaoId: instOn },
      create: {
        instituicaoId: instOn,
        planoId: planOn,
        status: 'ativa',
        tipo: 'PAGA',
        dataFim: fim,
        dataProximoPagamento: fim,
        valorAtual: 0,
      },
      update: { planoId: planOn, status: 'ativa', dataFim: fim, dataProximoPagamento: fim },
    });

    let uOff = await prisma.user.findUnique({
      where: { instituicaoId_email: { instituicaoId: instOff, email: EMAIL_OFF } },
    });
    if (!uOff) {
      uOff = await prisma.user.create({
        data: {
          email: EMAIL_OFF,
          password: hash,
          nomeCompleto: 'Admin Off',
          instituicaoId: instOff,
          mustChangePassword: false,
        },
      });
      await prisma.userRole_.create({
        data: { userId: uOff.id, role: 'ADMIN', instituicaoId: instOff },
      });
    } else {
      await prisma.user.update({ where: { id: uOff.id }, data: { password: hash } });
    }

    let uOn = await prisma.user.findUnique({
      where: { instituicaoId_email: { instituicaoId: instOn, email: EMAIL_ON } },
    });
    if (!uOn) {
      uOn = await prisma.user.create({
        data: {
          email: EMAIL_ON,
          password: hash,
          nomeCompleto: 'Admin On',
          instituicaoId: instOn,
          mustChangePassword: false,
        },
      });
      await prisma.userRole_.create({
        data: { userId: uOn.id, role: 'ADMIN', instituicaoId: instOn },
      });
    } else {
      await prisma.user.update({ where: { id: uOn.id }, data: { password: hash } });
    }

    const loginOff = await request(app)
      .post('/auth/login')
      .set('Host', 'localhost')
      .send({ email: EMAIL_OFF, password: SENHA });
    if (loginOff.status !== 200) {
      throw new Error(`Login OFF falhou: ${JSON.stringify(loginOff.body)}`);
    }
    tokenOff = loginOff.body.accessToken;

    const loginOn = await request(app)
      .post('/auth/login')
      .set('Host', 'localhost')
      .send({ email: EMAIL_ON, password: SENHA });
    if (loginOn.status !== 200) {
      throw new Error(`Login ON falhou: ${JSON.stringify(loginOn.body)}`);
    }
    tokenOn = loginOn.body.accessToken;
  });

  afterAll(async () => {
    if (!instOff || !instOn) return;
    const safe = async (label: string, fn: () => Promise<unknown>) => {
      try {
        await fn();
      } catch (e) {
        console.warn(`[social.integration] cleanup ${label}:`, e);
      }
    };
    await safe('socialPost', () =>
      prisma.socialPost.deleteMany({ where: { instituicaoId: { in: [instOff, instOn] } } }),
    );
    await safe('user', () => prisma.user.deleteMany({ where: { email: { in: [EMAIL_OFF, EMAIL_ON] } } }));
    await safe('assinatura', () =>
      prisma.assinatura.deleteMany({ where: { instituicaoId: { in: [instOff, instOn] } } }),
    );
    await safe('instituicao', () =>
      prisma.instituicao.deleteMany({ where: { id: { in: [instOff, instOn] } } }),
    );
    await safe('plano', () => prisma.plano.deleteMany({ where: { id: { in: [planOff, planOn] } } }));
  });

  it('GET /api/social/public/feed funciona sem autenticação (apenas posts públicos)', async () => {
    const res = await request(app).get('/api/social/public/feed').set('Host', 'localhost');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toBeDefined();
  });

  it('GET /api/social/feed retorna 403 sem funcionalidade comunidade no plano', async () => {
    const res = await request(app)
      .get('/api/social/feed')
      .set('Authorization', `Bearer ${tokenOff}`)
      .set('Host', 'localhost');
    expect(res.status).toBe(403);
    const msg = String(res.body.message || res.body.error || '');
    expect(msg.toLowerCase()).toMatch(/comunidade|plano/);
  });

  it('GET /api/social/feed retorna 200 com comunidade no plano', async () => {
    const res = await request(app)
      .get('/api/social/feed')
      .set('Authorization', `Bearer ${tokenOn}`)
      .set('Host', 'localhost');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toBeDefined();
  });

  it('POST /api/social/posts cria publicação e aparece no feed', async () => {
    const create = await request(app)
      .post('/api/social/posts')
      .set('Authorization', `Bearer ${tokenOn}`)
      .set('Host', 'localhost')
      .send({ body: 'Olá E2E comunidade', isPublic: false });
    expect(create.status).toBe(201);
    expect(create.body.id).toBeTruthy();
    expect(create.body.body).toBe('Olá E2E comunidade');

    const feed = await request(app)
      .get('/api/social/feed')
      .set('Authorization', `Bearer ${tokenOn}`)
      .set('Host', 'localhost');
    expect(feed.status).toBe(200);
    expect(feed.body.data.some((p: { id: string }) => p.id === create.body.id)).toBe(true);
  });
});
