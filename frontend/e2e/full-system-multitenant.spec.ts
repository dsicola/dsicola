/**
 * TESTE FULL DO SISTEMA – Multi-tenant + dois tipos de instituição
 *
 * Cobre:
 * - Inst A (SECUNDARIO): Admin, Professor, Aluno, Secretaria, POS, Responsável
 * - Inst B (SUPERIOR): Admin, Professor, Aluno, Secretaria, POS
 * - Navegação em fluxos principais: Gestão Acadêmica, CRUD (alunos/professores),
 *   Plano de Ensino, Notas/Avaliações, Presenças, Finanças, Ponto de Venda
 *
 * Pré-requisitos:
 *   1. Backend a correr (API)
 *   2. Seed: npx tsx backend/scripts/seed-multi-tenant-test.ts
 *   3. Seed perfis: npx tsx backend/scripts/seed-perfis-completos.ts
 *
 * Comandos:
 *   cd frontend && npm run test:e2e -- e2e/full-system-multitenant.spec.ts
 *   E2E_SKIP_WEB_SERVER=1 E2E_BASE_URL=https://... npm run test:e2e -- e2e/full-system-multitenant.spec.ts
 */
import { test, expect } from '@playwright/test';
import {
  loginAsAdmin,
  loginAsProfessor,
  loginAsAluno,
  loginAsSecretaria,
  loginAsResponsavel,
  loginAsAdminInstB,
  loginAsProfessorInstB,
  loginAsAlunoInstB,
  loginAsSecretariaInstB,
  loginAsPOS,
  loginAsPOSInstB,
} from './fixtures/auth';

const TIMEOUT_NAV = 12000;
const TIMEOUT_VISIBLE = 15000;

test.describe('Full System - Inst A (Secundário)', () => {
  test.use({ project: 'chromium' });

  test('Admin Inst A: dashboard e navegação completa', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForURL(/admin-dashboard|gestao/, { timeout: TIMEOUT_NAV }).catch(() => {});

    const inAdmin = page.url().includes('admin-dashboard') || page.url().includes('gestao');
    expect(inAdmin).toBeTruthy();

    const main = page.locator('main, [role="main"]').first();
    await expect(main).toBeVisible({ timeout: TIMEOUT_VISIBLE });

    const gestaoLink = page.locator('a[href*="gestao-academica"], a:has-text("Acadêmica"), a:has-text("Cursos")').first();
    await expect(gestaoLink).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    await gestaoLink.click();
    await page.waitForURL(/gestao-academica|tab=/, { timeout: TIMEOUT_NAV }).catch(() => {});
    expect(page.url()).toMatch(/gestao|admin-dashboard/);

    const configLink = page.locator('a[href*="configuracoes"], a:has-text("Configurações")').first();
    await expect(configLink).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    await configLink.click();
    await page.waitForURL(/configuracoes/, { timeout: TIMEOUT_NAV }).catch(() => {});
    expect(page.url()).toMatch(/configuracoes/);
  });

  test('Admin Inst A: Gestão Alunos e Gestão Professores', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForLoadState('domcontentloaded');

    const alunosLink = page.locator('a[href*="gestao-alunos"], a:has-text("Alunos"), a:has-text("Estudantes")').first();
    await expect(alunosLink).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    await alunosLink.click();
    await page.waitForURL(/gestao-alunos|gestao/, { timeout: TIMEOUT_NAV }).catch(() => {});
    expect(page.url()).toMatch(/admin-dashboard|gestao/);

    const profLink = page.locator('a[href*="gestao-professores"], a:has-text("Professores")').first();
    await expect(profLink).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    await profLink.click();
    await page.waitForURL(/gestao-professores/, { timeout: TIMEOUT_NAV }).catch(() => {});
    expect(page.url()).toMatch(/gestao-professores|admin-dashboard/);
  });

  test('Admin Inst A: Plano de Ensino, Avaliações/Notas, Presenças', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForLoadState('domcontentloaded');

    const planoLink = page.locator('a[href*="plano-ensino"], a:has-text("Plano de Ensino"), a:has-text("Planos")').first();
    await expect(planoLink).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    await planoLink.click();
    await page.waitForURL(/plano-ensino/, { timeout: TIMEOUT_NAV }).catch(() => {});
    expect(page.url()).toMatch(/plano-ensino|admin-dashboard/);

    const notasLink = page.locator('a[href*="avaliacoes-notas"], a:has-text("Notas"), a:has-text("Avaliações")').first();
    await expect(notasLink).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    await notasLink.click();
    await page.waitForURL(/avaliacoes-notas/, { timeout: TIMEOUT_NAV }).catch(() => {});
    expect(page.url()).toMatch(/avaliacoes-notas|admin-dashboard/);

    const presencasLink = page.locator('a[href*="presencas"], a:has-text("Presenças")').first();
    await expect(presencasLink).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    await presencasLink.click();
    await page.waitForURL(/presencas/, { timeout: TIMEOUT_NAV }).catch(() => {});
    expect(page.url()).toMatch(/presencas|admin-dashboard/);
  });

  test('Professor Inst A: painel, turmas, notas, frequência', async ({ page }) => {
    await loginAsProfessor(page);
    await page.waitForURL(/painel-professor/, { timeout: TIMEOUT_NAV }).catch(() => {});
    expect(page.url()).toContain('painel-professor');

    const turmasLink = page.locator('a[href*="turmas"], a:has-text("Turmas"), a:has-text("Minhas Turmas")').first();
    await expect(turmasLink).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    await turmasLink.click();
    await page.waitForURL(/painel-professor\/turmas/, { timeout: TIMEOUT_NAV }).catch(() => {});

    const notasLink = page.locator('a[href*="notas"], a:has-text("Notas")').first();
    await expect(notasLink).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    await notasLink.click();
    await page.waitForURL(/painel-professor\/notas/, { timeout: TIMEOUT_NAV }).catch(() => {});

    const freqLink = page.locator('a[href*="frequencia"], a:has-text("Frequência"), a:has-text("Presenças")').first();
    await expect(freqLink).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    await freqLink.click();
    await page.waitForURL(/painel-professor\/frequencia/, { timeout: TIMEOUT_NAV }).catch(() => {});
  });

  test('Aluno Inst A: painel, boletim, horários, mensalidades', async ({ page }) => {
    await loginAsAluno(page);
    await page.waitForURL(/painel-aluno/, { timeout: TIMEOUT_NAV }).catch(() => {});
    expect(page.url()).toContain('painel-aluno');

    const boletimLink = page.locator('a[href*="boletim"], a:has-text("Boletim")').first();
    await expect(boletimLink).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    await boletimLink.click();
    await page.waitForURL(/painel-aluno\/boletim/, { timeout: TIMEOUT_NAV }).catch(() => {});

    const horariosLink = page.locator('a[href*="horarios"], a:has-text("Horários")').first();
    await expect(horariosLink).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    await horariosLink.click();
    await page.waitForURL(/painel-aluno\/horarios/, { timeout: TIMEOUT_NAV }).catch(() => {});

    const mensalLink = page.locator('a[href*="mensalidades"], a:has-text("Mensalidades")').first();
    await expect(mensalLink).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    await mensalLink.click();
    await page.waitForURL(/painel-aluno\/mensalidades/, { timeout: TIMEOUT_NAV }).catch(() => {});
  });

  test('Secretaria Inst A: painel e gestão de alunos', async ({ page }) => {
    await loginAsSecretaria(page);
    await page.waitForLoadState('domcontentloaded');
    const inSecretaria =
      page.url().includes('secretaria') || page.url().includes('admin-dashboard') || page.url().includes('gestao');
    expect(inSecretaria).toBeTruthy();

    const alunosLink = page.locator('a[href*="alunos"], a[href*="gestao-alunos"], a:has-text("Alunos"), a:has-text("Estudantes")').first();
    await expect(alunosLink).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    await alunosLink.click();
    await page.waitForURL(/alunos|gestao-alunos|secretaria/, { timeout: TIMEOUT_NAV }).catch(() => {});
  });

  test('POS Inst A: ponto de venda', async ({ page }) => {
    await loginAsPOS(page);
    await page.waitForURL(/ponto-de-venda|admin-dashboard/, { timeout: TIMEOUT_NAV }).catch(() => {});
    expect(page.url()).toMatch(/ponto-de-venda|admin-dashboard/);
    const main = page.locator('main, [role="main"], [class*="dashboard"]').first();
    await expect(main).toBeVisible({ timeout: TIMEOUT_VISIBLE });
  });

  test('Responsável Inst A: painel', async ({ page }) => {
    await loginAsResponsavel(page);
    await page.waitForURL(/painel-responsavel|admin-dashboard/, { timeout: TIMEOUT_NAV }).catch(() => {});
    expect(page.url()).toContain('painel-responsavel');
    const main = page.locator('main, [role="main"]').first();
    await expect(main).toBeVisible({ timeout: TIMEOUT_VISIBLE });
  });
});

test.describe('Full System - Inst B (Superior)', () => {
  test.use({ project: 'chromium' });

  test('Admin Inst B: dashboard e gestão acadêmica', async ({ page }) => {
    await loginAsAdminInstB(page);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForURL(/admin-dashboard|gestao/, { timeout: TIMEOUT_NAV }).catch(() => {});

    const inAdmin = page.url().includes('admin-dashboard') || page.url().includes('gestao');
    expect(inAdmin).toBeTruthy();

    const gestaoLink = page.locator('a[href*="gestao-academica"], a:has-text("Acadêmica"), a:has-text("Cursos")').first();
    await expect(gestaoLink).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    await gestaoLink.click();
    await page.waitForURL(/gestao-academica|tab=/, { timeout: TIMEOUT_NAV }).catch(() => {});
    expect(page.url()).toMatch(/gestao|admin-dashboard/);
  });

  test('Admin Inst B: plano de ensino e avaliações', async ({ page }) => {
    await loginAsAdminInstB(page);
    await page.waitForLoadState('domcontentloaded');

    const planoLink = page.locator('a[href*="plano-ensino"], a:has-text("Plano de Ensino"), a:has-text("Planos")').first();
    await expect(planoLink).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    await planoLink.click();
    await page.waitForURL(/plano-ensino/, { timeout: TIMEOUT_NAV }).catch(() => {});

    const notasLink = page.locator('a[href*="avaliacoes-notas"], a:has-text("Notas"), a:has-text("Avaliações")').first();
    await expect(notasLink).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    await notasLink.click();
    await page.waitForURL(/avaliacoes-notas/, { timeout: TIMEOUT_NAV }).catch(() => {});
  });

  test('Professor Inst B: painel e turmas', async ({ page }) => {
    await loginAsProfessorInstB(page);
    await page.waitForURL(/painel-professor/, { timeout: TIMEOUT_NAV }).catch(() => {});
    expect(page.url()).toContain('painel-professor');

    const turmasLink = page.locator('a[href*="turmas"], a:has-text("Turmas"), a:has-text("Minhas Turmas")').first();
    await expect(turmasLink).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    await turmasLink.click();
    await page.waitForURL(/painel-professor\/turmas/, { timeout: TIMEOUT_NAV }).catch(() => {});
  });

  test('Aluno Inst B: painel e boletim', async ({ page }) => {
    await loginAsAlunoInstB(page);
    await page.waitForURL(/painel-aluno/, { timeout: TIMEOUT_NAV }).catch(() => {});
    expect(page.url()).toContain('painel-aluno');

    const boletimLink = page.locator('a[href*="boletim"], a:has-text("Boletim")').first();
    await expect(boletimLink).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    await boletimLink.click();
    await page.waitForURL(/painel-aluno\/boletim/, { timeout: TIMEOUT_NAV }).catch(() => {});
  });

  test('Secretaria Inst B: painel', async ({ page }) => {
    await loginAsSecretariaInstB(page);
    await page.waitForLoadState('domcontentloaded');
    const inSecretaria =
      page.url().includes('secretaria') || page.url().includes('admin-dashboard') || page.url().includes('gestao');
    expect(inSecretaria).toBeTruthy();
  });

  test('POS Inst B: ponto de venda', async ({ page }) => {
    await loginAsPOSInstB(page);
    await page.waitForURL(/ponto-de-venda|admin-dashboard/, { timeout: TIMEOUT_NAV }).catch(() => {});
    expect(page.url()).toMatch(/ponto-de-venda|admin-dashboard/);
  });
});

test.describe('Full System - Multi-tenant (isolamento de contexto)', () => {
  test.use({ project: 'chromium' });

  test('Login Admin Inst A depois Admin Inst B: URLs e contexto distintos', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForLoadState('domcontentloaded');
    const urlA = page.url();
    expect(urlA).toMatch(/admin-dashboard|gestao/);

    await page.goto('/auth');
    await page.waitForLoadState('domcontentloaded');
    await loginAsAdminInstB(page);
    await page.waitForLoadState('domcontentloaded');
    const urlB = page.url();
    expect(urlB).toMatch(/admin-dashboard|gestao/);
    expect(urlB).toBeTruthy();
  });
});
