/**
 * ROADMAP-100 — E2E: Académico — lançar notas, fechar avaliação, pauta.
 *
 * Multi-tenant + dois tipos: Inst A (Secundário) e Inst B (Superior).
 * Pré-requisitos: backend a correr; seed-multi-tenant-test (planos, turmas, alunos, exames, período lançamento).
 *
 * 1) Secundário (Inst A): Professor A → Lançar Notas → selecionar turma → lançar uma nota (1º Trimestre) → salvar.
 * 2) Superior (Inst B): Professor B → Lançar Notas → selecionar turma → lançar uma nota (1ª Prova) → salvar.
 * 3) Pauta: Professor ou Admin acede a relatório pauta (smoke: página carrega).
 */
import { test, expect } from '@playwright/test';
import { loginAsProfessor, loginAsProfessorInstB } from './fixtures/auth';

const TIMEOUT_NAV = 20000;
const TIMEOUT_VISIBLE = 20000;

/** Seleciona a turma no combobox. Para Secundário (Inst A) escolhe a opção com "10ª" (seed); para outros a primeira. */
async function selectTurmaForNotas(page: import('@playwright/test').Page, instSecundario: boolean) {
  const turmaSelect = page.getByRole('combobox').first();
  await expect(turmaSelect).toBeVisible({ timeout: TIMEOUT_VISIBLE });
  await turmaSelect.click();
  await page.waitForTimeout(800);
  const option = instSecundario
    ? page.getByRole('option').filter({ hasText: /10ª|Turma A/i }).first()
    : page.getByTestId('turma-option-first').or(page.getByRole('option').first());
  await expect(option).toBeVisible({ timeout: TIMEOUT_VISIBLE });
  await option.click();
}

/** Espera a tabela de notas aparecer após selecionar turma (dados de alunos/notas carregados). */
async function waitForNotasTable(page: import('@playwright/test').Page) {
  // Dar tempo ao Select para atualizar estado e disparar o fetch de alunos/notas
  await page.waitForTimeout(600);
  // Esperar o pedido de alunos/notas da turma (GET .../notas/.../alunos ou turmaId=)
  const responsePromise = page.waitForResponse(
    (res) => {
      const u = res.url();
      const match = (u.includes('/notas') && u.includes('alunos')) || (u.includes('turma') && u.includes('alunos'));
      return match && res.status() === 200;
    },
    { timeout: 18000 }
  ).catch(() => null);
  // Tabela pode aparecer antes ou logo após a resposta
  await expect(page.locator('table').first()).toBeVisible({ timeout: 25000 });
  await responsePromise;
}

test.describe('ROADMAP-100: Académico (lançar notas, pauta) — multi-tenant Secundário + Superior', () => {
  // Usar --project=chrome para evitar crash do Chromium (SIGSEGV) em alguns macOS

  test('Secundário (Inst A): Professor lança nota (1º Trimestre) e salva', async ({ page }) => {
    await loginAsProfessor(page);
    await page.waitForLoadState('domcontentloaded');

    const [turmasRes] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('/turmas/professor') && res.status() === 200, { timeout: 20000 }),
      page.goto('/painel-professor/notas'),
    ]);
    await page.waitForURL(/painel-professor\/notas/, { timeout: TIMEOUT_NAV });
    const turmasBody = await turmasRes.json().catch(() => ({}));
    const turmas = turmasBody?.turmas ?? turmasBody?.data?.turmas ?? [];
    expect(turmas.length, `API /turmas/professor deve devolver turmas (obtido: ${turmas.length}). Execute seed:multi-tenant e confirme que o backend usa a mesma BD.`).toBeGreaterThan(0);

    await selectTurmaForNotas(page, true);
    await waitForNotasTable(page);
    const firstNotaInput = page.locator('table input[inputmode="decimal"], input[placeholder*="0-20"]').first();
    await expect(firstNotaInput).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    await firstNotaInput.clear({ force: true });
    await firstNotaInput.fill('12', { force: true });

    await expect(page.getByTestId('salvar-todas-notas')).toBeVisible({ timeout: 12000 });
    await page.getByTestId('salvar-todas-notas').click();
    await expect(
      page.getByText(/Notas salvas|notas salvas|sucesso|inseridas|atualizadas/i)
    ).toBeVisible({ timeout: TIMEOUT_VISIBLE });
  });

  test('Superior (Inst B): Professor lança nota (1ª Prova) e salva', async ({ page }) => {
    await loginAsProfessorInstB(page);
    await page.waitForLoadState('domcontentloaded');

    const [turmasRes] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('/turmas/professor') && res.status() === 200, { timeout: 20000 }),
      page.goto('/painel-professor/notas'),
    ]);
    await page.waitForURL(/painel-professor\/notas/, { timeout: TIMEOUT_NAV });
    const turmasBody = await turmasRes.json().catch(() => ({}));
    const turmas = turmasBody?.turmas ?? turmasBody?.data?.turmas ?? [];
    expect(turmas.length, `API /turmas/professor deve devolver turmas para Professor B (obtido: ${turmas.length}).`).toBeGreaterThan(0);

    await selectTurmaForNotas(page, false);
    await waitForNotasTable(page);
    const firstNotaInput = page.locator('table input[inputmode="decimal"], input[placeholder*="0-20"]').first();
    await expect(firstNotaInput).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    await firstNotaInput.clear({ force: true });
    await firstNotaInput.fill('14', { force: true });

    await expect(page.getByTestId('salvar-todas-notas')).toBeVisible({ timeout: 12000 });
    await page.getByTestId('salvar-todas-notas').click();
    await expect(
      page.getByText(/Notas salvas|notas salvas|sucesso|inseridas|atualizadas/i)
    ).toBeVisible({ timeout: TIMEOUT_VISIBLE });
  });

  test('Pauta: Professor A acede a Relatórios e verifica secção pauta', async ({ page }) => {
    await loginAsProfessor(page);
    await page.waitForLoadState('domcontentloaded');

    const sidebar = page.locator('nav').first();
    const relatoriosBtn = sidebar.getByRole('button', { name: /Relatórios/i });
    await expect(relatoriosBtn).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    await relatoriosBtn.click();
    await page.waitForURL(/painel-professor\/relatorios/, { timeout: TIMEOUT_NAV }).catch(() => {});

    expect(page.url()).toMatch(/relatorios/);
    await expect(page.locator('main').or(page.getByRole('main'))).toBeVisible({ timeout: TIMEOUT_VISIBLE });
  });
});
