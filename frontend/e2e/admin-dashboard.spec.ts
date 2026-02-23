import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './fixtures/auth';

test.describe('Admin - Dashboard e navegação', () => {
  test.use({ project: 'chromium' });

  test('Admin acessa dashboard após login', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForURL(/admin-dashboard/, { timeout: 8000 }).catch(() => {});
    const inDashboard =
      page.url().includes('admin-dashboard') || page.url().includes('gestao');
    expect(inDashboard).toBeTruthy();
  });

  test('Admin navega para Gestão Acadêmica', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForLoadState('domcontentloaded');
    const gestaoLink = page.locator(
      'a[href*="gestao-academica"], a[href*="gestao"]:has-text("Acadêmico"), a:has-text("Cursos"), a:has-text("Disciplinas")'
    ).first();
    await expect(gestaoLink).toBeVisible({ timeout: 10000 });
    await gestaoLink.click();
    await page.waitForURL(/gestao-academica|tab=/, { timeout: 10000 }).catch(() => {});
    expect(page.url()).toMatch(/gestao|admin-dashboard/);
  });

  test('Admin navega para Configurações', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForLoadState('domcontentloaded');
    const configLink = page.locator(
      'a[href*="configuracoes"], a:has-text("Configurações"), a:has-text("Instituição")'
    ).first();
    await expect(configLink).toBeVisible({ timeout: 10000 });
    await configLink.click();
    await page.waitForURL(/configuracoes/, { timeout: 10000 }).catch(() => {});
    expect(page.url()).toMatch(/configuracoes/);
  });

  test('Dashboard exibe seção ou conteúdo principal', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForLoadState('domcontentloaded');
    const mainContent = page.locator(
      'main, [role="main"], [class*="dashboard"], [class*="Dashboard"]'
    ).first();
    await expect(mainContent).toBeVisible({ timeout: 15000 });
  });
});
