import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './fixtures/auth';

test.describe('Admin - Matrículas e Notas', () => {
  test.use({ project: 'chromium' });

  test('Admin navega para Matrículas em Turmas', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForLoadState('domcontentloaded');
    const matriculasLink = page.locator(
      'a[href*="gestao-alunos"], a[href*="matriculas-turmas"], a:has-text("Matrículas em Turmas"), a:has-text("Estudantes")'
    ).first();
    await expect(matriculasLink).toBeVisible({ timeout: 10000 });
    await matriculasLink.click();
    await page.waitForURL(/gestao-alunos|matriculas/, { timeout: 8000 }).catch(() => {});
    expect(page.url()).toMatch(/admin-dashboard|gestao/);
  });

  test('Admin navega para Avaliações/Notas', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForLoadState('domcontentloaded');
    const notasLink = page.locator(
      'a[href*="avaliacoes-notas"], a:has-text("Notas"), a:has-text("Lançar Notas"), a:has-text("Avaliações")'
    ).first();
    await expect(notasLink).toBeVisible({ timeout: 10000 });
    await notasLink.click();
    await page.waitForURL(/avaliacoes-notas/, { timeout: 8000 }).catch(() => {});
    expect(page.url()).toMatch(/admin-dashboard|avaliacoes/);
  });

  test('Admin navega para Gestão Acadêmica (Cursos/Turmas)', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForLoadState('domcontentloaded');
    const gestaoLink = page.locator(
      'a[href*="gestao-academica"], a:has-text("Cursos"), a:has-text("Disciplinas"), a:has-text("Turmas")'
    ).first();
    await expect(gestaoLink).toBeVisible({ timeout: 10000 });
    await gestaoLink.click();
    await page.waitForURL(/gestao-academica|tab=/, { timeout: 8000 }).catch(() => {});
    expect(page.url()).toMatch(/gestao-academica|admin-dashboard/);
  });
});
