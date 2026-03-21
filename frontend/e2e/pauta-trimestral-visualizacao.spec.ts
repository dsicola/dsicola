/**
 * E2E: Pauta trimestral / Pautas (Gestão Académica) — filtros e visibilidade.
 *
 * Garante: Ano Letivo, Turno e Turma são selecionáveis, rótulos e ajuda visíveis,
 * filtro de turno refina a lista (quando há turmas no seed).
 *
 * Pré-requisitos: backend + seed em e2e/fixtures/auth.ts (TEST_*_EMAIL).
 * Comando: npm run test:e2e:pauta-trimestral --prefix frontend
 */
import { test, expect, type Page } from '@playwright/test';
import { loginAsAdmin, loginAsAdminInstB } from './fixtures/auth';

const T_NAV = 25000;

async function openSelectAndPick(page: Page, triggerTestId: string, optionTestId: string) {
  await page.getByTestId(triggerTestId).click();
  await expect(page.getByTestId(optionTestId)).toBeVisible({ timeout: 15000 });
  await page.getByTestId(optionTestId).click();
}

test.describe('Pauta trimestral — filtros e UX (Gestão Académica)', () => {
  test.use({ project: 'chromium' });

  test('Inst A (secundário): filtros visíveis, ano/turno/turma funcionam', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin-dashboard/gestao-academica?tab=pautas');
    await page.waitForLoadState('networkidle').catch(() => {});

    await expect(page.getByTestId('gestao-academica-tab-pautas')).toBeVisible({ timeout: T_NAV });
    await expect(page.getByTestId('admin-pautas-heading')).toBeVisible({ timeout: T_NAV });
    await expect(page.getByText(/Pautas de Notas/i).first()).toBeVisible();

    const card = page.getByTestId('pautas-filters-card');
    await expect(card).toBeVisible({ timeout: T_NAV });

    await expect(page.getByText(/^Ano Letivo$/)).toBeVisible();
    await expect(page.getByText(/^Turno$/)).toBeVisible();
    await expect(page.getByText(/^Turma$/)).toBeVisible();
    await expect(page.getByText(/^Incluir Incompletos$/)).toBeVisible();

    const anoTrigger = page.getByTestId('pautas-select-ano-letivo');
    const turnoTrigger = page.getByTestId('pautas-select-turno');
    const turmaTrigger = page.getByTestId('pautas-select-turma');

    await expect(anoTrigger).toBeVisible();
    await expect(turnoTrigger).toBeVisible();
    await expect(turmaTrigger).toBeVisible();

    await expect(anoTrigger).toBeEnabled({ timeout: T_NAV });
    await expect(turnoTrigger).toBeEnabled();
    await expect(turmaTrigger).toBeEnabled();

    const hint = page.getByTestId('pautas-hint-turno-filtro');
    await expect(hint).toBeVisible();
    await expect(hint).toContainText(/turma/i);
    await expect(hint).toContainText(/turno/i);

    await expect(page.getByTestId('pautas-switch-incluir-incompletos')).toBeVisible();

    // --- Ano letivo: escolher primeiro ano real (se existir no seed) ou manter Todos ---
    await anoTrigger.click();
    await expect(page.getByTestId('pautas-ano-option-todos')).toBeVisible({ timeout: 15000 });
    const firstReal = page.getByTestId('pautas-ano-option-first-real');
    if ((await firstReal.count()) > 0) {
      await firstReal.click();
    } else {
      await page.getByTestId('pautas-ano-option-todos').click();
    }
    await expect(anoTrigger).toBeVisible();

    // --- Turno: Manhã (refina lista) ---
    await openSelectAndPick(page, 'pautas-select-turno', 'pautas-turno-option-manha');
    await expect(turnoTrigger).toContainText(/Manhã/i);

    // Contagem de turmas com filtro Manhã
    await turmaTrigger.click();
    const listbox = page.getByRole('listbox').first();
    await expect(listbox).toBeVisible({ timeout: 15000 });
    const nManha = await listbox.getByRole('option').count();
    await page.keyboard.press('Escape');

    // --- Turno: Todos (lista não deve ser mais restritiva que Manhã) ---
    await openSelectAndPick(page, 'pautas-select-turno', 'pautas-turno-option-todos');
    await turmaTrigger.click();
    await expect(page.getByRole('listbox').first()).toBeVisible({ timeout: 15000 });
    const nTodos = await page.getByRole('listbox').first().getByRole('option').count();
    await page.keyboard.press('Escape');
    expect(nTodos).toBeGreaterThanOrEqual(nManha);

    // --- Selecionar primeira turma quando houver ---
    await turmaTrigger.click();
    const lb = page.getByRole('listbox').first();
    await expect(lb).toBeVisible({ timeout: 15000 });
    const firstOpt = page.getByTestId('pautas-turma-option-first');
    if ((await firstOpt.count()) === 0) {
      await page.keyboard.press('Escape');
      test.skip(true, 'Seed sem turmas na Inst A para Pautas (após filtros)');
      return;
    }
    await firstOpt.click();

    await expect(page.getByRole('heading', { name: /Pauta de Notas/i })).toBeVisible({ timeout: T_NAV });

    const emptyOrContent = page
      .getByText(/Nenhum estudante matriculado nesta turma/i)
      .or(page.getByText(/Total/i))
      .or(page.getByTestId('pautas-export-pdf'));
    await expect(emptyOrContent.first()).toBeVisible({ timeout: 25000 });
  });

  test('Inst B (superior): mesmos filtros visíveis e operacionais', async ({ page }) => {
    await loginAsAdminInstB(page);
    await page.goto('/admin-dashboard/gestao-academica?tab=pautas');
    await page.waitForLoadState('networkidle').catch(() => {});

    await expect(page.getByTestId('gestao-academica-tab-pautas')).toBeVisible({ timeout: T_NAV });
    await expect(page.getByTestId('pautas-filters-card')).toBeVisible({ timeout: T_NAV });
    await expect(page.getByTestId('pautas-select-ano-letivo')).toBeEnabled({ timeout: T_NAV });
    await expect(page.getByTestId('pautas-select-turno')).toBeEnabled();
    await expect(page.getByTestId('pautas-select-turma')).toBeEnabled();

    await openSelectAndPick(page, 'pautas-select-turno', 'pautas-turno-option-tarde');
    await expect(page.getByTestId('pautas-select-turno')).toContainText(/Tarde/i);

    await openSelectAndPick(page, 'pautas-select-turno', 'pautas-turno-option-todos');

    await page.getByTestId('pautas-select-turma').click();
    const lb = page.getByRole('listbox').first();
    await expect(lb).toBeVisible({ timeout: 15000 });
    const n = await lb.getByRole('option').count();
    await page.keyboard.press('Escape');
    if (n === 0) {
      test.skip(true, 'Seed sem turmas na Inst B para Pautas');
      return;
    }

    await page.getByTestId('pautas-select-turma').click();
    await expect(page.getByRole('listbox').first()).toBeVisible({ timeout: 15000 });
    const first = page.getByTestId('pautas-turma-option-first');
    await expect(first).toBeVisible({ timeout: 10000 });
    await first.click();

    await expect(
      page
        .getByText(/Nenhum estudante matriculado nesta turma/i)
        .or(page.getByText(/Total/i))
        .or(page.getByTestId('pautas-export-pdf'))
        .first(),
    ).toBeVisible({ timeout: 25000 });
  });
});
