import { test, expect } from '@playwright/test';
import { loginAsProfessor, loginAsAdmin } from './fixtures/auth';
import { E2E_BACKEND_SKIP_MESSAGE, isE2eBackendHealthy } from './fixtures/backendHealth';

/**
 * UX do Plano de Ensino: título da página + ou "Resumo institucional" (plano carregado)
 * ou cartão de contexto (selecção de curso/disciplina/etc.).
 *
 * Requer API com seed multi-tenant (ex.: admin.inst.a / prof.inst.a + TestMultiTenant123!):
 *   Terminal 1: cd backend && npm run dev   (porta padrão 3001 — GET /health)
 *   Terminal 2: cd frontend && npm run dev  (8080; Playwright pode subir sozinho se 8080 livre)
 *   npm run test:e2e:plano-resumo-ux
 * Opcional: E2E_API_BASE_URL=http://127.0.0.1:PORTA se a API não estiver na 3001.
 */
test.describe('Plano de Ensino — resumo institucional e contexto', () => {
  test.use({ project: 'chromium' });

  let backendHealthy = false;

  test.beforeAll(async ({ request }) => {
    const { ok } = await isE2eBackendHealthy(request);
    backendHealthy = ok;
    if (!ok) {
      console.warn(`[E2E] ${E2E_BACKEND_SKIP_MESSAGE}`);
    }
  });

  test.beforeEach(() => {
    test.skip(!backendHealthy, E2E_BACKEND_SKIP_MESSAGE);
  });

  test('Professor: página Plano de Ensino mostra cabeçalho e contexto ou resumo', async ({ page }) => {
    await loginAsProfessor(page);
    await page.goto('/painel-professor/plano-ensino');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('heading', { name: /plano de ensino/i })).toBeVisible({ timeout: 20000 });

    const resumo = page.getByRole('heading', { name: /resumo institucional deste plano/i });
    const contexto = page.getByText(/contexto do plano de ensino/i);
    await expect(resumo.or(contexto).first()).toBeVisible({ timeout: 15000 });
  });

  test('Admin: página Plano de Ensino mostra cabeçalho e contexto ou resumo', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin-dashboard/plano-ensino');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('heading', { name: /plano de ensino/i })).toBeVisible({ timeout: 20000 });

    const resumo = page.getByRole('heading', { name: /resumo institucional deste plano/i });
    const contexto = page.getByText(/contexto do plano de ensino/i);
    await expect(resumo.or(contexto).first()).toBeVisible({ timeout: 15000 });
  });

  test('Configuração de ensinos — aba Plano: resumo institucional ou fluxo de tabs/contexto', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin-dashboard/configuracao-ensino?tab=plano-ensino');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText(/configuração de ensinos/i).first()).toBeVisible({ timeout: 20000 });

    const resumo = page.getByRole('heading', { name: /resumo institucional deste plano/i });
    const tabApresentacao = page.getByRole('tab', { name: /apresentação/i });
    const contexto = page.getByText(/contexto do plano de ensino/i);
    await expect(resumo.or(tabApresentacao).or(contexto).first()).toBeVisible({ timeout: 20000 });
  });
});
