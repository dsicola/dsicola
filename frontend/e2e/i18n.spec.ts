import { test, expect } from '@playwright/test';

test.describe('i18n - Troca de idioma', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('domcontentloaded');
  });

  test('Formulário exibe texto em pt-BR por padrão', async ({ page }) => {
    await expect(page.locator('button[type="submit"]')).toBeVisible({ timeout: 10000 });
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toContainText(/Entrar|Sign in/);
    await expect(page.getByText(/Bem-vindo|Welcome/).first()).toBeVisible({ timeout: 5000 });
  });

  test('Seletor de idioma permite trocar para English', async ({ page }) => {
    await expect(page.locator('button[type="submit"]')).toBeVisible({ timeout: 10000 });
    const globeBtn = page.locator('button').filter({ has: page.locator('svg') }).first();
    await expect(globeBtn).toBeVisible({ timeout: 5000 });
    await globeBtn.click();
    await expect(page.getByText('English')).toBeVisible({ timeout: 5000 });
    await page.getByText('English').click();
    await expect(page.locator('button[type="submit"]')).toContainText('Sign in', { timeout: 5000 });
  });

  test('Seletor de idioma permite trocar para pt-AO', async ({ page }) => {
    await expect(page.locator('button[type="submit"]')).toBeVisible({ timeout: 10000 });
    const globeBtn = page.locator('button').filter({ has: page.locator('svg') }).first();
    await expect(globeBtn).toBeVisible({ timeout: 5000 });
    await globeBtn.click();
    await expect(page.getByText('Português (AO)')).toBeVisible({ timeout: 5000 });
    await page.getByText('Português (AO)').click();
    const emailLabel = page.locator('label').filter({ hasText: /Correio|E-mail|Email/ }).first();
    await expect(emailLabel).toBeVisible({ timeout: 5000 });
  });
});
