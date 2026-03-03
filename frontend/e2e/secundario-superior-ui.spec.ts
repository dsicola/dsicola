/**
 * E2E: Validação explícita da UI Secundário vs Superior
 *
 * Garante que os elementos corretos aparecem/desaparecem conforme o tipo de instituição:
 * - Secundário: Tab "Classes (Anos)" visível, Tab "Candidaturas" oculta
 * - Superior: Tab "Candidaturas" visível, Tab "Classes" oculta
 *
 * Pré-requisitos: backend a correr; seed multi-tenant (Inst A = Secundário, Inst B = Superior).
 */
import { test, expect } from '@playwright/test';
import { loginAsAdmin, loginAsAdminInstB } from './fixtures/auth';

const TIMEOUT_NAV = 15000;
const TIMEOUT_VISIBLE = 10000;

test.describe('UI Secundário vs Superior - Gestão Acadêmica', () => {
  test.use({ project: 'chromium' });

  test('Inst A (Secundário): Tab Classes visível, Candidaturas oculta', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForLoadState('domcontentloaded');

    await page.goto('/admin-dashboard/gestao-academica');
    await page.waitForURL(/gestao-academica/, { timeout: TIMEOUT_NAV });

    // Secundário deve ter tab "Classes (Anos)" (não confundir com "Turmas/Classes")
    const tabClasses = page.getByRole('tab', { name: /Classes \(Anos\)|Year Levels/i });
    await expect(tabClasses).toBeVisible({ timeout: TIMEOUT_VISIBLE });

    // Secundário NÃO deve ter tab "Candidaturas"
    const tabCandidaturas = page.getByRole('tab', { name: /Candidaturas|Applications/i });
    await expect(tabCandidaturas).not.toBeVisible();
  });

  test('Inst B (Superior): Tab Candidaturas visível, Classes oculta', async ({ page }) => {
    await loginAsAdminInstB(page);
    await page.waitForLoadState('domcontentloaded');

    await page.goto('/admin-dashboard/gestao-academica');
    await page.waitForURL(/gestao-academica/, { timeout: TIMEOUT_NAV });

    // Superior deve ter tab "Candidaturas"
    const tabCandidaturas = page.getByRole('tab', { name: /Candidaturas|Applications/i });
    await expect(tabCandidaturas).toBeVisible({ timeout: TIMEOUT_VISIBLE });

    // Superior NÃO deve ter tab "Classes (Anos)" (apenas Secundário)
    const tabClasses = page.getByRole('tab', { name: /Classes \(Anos\)|Year Levels/i });
    await expect(tabClasses).not.toBeVisible();
  });
});

test.describe('UI Secundário vs Superior - Plano de Ensino', () => {
  test.use({ project: 'chromium' });

  test('Inst A (Secundário): Plano de Ensino mostra Classe/Ano', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForLoadState('domcontentloaded');

    await page.goto('/admin-dashboard/plano-ensino');
    await page.waitForURL(/plano-ensino/, { timeout: TIMEOUT_NAV });

    // Secundário: campo Classe/Ano deve estar visível
    const labelClasse = page.getByText(/Classe\/Ano|Classe/).first();
    await expect(labelClasse).toBeVisible({ timeout: TIMEOUT_VISIBLE });
  });

  test('Inst B (Superior): Plano de Ensino mostra Semestre', async ({ page }) => {
    await loginAsAdminInstB(page);
    await page.waitForLoadState('domcontentloaded');

    await page.goto('/admin-dashboard/plano-ensino');
    await page.waitForURL(/plano-ensino/, { timeout: TIMEOUT_NAV });

    // Superior: campo Semestre deve estar visível (contexto do plano)
    const labelSemestre = page.getByText(/Semestre/).first();
    await expect(labelSemestre).toBeVisible({ timeout: TIMEOUT_VISIBLE });
  });
});
