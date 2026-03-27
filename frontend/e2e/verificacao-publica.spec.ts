import { test, expect } from '@playwright/test';
import { primeE2EPage } from './fixtures/auth';

/**
 * Páginas públicas de verificação (sem login): pauta, documento oficial, certificado de conclusão.
 * Requer API para respostas de verificação (backend com rotas públicas).
 */
test.describe('Verificação pública (institucional)', () => {
  test.beforeEach(async ({ page }) => {
    await primeE2EPage(page);
  });
  test('Mini pauta: página carrega e formulário responde a código inválido', async ({ page }) => {
    await page.goto('/verificar-pauta');
    await expect(page.getByRole('heading', { name: /verificação de pauta/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByLabel(/código de verificação/i)).toBeVisible();
    await page.getByLabel(/código de verificação/i).fill('CODIGO_INEXISTENTE_E2E');
    await page.getByRole('button', { name: /^verificar$/i }).click();
    await expect(
      page.getByText(/código|inválid|não encontrad|não foi possível|incorrect|invalid/i).first()
    ).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/tipos de verificação/i)).toBeVisible();
  });

  test('Documento oficial: página carrega', async ({ page }) => {
    await page.goto('/verificar-documento');
    await expect(page.getByRole('heading', { name: /verificação de documento oficial/i })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText(/tipos de verificação/i)).toBeVisible();
  });

  test('Certificado de conclusão: página carrega', async ({ page }) => {
    await page.goto('/verificar-certificado-conclusao');
    await expect(page.getByRole('heading', { name: /verificação de certificado de conclusão/i })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText(/tipos de verificação/i)).toBeVisible();
  });

  test('Link profundo ?codigo= pré-preenche o campo (pauta)', async ({ page }) => {
    await page.goto('/verificar-pauta?codigo=ABCDE12345');
    const input = page.getByLabel(/código de verificação/i);
    await expect(input).toHaveValue(/ABCDE12345/i, { timeout: 10000 });
  });
});
