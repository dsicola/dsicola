import { test, expect } from '@playwright/test';

/**
 * Testes E2E para modo offline.
 * Verifica indicador de estado e comportamento quando sem ligação.
 */
test.describe('Modo Offline', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('Indicador offline aparece quando sem ligação', async ({ page }) => {
    await page.context().setOffline(true);

    await expect(
      page.getByRole('status').filter({ hasText: /sem ligação|internet/i })
    ).toBeVisible({ timeout: 5000 });
  });

  test('Indicador desaparece quando ligação volta', async ({ page }) => {
    await page.context().setOffline(true);
    await expect(
      page.getByRole('status').filter({ hasText: /sem ligação|internet/i })
    ).toBeVisible({ timeout: 5000 });

    await page.context().setOffline(false);
    await page.waitForTimeout(500);
    await expect(
      page.getByRole('status').filter({ hasText: /sem ligação|internet/i })
    ).not.toBeVisible();
  });

  test('Navegação mantém app visível quando offline', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('domcontentloaded');

    await page.context().setOffline(true);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('body')).toBeVisible();
  });
});
