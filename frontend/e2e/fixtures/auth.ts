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

const LOGIN_FORM_TIMEOUT = 30000;

/** pt-BR antes da 1.ª carga da app (sidebar e tabs usam t() com keys). */
export async function primeE2EPage(page: Page) {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('i18nextLng', 'pt-BR');
    } catch {
      /* ignore */
    }
  });
}

export async function fillLogin(page: Page, email: string, password: string) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector(SELECTORS.email, { state: 'visible', timeout: LOGIN_FORM_TIMEOUT });
  await page.fill(SELECTORS.email, email);
  await page.fill(SELECTORS.password, password);
  await page.click(SELECTORS.submit);
}

/** Limpar sessão para permitir novo login (ex: troca de instituição em testes multi-tenant) */
export async function clearAuthAndGotoLogin(page: Page) {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await primeE2EPage(page);
  await page.goto('/auth');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector(SELECTORS.email, { state: 'visible', timeout: 20000 });
}

export async function loginAsSuperAdmin(page: Page) {
  await primeE2EPage(page);
  await page.goto('/auth');
  await fillLogin(page, E2E_CREDENTIALS.superAdmin.email, E2E_CREDENTIALS.superAdmin.password);
  await page.waitForURL(/super-admin|\/admin-dashboard|\/\?/, { timeout: 20000 });
}

export async function loginAsAdmin(page: Page) {
  await primeE2EPage(page);
  await page.goto('/auth');
  await fillLogin(page, E2E_CREDENTIALS.admin.email, E2E_CREDENTIALS.admin.password);
  // Alinhar ao login Inst B / professor: sem API o token não aparece (falha clara nos E2E que verificam /health)
  await page.waitForFunction(() => typeof localStorage !== 'undefined' && !!localStorage.getItem('accessToken'), {
    timeout: 35000,
  });
  await page.waitForURL(/admin-dashboard|gestao|super-admin|onboarding/, { timeout: 20000 });
}

export async function loginAsAluno(page: Page) {
  await primeE2EPage(page);
  await page.goto('/auth');
  await fillLogin(page, E2E_CREDENTIALS.aluno.email, E2E_CREDENTIALS.aluno.password);
  await page.waitForURL(/painel-aluno|admin-dashboard/, { timeout: 20000 });
}

export async function loginAsProfessor(page: Page) {
  await primeE2EPage(page);
  await page.goto('/auth');
  await fillLogin(page, E2E_CREDENTIALS.professor.email, E2E_CREDENTIALS.professor.password);
  await page.waitForFunction(() => typeof localStorage !== 'undefined' && !!localStorage.getItem('accessToken'), {
    timeout: 35000,
  });
  await page.waitForFunction(
    () => /\/painel-professor|\/admin-dashboard|\/onboarding/.test(window.location.pathname),
    { timeout: 20000 },
  );
}

export async function loginAsSecretaria(page: Page) {
  await primeE2EPage(page);
  await page.goto('/auth');
  await fillLogin(page, E2E_CREDENTIALS.secretaria.email, E2E_CREDENTIALS.secretaria.password);
  await page.waitForFunction(() => typeof localStorage !== 'undefined' && !!localStorage.getItem('accessToken'), {
    timeout: 35000,
  });
  await page.waitForURL(/painel-secretaria|secretaria-dashboard|gestao|admin-dashboard/, { timeout: 20000 });
}

export async function loginAsResponsavel(page: Page) {
  await primeE2EPage(page);
  await page.goto('/auth');
  await fillLogin(page, E2E_CREDENTIALS.responsavel.email, E2E_CREDENTIALS.responsavel.password);
  await page.waitForURL(/painel-responsavel|admin-dashboard|onboarding/, { timeout: 20000 });
}

/**
 * Inst B: login em /auth sem ?subdomain= — o TenantGate com subdomínio exige GET /instituicoes/por-subdominio
 * e, sem seed ou com API lenta, bloqueia o formulário (#email). O JWT e o InstituicaoContext definem Superior vs Secundário.
 */
export async function loginAsAdminInstB(page: Page) {
  await primeE2EPage(page);
  await page.goto('/auth');
  await fillLogin(page, E2E_CREDENTIALS.adminInstB.email, E2E_CREDENTIALS.adminInstB.password);
  await page.waitForFunction(() => typeof localStorage !== 'undefined' && !!localStorage.getItem('accessToken'), {
    timeout: 35000,
  });
  await page.waitForURL(/admin-dashboard|gestao|super-admin|onboarding/, { timeout: 20000 });
}

export async function loginAsProfessorInstB(page: Page) {
  await primeE2EPage(page);
  await page.goto('/auth');
  await fillLogin(page, E2E_CREDENTIALS.professorInstB.email, E2E_CREDENTIALS.professorInstB.password);
  await page.waitForFunction(() => typeof localStorage !== 'undefined' && !!localStorage.getItem('accessToken'), {
    timeout: 35000,
  });
  await page.waitForFunction(
    () => /\/painel-professor|\/admin-dashboard|\/onboarding/.test(window.location.pathname),
    { timeout: 20000 },
  );
}

export async function loginAsAlunoInstB(page: Page) {
  await primeE2EPage(page);
  await page.goto('/auth');
  await fillLogin(page, E2E_CREDENTIALS.alunoInstB.email, E2E_CREDENTIALS.alunoInstB.password);
  await page.waitForFunction(() => typeof localStorage !== 'undefined' && !!localStorage.getItem('accessToken'), {
    timeout: 35000,
  });
  await page.waitForURL(/painel-aluno|admin-dashboard|onboarding/, { timeout: 20000 });
}

export async function loginAsSecretariaInstB(page: Page) {
  await primeE2EPage(page);
  await page.goto('/auth');
  await fillLogin(page, E2E_CREDENTIALS.secretariaInstB.email, E2E_CREDENTIALS.secretariaInstB.password);
  await page.waitForFunction(() => typeof localStorage !== 'undefined' && !!localStorage.getItem('accessToken'), {
    timeout: 35000,
  });
  await page.waitForURL(/painel-secretaria|secretaria-dashboard|gestao|admin-dashboard|onboarding/, { timeout: 20000 });
}

export async function loginAsPOS(page: Page) {
  // Inst A: usar /auth como Admin (sem subdomínio em localhost)
  await primeE2EPage(page);
  await page.goto('/auth');
  await fillLogin(page, E2E_CREDENTIALS.pos.email, E2E_CREDENTIALS.pos.password);
  // Garantir login concluído (tokens) antes de verificar URL
  await page.waitForFunction(() => typeof localStorage !== 'undefined' && !!localStorage.getItem('accessToken'), { timeout: 20000 });
  // SPA: navegação client-side; aguardar redirect para ponto-de-venda
  await page.waitForFunction(
    () => /ponto-de-venda|admin-dashboard|onboarding/.test(window.location.pathname),
    { timeout: 25000 }
  );
}

export async function loginAsPOSInstB(page: Page) {
  await primeE2EPage(page);
  await page.goto('/auth');
  await fillLogin(page, E2E_CREDENTIALS.posInstB.email, E2E_CREDENTIALS.posInstB.password);
  await page.waitForFunction(() => typeof localStorage !== 'undefined' && !!localStorage.getItem('accessToken'), { timeout: 20000 });
  await page.waitForFunction(
    () => /ponto-de-venda|admin-dashboard|onboarding/.test(window.location.pathname),
    { timeout: 25000 }
  );
}

export const test = base.extend<Record<string, never>>({});
export { expect } from '@playwright/test';
