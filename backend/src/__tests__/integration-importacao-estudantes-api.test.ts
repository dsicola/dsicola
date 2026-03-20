/**
 * Integração leve: rotas de importação exigem auth e validam corpo.
 * Requer app + DB (mesmo padrão que integration-mensalidades).
 *
 * Execute: npx vitest run src/__tests__/integration-importacao-estudantes-api.test.ts
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import prisma from '../lib/prisma.js';

const LOGIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'superadmin@dsicola.com';
const LOGIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@123';

let accessToken: string | null = null;
let instituicaoId: string | null = null;

describe('Integration: importação estudantes API', () => {
  beforeAll(async () => {
    const loginRes = await request(app).post('/auth/login').send({
      email: LOGIN_EMAIL,
      password: LOGIN_PASSWORD,
    });
    if (loginRes.status === 200) {
      accessToken = loginRes.body.accessToken;
    }
    const inst = await prisma.instituicao.findFirst({
      where: { assinatura: { status: 'ativa' } },
      select: { id: true },
    });
    instituicaoId = inst?.id ?? null;
  });

  it('confirmar sem token → 401', async () => {
    const res = await request(app)
      .post('/api/importar/estudantes/confirmar')
      .send({ linhas: [{ linha: 1, nomeCompleto: 'X', classe: 'Y' }], modoImportacao: 'seguro' });
    expect(res.status).toBe(401);
  });

  it('confirmar com token mas linhas vazias → 400', async () => {
    if (!accessToken || !instituicaoId) {
      console.warn('[integration-importacao-estudantes] Skip: sem login ou instituição com assinatura ativa');
      return;
    }
    const res = await request(app)
      .post('/api/importar/estudantes/confirmar')
      .query({ instituicaoId })
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ linhas: [], modoImportacao: 'seguro' });
    expect(res.status).toBe(400);
  });
});
