import { test, expect } from '@playwright/test';

/**
 * Landing institucional no subdomínio simulado (?subdomain=) — alinhado a useSubdomain (localhost).
 * Requer backend em execução com instituição `inst-a-secundario-test` (ex.: seed-multi-tenant-test).
 */
test.describe('Landing institucional (tenant)', () => {
  test('raiz com subdomain de teste mostra página institucional com hero e CTAs', async ({ page }) => {
    const res = await page.goto('/?subdomain=inst-a-secundario-test', { waitUntil: 'domcontentloaded' });
    expect(res?.ok() ?? false).toBeTruthy();

    await expect(page.getByTestId('institutional-landing')).toBeVisible({ timeout: 15000 });

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: /Entrar/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Candidaturas|Candidatar/i }).first()).toBeVisible();

    await page.getByRole('button', { name: /^Entrar$/ }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('dialog').getByText(/Entrar ou criar conta/i)).toBeVisible();
  });
});
