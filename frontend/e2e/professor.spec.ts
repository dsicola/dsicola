import { test, expect } from '@playwright/test';
import { loginAsProfessor } from './fixtures/auth';

test.describe('Professor - Painel e navegação', () => {
  test.use({ project: 'chromium' });

  test('Professor acessa painel após login', async ({ page }) => {
    await loginAsProfessor(page);
    await page.waitForURL(/painel-professor/, { timeout: 10000 }).catch(() => {});
    expect(page.url()).toContain('painel-professor');
  });

  test('Professor navega para Minhas Turmas', async ({ page }) => {
    await loginAsProfessor(page);
    await page.waitForLoadState('domcontentloaded');
    // Módulo «Acadêmica» no painel do professor aponta para /painel-professor/turmas
    const turmasNav = page
      .getByRole('button', { name: /acadêmica|academic|turmas|minhas turmas/i })
      .first();
    await expect(turmasNav).toBeVisible({ timeout: 15000 });
    await turmasNav.click();
    await page.waitForURL(/painel-professor\/turmas/, { timeout: 12000 }).catch(() => {});
    expect(page.url()).toMatch(/painel-professor\/turmas/);
  });

  test('Professor navega para Notas (plano + turma)', async ({ page }) => {
    await loginAsProfessor(page);
    await page.waitForLoadState('domcontentloaded');
    const notasBtn = page.getByRole('button', { name: /notas \(plano|notas|lançar notas/i }).first();
    await expect(notasBtn).toBeVisible({ timeout: 15000 });
    await notasBtn.click();
    await page.waitForURL(/painel-professor\/notas/, { timeout: 12000 }).catch(() => {});
    expect(page.url()).toMatch(/painel-professor\/notas/);
  });

  test('Professor navega para Meus Horários e página carrega', async ({ page }) => {
    await loginAsProfessor(page);
    await page.waitForLoadState('domcontentloaded');
    const horariosBtn = page.getByRole('button', { name: /meus horários|my schedule|horários/i }).first();
    await expect(horariosBtn).toBeVisible({ timeout: 15000 });
    await horariosBtn.click();
    await page.waitForURL(/painel-professor\/horarios/, { timeout: 12000 }).catch(() => {});
    expect(page.url()).toContain('painel-professor/horarios');
    const main = page.locator('main, [role="main"]');
    await expect(main).toBeVisible({ timeout: 8000 });
    // Conteúdo esperado: título da página, ou mensagem de vazio, ou botão imprimir
    const hasContent =
      (await main.getByRole('heading', { level: 1 }).isVisible().catch(() => false)) ||
      (await main.getByText(/meus horários|my schedule|os meus horários|nenhum horário|no schedule|resumo|imprimir|print/i).first().isVisible().catch(() => false));
    expect(hasContent).toBe(true);
  });

  test('Painel Professor exibe conteúdo principal', async ({ page }) => {
    await loginAsProfessor(page);
    await page.waitForLoadState('domcontentloaded');
    const mainContent = page.locator(
      'main, [role="main"], [class*="dashboard"]'
    ).first();
    await expect(mainContent).toBeVisible({ timeout: 15000 });
  });
});
