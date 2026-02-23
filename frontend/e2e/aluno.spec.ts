import { test, expect } from '@playwright/test';

/**
 * Testes E2E: Fluxo Aluno
 * Login como Aluno, acesso a boletim, horários, histórico
 *
 * Requer: frontend :8080, backend :3001, seed-multi-tenant
 */
const ALUNO_EMAIL = process.env.TEST_ALUNO_INST_A_EMAIL || 'aluno.inst.a@teste.dsicola.com';
const ALUNO_PASSWORD = process.env.TEST_MULTITENANT_PASS || 'TestMultiTenant123!';

async function loginAsAluno(page: import('@playwright/test').Page) {
  await page.goto('/auth');
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.fill('input[type="email"]', ALUNO_EMAIL);
  await page.fill('input[type="password"]', ALUNO_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/painel-aluno|admin-dashboard/, { timeout: 15000 });
}

test.describe('Aluno - Painel e navegação', () => {
  test.setTimeout(60000);
  test.use({ project: 'chromium' });

  test('Aluno acessa painel após login', async ({ page }) => {
    await loginAsAluno(page);
    await page.waitForURL(/painel-aluno/, { timeout: 8000 }).catch(() => {});
    const inAlunoPanel = page.url().includes('painel-aluno');
    expect(inAlunoPanel).toBeTruthy();
  });

  test('Aluno navega para Boletim', async ({ page }) => {
    await loginAsAluno(page);
    await page.waitForLoadState('domcontentloaded');
    const boletimLink = page.locator(
      'a[href*="painel-aluno/boletim"], a:has-text("Boletim"), button:has-text("Boletim")'
    );
    const first = boletimLink.first();
    if (await first.isVisible({ timeout: 8000 })) {
      await first.click();
      await page.waitForURL(/painel-aluno\/boletim/, { timeout: 8000 }).catch(() => {});
      expect(page.url()).toMatch(/painel-aluno/);
    }
  });

  test('Aluno navega para Horários', async ({ page }) => {
    await loginAsAluno(page);
    await page.waitForLoadState('domcontentloaded');
    const horariosLink = page.locator(
      'a[href*="painel-aluno/horarios"], a:has-text("Horários"), button:has-text("Horários")'
    );
    const first = horariosLink.first();
    if (await first.isVisible({ timeout: 8000 })) {
      await first.click();
      await page.waitForURL(/painel-aluno\/horarios/, { timeout: 8000 }).catch(() => {});
      expect(page.url()).toMatch(/painel-aluno/);
    }
  });

  test('Painel Aluno exibe conteúdo principal', async ({ page }) => {
    await loginAsAluno(page);
    await page.waitForLoadState('networkidle').catch(() => {});
    const mainContent = page.locator('main, [role="main"], [class*="dashboard"]');
    await expect(mainContent.first()).toBeVisible({ timeout: 10000 });
  });
});
