/**
 * Fluxo de notas na UX — multi-tenant (Inst A secundário / Inst B superior).
 *
 * Cobre:
 * - Visibilidade: professor (trimestres vs semestres), admin (notas turma + pautas), aluno (boletim)
 * - Navegação direta às rotas institucionais
 * - Com seed completo: seleção de turma, grelha de lançamento, export PDF da pauta (admin)
 *
 * Pré-requisitos: backend + seed em `e2e/fixtures/auth.ts` (TEST_*_EMAIL).
 * Comando: npm run test:e2e:notas-fluxo --prefix frontend
 */
import { test, expect } from '@playwright/test';
import {
  loginAsAdmin,
  loginAsAdminInstB,
  loginAsProfessor,
  loginAsProfessorInstB,
  loginAsAluno,
  loginAsAlunoInstB,
} from './fixtures/auth';

const T_NAV = 25000;

test.describe('Notas na UX — multi-tenant e rotas', () => {
  test.use({ project: 'chromium' });

  test('Professor Inst A vê modo Secundário e Trimestres em /painel-professor/notas', async ({ page }) => {
    await loginAsProfessor(page);
    await page.goto('/painel-professor/notas');
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.getByTestId('gestao-notas-modo')).toBeVisible({ timeout: T_NAV });
    await expect(page.getByTestId('gestao-notas-modo')).toContainText(/Ensino Secundário/);
    await expect(page.getByTestId('gestao-notas-modo')).toContainText(/Trimestres/);
    await expect(page.getByRole('heading', { name: /Gestão de Notas/i })).toBeVisible();
    await expect(page.getByTestId('professor-notas-select-turma')).toBeVisible();
  });

  test('Professor Inst B vê modo Superior e Semestres', async ({ page }) => {
    await loginAsProfessorInstB(page);
    await page.goto('/painel-professor/notas');
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.getByTestId('gestao-notas-modo')).toBeVisible({ timeout: T_NAV });
    await expect(page.getByTestId('gestao-notas-modo')).toContainText(/Ensino Superior/);
    await expect(page.getByTestId('gestao-notas-modo')).toContainText(/Semestres/);
  });

  test('Menu professor: existe atalho para Notas (plano + turma)', async ({ page }) => {
    await loginAsProfessor(page);
    await page.goto('/painel-professor');
    await page.waitForLoadState('domcontentloaded');
    const linkNotas = page.locator(
      'a[href*="painel-professor/notas"], a:has-text("Notas"), button:has-text("Notas")',
    );
    await expect(linkNotas.first()).toBeVisible({ timeout: 15000 });
  });

  test('Admin Inst A: Gestão Académica — separador Notas trimestrais e lançamento turma', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin-dashboard/gestao-academica?tab=notas');
    await expect(page.getByRole('tab', { name: /Notas Trimestrais/i })).toBeVisible({ timeout: T_NAV });
    await expect(page.getByTestId('admin-notas-turma-heading')).toBeVisible({ timeout: T_NAV });
    await expect(page.getByTestId('admin-notas-select-turma')).toBeVisible();
  });

  test('Admin Inst B: Gestão Académica — separador Notas (superior) e lançamento turma', async ({ page }) => {
    await loginAsAdminInstB(page);
    await page.goto('/admin-dashboard/gestao-academica?tab=notas');
    // Superior usa t('grades.title'): "Notas" (pt) ou "Grades" (en) — evitar /^Notas$/ com i18n inglês
    await expect(page.getByTestId('gestao-academica-tab-notas')).toBeVisible({ timeout: T_NAV });
    await expect(page.getByTestId('admin-notas-turma-heading')).toBeVisible({ timeout: T_NAV });
    await expect(page.getByTestId('admin-notas-select-turma')).toBeVisible();
  });

  test('Admin Inst A: separador Pautas trimestrais e exportação (PDF visível com turma)', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin-dashboard/gestao-academica?tab=pautas');
    await expect(page.getByTestId('gestao-academica-tab-pautas')).toBeVisible({ timeout: T_NAV });
    await expect(page.getByTestId('admin-pautas-heading')).toBeVisible({ timeout: T_NAV });
    const turmaTrigger = page.getByTestId('pautas-select-turma');
    await turmaTrigger.click();
    await expect(page.getByRole('option').first()).toBeVisible({ timeout: 15000 });
    const n = await page.getByRole('option').count();
    if (n === 0) {
      await page.keyboard.press('Escape');
      test.skip(true, 'Seed sem turmas na Inst A para Pautas');
      return;
    }
    for (let i = 0; i < n; i++) {
      if (i > 0) await turmaTrigger.click();
      await page.getByRole('option').nth(i).click();
      const pdf = page.getByTestId('pautas-export-pdf');
      try {
        await pdf.waitFor({ state: 'visible', timeout: 12000 });
        return;
      } catch {
        /* próxima turma */
      }
    }
    throw new Error('PDF de pautas não ficou visível após tentar todas as turmas (Inst A)');
  });

  test('Admin Inst B: separador Pautas e exportação PDF com turma', async ({ page }) => {
    await loginAsAdminInstB(page);
    await page.goto('/admin-dashboard/gestao-academica?tab=pautas');
    await expect(page.getByTestId('gestao-academica-tab-pautas')).toBeVisible({ timeout: T_NAV });
    await expect(page.getByTestId('admin-pautas-heading')).toBeVisible({ timeout: T_NAV });
    const turmaTrigger = page.getByTestId('pautas-select-turma');
    await turmaTrigger.click();
    await expect(page.getByRole('option').first()).toBeVisible({ timeout: 15000 });
    const n = await page.getByRole('option').count();
    if (n === 0) {
      await page.keyboard.press('Escape');
      test.skip(true, 'Seed sem turmas na Inst B para Pautas');
      return;
    }
    for (let i = 0; i < n; i++) {
      if (i > 0) await turmaTrigger.click();
      await page.getByRole('option').nth(i).click();
      const pdf = page.getByTestId('pautas-export-pdf');
      try {
        await pdf.waitFor({ state: 'visible', timeout: 12000 });
        return;
      } catch {
        /* próxima turma */
      }
    }
    throw new Error('PDF de pautas não ficou visível após tentar todas as turmas (Inst B)');
  });

  test('Aluno Inst A: Meu Boletim (pauta / notas consolidadas)', async ({ page }) => {
    await loginAsAluno(page);
    await page.goto('/painel-aluno/boletim');
    await expect(page.getByRole('heading', { name: /Meu Boletim/i })).toBeVisible({ timeout: T_NAV });
  });

  test('Aluno Inst B: Meu Boletim', async ({ page }) => {
    await loginAsAlunoInstB(page);
    await page.goto('/painel-aluno/boletim');
    await expect(page.getByRole('heading', { name: /Meu Boletim/i })).toBeVisible({ timeout: T_NAV });
  });
});

test.describe('Professor — grelha de lançamento (quando há turma no seed)', () => {
  test.use({ project: 'chromium' });

  test('Inst A: após escolher turma, vê três períodos (trimestres) e pode editar célula', async ({ page }) => {
    await loginAsProfessor(page);
    await page.goto('/painel-professor/notas');
    const trigger = page.getByTestId('professor-notas-select-turma');
    await expect(trigger).toBeVisible({ timeout: T_NAV });

    await trigger.click();
    const semPlano = page.getByText(/Sem atribuições no Plano de Ensino/i);
    if (await semPlano.isVisible({ timeout: 15000 }).catch(() => false)) {
      await page.keyboard.press('Escape');
      test.skip(true, 'Seed sem turma/plano atribuído ao professor Inst A');
      return;
    }
    await expect(page.getByRole('option').first()).toBeVisible({ timeout: 15000 });
    const nOptions = await page.getByRole('option').count();

    const card = page.getByTestId('gestao-notas-lancamento-card');
    /** Grelha carregada ou estado vazio (evita poll em .animate-spin: 25s × N turmas) */
    const gradeReady = card
      .getByRole('heading', { name: /Sem alunos/i })
      .or(card.getByText(/Nenhum aluno matriculado nesta/i))
      .or(card.locator('table'));

    for (let i = 0; i < nOptions; i++) {
      if (i > 0) await trigger.click();
      await page.getByRole('option').nth(i).click();
      await expect(card).toBeVisible({ timeout: T_NAV });
      await expect(gradeReady.first()).toBeVisible({ timeout: 20000 });

      const semAlunos =
        (await card.getByRole('heading', { name: /Sem alunos/i }).isVisible().catch(() => false)) ||
        (await card.getByText(/Nenhum aluno matriculado nesta/i).isVisible().catch(() => false));
      if (semAlunos) continue;

      await expect(page.getByText(/Avaliação por trimestre/i)).toBeVisible({ timeout: 10000 });
      await expect(card.locator('table')).toBeVisible({ timeout: 5000 });
      const input = card.locator('input[placeholder*="0"]').first();
      await expect(input).toBeVisible({ timeout: 15000 });
      await input.fill('12');
      await input.press('Enter');
      await page.waitForTimeout(800);
      return;
    }

    test.skip(true, 'Nenhuma turma do professor Inst A com alunos matriculados no seed');
  });

  test('Inst B: após escolher turma, vê grelha de provas (superior)', async ({ page }) => {
    await loginAsProfessorInstB(page);
    await page.goto('/painel-professor/notas');
    const trigger = page.getByTestId('professor-notas-select-turma');
    await expect(trigger).toBeVisible({ timeout: T_NAV });

    await trigger.click();
    if (await page.getByText(/Sem atribuições no Plano de Ensino/i).isVisible({ timeout: 15000 }).catch(() => false)) {
      await page.keyboard.press('Escape');
      test.skip(true, 'Seed sem turma atribuída ao professor Inst B');
      return;
    }
    await expect(page.getByRole('option').first()).toBeVisible({ timeout: 15000 });
    const nOptions = await page.getByRole('option').count();

    const card = page.getByTestId('gestao-notas-lancamento-card');
    const gradeReady = card
      .getByRole('heading', { name: /Sem alunos/i })
      .or(card.getByText(/Nenhum aluno matriculado nesta/i))
      .or(card.locator('table'));

    for (let i = 0; i < nOptions; i++) {
      if (i > 0) await trigger.click();
      await page.getByRole('option').nth(i).click();
      await expect(card).toBeVisible({ timeout: T_NAV });
      await expect(gradeReady.first()).toBeVisible({ timeout: 20000 });

      const semAlunos =
        (await card.getByRole('heading', { name: /Sem alunos/i }).isVisible().catch(() => false)) ||
        (await card.getByText(/Nenhum aluno matriculado nesta/i).isVisible().catch(() => false));
      if (semAlunos) continue;

      await expect(card.locator('table')).toBeVisible({ timeout: 5000 });
      await expect(
        card.getByRole('columnheader').filter({ hasText: /Prova|1ª|P1/i }).first(),
      ).toBeVisible({ timeout: 15000 });
      const input = card.locator('input[placeholder*="0"]').first();
      await input.fill('14');
      await input.press('Enter');
      await page.waitForTimeout(800);
      return;
    }

    test.skip(true, 'Nenhuma turma do professor Inst B com alunos matriculados no seed');
  });
});

test.describe('Admin — grelha dinâmica notas turma (quando há turma)', () => {
  test.use({ project: 'chromium' });

  test('Inst A: selecionar turma mostra tabela de lançamento', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin-dashboard/gestao-academica?tab=notas');
    await page.getByTestId('admin-notas-select-turma').click();
    const opt = page.getByTestId('admin-notas-turma-option-first');
    if ((await opt.count()) === 0) {
      await page.keyboard.press('Escape');
      test.skip(true, 'Seed sem turmas na Inst A');
      return;
    }
    await opt.click();
    const planTrigger = page.getByTestId('admin-notas-select-plano');
    try {
      await planTrigger.waitFor({ state: 'visible', timeout: 15000 });
      await planTrigger.click();
      await page.getByRole('option').first().click();
    } catch {
      /* turma com um único plano: segundo seletor não existe */
    }
    await expect(page.getByTestId('admin-notas-pauta-card')).toBeVisible({ timeout: T_NAV });
    if (await page.getByRole('heading', { name: /Nenhum aluno matriculado/i }).isVisible().catch(() => false)) {
      test.skip(true, 'Turma sem alunos matriculados (admin Inst A)');
      return;
    }
    await expect(page.getByTestId('admin-notas-lancamento-table')).toBeVisible({ timeout: T_NAV });
  });
});
