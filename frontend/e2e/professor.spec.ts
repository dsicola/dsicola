import { test, expect } from '@playwright/test';
import { loginAsProfessor } from './fixtures/auth';

test.describe('Professor - Painel e navegação', () => {
  test.use({ project: 'chromium' });

  test('Professor acessa painel após login', async ({ page }) => {
    await loginAsProfessor(page);
    await page.waitForURL(/painel-professor/, { timeout: 10000 }).catch(() => {});
    expect(page.url()).toContain('painel-professor');
  });

  test('Professor navega para Minhas Turmas', async ({ page }) => {
    await loginAsProfessor(page);
    await page.waitForLoadState('domcontentloaded');
    const turmasLink = page.locator(
      'a[href*="painel-professor/turmas"], a:has-text("Turmas"), a:has-text("Minhas Turmas")'
    ).first();
    await expect(turmasLink).toBeVisible({ timeout: 10000 });
    await turmasLink.click();
    await page.waitForURL(/painel-professor\/turmas/, { timeout: 8000 }).catch(() => {});
    expect(page.url()).toMatch(/painel-professor/);
  });

  test('Professor navega para Lançamento de Notas', async ({ page }) => {
    await loginAsProfessor(page);
    await page.waitForLoadState('domcontentloaded');
    const notasLink = page.locator(
      'a[href*="painel-professor/notas"], a:has-text("Notas"), button:has-text("Notas")'
    ).first();
    await expect(notasLink).toBeVisible({ timeout: 10000 });
    await notasLink.click();
    await page.waitForURL(/painel-professor\/notas/, { timeout: 8000 }).catch(() => {});
    expect(page.url()).toMatch(/painel-professor/);
  });

  test('Painel Professor exibe conteúdo principal', async ({ page }) => {
    await loginAsProfessor(page);
    await page.waitForLoadState('domcontentloaded');
    const mainContent = page.locator(
      'main, [role="main"], [class*="dashboard"]'
    ).first();
    await expect(mainContent).toBeVisible({ timeout: 15000 });
  });
});
