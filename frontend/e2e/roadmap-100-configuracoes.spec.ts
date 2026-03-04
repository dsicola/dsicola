/**
 * E2E - Configurações da instituição (ROADMAP-100)
 *
 * Valida que salvar configuração da instituição não quebra o sistema.
 *
 * Pré-requisitos: Backend + seeds (multi-tenant, perfis-completos)
 * Comando: npm run test:e2e -- e2e/roadmap-100-configuracoes.spec.ts
 */
import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './fixtures/auth';

const TIMEOUT = 15000;

test.describe('E2E - Configurações da instituição', () => {
  test.use({ project: 'chromium' });

  test('Admin: aceder Configurações e salvar (sem quebrar)', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForLoadState('domcontentloaded');

    // Navegar para Configurações
    await page.goto('/admin-dashboard/configuracoes');
    await page.waitForURL(/configuracoes/, { timeout: TIMEOUT });
    await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: TIMEOUT });

    // Aguardar carregamento (skeleton ou formulário)
    await page.waitForSelector('input, button', { state: 'visible', timeout: TIMEOUT });

    // Alterar um campo simples (telefone) - não destrutivo
    const telefoneInput = page.locator('input[name="telefone"], input[id="telefone"]').first();
    if (await telefoneInput.isVisible()) {
      await telefoneInput.fill('+244 900 000 000');
    }

    // Clicar em "Salvar Configurações"
    const saveBtn = page.getByRole('button', { name: /salvar configurações/i }).first();
    await expect(saveBtn).toBeVisible({ timeout: TIMEOUT });
    await saveBtn.click();

    // Aguardar fim do salvamento (botão deixa de estar disabled ou toast aparece)
    await page.waitForTimeout(3000);

    // Verificar que não houve erro crítico (página ainda carregada, sem crash)
    const main = page.locator('main, [role="main"]').first();
    await expect(main).toBeVisible({ timeout: 5000 });

    // Verificar que estamos ainda em configuracoes ou voltou ao dashboard
    expect(page.url()).toMatch(/configuracoes|admin-dashboard/);
  });

  test('Admin: salvar apenas cores (fluxo mínimo)', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForLoadState('domcontentloaded');

    await page.goto('/admin-dashboard/configuracoes');
    await page.waitForURL(/configuracoes/, { timeout: TIMEOUT });

    // Abrir tab de Identidade Visual se existir
    const identidadeTab = page.getByRole('tab', { name: /identidade|visual|cores/i }).first();
    if (await identidadeTab.isVisible()) {
      await identidadeTab.click();
      await page.waitForTimeout(500);
    }

    // Clicar em "Salvar Cores"
    const saveCoresBtn = page.getByRole('button', { name: /salvar cores/i }).first();
    if (await saveCoresBtn.isVisible()) {
      await saveCoresBtn.click();
      await page.waitForTimeout(2000);
      await expect(page.locator('main').first()).toBeVisible();
    }

    expect(page.url()).toMatch(/configuracoes|admin-dashboard/);
  });
});
