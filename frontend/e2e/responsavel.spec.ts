import { test, expect } from '@playwright/test';
import { loginAsResponsavel } from './fixtures/auth';

test.describe('Responsável - Painel e navegação', () => {
  test.use({ project: 'chromium' });

  test('Responsável acessa painel após login', async ({ page }) => {
    await loginAsResponsavel(page);
    await page.waitForURL(/painel-responsavel|admin-dashboard/, { timeout: 10000 }).catch(() => {});
    expect(page.url()).toContain('painel-responsavel');
  });

  test('Painel Responsável exibe conteúdo principal', async ({ page }) => {
    await loginAsResponsavel(page);
    await page.waitForLoadState('domcontentloaded');
    const mainContent = page.locator(
      'main, [role="main"], [class*="dashboard"]'
    ).first();
    await expect(mainContent).toBeVisible({ timeout: 15000 });
  });
});
