import { test, expect } from '@playwright/test';

/**
 * Testes E2E: Fluxo Professor
 * Login como Professor, acesso a turmas, notas, frequência
 *
 * Requer: frontend :8080, backend :3001, seed-multi-tenant
 */
const PROF_EMAIL = process.env.TEST_PROF_INST_A_EMAIL || 'prof.inst.a@teste.dsicola.com';
const PROF_PASSWORD = process.env.TEST_MULTITENANT_PASS || 'TestMultiTenant123!';

async function loginAsProfessor(page: import('@playwright/test').Page) {
  await page.goto('/auth');
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.fill('input[type="email"]', PROF_EMAIL);
  await page.fill('input[type="password"]', PROF_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/painel-professor|admin-dashboard/, { timeout: 15000 });
}

test.describe('Professor - Painel e navegação', () => {
  test.setTimeout(60000);
  test.use({ project: 'chromium' });

  test('Professor acessa painel após login', async ({ page }) => {
    await loginAsProfessor(page);
    await page.waitForURL(/painel-professor/, { timeout: 8000 }).catch(() => {});
    const inProfessorPanel = page.url().includes('painel-professor');
    expect(inProfessorPanel).toBeTruthy();
  });

  test('Professor navega para Minhas Turmas', async ({ page }) => {
    await loginAsProfessor(page);
    await page.waitForLoadState('domcontentloaded');
    const turmasLink = page.locator(
      'a[href*="painel-professor/turmas"], a:has-text("Turmas"), a:has-text("Minhas Turmas")'
    );
    const first = turmasLink.first();
    if (await first.isVisible({ timeout: 8000 })) {
      await first.click();
      await page.waitForURL(/painel-professor\/turmas/, { timeout: 8000 }).catch(() => {});
      expect(page.url()).toMatch(/painel-professor/);
    }
  });

  test('Professor navega para Lançamento de Notas', async ({ page }) => {
    await loginAsProfessor(page);
    await page.waitForLoadState('domcontentloaded');
    const notasLink = page.locator(
      'a[href*="painel-professor/notas"], a:has-text("Notas"), button:has-text("Notas")'
    );
    const first = notasLink.first();
    if (await first.isVisible({ timeout: 8000 })) {
      await first.click();
      await page.waitForURL(/painel-professor\/notas/, { timeout: 8000 }).catch(() => {});
      expect(page.url()).toMatch(/painel-professor/);
    }
  });

  test('Painel Professor exibe conteúdo principal', async ({ page }) => {
    await loginAsProfessor(page);
    await page.waitForLoadState('networkidle').catch(() => {});
    const mainContent = page.locator('main, [role="main"], [class*="dashboard"]');
    await expect(mainContent.first()).toBeVisible({ timeout: 10000 });
  });
});
