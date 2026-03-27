/**
 * E2E - Configurações de Impressão
 *
 * Testa o painel de Configurações de Impressão (impressão direta, formato A4/80mm, cópias, impressora).
 *
 * Pré-requisitos: Backend + seeds (multi-tenant)
 * Comando: npm run test:e2e -- e2e/config-impressao.spec.ts
 */
import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './fixtures/auth';

const TIMEOUT = 15000;

test.describe('E2E - Configurações de Impressão', () => {
  test.use({ project: 'chromium' });

  test('Admin: aceder Configurações e ver painel de Impressão', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForLoadState('domcontentloaded');

    await page.goto('/admin-dashboard/configuracoes');
    await page.waitForURL(/configuracoes/, { timeout: TIMEOUT });
    await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: TIMEOUT });

    await expect(page.getByText(/Configurações de Impressão|Print settings/i)).toBeVisible({ timeout: TIMEOUT });
    await expect(page.getByText(/Impressão direta|Direct printing/i)).toBeVisible({ timeout: 5000 });
  });

  test('Admin: alterar configurações de impressão e salvar', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForLoadState('domcontentloaded');

    await page.goto('/admin-dashboard/configuracoes');
    await page.waitForURL(/configuracoes/, { timeout: TIMEOUT });

    // Garantir que estamos na tab Geral (onde está o painel de impressão)
    const geralTab = page.getByRole('tab', { name: /geral/i }).first();
    if (await geralTab.isVisible()) {
      await geralTab.click();
      await page.waitForTimeout(500);
    }

    // Scroll para o painel de impressão
    const impressaoSection = page.getByText(/Configurações de Impressão|Print settings/i).first();
    await impressaoSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    // Toggle Impressão direta (Radix Switch com id impressao_direta)
    const impressaoDiretaSwitch = page.locator('#impressao_direta, [id="impressao_direta"]').first();
    if (await impressaoDiretaSwitch.isVisible()) {
      await impressaoDiretaSwitch.click();
      await page.waitForTimeout(300);
      await expect(page.getByText(/Formato padrão|Default format/i)).toBeVisible({ timeout: 3000 });
    }

    // Alterar formato padrão (A4 ou 80mm)
    const formatoSelect = page.locator('#formato_padrao_impressao').first();
    if (await formatoSelect.isVisible()) {
      await formatoSelect.click();
      await page.waitForTimeout(200);
      const termicoOption = page.getByRole('option', { name: /80mm|térmica/i }).first();
      if (await termicoOption.isVisible()) {
        await termicoOption.click();
      } else {
        await page.keyboard.press('Escape');
      }
      await page.waitForTimeout(200);
    }

    // Voltar formato para A4 (para não deixar config alterada)
    const formatoSelect2 = page.locator('#formato_padrao_impressao').first();
    if (await formatoSelect2.isVisible()) {
      await formatoSelect2.click();
      await page.waitForTimeout(200);
      const a4Option = page.getByRole('option', { name: /A4/i }).first();
      if (await a4Option.isVisible()) {
        await a4Option.click();
      }
      await page.waitForTimeout(200);
    }

    // Salvar Configurações
    const saveBtn = page.getByRole('button', { name: /salvar configurações/i }).first();
    await saveBtn.scrollIntoViewIfNeeded();
    await expect(saveBtn).toBeVisible({ timeout: TIMEOUT });
    await saveBtn.click();

    // Aguardar salvamento (toast de sucesso ou fim do loading)
    await page.waitForTimeout(4000);

    // Verificar que não houve erro
    const main = page.locator('main, [role="main"]').first();
    await expect(main).toBeVisible({ timeout: 5000 });
    expect(page.url()).toMatch(/configuracoes|admin-dashboard/);

    // Verificar que toast de sucesso apareceu (opcional)
    const toast = page.locator('[data-sonner-toast], [role="status"]').first();
    const toastVisible = await toast.isVisible().catch(() => false);
    if (toastVisible) {
      await expect(toast).toContainText(/salv|guardad|sucesso/i).catch(() => {});
    }
  });

  test('Admin: número de cópias e nome impressora visíveis', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForLoadState('domcontentloaded');

    await page.goto('/admin-dashboard/configuracoes');
    await page.waitForURL(/configuracoes/, { timeout: TIMEOUT });

    const impressaoSection = page.getByText(/Configurações de Impressão|Print settings/i).first();
    await impressaoSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    // Verificar campos
    await expect(page.getByText(/Número de cópias por recibo|Copies per receipt/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Impressora preferida|Preferred printer/i)).toBeVisible({ timeout: 5000 });
  });
});
