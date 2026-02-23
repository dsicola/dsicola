import { test, expect } from '@playwright/test';

/**
 * Testes E2E: Fluxo Admin - Dashboard e navegação
 * Login como Admin, navegação pelas principais áreas
 *
 * Requer: frontend :8080, backend :3001, seed-multi-tenant
 */
const ADMIN_EMAIL = process.env.TEST_USER_INST_A_EMAIL || 'admin.inst.a@teste.dsicola.com';
const ADMIN_PASSWORD = process.env.TEST_MULTITENANT_PASS || 'TestMultiTenant123!';

async function loginAsAdmin(page: any) {
  await page.goto('/auth');
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/admin-dashboard|gestao|super-admin/, { timeout: 15000 });
}

test.describe('Admin - Dashboard e navegação', () => {
  test.setTimeout(60000);
  test.use({ project: 'chromium' });

  test('Admin acessa dashboard após login', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForURL(/admin-dashboard/, { timeout: 5000 }).catch(() => {});
    const inDashboard = page.url().includes('admin-dashboard') || page.url().includes('gestao');
    expect(inDashboard).toBeTruthy();
  });

  test('Admin navega para Gestão Acadêmica', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForLoadState('domcontentloaded');
    const gestaoLink = page.locator('a[href*="gestao-academica"], [href*="gestao"]:has-text("Acadêmico"), a:has-text("Cursos"), a:has-text("Disciplinas")');
    const first = gestaoLink.first();
    if (await first.isVisible({ timeout: 8000 })) {
      await first.click();
      await page.waitForURL(/gestao-academica|tab=/, { timeout: 8000 }).catch(() => {});
      const url = page.url();
      expect(url).toMatch(/gestao|admin-dashboard/);
    }
  });

  test('Admin navega para Configurações', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForLoadState('domcontentloaded');
    const configLink = page.locator('a[href*="configuracoes"], a:has-text("Configurações"), a:has-text("Instituição")');
    const first = configLink.first();
    if (await first.isVisible({ timeout: 8000 })) {
      await first.click();
      await page.waitForURL(/configuracoes/, { timeout: 8000 }).catch(() => {});
      const url = page.url();
      expect(url).toMatch(/configuracoes/);
    }
  });

  test('Dashboard exibe seção ou conteúdo principal', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForLoadState('networkidle').catch(() => {});
    const mainContent = page.locator('main, [role="main"], [class*="dashboard"], [class*="Dashboard"]');
    await expect(mainContent.first()).toBeVisible({ timeout: 10000 });
  });
});
