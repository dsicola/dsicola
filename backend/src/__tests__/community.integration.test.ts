/**
 * Integração: diretório público Comunidade (/api/community/*).
 * Executar: npx vitest run src/__tests__/community.integration.test.ts
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app.js';

describe('API community (diretório público)', { timeout: 60_000 }, () => {
  it('GET /api/community/institutions responde 200 sem autenticação', async () => {
    const res = await request(app).get('/api/community/institutions');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toBeDefined();
  });

  it('GET /api/community/courses responde 200 sem autenticação', async () => {
    const res = await request(app).get('/api/community/courses');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/community/institutions/:id/ratings responde 404 para instituição inexistente', async () => {
    const res = await request(app).get(
      '/api/community/institutions/00000000-0000-4000-8000-000000000099/ratings',
    );
    expect(res.status).toBe(404);
  });
});
