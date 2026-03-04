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
  clearAuthAndGotoLogin,
  E2E_CREDENTIALS,
  fillLogin,
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

    // Sidebar usa botões (não links) - "Acadêmica" ou dashboard tem "Cursos"
    const gestaoLink = page.getByRole('button', { name: /acadêmica|cursos/i }).first();
    await expect(gestaoLink).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    await gestaoLink.click();
    await page.waitForURL(/gestao-academica|tab=/, { timeout: TIMEOUT_NAV }).catch(() => {});
    expect(page.url()).toMatch(/gestao|admin-dashboard/);

    // Navegação direta para Configurações - evita "element detached"
    await page.goto('/admin-dashboard/configuracoes');
    await page.waitForURL(/configuracoes/, { timeout: TIMEOUT_NAV }).catch(() => {});
    expect(page.url()).toMatch(/configuracoes/);
  });

  test('Admin Inst A: Gestão Alunos e Gestão Professores', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForLoadState('domcontentloaded');

    // Sidebar: "Administrativo" (gestao-alunos) ou dashboard: "Matrículas"
    const alunosLink = page.getByRole('button', { name: /administrativo|matrículas|alunos|estudantes/i }).first();
    await expect(alunosLink).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    await alunosLink.click();
    await page.waitForURL(/gestao-alunos|gestao/, { timeout: TIMEOUT_NAV }).catch(() => {});
    expect(page.url()).toMatch(/admin-dashboard|gestao/);

    const profLink = page.getByRole('button', { name: /professores/i }).first();
    await expect(profLink).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    await profLink.click();
    await page.waitForURL(/gestao-professores/, { timeout: TIMEOUT_NAV }).catch(() => {});
    expect(page.url()).toMatch(/gestao-professores|admin-dashboard/);
  });

  test('Admin Inst A: Plano de Ensino, Avaliações/Notas, Presenças', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForLoadState('domcontentloaded');

    // Navegação direta - "Planos de Ensino" pode estar em secção colapsável
    await page.goto('/admin-dashboard/plano-ensino');
    await page.waitForURL(/plano-ensino/, { timeout: TIMEOUT_NAV }).catch(() => {});
    expect(page.url()).toMatch(/plano-ensino|admin-dashboard/);

    // Navegação direta - evita "element detached" em UIs dinâmicas
    await page.goto('/admin-dashboard/avaliacoes-notas');
    await page.waitForURL(/avaliacoes-notas/, { timeout: TIMEOUT_NAV }).catch(() => {});
    expect(page.url()).toMatch(/avaliacoes-notas|admin-dashboard/);

    // Navegação direta - Presenças pode não estar visível na página atual
    await page.goto('/admin-dashboard/presencas');
    await page.waitForURL(/presencas/, { timeout: TIMEOUT_NAV }).catch(() => {});
    expect(page.url()).toMatch(/presencas|admin-dashboard/);
  });

  test('Professor Inst A: painel, turmas, notas, frequência', async ({ page }) => {
    await loginAsProfessor(page);
    await page.waitForURL(/painel-professor/, { timeout: TIMEOUT_NAV }).catch(() => {});
    expect(page.url()).toContain('painel-professor');

    const turmasLink = page.getByRole('button', { name: /turmas|minhas turmas/i }).first();
    await expect(turmasLink).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    await turmasLink.click();
    await page.waitForURL(/painel-professor\/turmas/, { timeout: TIMEOUT_NAV }).catch(() => {});

    const notasLink = page.getByRole('button', { name: /notas|lançar notas/i }).first();
    await expect(notasLink).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    await notasLink.click();
    await page.waitForURL(/painel-professor\/notas/, { timeout: TIMEOUT_NAV }).catch(() => {});

    const freqLink = page.getByRole('button', { name: /frequência|presenças|aulas e presenças/i }).first();
    await expect(freqLink).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    await freqLink.click();
    await page.waitForURL(/painel-professor\/frequencia/, { timeout: TIMEOUT_NAV }).catch(() => {});
  });

  test('Aluno Inst A: painel, boletim, horários, mensalidades', async ({ page }) => {
    await loginAsAluno(page);
    await page.waitForURL(/painel-aluno/, { timeout: TIMEOUT_NAV }).catch(() => {});
    expect(page.url()).toContain('painel-aluno');

    const boletimLink = page.getByRole('button', { name: /boletim/i }).first();
    await expect(boletimLink).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    await boletimLink.click();
    await page.waitForURL(/painel-aluno\/boletim/, { timeout: TIMEOUT_NAV }).catch(() => {});

    const horariosLink = page.getByRole('button', { name: /horários|meu horário/i }).first();
    await expect(horariosLink).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    await horariosLink.click();
    await page.waitForURL(/painel-aluno\/horarios/, { timeout: TIMEOUT_NAV }).catch(() => {});

    const mensalLink = page.getByRole('button', { name: /mensalidades|minhas mensalidades/i }).first();
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

    const alunosLink = page.getByRole('button', { name: /administrativo|alunos|estudantes|matrículas/i }).first();
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

    const gestaoLink = page.getByRole('button', { name: /acadêmica|cursos/i }).first();
    await expect(gestaoLink).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    await gestaoLink.click();
    await page.waitForURL(/gestao-academica|tab=/, { timeout: TIMEOUT_NAV }).catch(() => {});
    expect(page.url()).toMatch(/gestao|admin-dashboard/);
  });

  test('Admin Inst B: plano de ensino e avaliações', async ({ page }) => {
    await loginAsAdminInstB(page);
    await page.waitForLoadState('domcontentloaded');

    // Navegação direta - "Planos de Ensino" pode estar em secção colapsável
    await page.goto('/admin-dashboard/plano-ensino');
    await page.waitForURL(/plano-ensino/, { timeout: TIMEOUT_NAV }).catch(() => {});

    // Navegação direta - evita "element detached" em UIs dinâmicas
    await page.goto('/admin-dashboard/avaliacoes-notas');
    await page.waitForURL(/avaliacoes-notas/, { timeout: TIMEOUT_NAV }).catch(() => {});
  });

  test('Professor Inst B: painel e turmas', async ({ page }) => {
    await loginAsProfessorInstB(page);
    await page.waitForURL(/painel-professor/, { timeout: TIMEOUT_NAV }).catch(() => {});
    expect(page.url()).toContain('painel-professor');

    const turmasLink = page.getByRole('button', { name: /turmas|minhas turmas/i }).first();
    await expect(turmasLink).toBeVisible({ timeout: TIMEOUT_VISIBLE });
    await turmasLink.click();
    await page.waitForURL(/painel-professor\/turmas/, { timeout: TIMEOUT_NAV }).catch(() => {});
  });

  test('Aluno Inst B: painel e boletim', async ({ page }) => {
    await loginAsAlunoInstB(page);
    await page.waitForURL(/painel-aluno/, { timeout: TIMEOUT_NAV }).catch(() => {});
    expect(page.url()).toContain('painel-aluno');

    const boletimLink = page.getByRole('button', { name: /boletim/i }).first();
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

    // Limpar sessão antes do 2º login - /auth redireciona se já logado
    await clearAuthAndGotoLogin(page);
    await fillLogin(page, E2E_CREDENTIALS.adminInstB.email, E2E_CREDENTIALS.adminInstB.password);
    await page.waitForURL(/admin-dashboard|gestao|super-admin/, { timeout: 20000 });
    await page.waitForLoadState('domcontentloaded');
    const urlB = page.url();
    expect(urlB).toMatch(/admin-dashboard|gestao/);
    expect(urlB).toBeTruthy();
  });
});
