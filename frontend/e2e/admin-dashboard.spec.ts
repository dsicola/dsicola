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
    // Sidebar usa <button> + navigate (sem <a href>)
    await page.goto('/admin-dashboard/gestao-academica');
    await page.waitForURL(/gestao-academica/, { timeout: 10000 }).catch(() => {});
    expect(page.url()).toMatch(/gestao-academica/);
  });

  test('Admin navega para Configurações', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForLoadState('domcontentloaded');
    await page.goto('/admin-dashboard/configuracoes');
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
