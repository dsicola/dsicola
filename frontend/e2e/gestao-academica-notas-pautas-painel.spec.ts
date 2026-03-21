/**
 * E2E: Gestão académica — abas Notas e Pautas (fonte GET /notas/turma/alunos).
 * Pré-requisitos: seed + auth em e2e/fixtures/auth.ts
 */
import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './fixtures/auth';

const T_NAV = 25000;

test.describe('Gestão académica — Notas e Pautas (painel)', () => {
  test.use({ project: 'chromium' });

  test('Aba Notas: cabeçalho e seletor de turma', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin-dashboard/gestao-academica?tab=notas');
    await page.waitForLoadState('networkidle').catch(() => {});

    await expect(page.getByTestId('gestao-academica-tab-notas')).toBeVisible({ timeout: T_NAV });
    await expect(page.getByTestId('admin-notas-turma-heading')).toBeVisible({ timeout: T_NAV });
    await expect(page.getByTestId('admin-notas-select-turma')).toBeVisible();
  });

  test('Aba Pautas: filtros; se houver plano extra, selecionar antes da pauta', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin-dashboard/gestao-academica?tab=pautas');
    await page.waitForLoadState('networkidle').catch(() => {});

    await expect(page.getByTestId('gestao-academica-tab-pautas')).toBeVisible({ timeout: T_NAV });
    await expect(page.getByTestId('pautas-filters-card')).toBeVisible({ timeout: T_NAV });

    const turmaTrigger = page.getByTestId('pautas-select-turma');
    await turmaTrigger.click();
    const firstTurma = page.getByTestId('pautas-turma-option-first');
    if ((await firstTurma.count()) === 0) {
      await page.keyboard.press('Escape');
      test.skip(true, 'Seed sem turmas para Pautas');
      return;
    }
    await firstTurma.click();

    const planoTrigger = page.getByTestId('pautas-select-plano');
    if (await planoTrigger.isVisible().catch(() => false)) {
      await planoTrigger.click();
      const opt = page.getByRole('listbox').first().getByRole('option').first();
      await expect(opt).toBeVisible({ timeout: 15000 });
      await opt.click();
    }

    const emptyOrContent = page
      .getByText(/Nenhum estudante matriculado nesta turma/i)
      .or(page.getByText(/Disciplina em falta/i))
      .or(page.getByText(/Total/i))
      .or(page.getByTestId('pautas-export-pdf'));
    await expect(emptyOrContent.first()).toBeVisible({ timeout: 25000 });
  });
});
