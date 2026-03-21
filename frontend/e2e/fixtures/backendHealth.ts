import type { APIRequestContext } from '@playwright/test';

/**
 * Verifica se a API responde em GET /health (login E2E falha sem backend).
 * Ordem: E2E_API_BASE_URL → 127.0.0.1:3001 → 127.0.0.1:3000 (portas comuns do projeto).
 */
export async function isE2eBackendHealthy(request: APIRequestContext): Promise<{ ok: boolean; tried: string[] }> {
  const custom = process.env.E2E_API_BASE_URL?.replace(/\/$/, '').trim();
  const candidates = custom
    ? [custom]
    : ['http://127.0.0.1:3001', 'http://127.0.0.1:3000'];
  const tried: string[] = [];

  for (const base of candidates) {
    const url = `${base}/health`;
    tried.push(url);
    try {
      const res = await request.get(url, { timeout: 8000 });
      if (res.ok()) return { ok: true, tried };
    } catch {
      /* tentar seguinte */
    }
  }
  return { ok: false, tried };
}

export const E2E_BACKEND_SKIP_MESSAGE =
  'API não respondeu em /health (tente: cd backend && npm run dev; porta padrão 3001). ' +
  'Opcional: E2E_API_BASE_URL=http://127.0.0.1:PORTA. Credenciais seed: admin.inst.a@teste.dsicola.com / TestMultiTenant123!';
