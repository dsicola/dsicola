import { test, expect } from '@playwright/test';

/**
 * Testa que a rota de teste /test-sentry-error dispara um erro, o ErrorBoundary
 * captura e mostra a UI de fallback, e o erro é reportado ao Sentry (sem validar
 * o envio ao Sentry; apenas que a app não crasha e mostra o fallback).
 * A rota /test-sentry-error só existe em desenvolvimento (npm run dev).
 */
test.describe('Sentry / ErrorBoundary', () => {
  test('rota /test-sentry-error dispara erro e ErrorBoundary mostra fallback', async ({
    page,
  }) => {
    await page.goto('/test-sentry-error');
    await page.waitForLoadState('domcontentloaded');

    // ErrorBoundary deve mostrar a mensagem padrão
    await expect(
      page.getByRole('heading', { name: /algo deu errado/i })
    ).toBeVisible({ timeout: 10000 });

    // Botão "Recarregar página" deve estar visível
    await expect(
      page.getByRole('button', { name: /recarregar página/i })
    ).toBeVisible();
  });
});
