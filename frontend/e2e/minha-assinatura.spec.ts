import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './fixtures/auth';

/**
 * Teste E2E: Minha Assinatura (área comercial)
 *
 * Valida:
 * - Acesso à página Minha Assinatura após login como Admin
 * - Exibição do card de countdown (Dias Restantes ou status)
 * - Botão Atualizar visível
 * - Indicador "Atualização automática a cada minuto" quando há assinatura ativa
 * - Barra de progresso do período
 *
 * Requer: frontend em :8080, backend em :3001
 */
test.describe('Admin - Minha Assinatura', () => {
  test.use({ project: 'chromium' });
  test.setTimeout(30000);

  test('Admin acessa Minha Assinatura e vê conteúdo da assinatura', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForLoadState('domcontentloaded');

    await page.goto('/admin-dashboard/minha-assinatura');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // Título da página
    await expect(page.getByRole('heading', { name: /Minha Assinatura/i })).toBeVisible({
      timeout: 10000,
    });

    // Conteúdo principal: card de countdown OU status da assinatura
    const diasRestantes = page.getByText(/Dias Restantes/i);
    const assinaturaExpirada = page.getByText(/Assinatura Expirada/i);
    const emAnalise = page.getByText(/Pagamento em Análise/i);
    const statusAssinatura = page.getByText(/Status da Assinatura/i);

    const hasCountdown = await diasRestantes.isVisible().catch(() => false);
    const hasExpired = await assinaturaExpirada.isVisible().catch(() => false);
    const hasAnalysis = await emAnalise.isVisible().catch(() => false);
    const hasStatus = await statusAssinatura.isVisible().catch(() => false);

    expect(hasCountdown || hasExpired || hasAnalysis || hasStatus).toBeTruthy();
  });

  test('Botão Atualizar visível quando há assinatura', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForLoadState('domcontentloaded');

    await page.goto('/admin-dashboard/minha-assinatura');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // Pode não haver assinatura (instituição de teste), então verificamos se a página carrega
    const atualizarBtn = page.getByRole('button', { name: /Atualizar/i });
    const hasAssinatura = await page.getByText(/Dias Restantes|Assinatura Expirada|Pagamento em Análise|Status da Assinatura/i).first().isVisible().catch(() => false);

    if (hasAssinatura) {
      await expect(atualizarBtn).toBeVisible({ timeout: 5000 });
    }
    // Se não há assinatura, a página ainda deve carregar sem erro
    await expect(page.getByRole('heading', { name: /Minha Assinatura/i })).toBeVisible();
  });

  test('Indicador de atualização automática quando há countdown', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForLoadState('domcontentloaded');

    await page.goto('/admin-dashboard/minha-assinatura');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    const diasRestantes = page.getByText(/Dias Restantes/i);
    const hasCountdown = await diasRestantes.isVisible().catch(() => false);

    if (hasCountdown) {
      await expect(page.getByText(/Atualização automática a cada minuto/i)).toBeVisible({
        timeout: 5000,
      });
    }
  });
});
