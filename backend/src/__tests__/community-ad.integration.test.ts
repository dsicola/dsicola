/**
 * Integração: publicidade Comunidade (pedidos, comprovativo, aprovação SUPER_ADMIN, gate vitrine).
 *
 * Requer: PostgreSQL com migrações aplicadas — `npx prisma migrate deploy` (tabela `community_ad_bookings`).
 * SUPER_ADMIN: credenciais em .env ou `superadmin@dsicola.com` / `SuperAdmin@123` após `npm run db:seed`.
 *
 * Executar: npx vitest run src/__tests__/community-ad.integration.test.ts
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import prisma from '../lib/prisma.js';
import bcrypt from 'bcryptjs';

const SUB_A = 'inst-e2e-community-ad-a';
const SUB_B = 'inst-e2e-community-ad-b';
const EMAIL_A = 'admin.e2e.community.ad.a@teste.dsicola.com';
const EMAIL_B = 'admin.e2e.community.ad.b@teste.dsicola.com';
const SENHA = 'E2eCommunityAd123!';
const PLANO_NOME = 'E2E Plano Community Ad';
const SUPER_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'superadmin@dsicola.com';
const SUPER_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@123';

describe('API community ad / publicidade Comunidade', { timeout: 120_000 }, () => {
  let planId = '';
  let instA = '';
  let instB = '';
  let tokenA = '';
  let tokenB = '';
  let tokenSuper = '';
  let prevPublicidadeEnv: string | undefined;

  beforeAll(async () => {
    prevPublicidadeEnv = process.env.COMMUNITY_PUBLICIDADE_OBRIGATORIA;
    process.env.COMMUNITY_PUBLICIDADE_OBRIGATORIA = 'false';

    const hash = await bcrypt.hash(SENHA, 10);

    let p = await prisma.plano.findFirst({ where: { nome: PLANO_NOME } });
    if (!p) {
      p = await prisma.plano.create({
        data: {
          nome: PLANO_NOME,
          descricao: 'E2E community ad',
          valorMensal: 0,
          funcionalidades: ['gestao_alunos', 'gestao_professores', 'comunicados', 'comunidade'],
          ativo: true,
        },
      });
    } else {
      await prisma.plano.update({
        where: { id: p.id },
        data: {
          funcionalidades: ['gestao_alunos', 'gestao_professores', 'comunicados', 'comunidade'],
        },
      });
    }
    planId = p.id;

    const fim = new Date();
    fim.setFullYear(fim.getFullYear() + 1);

    for (const [sub, nom] of [
      [SUB_A, 'E2E Community Ad A'],
      [SUB_B, 'E2E Community Ad B'],
    ] as const) {
      let inst = await prisma.instituicao.findUnique({ where: { subdominio: sub } });
      if (!inst) {
        inst = await prisma.instituicao.create({
          data: {
            nome: nom,
            subdominio: sub,
            tipoInstituicao: 'ENSINO_MEDIO',
            tipoAcademico: 'SECUNDARIO',
            status: 'ativa',
          },
        });
      }
      if (sub === SUB_A) instA = inst.id;
      else instB = inst.id;

      await prisma.assinatura.upsert({
        where: { instituicaoId: inst.id },
        create: {
          instituicaoId: inst.id,
          planoId: planId,
          status: 'ativa',
          tipo: 'PAGA',
          dataFim: fim,
          dataProximoPagamento: fim,
          valorAtual: 0,
        },
        update: { planoId: planId, status: 'ativa', dataFim: fim, dataProximoPagamento: fim },
      });
    }

    async function ensureAdmin(email: string, instituicaoId: string) {
      let u = await prisma.user.findUnique({
        where: { instituicaoId_email: { instituicaoId, email } },
      });
      if (!u) {
        u = await prisma.user.create({
          data: {
            email,
            password: hash,
            nomeCompleto: 'E2E Admin',
            instituicaoId,
            mustChangePassword: false,
          },
        });
        await prisma.userRole_.create({
          data: { userId: u.id, role: 'ADMIN', instituicaoId },
        });
      } else {
        await prisma.user.update({ where: { id: u.id }, data: { password: hash } });
      }
      return u;
    }

    await ensureAdmin(EMAIL_A, instA);
    await ensureAdmin(EMAIL_B, instB);

    const la = await request(app).post('/auth/login').set('Host', 'localhost').send({
      email: EMAIL_A,
      password: SENHA,
    });
    if (la.status !== 200) throw new Error(`Login A falhou: ${JSON.stringify(la.body)}`);
    tokenA = la.body.accessToken;

    const lb = await request(app).post('/auth/login').set('Host', 'localhost').send({
      email: EMAIL_B,
      password: SENHA,
    });
    if (lb.status !== 200) throw new Error(`Login B falhou: ${JSON.stringify(lb.body)}`);
    tokenB = lb.body.accessToken;

    const ls = await request(app).post('/auth/login').set('Host', 'localhost').send({
      email: SUPER_EMAIL,
      password: SUPER_PASSWORD,
    });
    if (ls.status !== 200) {
      throw new Error(
        `SUPER_ADMIN login falhou (${ls.status}). Corra seed ou defina SUPER_ADMIN_EMAIL/PASSWORD: ${JSON.stringify(ls.body)}`,
      );
    }
    tokenSuper = ls.body.accessToken;
  });

  afterAll(async () => {
    process.env.COMMUNITY_PUBLICIDADE_OBRIGATORIA = prevPublicidadeEnv;
    if (prevPublicidadeEnv === undefined) delete process.env.COMMUNITY_PUBLICIDADE_OBRIGATORIA;

    const safe = async (_label: string, fn: () => Promise<unknown>) => {
      try {
        await fn();
      } catch {
        /* ignore cleanup */
      }
    };

    await safe('communityAdBooking', () =>
      prisma.communityAdBooking.deleteMany({ where: { instituicaoId: { in: [instA, instB] } } }),
    );
    await safe('socialPost', () =>
      prisma.socialPost.deleteMany({ where: { instituicaoId: { in: [instA, instB] } } }),
    );
    await safe('user', () => prisma.user.deleteMany({ where: { email: { in: [EMAIL_A, EMAIL_B] } } }));
    await safe('assinatura', () =>
      prisma.assinatura.deleteMany({ where: { instituicaoId: { in: [instA, instB] } } }),
    );
    await safe('instituicao', () =>
      prisma.instituicao.deleteMany({ where: { id: { in: [instA, instB] } } }),
    );
    await safe('plano', () => prisma.plano.deleteMany({ where: { id: planId } }));
  });

  it('POST /api/community/ad-bookings cria pedido em análise', async () => {
    const res = await request(app)
      .post('/api/community/ad-bookings')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Host', 'localhost')
      .send({
        scope: 'BOTH',
        duracaoDiasSolicitada: 14,
        referenciaPagamento: 'REF-E2E-001',
        valorPagoDeclarado: 1000,
      });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('AGUARDANDO_ANALISE');
    expect(res.body.scope).toBe('BOTH');
    expect(res.body.instituicaoId).toBe(instA);
  });

  it('PATCH comprovativo e GET /me funcionam', async () => {
    const mine = await request(app)
      .get('/api/community/ad-bookings/me')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Host', 'localhost');
    expect(mine.status).toBe(200);
    const pending = mine.body.bookings.find((b: { status: string }) => b.status === 'AGUARDANDO_ANALISE');
    expect(pending).toBeTruthy();
    const bookingId = pending.id as string;

    const att = await request(app)
      .patch(`/api/community/ad-bookings/me/${bookingId}/comprovativo`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Host', 'localhost')
      .send({ comprovativoUrl: 'https://example.com/e2e-comprovativo.pdf' });
    expect(att.status).toBe(200);
    expect(att.body.comprovativoUrl).toContain('example.com');
  });

  it('GET /super lista pedidos (SUPER_ADMIN)', async () => {
    const res = await request(app)
      .get('/api/community/ad-bookings/super')
      .query({ status: 'AGUARDANDO_ANALISE', pageSize: '50' })
      .set('Authorization', `Bearer ${tokenSuper}`)
      .set('Host', 'localhost');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    const row = res.body.data.find((r: { referenciaPagamento?: string }) => r.referenciaPagamento === 'REF-E2E-001');
    expect(row).toBeTruthy();
  });

  it('PATCH /super aprovar exige pagamentoVerificado e define vigência', async () => {
    const mine = await request(app)
      .get('/api/community/ad-bookings/me')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Host', 'localhost');
    const bookingId = (mine.body.bookings as { id: string; status: string }[]).find(
      (b) => b.status === 'AGUARDANDO_ANALISE',
    )!.id;

    const bad = await request(app)
      .patch(`/api/community/ad-bookings/super/${bookingId}`)
      .set('Authorization', `Bearer ${tokenSuper}`)
      .set('Host', 'localhost')
      .send({ action: 'APROVAR', pagamentoVerificado: false });
    expect(bad.status).toBe(400);

    const ok = await request(app)
      .patch(`/api/community/ad-bookings/super/${bookingId}`)
      .set('Authorization', `Bearer ${tokenSuper}`)
      .set('Host', 'localhost')
      .send({
        action: 'APROVAR',
        pagamentoVerificado: true,
        duracaoDiasEfetiva: 14,
      });
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe('APROVADA');
    expect(ok.body.startsAt).toBeTruthy();
    expect(ok.body.endsAt).toBeTruthy();
  });

  it('rejeitar pedido B com motivo', async () => {
    const cr = await request(app)
      .post('/api/community/ad-bookings')
      .set('Authorization', `Bearer ${tokenB}`)
      .set('Host', 'localhost')
      .send({
        scope: 'VITRINE_SOCIAL',
        duracaoDiasSolicitada: 7,
        referenciaPagamento: 'REF-E2E-REJECT',
      });
    expect(cr.status).toBe(201);
    const bid = cr.body.id as string;

    const rej = await request(app)
      .patch(`/api/community/ad-bookings/super/${bid}`)
      .set('Authorization', `Bearer ${tokenSuper}`)
      .set('Host', 'localhost')
      .send({
        action: 'REJEITAR',
        motivoRejeicao: 'E2E: pagamento não verificado',
      });
    expect(rej.status).toBe(200);
    expect(rej.body.status).toBe('REJEITADA');
    expect(rej.body.motivoRejeicao).toContain('E2E');
  });

  it('COMMUNITY_PUBLICIDADE_OBRIGATORIA: post público sem campanha → 403; com campanha aprovada → 201', async () => {
    process.env.COMMUNITY_PUBLICIDADE_OBRIGATORIA = 'true';

    const blocked = await request(app)
      .post('/api/social/posts')
      .set('Authorization', `Bearer ${tokenB}`)
      .set('Host', 'localhost')
      .send({ body: 'E2E público sem ad', isPublic: true });
    expect(blocked.status).toBe(403);

    const allowed = await request(app)
      .post('/api/social/posts')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Host', 'localhost')
      .send({ body: 'E2E público com campanha activa', isPublic: true });
    expect(allowed.status).toBe(201);
    expect(allowed.body.isPublic).toBe(true);

    process.env.COMMUNITY_PUBLICIDADE_OBRIGATORIA = 'false';
  });

  it('GET /api/community/institutions marca directoryFeatured quando há destaque aprovado', async () => {
    const res = await request(app).get('/api/community/institutions').set('Host', 'localhost').query({ pageSize: '48' });
    expect(res.status).toBe(200);
    const row = res.body.data.find((x: { id: string }) => x.id === instA);
    expect(row).toBeTruthy();
    expect(row.directoryFeatured).toBe(true);
  });
});
