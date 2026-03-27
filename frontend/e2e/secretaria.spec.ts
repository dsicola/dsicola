import { test, expect } from '@playwright/test';
import { loginAsSecretaria } from './fixtures/auth';

test.describe('Secretaria - Painel e navegação', () => {
  test.use({ project: 'chromium' });

  test('Secretaria acessa painel após login', async ({ page }) => {
    await loginAsSecretaria(page);
    await page.waitForURL(/painel-secretaria|secretaria-dashboard|gestao|admin-dashboard/, { timeout: 10000 }).catch(() => {});
    const inSecretaria =
      page.url().includes('secretaria') ||
      page.url().includes('admin-dashboard') ||
      page.url().includes('gestao');
    expect(inSecretaria).toBeTruthy();
  });

  test('Secretaria navega para Gestão de Alunos', async ({ page }) => {
    await loginAsSecretaria(page);
    await page.waitForLoadState('domcontentloaded');
    await page.goto('/secretaria-dashboard/alunos?tab=alunos');
    await page.waitForURL(/alunos|gestao-alunos|secretaria-dashboard/, { timeout: 12000 }).catch(() => {});
    expect(page.url()).toMatch(/secretaria-dashboard|gestao-alunos/);
  });

  test('Painel Secretaria exibe conteúdo principal', async ({ page }) => {
    await loginAsSecretaria(page);
    await page.waitForLoadState('domcontentloaded');
    const mainContent = page.locator(
      'main, [role="main"], [class*="dashboard"]'
    ).first();
    await expect(mainContent).toBeVisible({ timeout: 15000 });
  });
});
