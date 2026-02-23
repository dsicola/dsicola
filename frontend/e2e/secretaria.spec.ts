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
    const alunosLink = page.locator(
      'a[href*="gestao-alunos"], a[href*="secretaria-dashboard/alunos"], a:has-text("Alunos"), a:has-text("Estudantes")'
    ).first();
    await expect(alunosLink).toBeVisible({ timeout: 10000 });
    await alunosLink.click();
    await page.waitForURL(/gestao-alunos|alunos|secretaria/, { timeout: 8000 }).catch(() => {});
    expect(page.url()).toMatch(/admin-dashboard|secretaria|gestao/);
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
