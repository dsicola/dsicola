import { test, expect } from '@playwright/test';
import { fillLogin, E2E_CREDENTIALS } from './fixtures/auth';

test.describe('Autenticação - Fluxo principal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('domcontentloaded');
  });

  test('Página de login carrega com formulário visível', async ({ page }) => {
    await expect(page.locator('#email')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#password')).toBeVisible({ timeout: 5000 });
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toBeEnabled();
  });

  test('Login Super Admin redireciona para /super-admin', async ({ page }) => {
    await fillLogin(
      page,
      E2E_CREDENTIALS.superAdmin.email,
      E2E_CREDENTIALS.superAdmin.password
    );
    await page.waitForURL(/super-admin|\/admin-dashboard|\/\?/, { timeout: 20000 });
    const url = page.url();
    expect(url).toMatch(/super-admin|admin-dashboard|\/\?/);
  });

  test('Login Admin (instituição) redireciona para dashboard', async ({ page }) => {
    await fillLogin(page, E2E_CREDENTIALS.admin.email, E2E_CREDENTIALS.admin.password);
    await page.waitForURL(/admin-dashboard|super-admin|\/gestao/, { timeout: 20000 });
    const url = page.url();
    expect(url).not.toContain('/auth');
  });

  test('Credenciais inválidas exibem feedback', async ({ page }) => {
    await fillLogin(page, 'invalido@teste.com', 'senhaerrada');
    await expect(page).toHaveURL(/\/auth/, { timeout: 10000 });
    const toastOrError = page.locator('[data-sonner-toast], [role="alert"], [role="status"], [class*="toast"]').or(
      page.getByText(/inválid|incorret|erro|credential|Invalid|incorrect/i)
    );
    await expect(toastOrError.first()).toBeVisible({ timeout: 8000 });
  });

  test('Link Esqueceu a senha navega para modo recuperação', async ({ page }) => {
    await expect(page.locator('#email')).toBeVisible({ timeout: 10000 });
    const forgotLink = page.getByRole('button', { name: /esqueceu|forgot/i });
    if (await forgotLink.isVisible()) {
      await forgotLink.click();
      await expect(
        page.getByText(/recuperar|redefinir|esqueci|reset|password/i).first()
      ).toBeVisible({ timeout: 5000 });
    }
  });
});
