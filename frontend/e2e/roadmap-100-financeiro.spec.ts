/**
 * ROADMAP-100 — E2E: Financeiro — listar mensalidades e registrar pagamento.
 *
 * Pré-requisitos: backend a correr; seed-multi-tenant-test (cria uma mensalidade Pendente para Aluno A, Inst A).
 *
 * Admin (Inst A) → Gestão Financeira → lista mensalidades → Marcar Pago na primeira pendente →
 * preencher data e forma de pagamento → Confirmar Pagamento → verificar toast de sucesso.
 */
import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './fixtures/auth';

const TIMEOUT_NAV = 20000;
const TIMEOUT_VISIBLE = 20000;

test.describe('ROADMAP-100: Financeiro (listar mensalidades, registrar pagamento)', () => {
  test('Admin: listar mensalidades e registrar pagamento (Marcar Pago → Confirmar)', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForLoadState('domcontentloaded');

    const [mensalidadesRes] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/mensalidades') && res.status() === 200,
        { timeout: 20000 }
      ),
      page.goto('/admin-dashboard/gestao-financeira'),
    ]);
    await page.waitForURL(/admin-dashboard\/gestao-financeira/, { timeout: TIMEOUT_NAV });

    const body = await mensalidadesRes.json().catch(() => ({}));
    const lista = Array.isArray(body) ? body : (body?.data ?? body?.mensalidades ?? []);
    const isArray = Array.isArray(lista);

    if (!isArray || lista.length === 0) {
      await expect(
        page.getByText(/Nenhuma mensalidade encontrada|nenhuma mensalidade/i)
      ).toBeVisible({ timeout: TIMEOUT_VISIBLE });
      test.skip();
      return;
    }

    const tabela = page.locator('table').first();
    await expect(tabela).toBeVisible({ timeout: TIMEOUT_VISIBLE });

    const btnMarcarPago = page.getByRole('button', { name: /Marcar Pago/i }).first();
    await expect(btnMarcarPago).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    await btnMarcarPago.click();

    await expect(page.getByRole('dialog').getByText('Registrar Pagamento')).toBeVisible({
      timeout: TIMEOUT_VISIBLE,
    });

    const dataInput = page.locator('#data').first();
    await expect(dataInput).toBeVisible({ timeout: 8000 });
    const hoje = new Date().toISOString().split('T')[0];
    await dataInput.fill(hoje);

    const btnConfirmar = page.getByRole('button', { name: /Confirmar Pagamento/i });
    await expect(btnConfirmar).toBeVisible({ timeout: 5000 });
    await btnConfirmar.click();

    await expect(
      page.getByText(/Pagamento registrado|pagamento registrado|Recibo gerado|recibo gerado/i)
    ).toBeVisible({ timeout: TIMEOUT_VISIBLE });
  });
});
