import { test as base, Page } from '@playwright/test';

/**
 * Credenciais E2E (backend seed multi-tenant ou env em CI)
 */
export const E2E_CREDENTIALS = {
  superAdmin: {
    email: process.env.TEST_SUPER_ADMIN_EMAIL || 'superadmin@dsicola.com',
    password: process.env.TEST_SUPER_ADMIN_PASSWORD || 'SuperAdmin@123',
  },
  admin: {
    email: process.env.TEST_USER_INST_A_EMAIL || 'admin.inst.a@teste.dsicola.com',
    password: process.env.TEST_MULTITENANT_PASS || 'TestMultiTenant123!',
  },
  aluno: {
    email: process.env.TEST_ALUNO_INST_A_EMAIL || 'aluno.inst.a@teste.dsicola.com',
    password: process.env.TEST_MULTITENANT_PASS || 'TestMultiTenant123!',
  },
  professor: {
    email: process.env.TEST_PROF_INST_A_EMAIL || 'prof.inst.a@teste.dsicola.com',
    password: process.env.TEST_MULTITENANT_PASS || 'TestMultiTenant123!',
  },
  secretaria: {
    email: process.env.TEST_SECRETARIA_INST_A_EMAIL || 'secretaria.inst.a@teste.dsicola.com',
    password: process.env.TEST_MULTITENANT_PASS || 'TestMultiTenant123!',
  },
  responsavel: {
    email: process.env.TEST_RESPONSAVEL_INST_A_EMAIL || 'responsavel.inst.a@teste.dsicola.com',
    password: process.env.TEST_MULTITENANT_PASS || 'TestMultiTenant123!',
  },
  // Inst B (Superior) - multi-tenant + dois tipos de instituição
  adminInstB: {
    email: process.env.TEST_USER_INST_B_EMAIL || 'admin.inst.b@teste.dsicola.com',
    password: process.env.TEST_MULTITENANT_PASS || 'TestMultiTenant123!',
  },
  professorInstB: {
    email: process.env.TEST_PROF_INST_B_EMAIL || 'prof.inst.b@teste.dsicola.com',
    password: process.env.TEST_MULTITENANT_PASS || 'TestMultiTenant123!',
  },
  alunoInstB: {
    email: process.env.TEST_ALUNO_INST_B_EMAIL || 'aluno.inst.b@teste.dsicola.com',
    password: process.env.TEST_MULTITENANT_PASS || 'TestMultiTenant123!',
  },
  secretariaInstB: {
    email: process.env.TEST_SECRETARIA_INST_B_EMAIL || 'secretaria.inst.b@teste.dsicola.com',
    password: process.env.TEST_MULTITENANT_PASS || 'TestMultiTenant123!',
  },
  pos: {
    email: process.env.TEST_POS_INST_A_EMAIL || 'pos.inst.a@teste.dsicola.com',
    password: process.env.TEST_MULTITENANT_PASS || 'TestMultiTenant123!',
  },
  posInstB: {
    email: process.env.TEST_POS_INST_B_EMAIL || 'pos.inst.b@teste.dsicola.com',
    password: process.env.TEST_MULTITENANT_PASS || 'TestMultiTenant123!',
  },
};

/** Seletores estáveis do LoginForm (ids do formulário) */
const SELECTORS = {
  email: '#email',
  password: '#password',
  submit: 'button[type="submit"]',
};

export async function fillLogin(page: Page, email: string, password: string) {
  await page.waitForSelector(SELECTORS.email, { state: 'visible', timeout: 15000 });
  await page.fill(SELECTORS.email, email);
  await page.fill(SELECTORS.password, password);
  await page.click(SELECTORS.submit);
}

export async function loginAsSuperAdmin(page: Page) {
  await page.goto('/auth');
  await fillLogin(page, E2E_CREDENTIALS.superAdmin.email, E2E_CREDENTIALS.superAdmin.password);
  await page.waitForURL(/super-admin|\/admin-dashboard|\/\?/, { timeout: 20000 });
}

export async function loginAsAdmin(page: Page) {
  await page.goto('/auth');
  await fillLogin(page, E2E_CREDENTIALS.admin.email, E2E_CREDENTIALS.admin.password);
  await page.waitForURL(/admin-dashboard|gestao|super-admin/, { timeout: 20000 });
}

export async function loginAsAluno(page: Page) {
  await page.goto('/auth');
  await fillLogin(page, E2E_CREDENTIALS.aluno.email, E2E_CREDENTIALS.aluno.password);
  await page.waitForURL(/painel-aluno|admin-dashboard/, { timeout: 20000 });
}

export async function loginAsProfessor(page: Page) {
  await page.goto('/auth');
  await fillLogin(page, E2E_CREDENTIALS.professor.email, E2E_CREDENTIALS.professor.password);
  await page.waitForURL(/painel-professor|admin-dashboard/, { timeout: 20000 });
}

export async function loginAsSecretaria(page: Page) {
  await page.goto('/auth');
  await fillLogin(page, E2E_CREDENTIALS.secretaria.email, E2E_CREDENTIALS.secretaria.password);
  await page.waitForURL(/painel-secretaria|secretaria-dashboard|gestao|admin-dashboard/, { timeout: 20000 });
}

export async function loginAsResponsavel(page: Page) {
  await page.goto('/auth');
  await fillLogin(page, E2E_CREDENTIALS.responsavel.email, E2E_CREDENTIALS.responsavel.password);
  await page.waitForURL(/painel-responsavel|admin-dashboard/, { timeout: 20000 });
}

export async function loginAsAdminInstB(page: Page) {
  await page.goto('/auth');
  await fillLogin(page, E2E_CREDENTIALS.adminInstB.email, E2E_CREDENTIALS.adminInstB.password);
  await page.waitForURL(/admin-dashboard|gestao|super-admin/, { timeout: 20000 });
}

export async function loginAsProfessorInstB(page: Page) {
  await page.goto('/auth');
  await fillLogin(page, E2E_CREDENTIALS.professorInstB.email, E2E_CREDENTIALS.professorInstB.password);
  await page.waitForURL(/painel-professor|admin-dashboard/, { timeout: 20000 });
}

export async function loginAsAlunoInstB(page: Page) {
  await page.goto('/auth');
  await fillLogin(page, E2E_CREDENTIALS.alunoInstB.email, E2E_CREDENTIALS.alunoInstB.password);
  await page.waitForURL(/painel-aluno|admin-dashboard/, { timeout: 20000 });
}

export async function loginAsSecretariaInstB(page: Page) {
  await page.goto('/auth');
  await fillLogin(page, E2E_CREDENTIALS.secretariaInstB.email, E2E_CREDENTIALS.secretariaInstB.password);
  await page.waitForURL(/painel-secretaria|secretaria-dashboard|gestao|admin-dashboard/, { timeout: 20000 });
}

export async function loginAsPOS(page: Page) {
  await page.goto('/auth');
  await fillLogin(page, E2E_CREDENTIALS.pos.email, E2E_CREDENTIALS.pos.password);
  await page.waitForURL(/ponto-de-venda|admin-dashboard/, { timeout: 20000 });
}

export async function loginAsPOSInstB(page: Page) {
  await page.goto('/auth');
  await fillLogin(page, E2E_CREDENTIALS.posInstB.email, E2E_CREDENTIALS.posInstB.password);
  await page.waitForURL(/ponto-de-venda|admin-dashboard/, { timeout: 20000 });
}

export const test = base.extend<Record<string, never>>({});
export { expect } from '@playwright/test';
