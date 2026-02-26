/**
 * ROADMAP-100 — E2E: Fluxo completo login (Admin, Secretaria, Professor, Aluno) e navegação por módulos principais.
 *
 * Corresponde ao primeiro item da secção Testes do docs/ROADMAP-100.md.
 * Pré-requisitos: backend a correr; seeds: seed-multi-tenant-test + seed-perfis-completos.
 *
 * Comando: cd frontend && npm run test:e2e -- e2e/roadmap-100-login-nav.spec.ts
 * Ou: npm run test:e2e:full-system (inclui este fluxo e mais; ver full-system-multitenant.spec.ts)
 */
import { test, expect } from '@playwright/test';
import { loginAsAdmin, loginAsSecretaria, loginAsProfessor, loginAsAluno } from './fixtures/auth';

const TIMEOUT_NAV = 12000;
const TIMEOUT_VISIBLE = 15000;

test.describe('ROADMAP-100: Login e navegação por módulos principais', () => {
  test.use({ project: 'chromium' });

  test('Admin: login e navegação (dashboard + Acadêmica + Configurações)', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForURL(/admin-dashboard|gestao/, { timeout: TIMEOUT_NAV }).catch(() => {});

    expect(page.url()).toMatch(/admin-dashboard|gestao/);
    const main = page.locator('main, [role="main"]').first();
    await expect(main).toBeVisible({ timeout: TIMEOUT_VISIBLE });

    // Sidebar usa botões (DynamicSidebar); escopar ao nav para não clicar em conteúdo
    const sidebar = page.locator('nav').first();
    const gestaoBtn = sidebar.getByRole('button', { name: /Acadêmica/i });
    await expect(gestaoBtn).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    await gestaoBtn.click();
    await page.waitForURL(/gestao-academica|tab=/, { timeout: TIMEOUT_NAV }).catch(() => {});

    const configBtn = sidebar.getByRole('button', { name: /Sistema/i });
    await expect(configBtn).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    await configBtn.click();
    await page.waitForURL(/configuracoes/, { timeout: TIMEOUT_NAV }).catch(() => {});
    expect(page.url()).toMatch(/configuracoes/);
  });

  test('Secretaria: login e navegação (dashboard + Alunos)', async ({ page }) => {
    await loginAsSecretaria(page);
    await page.waitForLoadState('domcontentloaded');

    const inSecretaria =
      page.url().includes('secretaria') || page.url().includes('admin-dashboard') || page.url().includes('gestao');
    expect(inSecretaria).toBeTruthy();

    // Secretaria: módulo "Administrativo" leva a gestao-alunos
    const adminBtn = page.getByRole('button', { name: /Administrativo/i }).first();
    await expect(adminBtn).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    await adminBtn.click();
    await page.waitForURL(/alunos|gestao-alunos|secretaria/, { timeout: TIMEOUT_NAV }).catch(() => {});
    expect(page.url()).toMatch(/alunos|gestao-alunos|secretaria/);
  });

  test('Professor: login e navegação (painel + Turmas + Notas)', async ({ page }) => {
    await loginAsProfessor(page);
    await page.waitForURL(/painel-professor/, { timeout: TIMEOUT_NAV }).catch(() => {});

    expect(page.url()).toContain('painel-professor');

    // Professor: "Acadêmica" navega para turmas; depois "Lançar Notas"
    const academicaBtn = page.getByRole('button', { name: /Acadêmica/i }).first();
    await expect(academicaBtn).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    await academicaBtn.click();
    await page.waitForURL(/painel-professor\/turmas/, { timeout: TIMEOUT_NAV }).catch(() => {});

    const notasBtn = page.getByRole('button', { name: /Lançar Notas|Notas/i }).first();
    await expect(notasBtn).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    await notasBtn.click();
    await page.waitForURL(/painel-professor\/notas/, { timeout: TIMEOUT_NAV }).catch(() => {});
  });

  test('Aluno: login e navegação (painel + Boletim + Mensalidades)', async ({ page }) => {
    await loginAsAluno(page);
    await page.waitForURL(/painel-aluno/, { timeout: TIMEOUT_NAV }).catch(() => {});

    expect(page.url()).toContain('painel-aluno');

    const boletimBtn = page.getByRole('button', { name: /Boletim/i }).first();
    await expect(boletimBtn).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    await boletimBtn.click();
    await page.waitForURL(/painel-aluno\/boletim/, { timeout: TIMEOUT_NAV }).catch(() => {});

    const mensalBtn = page.getByRole('button', { name: /Mensalidades/i }).first();
    await expect(mensalBtn).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    await mensalBtn.click();
    await page.waitForURL(/painel-aluno\/mensalidades/, { timeout: TIMEOUT_NAV }).catch(() => {});
  });
});
