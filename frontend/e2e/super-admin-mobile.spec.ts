import { test, expect } from '@playwright/test';

/**
 * Testes E2E: área SUPER_ADMIN em viewport smartphone
 * Login, navegação e cadastros (Instituições, Planos)
 *
 * Requer: frontend em :8080, backend em :3001
 * Credenciais: superadmin@dsicola.com / SuperAdmin@123 (seed padrão)
 */
const SUPER_ADMIN_EMAIL = process.env.TEST_SUPER_ADMIN_EMAIL || 'superadmin@dsicola.com';
const SUPER_ADMIN_PASSWORD = process.env.TEST_SUPER_ADMIN_PASSWORD || 'SuperAdmin@123';

test.describe('Super Admin - Mobile', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('domcontentloaded');
  });

  async function loginAsSuperAdmin(page: import('@playwright/test').Page) {
    await page.goto('/auth');
    await page.fill('#email', SUPER_ADMIN_EMAIL);
    await page.fill('#password', SUPER_ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/super-admin|^\//, { timeout: 20000 });
  }

  test('Login SUPER_ADMIN em mobile', async ({ page }) => {
    await page.waitForSelector('#email', { timeout: 10000 });
    await loginAsSuperAdmin(page);
    await expect(page).toHaveURL(/super-admin|^\//);
    await expect(page.locator('text=Administração Global').or(page.locator('text=Plataforma DSICOLA'))).toBeVisible({ timeout: 10000 });
  });

  test('Super Admin - Dashboard visível em mobile', async ({ page }) => {
    await page.waitForSelector('#email', { timeout: 10000 });
    await loginAsSuperAdmin(page);
    await page.waitForURL(/super-admin/, { timeout: 10000 });
    await page.waitForSelector('[role="tablist"], [data-state="active"]', { timeout: 8000 });
    await expect(page.locator('text=Instituições, text=Planos, text=Onboarding').first()).toBeVisible({ timeout: 5000 });
  });

  test('Super Admin - Tab Instituições acessível', async ({ page }) => {
    await page.waitForSelector('#email', { timeout: 10000 });
    await loginAsSuperAdmin(page);
    await page.goto('/super-admin?tab=instituicoes');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(600);
    const instituicoesContent = page.locator('text=Nova Instituição, text=Cadastrar, text=Instituição').first();
    await expect(instituicoesContent).toBeVisible({ timeout: 10000 });
  });

  test('Super Admin - Abrir modal Nova Instituição', async ({ page }) => {
    await page.waitForSelector('#email', { timeout: 10000 });
    await loginAsSuperAdmin(page);
    await page.goto('/super-admin?tab=instituicoes');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('[data-state="inactive"], [role="tab"]', { timeout: 8000 }).catch(() => {});
    const novaBtn = page.locator('button:has-text("Nova Instituição"), button:has-text("Cadastrar"), button:has-text("Adicionar")').first();
    if (await novaBtn.isVisible()) {
      await novaBtn.click();
      await page.waitForSelector('dialog, [role="dialog"], input[name="nome"], input#nome', { timeout: 5000 });
      const dialog = page.locator('[role="dialog"], dialog').first();
      await expect(dialog).toBeVisible({ timeout: 3000 });
    }
  });

  test('Super Admin - Tab Planos acessível', async ({ page }) => {
    await page.waitForSelector('#email', { timeout: 10000 });
    await loginAsSuperAdmin(page);
    await page.goto('/super-admin?tab=planos');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);
    const planosContent = page.locator('text=Plano, text=planos, text=Preço').first();
    await expect(planosContent).toBeVisible({ timeout: 10000 });
  });

  test('Super Admin - Tab Videoaulas acessível', async ({ page }) => {
    await page.waitForSelector('#email', { timeout: 10000 });
    await loginAsSuperAdmin(page);
    await page.goto('/super-admin?tab=videoaulas');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);
    const videoContent = page.locator('text=Videoaula, text=Video, text=Gestão').first();
    await expect(videoContent).toBeVisible({ timeout: 10000 });
  });

  test('Super Admin - sem overflow horizontal', async ({ page }) => {
    await page.waitForSelector('#email', { timeout: 10000 });
    await loginAsSuperAdmin(page);
    await page.waitForURL(/super-admin/, { timeout: 10000 });
    await page.waitForLoadState('networkidle').catch(() => {});
    const vw = 390;
    const bodyScroll = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyScroll).toBeLessThanOrEqual(vw + 50);
  });
});
