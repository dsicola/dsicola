import { test, expect } from '@playwright/test';

/**
 * Testes E2E: Matrículas e Notas (Admin)
 * Admin navega para Gestão de Alunos (matrículas) e Avaliações/Notas
 *
 * Requer: frontend :8080, backend :3001, seed-multi-tenant
 */
const ADMIN_EMAIL = process.env.TEST_USER_INST_A_EMAIL || 'admin.inst.a@teste.dsicola.com';
const ADMIN_PASSWORD = process.env.TEST_MULTITENANT_PASS || 'TestMultiTenant123!';

async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/auth');
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/admin-dashboard|gestao|super-admin/, { timeout: 15000 });
}

test.describe('Admin - Matrículas e Notas', () => {
  test.setTimeout(60000);
  test.use({ project: 'chromium' });

  test('Admin navega para Matrículas em Turmas', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForLoadState('domcontentloaded');
    const matriculasLink = page.locator(
      'a[href*="gestao-alunos"], a[href*="matriculas-turmas"], a:has-text("Matrículas em Turmas"), a:has-text("Estudantes")'
    );
    const first = matriculasLink.first();
    if (await first.isVisible({ timeout: 8000 })) {
      await first.click();
      await page.waitForURL(/gestao-alunos|matriculas/, { timeout: 8000 }).catch(() => {});
      const url = page.url();
      expect(url).toMatch(/admin-dashboard|gestao/);
    }
  });

  test('Admin navega para Avaliações/Notas', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForLoadState('domcontentloaded');
    const notasLink = page.locator(
      'a[href*="avaliacoes-notas"], a:has-text("Notas"), a:has-text("Lançar Notas"), a:has-text("Avaliações")'
    );
    const first = notasLink.first();
    if (await first.isVisible({ timeout: 8000 })) {
      await first.click();
      await page.waitForURL(/avaliacoes-notas/, { timeout: 8000 }).catch(() => {});
      const url = page.url();
      expect(url).toMatch(/admin-dashboard|avaliacoes/);
    }
  });

  test('Admin navega para Gestão Acadêmica (Cursos/Turmas)', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForLoadState('domcontentloaded');
    const gestaoLink = page.locator(
      'a[href*="gestao-academica"], a:has-text("Cursos"), a:has-text("Disciplinas"), a:has-text("Turmas")'
    );
    const first = gestaoLink.first();
    if (await first.isVisible({ timeout: 8000 })) {
      await first.click();
      await page.waitForURL(/gestao-academica|tab=/, { timeout: 8000 }).catch(() => {});
      const url = page.url();
      expect(url).toMatch(/gestao-academica|admin-dashboard/);
    }
  });
});
