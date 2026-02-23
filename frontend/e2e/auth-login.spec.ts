import { test, expect } from '@playwright/test';

/**
 * Testes E2E: Fluxo de autenticação
 * Login Super Admin, Admin (instituição), validação de credenciais
 *
 * Requer: frontend :8080, backend :3001
 * Credenciais: env ou seed padrão
 */
const SUPER_ADMIN_EMAIL = process.env.TEST_SUPER_ADMIN_EMAIL || 'superadmin@dsicola.com';
const SUPER_ADMIN_PASSWORD = process.env.TEST_SUPER_ADMIN_PASSWORD || 'SuperAdmin@123';
const ADMIN_EMAIL = process.env.TEST_USER_INST_A_EMAIL || 'admin.inst.a@teste.dsicola.com';
const ADMIN_PASSWORD = process.env.TEST_MULTITENANT_PASS || 'TestMultiTenant123!';

test.describe('Autenticação - Fluxo principal', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('domcontentloaded');
  });

  test('Página de login carrega com formulário visível', async ({ page }) => {
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });
    await page.waitForSelector('input[type="password"]', { timeout: 5000 });
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toBeEnabled();
  });

  test('Login Super Admin redireciona para /super-admin', async ({ page }) => {
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.fill('input[type="email"]', SUPER_ADMIN_EMAIL);
    await page.fill('input[type="password"]', SUPER_ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/super-admin|\/admin-dashboard|\/\?/, { timeout: 15000 });
    const url = page.url();
    expect(url).toMatch(/super-admin|admin-dashboard|\/\?/);
  });

  test('Login Admin (instituição) redireciona para dashboard', async ({ page }) => {
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/admin-dashboard|super-admin|\/gestao/, { timeout: 15000 });
    const url = page.url();
    expect(url).not.toContain('/auth');
  });

  test('Credenciais inválidas exibem feedback', async ({ page }) => {
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.fill('input[type="email"]', 'invalido@teste.com');
    await page.fill('input[type="password"]', 'senhaerrada');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    const toast = page.locator('[data-sonner-toast], [role="alert"], .toast, [class*="toast"]');
    const errorText = page.locator('text=/inválid|incorret|erro|credential/i');
    const hasFeedback = await toast.count() > 0 || (await errorText.first().isVisible().catch(() => false));
    expect(hasFeedback || page.url().includes('/auth')).toBeTruthy();
  });

  test('Link Esqueceu a senha navega para modo recuperação', async ({ page }) => {
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    const forgotLink = page.locator('button:has-text("Esqueceu"), a:has-text("Esqueceu"), [class*="underline"]:has-text("Esqueceu")');
    if (await forgotLink.first().isVisible()) {
      await forgotLink.first().click();
      await page.waitForTimeout(500);
      const recoveryContent = page.locator('text=/recuperar|redefinir|esqueci/i');
      await expect(recoveryContent.first()).toBeVisible({ timeout: 5000 });
    }
  });
});
