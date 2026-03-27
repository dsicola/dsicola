import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './fixtures/auth';

test.describe('Admin - Matrículas e Notas', () => {
  test.use({ project: 'chromium' });

  test('Admin navega para Matrículas em Turmas', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForLoadState('domcontentloaded');
    await page.goto('/admin-dashboard/gestao-alunos?tab=matriculas-turmas');
    await page.waitForURL(/gestao-alunos/, { timeout: 10000 }).catch(() => {});
    expect(page.url()).toMatch(/gestao-alunos/);
  });

  test('Admin navega para Avaliações/Notas', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForLoadState('domcontentloaded');
    await page.goto('/admin-dashboard/avaliacoes-notas');
    await page.waitForURL(/avaliacoes-notas/, { timeout: 10000 }).catch(() => {});
    expect(page.url()).toMatch(/avaliacoes-notas/);
  });

  test('Admin navega para Gestão Acadêmica (Cursos/Turmas)', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForLoadState('domcontentloaded');
    await page.goto('/admin-dashboard/gestao-academica?tab=turmas');
    await page.waitForURL(/gestao-academica/, { timeout: 10000 }).catch(() => {});
    expect(page.url()).toMatch(/gestao-academica/);
  });
});
