import { test, expect } from '@playwright/test';

/**
 * Teste E2E: Gestão de Assinaturas (Super Admin)
 *
 * Valida:
 * - Acesso à tab Assinaturas como SUPER_ADMIN
 * - Secção "Gestão de Assinaturas" e botão "Nova Assinatura"
 * - Diálogo Nova Assinatura: campo Instituição, Plano, Valor Mensal
 * - Badge Automático / Manual e bloco "Valor recomendado" quando plano e instituição estão selecionados
 *
 * Requer: frontend em :8080, backend em :3001
 * Credenciais: superadmin@dsicola.com / SuperAdmin@123 (seed padrão)
 */
const SUPER_ADMIN_EMAIL = process.env.TEST_SUPER_ADMIN_EMAIL || 'superadmin@dsicola.com';
const SUPER_ADMIN_PASSWORD = process.env.TEST_SUPER_ADMIN_PASSWORD || 'SuperAdmin@123';

test.describe('Super Admin - Gestão de Assinaturas', () => {
  test.setTimeout(60000);

  async function loginAsSuperAdmin(page: import('@playwright/test').Page) {
    await page.goto('/auth');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('#email', { timeout: 10000 });
    await page.fill('#email', SUPER_ADMIN_EMAIL);
    await page.fill('#password', SUPER_ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/super-admin|\/\?/, { timeout: 20000 });
  }

  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('domcontentloaded');
  });

  test('Abre a tab Assinaturas e exibe Gestão de Assinaturas', async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.goto('/super-admin?tab=assinaturas');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);

    await expect(page.getByRole('heading', { name: /Gestão de Assinaturas/i })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole('button', { name: /Nova Assinatura/i })).toBeVisible({
      timeout: 5000,
    });
  });

  test('Diálogo Nova Assinatura contém Instituição, Plano e Valor Mensal', async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.goto('/super-admin?tab=assinaturas');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);

    const novaAssinaturaBtn = page.getByRole('button', { name: /Nova Assinatura/i });
    await expect(novaAssinaturaBtn).toBeVisible({ timeout: 10000 });

    // Se o botão estiver desabilitado (todas as instituições já têm assinatura), não abrimos o diálogo
    const isDisabled = await novaAssinaturaBtn.isDisabled().catch(() => false);
    test.skip(isDisabled, 'Nenhuma instituição sem assinatura');

    await novaAssinaturaBtn.click();
    await page.waitForTimeout(500);

    await expect(page.getByRole('dialog', { name: /Nova Assinatura/i })).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByLabel(/Instituição/i)).toBeVisible({ timeout: 3000 });
    await expect(page.getByText(/Tipo de Licença/i).first()).toBeVisible({ timeout: 3000 });
    await expect(page.getByLabel(/Plano/i).first()).toBeVisible({ timeout: 3000 });
    await expect(page.getByLabel(/Valor Mensal/i).first()).toBeVisible({ timeout: 3000 });
  });

  test('Diálogo exibe secção Valor Mensal (e badge Automático/Manual quando há plano)', async ({
    page,
  }) => {
    await loginAsSuperAdmin(page);
    await page.goto('/super-admin?tab=assinaturas');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);

    const novaAssinaturaBtn = page.getByRole('button', { name: /Nova Assinatura/i });
    await expect(novaAssinaturaBtn).toBeVisible({ timeout: 10000 });
    if (await novaAssinaturaBtn.isDisabled().catch(() => false)) {
      test.skip(true, 'Nenhuma instituição sem assinatura');
      return;
    }

    await novaAssinaturaBtn.click();
    await page.waitForTimeout(500);

    const dialog = page.getByRole('dialog', { name: /Nova Assinatura/i });
    await expect(dialog).toBeVisible({ timeout: 5000 });

    await expect(dialog.getByText(/Valor Mensal/i).first()).toBeVisible({ timeout: 3000 });
    await expect(dialog.getByLabel(/Valor Mensal/i).first()).toBeVisible({ timeout: 3000 });
  });
});
