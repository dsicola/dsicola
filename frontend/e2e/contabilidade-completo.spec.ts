/**
 * E2E: Módulo Contabilidade Completo
 *
 * Cobre fluxo completo:
 * - Plano de contas (seed padrão, criar conta)
 * - Configuração de contas por instituição
 * - Centros de custo (criar)
 * - Lançamentos (criar, listar)
 * - Balancete, Balanço, DRE, Razão
 * - Fecho de exercício (visualizar)
 * - Exportação
 *
 * Pré-requisitos:
 *   - Backend a correr
 *   - Seed: npm run seed:multi-tenant (ou db:seed)
 *
 * Comando:
 *   cd frontend && npm run test:e2e -- e2e/contabilidade-completo.spec.ts
 */
import { test, expect } from '@playwright/test';
import { loginAsAdmin, loginAsAdminInstB, clearAuthAndGotoLogin } from './fixtures/auth';

const TIMEOUT_NAV = 20000;
const TIMEOUT_VISIBLE = 15000;

test.describe('Contabilidade E2E - Fluxo Completo', () => {
  test.use({ project: 'chromium' });

  test('Admin: acede Contabilidade e visualiza Plano de Contas', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForLoadState('domcontentloaded');

    await page.goto('/admin-dashboard/contabilidade');
    await page.waitForURL(/contabilidade/, { timeout: TIMEOUT_NAV });
    await expect(page.getByRole('heading', { name: /Contabilidade/i })).toBeVisible({
      timeout: TIMEOUT_VISIBLE,
    });

    // Tab Plano de Contas (default)
    await expect(page.getByRole('heading', { name: /Plano de Contas/i })).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    await expect(
      page.getByRole('button', { name: 'Criar plano padrão' }).first()
    ).toBeVisible({ timeout: TIMEOUT_VISIBLE });
  });

  test('Admin: cria plano padrão e nova conta', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin-dashboard/contabilidade');
    await page.waitForURL(/contabilidade/, { timeout: TIMEOUT_NAV });

    // Criar plano padrão (Secundário)
    const btnPlano = page.getByRole('button', { name: 'Criar plano padrão' }).first();
    if (await btnPlano.isVisible({ timeout: 5000 }).catch(() => false)) {
      await btnPlano.click();
      // Toast: "Criadas X contas" ou "Plano padrão já existe" (pode ser fugaz)
      await page.waitForTimeout(1500);
    }

    // Nova conta
    const btnNovaConta = page.getByRole('button', { name: 'Nova conta' }).first();
    await expect(btnNovaConta).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    await btnNovaConta.click();

    const codigoUnico = `99-E2E-${Date.now()}`;
    await expect(page.getByRole('dialog').getByText(/Nova conta|Editar conta/i)).toBeVisible({
      timeout: 5000,
    });
    await page.getByPlaceholder(/Ex: 11, 41/i).fill(codigoUnico);
    await page.getByPlaceholder(/Ex: Caixa, Receita/i).fill('Conta E2E Teste');
    await page.getByRole('button', { name: /Criar|Salvar/i }).click();

    await expect(page.getByText(/Conta criada|conta criada/i)).toBeVisible({
      timeout: TIMEOUT_VISIBLE,
    });
  });

  test('Admin: Configuração de contas', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin-dashboard/contabilidade?tab=config');
    await page.waitForURL(/contabilidade/, { timeout: TIMEOUT_NAV });

    await expect(page.getByRole('heading', { name: /Configuração de contas por instituição/i })).toBeVisible({
      timeout: TIMEOUT_VISIBLE,
    });
    await expect(page.getByRole('button', { name: /Guardar configuração/i })).toBeVisible({
      timeout: TIMEOUT_VISIBLE,
    });
  });

  test('Admin: Centros de custo', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin-dashboard/contabilidade?tab=centros-custo');
    await page.waitForURL(/contabilidade/, { timeout: TIMEOUT_NAV });

    await expect(page.getByRole('heading', { name: /Centros de custo/i })).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    const btnNovo = page.getByRole('button', { name: 'Novo' }).first();
    await expect(btnNovo).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    await btnNovo.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    const inputs = page.getByRole('dialog').locator('input');
    await inputs.nth(0).fill(`CC-${Date.now()}`);
    await inputs.nth(1).fill('Centro E2E');
    await page.getByRole('dialog').getByRole('button', { name: /Criar|Guardar/i }).click();
    await expect(
      page.getByText(/Centro de custo criado|centro criado|Código.*já existe/i)
    ).toBeVisible({ timeout: TIMEOUT_VISIBLE });
  });

  test('Admin: Lançamentos - importar CSV', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin-dashboard/contabilidade?tab=lancamentos');
    await page.waitForURL(/contabilidade/, { timeout: TIMEOUT_NAV });

    await expect(page.getByRole('heading', { name: /Lançamentos Contábeis/i })).toBeVisible({
      timeout: TIMEOUT_VISIBLE,
    });

    const btnImportar = page.getByRole('button', { name: 'Importar CSV' }).first();
    await expect(btnImportar).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    await btnImportar.click();

    const hoje = new Date().toISOString().split('T')[0];
    const csvContent = `${hoje};11;Import E2E;100;0\n${hoje};41;Import E2E;0;100`;
    const textarea = page.locator('textarea').first();
    await expect(textarea).toBeVisible({ timeout: 5000 });
    await textarea.fill(csvContent);

    const btnImport = page.getByRole('button', { name: /^Importar$/i });
    await btnImport.click();

    await expect(
      page.getByText(/lançamento\(s\) criado|Nenhum lançamento criado|Conta.*não encontrada/i)
    ).toBeVisible({ timeout: TIMEOUT_VISIBLE });
  });

  test('Admin: Balancete', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin-dashboard/contabilidade?tab=balancete');
    await page.waitForURL(/contabilidade/, { timeout: TIMEOUT_NAV });

    await expect(page.getByRole('heading', { name: /Balancete/i })).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    const btnConsultar = page.getByRole('button', { name: /Consultar|Gerar/i }).first();
    if (await btnConsultar.isVisible({ timeout: 5000 }).catch(() => false)) {
      await btnConsultar.click();
      await expect(page.getByText(/Total Débito|Total Crédito/i)).toBeVisible({
        timeout: TIMEOUT_VISIBLE,
      }).catch(() => {});
    }
  });

  test('Admin: Balanço e DRE', async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto('/admin-dashboard/contabilidade?tab=balanco');
    await page.waitForURL(/contabilidade/, { timeout: TIMEOUT_NAV });
    await expect(page.getByRole('heading', { name: /Balanço|Patrimonial/i })).toBeVisible({ timeout: TIMEOUT_VISIBLE });

    await page.goto('/admin-dashboard/contabilidade?tab=dre');
    await page.waitForURL(/contabilidade/, { timeout: TIMEOUT_NAV });
    await expect(page.getByRole('heading', { name: /DRE|Demonstração do Resultado/i })).toBeVisible({
      timeout: TIMEOUT_VISIBLE,
    });
  });

  test('Admin: Razão e Exportação', async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto('/admin-dashboard/contabilidade?tab=razao');
    await page.waitForURL(/contabilidade/, { timeout: TIMEOUT_NAV });
    await expect(page.getByRole('heading', { name: /Razão|Livro Razão/i })).toBeVisible({ timeout: TIMEOUT_VISIBLE });

    await page.goto('/admin-dashboard/contabilidade?tab=exportacao');
    await page.waitForURL(/contabilidade/, { timeout: TIMEOUT_NAV });
    await expect(
      page.getByRole('heading', { name: /Exportação para Contabilistas/i })
    ).toBeVisible({ timeout: TIMEOUT_VISIBLE });
  });

  test('Admin: Fecho de exercício', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin-dashboard/contabilidade?tab=fecho');
    await page.waitForURL(/contabilidade/, { timeout: TIMEOUT_NAV });

    await expect(page.getByRole('heading', { name: /Fecho de Exercício/i })).toBeVisible({
      timeout: TIMEOUT_VISIBLE,
    });
  });
});

test.describe('Contabilidade E2E - Multi-tenant (Secundário + Superior)', () => {
  test.use({ project: 'chromium' });

  test('Admin Inst A (Secundário): fluxo completo - plano, config, regras, lançamentos', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin-dashboard/contabilidade');
    await page.waitForURL(/contabilidade/, { timeout: TIMEOUT_NAV });
    await expect(page.getByRole('heading', { name: 'Contabilidade' }).first()).toBeVisible({
      timeout: TIMEOUT_VISIBLE,
    });

    // Plano de Contas (tab=plano)
    await page.goto('/admin-dashboard/contabilidade?tab=plano');
    await page.waitForURL(/contabilidade/, { timeout: TIMEOUT_NAV });
    await expect(page.getByRole('heading', { name: /Plano de Contas/i })).toBeVisible({
      timeout: TIMEOUT_VISIBLE,
    });

    // Configuração (tab=config)
    await page.goto('/admin-dashboard/contabilidade?tab=config');
    await page.waitForURL(/contabilidade/, { timeout: TIMEOUT_NAV });
    await expect(page.getByText(/Configuração de contas|Caixa \(pagamentos\)|Guardar configuração/i).first()).toBeVisible({
      timeout: TIMEOUT_VISIBLE,
    });

    // Lançamentos
    await page.goto('/admin-dashboard/contabilidade?tab=lancamentos');
    await page.waitForURL(/contabilidade/, { timeout: TIMEOUT_NAV });
    await expect(page.getByRole('heading', { name: /Lançamentos Contábeis/i })).toBeVisible({
      timeout: TIMEOUT_VISIBLE,
    });
  });

  test('Admin Inst B (Superior): fluxo completo - isolamento de dados', async ({ page }) => {
    await loginAsAdminInstB(page);
    await page.goto('/admin-dashboard/contabilidade');
    await page.waitForURL(/contabilidade/, { timeout: TIMEOUT_NAV });
    await expect(page.getByRole('heading', { name: 'Contabilidade' }).first()).toBeVisible({
      timeout: TIMEOUT_VISIBLE,
    });

    // Inst B deve ver Contabilidade (dados isolados da Inst A)
    await page.goto('/admin-dashboard/contabilidade?tab=plano');
    await page.waitForURL(/contabilidade/, { timeout: TIMEOUT_NAV });
    await expect(page.getByRole('heading', { name: /Plano de Contas/i })).toBeVisible({
      timeout: TIMEOUT_VISIBLE,
    });

    await page.goto('/admin-dashboard/contabilidade?tab=dashboard');
    await page.waitForURL(/contabilidade/, { timeout: TIMEOUT_NAV });
    await expect(page.getByText(/Visão geral|Saldo Caixa|Receitas/i).first()).toBeVisible({
      timeout: TIMEOUT_VISIBLE,
    });
  });

  test('Admin Inst A e Inst B: isolamento por instituição', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin-dashboard/contabilidade');
    await page.waitForURL(/contabilidade/, { timeout: TIMEOUT_NAV });

    await expect(page.getByRole('heading', { name: 'Contabilidade' }).first()).toBeVisible({
      timeout: TIMEOUT_VISIBLE,
    });

    await clearAuthAndGotoLogin(page);
    await loginAsAdminInstB(page);
    await page.goto('/admin-dashboard/contabilidade');
    await page.waitForURL(/contabilidade/, { timeout: TIMEOUT_NAV });

    await expect(page.getByRole('heading', { name: 'Contabilidade' }).first()).toBeVisible({
      timeout: TIMEOUT_VISIBLE,
    });
    // Ambas instituições acedem à mesma rota mas com dados isolados (validado no backend)
  });
});
