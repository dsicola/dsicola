/**
 * E2E: Secretaria → Relatórios Oficiais (boletim, pauta oficial, histórico).
 *
 * Checklist manual (replicar em staging/demo):
 * 1) Login SECRETARIA Inst A; abrir /secretaria-dashboard/relatorios-oficiais.
 * 2) Boletim: ano letivo opcional; escolher aluno; Gerar Boletim — esperar tabela ou mensagem de erro
 *    (ano letivo ativo, matrículas, planos). PDF só com modelo Boletim configurado.
 * 3) Pauta: só planos APROVADO/ENCERRADOS; Gerar Pauta — pré-requisitos: aulas lançadas, presenças,
 *    todas avaliações fechadas. A visualização usa o payload de /relatorios-oficiais/pauta.
 * 4) Histórico: escolher aluno; Gerar — pode bloquear por documentos/financeiro conforme regras.
 * 5) Repetir com Inst B (superior): login secretaria.inst.b; textos e fluxo equivalentes (semestres vs trimestres na gestão, não neste ecrã).
 *
 * Pré-requisitos: seed multi-tenant + backend em /health (ver fixtures/backendHealth.ts).
 */
import { test, expect } from '@playwright/test';
import { loginAsSecretaria, loginAsSecretariaInstB } from './fixtures/auth';
import { isE2eBackendHealthy, E2E_BACKEND_SKIP_MESSAGE } from './fixtures/backendHealth';

const T_NAV = 28000;
const T_API = 45000;

test.describe('Secretaria — Relatórios Oficiais', () => {
  test.use({ project: 'chromium' });

  test.beforeEach(async ({ request }) => {
    const { ok, tried } = await isE2eBackendHealthy(request);
    if (!ok) test.skip(true, `${E2E_BACKEND_SKIP_MESSAGE} Tentado: ${tried.join(', ')}`);
  });

  test('Página carrega: título, separadores e pré-requisitos da pauta', async ({ page }) => {
    await loginAsSecretaria(page);
    await page.goto('/secretaria-dashboard/relatorios-oficiais');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByTestId('relatorios-oficiais-secretaria')).toBeVisible({ timeout: T_NAV });
    await expect(page.getByRole('heading', { name: 'Relatórios Oficiais' })).toBeVisible();

    await expect(page.getByTestId('relatorios-oficiais-tabs')).toBeVisible();
    await expect(page.getByTestId('relatorios-tab-boletim')).toBeVisible();
    await expect(page.getByTestId('relatorios-tab-pauta')).toBeVisible();
    await expect(page.getByTestId('relatorios-tab-historico')).toBeVisible();

    await page.getByTestId('relatorios-tab-pauta').click();
    await expect(page.getByText(/Pré-requisitos institucionais para emitir a pauta/i)).toBeVisible({
      timeout: T_NAV,
    });
    await expect(page.getByText(/APROVADO ou ENCERRADO/i)).toBeVisible();
  });

  test('Boletim: com alunos no seed, gerar ou ver erro institucional', async ({ page }) => {
    await loginAsSecretaria(page);
    await page.goto('/secretaria-dashboard/relatorios-oficiais');
    await page.waitForLoadState('domcontentloaded');

    await page.getByTestId('relatorios-tab-boletim').click();
    await expect(page.getByTestId('relatorios-boletim-select-aluno')).toBeVisible({ timeout: T_NAV });

    await page.getByTestId('relatorios-boletim-select-aluno').click();
    const optAluno = page.getByRole('option').first();
    if ((await optAluno.count()) === 0) {
      await page.keyboard.press('Escape');
      test.skip(true, 'Seed sem alunos listados para boletim');
      return;
    }
    await optAluno.click();

    await page.getByTestId('relatorios-boletim-gerar').click();

    const ok = page.getByTestId('relatorios-boletim-resultado');
    const err = page.getByTestId('relatorios-boletim-erro');
    await expect(ok.or(err).first()).toBeVisible({ timeout: T_API });

    if (await err.isVisible().catch(() => false)) {
      await expect(err.getByText(/Erro ao gerar boletim/i)).toBeVisible();
      return;
    }

    await expect(page.getByRole('heading', { name: /Boletim Acadêmico/i })).toBeVisible({
      timeout: T_NAV,
    });
  });

  test('Pauta oficial: com plano no seed, gerar ou ver pré-requisitos / erro', async ({ page }) => {
    await loginAsSecretaria(page);
    await page.goto('/secretaria-dashboard/relatorios-oficiais');
    await page.waitForLoadState('domcontentloaded');

    await page.getByTestId('relatorios-tab-pauta').click();
    await expect(page.getByTestId('relatorios-pauta-select-plano')).toBeVisible({ timeout: T_NAV });

    await page.getByTestId('relatorios-pauta-select-plano').click();
    const optPlano = page.getByRole('option').first();
    if ((await optPlano.count()) === 0) {
      await page.keyboard.press('Escape');
      await expect(page.getByText(/Nenhum plano de ensino APROVADO ou ENCERRADO encontrado/i)).toBeVisible();
      return;
    }
    await optPlano.click();

    await page.getByTestId('relatorios-pauta-gerar').click();

    const resultado = page.getByTestId('relatorios-pauta-resultado');
    const erro = page.getByTestId('relatorios-pauta-erro');
    await expect(resultado.or(erro).first()).toBeVisible({ timeout: T_API });

    if (await erro.isVisible().catch(() => false)) {
      await expect(erro.getByText(/Erro ao gerar pauta/i)).toBeVisible();
      return;
    }

    await expect(page.getByTestId('pauta-visualizacao')).toBeVisible({ timeout: T_NAV });
    await expect(page.getByRole('heading', { name: /Pauta de Avaliação/i })).toBeVisible();
  });

  test('Histórico: com aluno no seed, gerar ou ver erro (bloqueio / dados)', async ({ page }) => {
    await loginAsSecretaria(page);
    await page.goto('/secretaria-dashboard/relatorios-oficiais');
    await page.waitForLoadState('domcontentloaded');

    await page.getByTestId('relatorios-tab-historico').click();
    await expect(page.getByTestId('relatorios-historico-select-aluno')).toBeVisible({ timeout: T_NAV });

    await page.getByTestId('relatorios-historico-select-aluno').click();
    const optAluno = page.getByRole('option').first();
    if ((await optAluno.count()) === 0) {
      await page.keyboard.press('Escape');
      test.skip(true, 'Seed sem alunos para histórico');
      return;
    }
    await optAluno.click();

    await page.getByTestId('relatorios-historico-gerar').click();

    const resultado = page.getByTestId('relatorios-historico-resultado');
    const erro = page.getByTestId('relatorios-historico-erro');
    await expect(resultado.or(erro).first()).toBeVisible({ timeout: T_API });

    if (await erro.isVisible().catch(() => false)) {
      await expect(erro.getByText(/Erro ao gerar histórico/i)).toBeVisible();
      return;
    }

    await expect(page.getByText(/Documento Oficial/i).first()).toBeVisible({
      timeout: T_NAV,
    });
  });
});

test.describe('Secretaria Inst B — Relatórios Oficiais (multi-tenant, superior)', () => {
  test.use({ project: 'chromium' });

  test.beforeEach(async ({ request }) => {
    const { ok, tried } = await isE2eBackendHealthy(request);
    if (!ok) test.skip(true, `${E2E_BACKEND_SKIP_MESSAGE} Tentado: ${tried.join(', ')}`);
  });

  test('Página acessível após login secretaria Inst B', async ({ page }) => {
    await loginAsSecretariaInstB(page);
    await page.goto('/secretaria-dashboard/relatorios-oficiais');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByTestId('relatorios-oficiais-secretaria')).toBeVisible({ timeout: T_NAV });
    await expect(page.getByTestId('relatorios-tab-boletim')).toBeVisible();
    await expect(page.getByTestId('relatorios-tab-pauta')).toBeVisible();
  });
});
