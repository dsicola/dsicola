/**
 * Integração: instituição com domínio próprio — alinhado ao fluxo frontend (TenantContext + API).
 *
 * - ADMIN (plano Enterprise) grava `dominioCustomizado` via PUT /instituicoes/:id
 * - Público: GET /instituicoes/public-por-host?host= (igual ao instituicoesApi.getPublicByHost)
 * - parseTenantDomain: Origin do domínio próprio + Host api.* resolve o mesmo tenant
 * - Login: POST /auth/login com Origin do domínio próprio filtra pelo tenant correto
 *
 * Executar: npx vitest run src/__tests__/instituicao-dominio-proprio.integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import prisma from '../lib/prisma.js';
import bcrypt from 'bcryptjs';
import { parseTenantDomain } from '../middlewares/validateTenantDomain.js';
import { getLoginBaseUrlForInstituicao } from '../middlewares/validateTenantDomain.js';
import { parseHostForInstituicaoLookup } from '../utils/instituicaoCustomDomain.js';
import { clearCorsCustomDomainCache } from '../utils/corsCustomInstituicaoDomain.js';

const SUB_DOMINIO = 'inst-e2e-dominio-proprio';
/** TLD .invalid reservado (RFC 2606) — não resolve na Internet; válido para hostname de teste */
const CUSTOM_HOST = 'portal-e2e-dominio-proprio.test.invalid';
const ADMIN_EMAIL = 'admin.e2e.dominio.proprio@teste.dsicola.com';
const SENHA_ADMIN = 'E2eDominioProprio123!';

describe('Instituição: domínio próprio (API + tenant + alinhamento frontend)', () => {
  let instituicaoId: string;
  let adminToken: string;
  let planoEnterpriseId: string;
  let planoBasicoId: string;

  beforeAll(async () => {
    const hashedPassword = await bcrypt.hash(SENHA_ADMIN, 10);

    let planoEnt = await prisma.plano.findFirst({
      where: {
        ativo: true,
        nome: { contains: 'Enterprise', mode: 'insensitive' },
      },
    });
    if (!planoEnt) {
      planoEnt = await prisma.plano.create({
        data: {
          nome: 'Enterprise E2E Domínio',
          descricao: 'Plano de teste — domínio customizado',
          valorMensal: 0,
          multiCampus: true,
          funcionalidades: [
            'gestao_alunos',
            'gestao_professores',
            'notas',
            'frequencia',
            'financeiro',
            'documentos',
            'dominio_customizado',
          ],
          ativo: true,
        },
      });
    }
    planoEnterpriseId = planoEnt.id;

    let planoBas = await prisma.plano.findFirst({
      where: {
        ativo: true,
        nome: { contains: 'Básico', mode: 'insensitive' },
      },
    });
    if (!planoBas) {
      planoBas = await prisma.plano.create({
        data: {
          nome: 'Básico E2E Domínio',
          descricao: 'Sem domínio customizado',
          valorMensal: 0,
          funcionalidades: ['gestao_alunos', 'gestao_professores', 'notas'],
          ativo: true,
        },
      });
    }
    planoBasicoId = planoBas.id;

    let inst = await prisma.instituicao.findUnique({
      where: { subdominio: SUB_DOMINIO },
    });
    if (!inst) {
      inst = await prisma.instituicao.create({
        data: {
          nome: 'Instituição E2E Domínio Próprio',
          subdominio: SUB_DOMINIO,
          tipoInstituicao: 'ENSINO_MEDIO',
          tipoAcademico: 'SECUNDARIO',
          status: 'ativa',
          dominioCustomizado: null,
        },
      });
    } else {
      await prisma.instituicao.update({
        where: { id: inst.id },
        data: { dominioCustomizado: null },
      });
    }
    instituicaoId = inst.id;

    const umAno = new Date();
    umAno.setFullYear(umAno.getFullYear() + 1);
    await prisma.assinatura.upsert({
      where: { instituicaoId },
      create: {
        instituicaoId,
        planoId: planoEnterpriseId,
        status: 'ativa',
        tipo: 'PAGA',
        dataFim: umAno,
        dataProximoPagamento: umAno,
        valorAtual: 0,
      },
      update: {
        planoId: planoEnterpriseId,
        status: 'ativa',
        dataFim: umAno,
        dataProximoPagamento: umAno,
      },
    });

    let admin = await prisma.user.findUnique({
      where: { instituicaoId_email: { instituicaoId, email: ADMIN_EMAIL } },
    });
    if (!admin) {
      admin = await prisma.user.create({
        data: {
          email: ADMIN_EMAIL,
          password: hashedPassword,
          nomeCompleto: 'Admin E2E Domínio',
          instituicaoId,
          mustChangePassword: false,
        },
      });
      await prisma.userRole_.create({
        data: { userId: admin.id, role: 'ADMIN', instituicaoId },
      });
    } else {
      await prisma.user.update({
        where: { id: admin.id },
        data: { password: hashedPassword },
      });
    }

    const login = await request(app)
      .post('/auth/login')
      .set('Host', 'localhost')
      .send({ email: ADMIN_EMAIL, password: SENHA_ADMIN });

    if (login.status !== 200) {
      throw new Error(`Login ADMIN E2E falhou: ${JSON.stringify(login.body)}`);
    }
    adminToken = login.body.accessToken;

    const putDom = await request(app)
      .put(`/instituicoes/${instituicaoId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Host', 'localhost')
      .send({ dominioCustomizado: CUSTOM_HOST });

    if (putDom.status !== 200) {
      throw new Error(`PUT dominioCustomizado falhou no beforeAll: ${putDom.status} ${JSON.stringify(putDom.body)}`);
    }
    expect(putDom.body.dominioCustomizado).toBe(CUSTOM_HOST);
  });

  afterAll(async () => {
    clearCorsCustomDomainCache();
    await prisma.instituicao
      .update({
        where: { id: instituicaoId },
        data: { dominioCustomizado: null },
      })
      .catch(() => {});
  });

  it('contrato frontend: parseHostForInstituicaoLookup(host) coerente com query public-por-host', () => {
    const parsed = parseHostForInstituicaoLookup(CUSTOM_HOST);
    expect(parsed).toEqual({ kind: 'dominio_customizado', value: CUSTOM_HOST });
    const parsedWww = parseHostForInstituicaoLookup(`www.${CUSTOM_HOST}`);
    expect(parsedWww).toEqual({ kind: 'dominio_customizado', value: CUSTOM_HOST });
  });

  it('GET /instituicoes/public-por-host?host= devolve a mesma instituição (como TenantContext)', async () => {
    const res = await request(app).get('/instituicoes/public-por-host').query({ host: CUSTOM_HOST });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(instituicaoId);
    expect(res.body.subdominio).toBe(SUB_DOMINIO);
    expect(res.body.dominioCustomizado).toBe(CUSTOM_HOST);
    expect(res.body.status).toBe('ativa');
    expect(res.body.nome).toBeTruthy();
  });

  it('GET public-por-host com subdomínio da plataforma continua a funcionar', async () => {
    const res = await request(app)
      .get('/instituicoes/public-por-host')
      .query({ host: `${SUB_DOMINIO}.dsicola.com` });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(instituicaoId);
    expect(res.body.subdominio).toBe(SUB_DOMINIO);
  });

  it('getLoginBaseUrlForInstituicao prefere domínio próprio (links em email/redirecionamentos)', () => {
    const url = getLoginBaseUrlForInstituicao(SUB_DOMINIO, CUSTOM_HOST);
    expect(url).toMatch(new RegExp(`^https?://${CUSTOM_HOST.replace(/\./g, '\\.')}$`));
  });

  it('parseTenantDomain: Origin https://dominio + Host api.dsicola.com → subdomain + mesmo instituicaoId', async () => {
    const req = {
      hostname: 'api.dsicola.com',
      get: (h: string) => {
        if (h === 'host') return 'api.dsicola.com';
        if (h === 'origin') return `https://${CUSTOM_HOST}`;
        return undefined;
      },
    } as any;
    const next = vi.fn();
    await parseTenantDomain(req, {} as any, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.tenantDomainMode).toBe('subdomain');
    expect(req.tenantDomainInstituicaoId).toBe(instituicaoId);
    expect(req.tenantDomainSubdominio).toBe(SUB_DOMINIO);
    expect(req.tenantDomainCustomHost).toBe(CUSTOM_HOST);
  });

  it('POST /auth/login com Origin do domínio próprio autentica o utilizador da instituição', async () => {
    const res = await request(app)
      .post('/auth/login')
      .set('Host', 'api.dsicola.com')
      .set('Origin', `https://${CUSTOM_HOST}`)
      .send({ email: ADMIN_EMAIL, password: SENHA_ADMIN });

    expect(res.status).toBe(200);
    expect(res.body.user?.instituicaoId).toBe(instituicaoId);
  });

  it('POST /auth/login com Origin sem tenant resolve em central → 403 USE_SUBDOMAIN (não emite sessão no host errado)', async () => {
    const outroHost = 'outra-instituicao-fake.test.invalid';
    const res = await request(app)
      .post('/auth/login')
      .set('Host', 'api.dsicola.com')
      .set('Origin', `https://${outroHost}`)
      .send({ email: ADMIN_EMAIL, password: SENHA_ADMIN });

    expect(res.status).toBe(403);
    expect(res.body.reason).toBe('USE_SUBDOMAIN');
    expect(String(res.body?.message || '')).toMatch(/subdomínio|instituição/i);
  });

  it('plano sem domínio customizado: PUT dominioCustomizado → 403', async () => {
    await prisma.assinatura.update({
      where: { instituicaoId },
      data: { planoId: planoBasicoId },
    });

    const res = await request(app)
      .put(`/instituicoes/${instituicaoId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Host', 'localhost')
      .send({ dominioCustomizado: 'nao-deve-salvar.test.invalid' });

    expect(res.status).toBe(403);
    expect(String(res.body?.message || '')).toMatch(/Enterprise|plano/i);

    await prisma.assinatura.update({
      where: { instituicaoId },
      data: { planoId: planoEnterpriseId },
    });

    const restore = await prisma.instituicao.findUnique({
      where: { id: instituicaoId },
      select: { dominioCustomizado: true },
    });
    expect(restore?.dominioCustomizado).toBe(CUSTOM_HOST);
  });

  it('landing institucional: PUT landingPublico + GET público (subdomínio e host) devolve JSON sanitizado', async () => {
    const put = await request(app)
      .put('/configuracoes-instituicao')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Host', 'localhost')
      .send({
        landingPublico: {
          heroBadge: 'Selo E2E institucional',
          heroTitle: 'Título landing E2E',
          heroSubtitle: 'Subtítulo institucional',
          galleryUrls: ['https://example.com/e2e.png', 'javascript:alert(1)', 'not-a-url'],
          instagramUrl: 'http://insecure.example.com/ig',
          facebookUrl: 'https://facebook.com/example',
          whatsappDigits: '244900000001',
          mapEmbedUrl: 'https://www.google.com/maps/embed?e2e=1',
          showAcademicOffer: true,
        },
      });

    expect(put.status).toBe(200);

    const pubSub = await request(app).get(`/instituicoes/subdominio/${SUB_DOMINIO}`);
    expect(pubSub.status).toBe(200);
    const lp = pubSub.body.configuracao?.landingPublico as Record<string, unknown> | undefined;
    expect(lp?.heroBadge).toBe('Selo E2E institucional');
    expect(lp?.heroTitle).toBe('Título landing E2E');
    expect(lp?.galleryUrls).toEqual(['https://example.com/e2e.png']);
    expect(lp?.instagramUrl).toBeFalsy();
    expect(lp?.facebookUrl).toBe('https://facebook.com/example');
    expect(lp?.whatsappDigits).toBe('244900000001');

    const pubHost = await request(app).get('/instituicoes/public-por-host').query({ host: CUSTOM_HOST });
    expect(pubHost.status).toBe(200);
    expect((pubHost.body.configuracao?.landingPublico as { heroTitle?: string })?.heroTitle).toBe('Título landing E2E');

    await request(app)
      .put('/configuracoes-instituicao')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Host', 'localhost')
      .send({ landingPublico: null });
  });

  it('landing institucional: personalização (véu, secções, eventos) — PUT → GET público sanitizado', async () => {
    const put = await request(app)
      .put('/configuracoes-instituicao')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Host', 'localhost')
      .send({
        landingPublico: {
          heroTitle: 'Título personalizado E2E',
          heroOverlayOpacity: 72,
          showHeroSection: true,
          showAboutSection: false,
          showGallerySection: true,
          showMapSection: false,
          showEventsSection: true,
          eventsSectionTitle: 'Publicações e eventos E2E',
          eventsItems: [
            {
              title: 'Publicação Um',
              subtitle: 'Texto de apoio',
              imageUrl: 'https://example.com/pub1.jpg',
              dateLabel: 'Mar 2026',
              ctaLabel: 'Saiba mais',
              ctaUrl: 'https://example.com/detalhe',
            },
            { title: 'Só título e CTA interno', ctaLabel: 'Candidaturas', ctaUrl: '/inscricao' },
            { title: '', subtitle: 'deve ser ignorado sem título' },
            { title: 'Evil', ctaUrl: '//evil.com' },
          ],
        },
      });

    expect(put.status).toBe(200);

    const pub = await request(app).get(`/instituicoes/subdominio/${SUB_DOMINIO}`);
    expect(pub.status).toBe(200);
    const lp = pub.body.configuracao?.landingPublico as Record<string, unknown> | undefined;
    expect(lp?.heroTitle).toBe('Título personalizado E2E');
    expect(lp?.heroOverlayOpacity).toBe(72);
    expect(lp?.showAboutSection).toBe(false);
    expect(lp?.showMapSection).toBe(false);
    expect(lp?.showEventsSection).toBe(true);
    expect(lp?.eventsSectionTitle).toBe('Publicações e eventos E2E');
    const evs = lp?.eventsItems as Array<Record<string, unknown>> | undefined;
    expect(Array.isArray(evs)).toBe(true);
    expect(evs).toHaveLength(3);
    expect(evs![0]!.title).toBe('Publicação Um');
    expect(evs![0]!.imageUrl).toBe('https://example.com/pub1.jpg');
    expect(evs![1]!.ctaUrl).toBe('/inscricao');
    expect(evs![2]!.title).toBe('Evil');
    expect(evs![2]!.ctaUrl).toBeNull();

    await request(app)
      .put('/configuracoes-instituicao')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Host', 'localhost')
      .send({ landingPublico: null });
  });
});

describe('CORS produção: domínio próprio sem CORS_EXTRA_ORIGINS manual', () => {
  const prevEnv = process.env.NODE_ENV;

  beforeAll(() => {
    process.env.NODE_ENV = 'production';
  });

  afterAll(() => {
    process.env.NODE_ENV = prevEnv;
    clearCorsCustomDomainCache();
  });

  it('OPTIONS preflight permite Origin https://… quando hostname = dominioCustomizado ativo', async () => {
    clearCorsCustomDomainCache();

    let inst = await prisma.instituicao.findUnique({
      where: { subdominio: SUB_DOMINIO },
    });
    if (!inst) {
      throw new Error('Instituição E2E ausente — correr o describe anterior primeiro');
    }

    await prisma.instituicao.update({
      where: { id: inst.id },
      data: {
        dominioCustomizado: CUSTOM_HOST,
        status: 'ativa',
      },
    });

    const res = await request(app)
      .options('/auth/login')
      .set('Origin', `https://${CUSTOM_HOST}`)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Content-Type');

    expect([200, 204]).toContain(res.status);
    expect(res.headers['access-control-allow-origin']).toBe(`https://${CUSTOM_HOST}`);

    await prisma.instituicao
      .update({
        where: { id: inst.id },
        data: { dominioCustomizado: null },
      })
      .catch(() => {});
    clearCorsCustomDomainCache();
  });

  it('OPTIONS com Origin não registado continua bloqueado em produção', async () => {
    clearCorsCustomDomainCache();
    const res = await request(app)
      .options('/auth/login')
      .set('Origin', 'https://invasor-nao-registado.test.invalid')
      .set('Access-Control-Request-Method', 'POST');

    expect(res.status).toBe(500);
    clearCorsCustomDomainCache();
  });
});
