/**
 * ROADMAP-100 — E2E: Matrícula — criar aluno e matricular em turma.
 *
 * Pré-requisitos: backend a correr; seed: seed-multi-tenant-test (cria Inst A com turma e matrícula anual do Aluno A).
 *
 * 1) Criar aluno: login Admin -> criar-aluno -> preencher dados mínimos -> submeter -> sucesso.
 * 2) Matricular em turma: login Admin -> gestao-alunos tab matriculas-turmas -> Matricular em Turma ->
 *    selecionar aluno (Aluno Instituição A, já com matrícula anual no seed) -> selecionar turma -> submeter -> sucesso.
 */
import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './fixtures/auth';

const TIMEOUT_NAV = 15000;
const TIMEOUT_VISIBLE = 15000;

test.describe('ROADMAP-100: Matrícula (criar aluno, matricular em turma)', () => {
  test.use({ project: 'chromium' });

  test('Criar aluno: formulário mínimo e submissão com sucesso', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForLoadState('domcontentloaded');

    await page.goto('/admin-dashboard/criar-aluno');
    await page.waitForURL(/criar-aluno/, { timeout: TIMEOUT_NAV });

    const suffix = Date.now().toString(36).slice(-6);
    const email = `e2e.matricula.${suffix}@teste.dsicola.com`;
    const bi = `BI-E2E-${suffix}`;

    await page.getByLabel(/primeiro nome/i).fill('E2E');
    await page.getByLabel(/último nome/i).fill('Matricula Test');
    await page.locator('#numero_identificacao').fill(bi);
    await page.getByRole('tab', { name: /endereço|endereco/i }).click();
    await page.locator('#email').fill(email);
    await page.getByRole('tab', { name: /acadêmico|academico/i }).click();
    await page.getByRole('button', { name: /cadastrar|estudante/i }).click();

    await expect(page.getByText(/estudante cadastrado|sucesso/i)).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    await page.waitForURL(/gestao-alunos|secretaria-dashboard\/alunos|admin-dashboard/, { timeout: TIMEOUT_NAV }).catch(() => {});
    expect(page.url()).toMatch(/gestao-alunos|alunos|admin-dashboard/);
  });

  test('Matricular em turma: selecionar aluno e turma e submeter com sucesso', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForLoadState('domcontentloaded');

    await page.goto('/admin-dashboard/gestao-alunos?tab=matriculas-turmas');
    await page.waitForURL(/gestao-alunos.*matriculas-turmas|gestao-alunos/, { timeout: TIMEOUT_NAV });

    await page.getByRole('button', { name: /matricular em turma/i }).click();
    await expect(page.getByRole('dialog').getByText(/matricular estudante em turma/i)).toBeVisible({ timeout: TIMEOUT_VISIBLE });

    const searchInput = page.getByPlaceholder(/nome do estudante|digite o nome/i).first();
    await searchInput.fill('Aluno Instituição');
    await page.waitForTimeout(800);
    const option = page.locator('[class*="cursor-pointer"]').filter({ hasText: 'Aluno Instituição A' }).first();
    await expect(option).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    await option.click();

    await page.waitForTimeout(800);
    const dialog = page.getByRole('dialog');
    const turmaCombobox = dialog.getByText(/Turma \*/).locator('../..').getByRole('combobox').first();
    await expect(turmaCombobox).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    await turmaCombobox.click();
    await page.getByRole('option', { name: /10ª Classe|Turma A/i }).first().click();

    await page.getByRole('button', { name: /^Matricular$/i }).click();

    await expect(page.getByText(/matriculado|sucesso/i)).toBeVisible({ timeout: TIMEOUT_VISIBLE });
  });
});
