import { test, expect } from '@playwright/test';
import { loginAsAluno } from './fixtures/auth';

test.describe('Aluno - Painel e navegação', () => {
  test.use({ project: 'chromium' });

  test('Aluno acessa painel após login', async ({ page }) => {
    await loginAsAluno(page);
    await page.waitForURL(/painel-aluno/, { timeout: 10000 }).catch(() => {});
    expect(page.url()).toContain('painel-aluno');
  });

  test('Aluno navega para Boletim', async ({ page }) => {
    await loginAsAluno(page);
    await page.waitForLoadState('domcontentloaded');
    const boletimBtn = page.getByRole('button', { name: /boletim/i }).first();
    await expect(boletimBtn).toBeVisible({ timeout: 15000 });
    await boletimBtn.click();
    await page.waitForURL(/painel-aluno\/boletim/, { timeout: 12000 }).catch(() => {});
    expect(page.url()).toMatch(/painel-aluno\/boletim/);
  });

  test('Aluno navega para Meu Horário (horários da turma)', async ({ page }) => {
    await loginAsAluno(page);
    await page.waitForLoadState('domcontentloaded');
    const horariosBtn = page.getByRole('button', { name: /meu horário|horários|my schedule/i }).first();
    await expect(horariosBtn).toBeVisible({ timeout: 15000 });
    await horariosBtn.click();
    await page.waitForURL(/painel-aluno\/horarios/, { timeout: 12000 }).catch(() => {});
    expect(page.url()).toMatch(/painel-aluno\/horarios/);
  });

  test('Painel Aluno exibe conteúdo principal', async ({ page }) => {
    await loginAsAluno(page);
    await page.waitForLoadState('domcontentloaded');
    const mainContent = page.locator(
      'main, [role="main"], [class*="dashboard"]'
    ).first();
    await expect(mainContent).toBeVisible({ timeout: 15000 });
  });
});
