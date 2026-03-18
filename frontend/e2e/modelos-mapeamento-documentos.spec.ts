/**
 * E2E - Modelos de Documentos e Mapeamento (100% produção)
 *
 * Cobre:
 * - Navegação para Certificados → Importar Modelos
 * - CRUD modelos HTML (Certificado, Declaração)
 * - Importar modelo Excel (Pauta de Conclusão / Boletim)
 * - Modo PLACEHOLDER e CELL_MAPPING
 * - Editor de mapeamento visual (ExcelMappingEditor): grid Excel, sugerir, validar, preview
 * - Pré-visualização de certificados, declarações e pautas
 * - Multi-tenant: Inst A (Secundário) e Inst B (Superior)
 *
 * Pré-requisitos:
 *   - Backend a correr (API)
 *   - Seeds: npx tsx backend/scripts/seed-multi-tenant-test.ts
 *   - npx tsx backend/scripts/seed-perfis-completos.ts
 *
 * Comando:
 *   cd frontend && npm run test:e2e:modelos-mapeamento
 *   E2E_SKIP_WEB_SERVER=1 npm run test:e2e:modelos-mapeamento
 */
import { test, expect, type Page, type Locator } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { loginAsAdmin, loginAsAdminInstB } from './fixtures/auth';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXCEL_FIXTURE = path.join(__dirname, 'fixtures', 'test-pauta-conclusao.xlsx');

const TIMEOUT_NAV = 20000;
const TIMEOUT_VISIBLE = 15000;

/** Seleciona tipo Excel (Pauta de Conclusão) no combobox Tipo de documento. */
async function selectTipoExcel(page: Page, dialog: Locator, tipo: 'Pauta de Conclusão' | 'Mini Pauta' = 'Pauta de Conclusão') {
  await dialog.getByRole('combobox').first().click();
  const option = page.getByRole('option', { name: tipo });
  await expect(option).toBeVisible({ timeout: 3000 });
  await option.scrollIntoViewIfNeeded();
  await option.click();
  const fileInput = dialog.getByTestId('modelo-excel-file-input');
  await expect(fileInput).toBeVisible({ timeout: 8000 });
  await fileInput.scrollIntoViewIfNeeded();
}

test.describe('E2E - Modelos e Mapeamento de Documentos', () => {
  test.use({ project: 'chromium' });

  test('Admin: navegar para Modelos de Documentos e ver UI completa', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForLoadState('domcontentloaded');

    await page.goto('/admin-dashboard/certificados?tab=modelos&subtab=importados');
    await page.waitForURL(/certificados/, { timeout: TIMEOUT_NAV });

    await expect(page.getByRole('tab', { name: /Importar modelos|importar/i }).first()).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    await expect(page.getByText(/Importar e gerir modelos|modelos importados/i)).toBeVisible({ timeout: TIMEOUT_VISIBLE });

    const importBtn = page.getByRole('button', { name: /Importar modelo|Importar primeiro modelo/i }).first();
    await expect(importBtn).toBeVisible({ timeout: TIMEOUT_VISIBLE });

    const tabsImportados = page.getByRole('tab', { name: /Importar \/ Modelos|Mini Pautas|Certificados|Declarações/i });
    await expect(tabsImportados.first()).toBeVisible({ timeout: TIMEOUT_VISIBLE });
  });

  test('Admin: criar modelo HTML (Certificado) completo', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForLoadState('domcontentloaded');

    await page.goto('/admin-dashboard/certificados?tab=modelos&subtab=importados');
    await page.waitForURL(/certificados/, { timeout: TIMEOUT_NAV });

    const importBtn = page.getByRole('button', { name: /Importar modelo \(Excel|Importar modelo/ }).first();
    await expect(importBtn).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    await importBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    await expect(dialog.getByRole('heading', { name: /Importar modelo|Editar modelo/i })).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    await dialog.getByRole('combobox').first().click();
    await page.getByRole('option', { name: /Certificado/i }).click();

    await dialog.getByPlaceholder(/Ex: Certificado Superior|Identificação/i).fill('E2E Certificado Teste ' + Date.now());
    await dialog.getByPlaceholder(/Ex: Modelo oficial/i).fill('Modelo E2E para validação');

    await dialog.getByRole('combobox').nth(2).click();
    await page.getByRole('option', { name: /^HTML$/i }).click();

    const htmlTemplate = `
      <html><body>
        <h1>Certificado de Conclusão</h1>
        <p>{{NOME_ALUNO}}</p>
        <p>{{CURSO}}</p>
        <p>{{ANO_LETIVO}}</p>
      </body></html>
    `;
    await page.getByPlaceholder(/<html>/).fill(htmlTemplate);

    const submitBtn = page.getByRole('button', { name: /Importar|Guardar/i }).last();
    await expect(submitBtn).toBeVisible({ timeout: TIMEOUT_VISIBLE });

    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/modelos-documento') && ['POST', 'PUT'].includes(res.request().method() ?? '') && [200, 201].includes(res.status()),
        { timeout: 15000 }
      ).catch(() => null),
      submitBtn.click(),
    ]);

    await expect(page.getByText(/Modelo importado com sucesso|Modelo atualizado com sucesso/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 });
  });

  test('Admin: editar e remover modelo (fluxo completo)', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForLoadState('domcontentloaded');

    await page.goto('/admin-dashboard/certificados?tab=modelos&subtab=importados');
    await page.waitForURL(/certificados/, { timeout: TIMEOUT_NAV });

    // Esperar que a lista carregue (tabela ou estado vazio)
    await expect(
      page.locator('table tbody tr').or(page.getByText('Nenhum modelo importado')).first()
    ).toBeVisible({ timeout: TIMEOUT_VISIBLE });

    const table = page.locator('table tbody');
    const rows = table.locator('tr');
    const count = await rows.count();

    if (count === 0) {
      test.skip();
      return;
    }

    const editBtn = rows.first().getByRole('button', { name: /Editar modelo/i });
    await editBtn.click();

    await expect(page.getByRole('dialog')).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    const nomeInput = page.getByPlaceholder(/Ex: Certificado Superior/);
    await nomeInput.clear();
    await nomeInput.fill('Modelo E2E Editado');

    await page.getByRole('button', { name: /Guardar/i }).last().click();
    await expect(page.getByText(/atualizado com sucesso/i)).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1500);

    const rowsAfterEdit = page.locator('table tbody tr');
    const deleteBtn = rowsAfterEdit.first().getByRole('button', { name: /Remover modelo/i });
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();
      await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 5000 });
      await page.getByRole('button', { name: /Remover|Confirmar/i }).last().click();
      await expect(page.getByText(/removido|Modelo removido/i)).toBeVisible({ timeout: 8000 });
    }
  });

  test('Admin: importar modelo Excel e modo PLACEHOLDER', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForLoadState('domcontentloaded');

    await page.goto('/admin-dashboard/certificados?tab=modelos&subtab=importados');
    await page.waitForURL(/certificados/, { timeout: TIMEOUT_NAV });

    const importBtn = page.getByRole('button', { name: /Importar modelo \(Excel|Importar modelo/ }).first();
    await importBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: TIMEOUT_VISIBLE });

    await dialog.getByPlaceholder(/Ex: Certificado Superior/i).fill('E2E Pauta PLACEHOLDER ' + Date.now());
    await selectTipoExcel(page, dialog);

    const fileInput = dialog.getByTestId('modelo-excel-file-input');
    await fileInput.setInputFiles(EXCEL_FIXTURE);

    await expect(dialog.getByText(/Modelo Excel carregado/i)).toBeVisible({ timeout: 8000 });

    const modeSelect = dialog.getByRole('combobox').nth(2);
    if (await modeSelect.isVisible()) {
      await modeSelect.click();
      await page.getByRole('option', { name: /Placeholders/i }).click();
    }

    await page.getByRole('button', { name: /Importar|Guardar/i }).last().click();
    await expect(page.getByText(/Modelo importado com sucesso|Modelo atualizado com sucesso/i)).toBeVisible({ timeout: 15000 });
  });

  test('Admin: importar modelo Excel e modo CELL_MAPPING com editor', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForLoadState('domcontentloaded');

    await page.goto('/admin-dashboard/certificados?tab=modelos&subtab=importados');
    await page.waitForURL(/certificados/, { timeout: TIMEOUT_NAV });

    const importBtn = page.getByRole('button', { name: /Importar modelo \(Excel|Importar modelo/ }).first();
    await importBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: TIMEOUT_VISIBLE });

    await dialog.getByPlaceholder(/Ex: Certificado Superior/i).fill('E2E Pauta CELL_MAPPING ' + Date.now());
    await selectTipoExcel(page, dialog);

    const fileInput = dialog.getByTestId('modelo-excel-file-input');
    await fileInput.setInputFiles(EXCEL_FIXTURE);

    await expect(dialog.getByText(/Modelo Excel carregado/i)).toBeVisible({ timeout: 8000 });

    const modeSelect = dialog.getByRole('combobox').nth(2);
    await modeSelect.click();
    await page.getByRole('option', { name: /Mapeamento por coordenadas/i }).click();

    await expect(page.getByText(/Mapeamento de células/i)).toBeVisible({ timeout: 8000 });

    const sugerirBtn = page.getByRole('button', { name: /Sugerir mapeamento/i });
    await expect(sugerirBtn).toBeVisible({ timeout: 5000 });
    await sugerirBtn.click();

    await page.waitForTimeout(2000);

    const validarBtn = page.getByRole('button', { name: /Validar/i });
    if (await validarBtn.isVisible()) {
      await validarBtn.click();
      await page.waitForTimeout(1500);
    }

    await page.getByRole('button', { name: /Importar|Guardar/i }).last().click();
    await expect(page.getByText(/Modelo importado com sucesso|Modelo atualizado com sucesso/i)).toBeVisible({ timeout: 15000 });
  });

  test('Admin: pré-visualizar certificado e declaração', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForLoadState('domcontentloaded');

    await page.goto('/admin-dashboard/certificados?tab=modelos&subtab=certificados');
    await page.waitForURL(/certificados/, { timeout: TIMEOUT_NAV });

    const verModeloBtn = page.getByRole('button', { name: /Ver modelo|Ver modelo Ensino/i });
    if (await verModeloBtn.isVisible()) {
      await verModeloBtn.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: TIMEOUT_VISIBLE });
      await expect(page.locator('iframe[title], iframe')).toBeVisible({ timeout: 8000 });
    }

    await page.goto('/admin-dashboard/certificados?tab=modelos&subtab=declaracoes');
    await page.waitForURL(/certificados/, { timeout: TIMEOUT_NAV });

    const verMatriculaBtn = page.getByRole('button', { name: /Ver modelo Matrícula/i });
    if (await verMatriculaBtn.isVisible()) {
      await verMatriculaBtn.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    }
  });

  test('Admin Inst B (Superior): modelos e isolamento', async ({ page }) => {
    await loginAsAdminInstB(page);
    await page.waitForLoadState('domcontentloaded');

    await page.goto('/admin-dashboard/certificados?tab=modelos&subtab=importados');
    await page.waitForURL(/certificados/, { timeout: TIMEOUT_NAV });

    await expect(page.getByRole('heading', { name: /Importar e gerir modelos/i })).toBeVisible({ timeout: TIMEOUT_VISIBLE });

    await page.goto('/admin-dashboard/certificados?tab=modelos&subtab=certificados');
    await page.waitForURL(/subtab=certificados/, { timeout: TIMEOUT_NAV });
    // Não clicar no tab — getByRole('tab', /Certificados/i) poderia acionar "Emitir Certificados" (tab exterior).
    // O URL subtab=certificados já mostra a secção Certificados importados.
    // Secção "Certificados importados" na tab Certificados — Inst B (Superior) vê esta área
    await expect(page.getByText(/Certificados importados/i)).toBeVisible({ timeout: TIMEOUT_VISIBLE });
  });

  test('Admin: abrir diálogo DOCX e ver formulário', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForLoadState('domcontentloaded');

    await page.goto('/admin-dashboard/certificados?tab=modelos&subtab=importados');
    await page.waitForURL(/certificados/, { timeout: TIMEOUT_NAV });

    const docxBtn = page.getByRole('button', { name: /Importar DOCX|Word/i });
    await expect(docxBtn).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    await docxBtn.click();

    const docxDialog = page.getByRole('dialog');
    await expect(docxDialog).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    await expect(docxDialog.getByRole('heading', { name: /Importar modelo DOCX/i })).toBeVisible({ timeout: TIMEOUT_VISIBLE });

    await page.getByRole('button', { name: /Cancelar/i }).first().click();
  });
});
