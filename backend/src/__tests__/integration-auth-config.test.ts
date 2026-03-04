/**
 * Integration tests: Auth (login, refresh, logout) + Configuração Instituição (GET, PUT)
 *
 * Prerequisites: Run `npm run db:seed` (creates SUPER_ADMIN).
 * For full configuracoes-instituicao tests, run `npm run seed:multi-tenant` or ensure
 * at least one instituição exists.
 *
 * Execute: npx vitest run src/__tests__/integration-auth-config.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import prisma from '../lib/prisma.js';

const LOGIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'superadmin@dsicola.com';
const LOGIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@123';

let accessToken: string;
let refreshToken: string;
let instituicaoId: string;

describe('Integration: Auth + Configuração Instituição', () => {
  beforeAll(async () => {
    // Ensure we have an instituição for GET/PUT configuracoes-instituicao (SUPER_ADMIN needs ?instituicaoId=xxx)
    const inst = await prisma.instituicao.findFirst({
      where: { status: 'ativa' },
      select: { id: true },
    });
    if (inst) {
      instituicaoId = inst.id;
    } else {
      const created = await prisma.instituicao.create({
        data: {
          nome: 'Inst Teste Integration',
          subdominio: 'inst-test-integration',
          tipoInstituicao: 'ENSINO_MEDIO',
          tipoAcademico: 'SECUNDARIO',
          status: 'ativa',
        },
      });
      instituicaoId = created.id;
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Auth: Login', () => {
    it('POST /auth/login returns 200 with valid credentials', async () => {
      const res = await request(app)
        .post('/auth/login')
        .set('Host', 'localhost')
        .send({ email: LOGIN_EMAIL, password: LOGIN_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user).toHaveProperty('id');
      expect(res.body.user).toHaveProperty('email', LOGIN_EMAIL);
      expect(res.body.user).toHaveProperty('roles');
      expect(Array.isArray(res.body.user.roles)).toBe(true);

      accessToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;
    });

    it('POST /auth/login returns 401 with invalid credentials', async () => {
      const res = await request(app)
        .post('/auth/login')
        .set('Host', 'localhost')
        .send({ email: LOGIN_EMAIL, password: 'WrongPassword123!' });

      expect(res.status).toBe(401);
    });
  });

  describe('Auth: Refresh Token', () => {
    it('POST /auth/refresh returns new tokens', async () => {
      const res = await request(app)
        .post('/auth/refresh')
        .set('Content-Type', 'application/json')
        .send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(typeof res.body.accessToken).toBe('string');
      expect(typeof res.body.refreshToken).toBe('string');
      expect(res.body.accessToken).not.toBe(accessToken);
      expect(res.body.refreshToken).not.toBe(refreshToken);

      accessToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;
    });
  });

  describe('Auth: Logout', () => {
    it('POST /auth/logout returns 200 with valid token', async () => {
      const res = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Content-Type', 'application/json')
        .send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message');
      expect(res.body.message).toMatch(/sucesso|logout/i);
    });

    it('re-login to restore tokens for subsequent tests', async () => {
      const res = await request(app)
        .post('/auth/login')
        .set('Host', 'localhost')
        .send({ email: LOGIN_EMAIL, password: LOGIN_PASSWORD });

      expect(res.status).toBe(200);
      accessToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;
    });
  });

  describe('Configuração Instituição: GET', () => {
    it('GET /configuracoes-instituicao with admin token and instituicaoId returns 200', async () => {
      const res = await request(app)
        .get(`/configuracoes-instituicao?instituicaoId=${instituicaoId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Host', 'localhost');

      expect(res.status).toBe(200);
      expect(res.body).toBeDefined();
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('instituicaoId');
      expect(res.body).toHaveProperty('nomeInstituicao');
    });

    it('GET /configuracoes-instituicao without instituicaoId returns 403 for SUPER_ADMIN', async () => {
      const res = await request(app)
        .get('/configuracoes-instituicao')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Host', 'localhost');

      expect(res.status).toBe(403);
    });
  });

  describe('Configuração Instituição: PUT', () => {
    it('PUT /configuracoes-instituicao with valid minimal payload returns 200', async () => {
      const res = await request(app)
        .put(`/configuracoes-instituicao?instituicaoId=${instituicaoId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Content-Type', 'application/json')
        .send({ nomeInstituicao: 'Escola Teste Integration' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('nomeInstituicao', 'Escola Teste Integration');
    });
  });
});
