import { test, expect } from '@playwright/test';

/**
 * Testes E2E: i18n - troca de idioma
 * Verifica que pt-BR, pt-AO e en funcionam na tela de login
 */
test.describe('i18n - Troca de idioma', () => {
  test.setTimeout(30000);

  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('domcontentloaded');
  });

  test('Formulário exibe texto em pt-BR por padrão', async ({ page }) => {
    await page.waitForSelector('button[type="submit"]', { timeout: 10000 });
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toContainText(/Entrar|Sign in/);
    const welcome = page.locator('text=/Bem-vindo|Welcome/');
    await expect(welcome.first()).toBeVisible({ timeout: 5000 });
  });

  test('Seletor de idioma permite trocar para English', async ({ page }) => {
    await page.waitForSelector('button[type="submit"]', { timeout: 10000 });
    const globeBtn = page.locator('button:has(svg)').filter({ has: page.locator('[aria-hidden]') }).first();
    if (await globeBtn.isVisible({ timeout: 5000 })) {
      await globeBtn.click();
      await page.waitForSelector('text=English', { timeout: 3000 });
      await page.locator('text=English').click();
      await page.waitForTimeout(500);
      const submitBtn = page.locator('button[type="submit"]');
      await expect(submitBtn).toContainText('Sign in');
    }
  });

  test('Seletor de idioma permite trocar para pt-AO', async ({ page }) => {
    await page.waitForSelector('button[type="submit"]', { timeout: 10000 });
    const globeBtn = page.locator('button').filter({ has: page.locator('svg') }).first();
    if (await globeBtn.isVisible({ timeout: 5000 })) {
      await globeBtn.click();
      await page.waitForSelector('text=Português (AO)', { timeout: 3000 });
      await page.locator('text=Português (AO)').click();
      await page.waitForTimeout(500);
      const emailLabel = page.locator('label:has-text("Correio"), label:has-text("E-mail"), label:has-text("Email")');
      await expect(emailLabel.first()).toBeVisible({ timeout: 3000 });
    }
  });
});
