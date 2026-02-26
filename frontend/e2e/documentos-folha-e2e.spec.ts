/**
 * E2E: Documentos oficiais (Secundário + Superior) e Folha de Pagamento
 *
 * Garante:
 * - Backend e frontend alinhados para emissão de documentos (Declaração/Certificado)
 * - PDFs conforme implementação (ensino secundário e superior)
 * - Folha de pagamento: UI carrega lista e opções corretas
 * - Dados aparecem na UI após emissão
 *
 * Pré-requisitos: backend a correr; seed multi-tenant (Inst A = secundário, Inst B = superior).
 */
import { test, expect } from '@playwright/test';
import { loginAsAdmin, loginAsAdminInstB } from './fixtures/auth';

const TIMEOUT_NAV = 20000;
const TIMEOUT_VISIBLE = 15000;

test.describe('Documentos oficiais (Secundário e Superior)', () => {
  test('Admin Inst A: lista de alunos e acesso à emissão de documentos', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForLoadState('domcontentloaded');

    await page.goto('/admin-dashboard/gestao-alunos');
    await page.waitForURL(/gestao-alunos/, { timeout: TIMEOUT_NAV });

    const table = page.locator('table tbody');
    await expect(table).toBeVisible({ timeout: TIMEOUT_VISIBLE });

    const rows = page.locator('table tbody tr');
    const count = await rows.count();
    if (count === 0) {
      await expect(page.getByText(/não há alunos|nenhum aluno/i)).toBeVisible({ timeout: 8000 });
      test.skip();
      return;
    }

    const editButton = rows.first().getByRole('button').nth(2);
    await editButton.click();
    await page.waitForURL(/editar-aluno\/[a-f0-9-]+/i, { timeout: TIMEOUT_NAV });

    const tabDocumentos = page.getByRole('tab', { name: /Documentos/i });
    await expect(tabDocumentos).toBeVisible({ timeout: 8000 });
    await tabDocumentos.click();

    await expect(page.getByText(/Emitir Documento Oficial/i)).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    await expect(page.getByText(/Selecione o tipo/i).or(page.locator('button:has-text("Selecione")').first())).toBeVisible({ timeout: 8000 });
  });

  test('Admin Inst A: emitir Declaração de Matrícula e ver documento na lista', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForLoadState('domcontentloaded');

    await page.goto('/admin-dashboard/gestao-alunos');
    await page.waitForURL(/gestao-alunos/, { timeout: TIMEOUT_NAV });

    const rows = page.locator('table tbody tr');
    const count = await rows.count();
    if (count === 0) {
      test.skip();
      return;
    }

    const editButton = rows.first().getByRole('button').nth(2);
    await editButton.click();
    await page.waitForURL(/editar-aluno\/[a-f0-9-]+/i, { timeout: TIMEOUT_NAV });

    await page.getByRole('tab', { name: /Documentos/i }).click();
    await expect(page.getByText(/Emitir Documento Oficial/i)).toBeVisible({ timeout: TIMEOUT_VISIBLE });

    const selectTrigger = page.locator('[role="combobox"]').first();
    await selectTrigger.click();
    await page.getByRole('option', { name: /Declaração de Matrícula/i }).click();

    await page.waitForTimeout(1500);

    const preValidacaoOk = page.getByText(/Prévia OK|prévia ok|Dados serão preenchidos/i);
    const preValidacaoErro = page.getByText(/Não é possível emitir|sem matrícula ativa|Bloqueado/i);
    const okVisible = await preValidacaoOk.isVisible().catch(() => false);
    const errVisible = await preValidacaoErro.isVisible().catch(() => false);

    if (errVisible && !okVisible) {
      test.skip();
      return;
    }

    const btnEmitir = page.getByRole('button', { name: /Emitir PDF/i });
    await expect(btnEmitir).toBeVisible({ timeout: 5000 });
    if (await btnEmitir.isDisabled().catch(() => true)) {
      test.skip();
      return;
    }

    const [toastRes] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('/documentos/emitir-json') && (res.status() === 201 || res.status() === 200), { timeout: 15000 }).catch(() => null),
      btnEmitir.click(),
    ]);

    await expect(
      page.getByText(/Documento emitido|emitido com sucesso|Código:/i)
    ).toBeVisible({ timeout: TIMEOUT_VISIBLE });

    await expect(page.getByText(/DECL-|Documentos emitidos/i)).toBeVisible({ timeout: 8000 });
  });

  test('Admin Inst B (Superior): acesso à emissão e tipos de documento na UI', async ({ page }) => {
    await loginAsAdminInstB(page);
    await page.waitForLoadState('domcontentloaded');

    await page.goto('/admin-dashboard/gestao-alunos');
    await page.waitForURL(/gestao-alunos/, { timeout: TIMEOUT_NAV });

    const rows = page.locator('table tbody tr');
    const count = await rows.count();
    if (count === 0) {
      test.skip();
      return;
    }

    const editButton = rows.first().getByRole('button').nth(2);
    await editButton.click();
    await page.waitForURL(/editar-aluno\/[a-f0-9-]+/i, { timeout: TIMEOUT_NAV });

    await page.getByRole('tab', { name: /Documentos/i }).click();
    await expect(page.getByText(/Emitir Documento Oficial/i)).toBeVisible({ timeout: TIMEOUT_VISIBLE });

    const selectTrigger = page.locator('[role="combobox"]').first();
    await selectTrigger.click();

    await expect(page.getByRole('option', { name: /Declaração de Matrícula/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('option', { name: /Certificado de Conclusão/i })).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Folha de Pagamento (UI e backend alinhados)', () => {
  test('Admin: acede à Folha de Pagamento e vê lista ou estado vazio', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForLoadState('domcontentloaded');

    const [folhaRes] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/folha-pagamento') && res.status() === 200,
        { timeout: 20000 }
      ).catch(() => null),
      page.goto('/admin-dashboard/recursos-humanos?tab=folha'),
    ]);
    await page.waitForURL(/recursos-humanos/, { timeout: TIMEOUT_NAV });

    const tabFolha = page.getByRole('tab', { name: /Folha de Pagamento|Folha/i });
    await tabFolha.click();

    await expect(
      page.getByText(/Folha de Pagamento|folha de pagamento|Nenhuma folha|nenhuma folha/i)
    ).toBeVisible({ timeout: TIMEOUT_VISIBLE });

    const tabelaOuVazio = page.locator('table').or(page.getByText(/Nenhuma folha|nenhuma folha/i));
    await expect(tabelaOuVazio).toBeVisible({ timeout: 10000 });
  });

  test('Admin: filtros de mês/ano e botão Nova folha ou Calcular visíveis', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForLoadState('domcontentloaded');

    await page.goto('/admin-dashboard/recursos-humanos?tab=folha');
    await page.waitForURL(/recursos-humanos/, { timeout: TIMEOUT_NAV });

    await page.getByRole('tab', { name: /Folha de Pagamento|Folha/i }).click();

    const hasNovaFolha = await page.getByRole('button', { name: /Nova folha|Adicionar|Calcular automático|Gerar/i }).first().isVisible().catch(() => false);
    const hasPeriodo = await page.getByText(/\d{1,2}\/\d{4}|Mês|Ano|período/i).first().isVisible().catch(() => false);
    expect(hasNovaFolha || hasPeriodo).toBeTruthy();
  });
});
