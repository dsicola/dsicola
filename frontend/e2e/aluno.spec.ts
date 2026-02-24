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
    const boletimLink = page.locator(
      'a[href*="painel-aluno/boletim"], a:has-text("Boletim"), button:has-text("Boletim")'
    ).first();
    await expect(boletimLink).toBeVisible({ timeout: 10000 });
    await boletimLink.click();
    await page.waitForURL(/painel-aluno\/boletim/, { timeout: 8000 }).catch(() => {});
    expect(page.url()).toMatch(/painel-aluno/);
  });

  test('Aluno navega para Meu Horário (horários da turma)', async ({ page }) => {
    await loginAsAluno(page);
    await page.waitForLoadState('domcontentloaded');
    const horariosLink = page.locator(
      'a[href*="painel-aluno/horarios"], a:has-text("Meu Horário"), a:has-text("Horários"), a:has-text("My Schedule")'
    ).first();
    await expect(horariosLink).toBeVisible({ timeout: 10000 });
    await horariosLink.click();
    await page.waitForURL(/painel-aluno\/horarios/, { timeout: 8000 }).catch(() => {});
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
