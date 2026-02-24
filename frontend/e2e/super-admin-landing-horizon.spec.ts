import { test, expect } from '@playwright/test';

/**
 * Teste E2E: Editor da Landing Page no estilo Horizon IA (blocos/seções)
 *
 * Valida:
 * - Acesso à tab Landing como SUPER_ADMIN
 * - Presença do editor por blocos (Imagens, Tema, Conteúdo por blocos)
 * - Seções expansíveis: Hero, Selos de Confiança, Benefícios, Recursos, Planos, Demo, Contato, Rodapé
 * - Expandir bloco Hero e editar um campo
 * - Botão Salvar e Ver Landing
 *
 * Requer: frontend em :8080, backend em :3001
 * Credenciais: superadmin@dsicola.com / SuperAdmin@123 (seed padrão)
 */
const SUPER_ADMIN_EMAIL = process.env.TEST_SUPER_ADMIN_EMAIL || 'superadmin@dsicola.com';
const SUPER_ADMIN_PASSWORD = process.env.TEST_SUPER_ADMIN_PASSWORD || 'SuperAdmin@123';

test.describe('Super Admin - Landing Page (nível Horizon IA)', () => {
  test.setTimeout(60000);

  async function loginAsSuperAdmin(page: import('@playwright/test').Page) {
    await page.goto('/auth');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('#email', { timeout: 10000 });
    await page.fill('#email', SUPER_ADMIN_EMAIL);
    await page.fill('#password', SUPER_ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/super-admin|\/\?/, { timeout: 20000 });
  }

  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('domcontentloaded');
  });

  test('Abre a tab Landing e carrega o editor por blocos', async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.goto('/super-admin?tab=landing');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);

    await expect(page.getByRole('heading', { name: /Configurações da Landing Page/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Personalize o conteúdo/i)).toBeVisible({ timeout: 5000 });
  });

  test('Editor em blocos: Estilo do site (Cores, Fontes, Botões, Animações) e Imagens visíveis', async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.goto('/super-admin?tab=landing');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);

    await expect(page.getByText('Estilo do site').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Escolha e gerencie as configurações de estilo/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('tab', { name: /Cores/i }).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('tab', { name: /Fontes/i }).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('tab', { name: /Botões/i }).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('tab', { name: /Animações/i }).first()).toBeVisible({ timeout: 5000 });

    await expect(page.getByText('Imagens e Logos').first()).toBeVisible({ timeout: 5000 });
  });

  test('Conteúdo por blocos: todas as seções presentes (nível Horizon)', async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.goto('/super-admin?tab=landing');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);

    await expect(page.getByText('Conteúdo por blocos').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Edite cada seção da landing/i).first()).toBeVisible({ timeout: 5000 });

    const sectionLabels = [
      'Seção Principal (Hero)',
      'Selos de Confiança',
      'Barra de Benefícios',
      'Recursos do Sistema',
      'Planos e Preços',
      'Vídeo e Demonstração',
      'Formulário de Contato',
      'Rodapé',
    ];

    for (const label of sectionLabels) {
      await expect(page.getByText(label).first()).toBeVisible({ timeout: 8000 });
    }
  });

  test('Expandir bloco Hero e campos editáveis visíveis', async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.goto('/super-admin?tab=landing');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);

    const heroBlock = page.getByRole('button', { name: /Seção Principal \(Hero\)/i }).first();
    await expect(heroBlock).toBeVisible({ timeout: 10000 });

    const hasHeroFields = await page.getByLabel('Badge do Hero').isVisible().catch(() => false);
    if (!hasHeroFields) {
      await heroBlock.click();
      await page.waitForTimeout(400);
    }

    await expect(page.getByLabel('Badge do Hero').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByLabel('Título Principal').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByPlaceholder(/Sistema de Gestão Acadêmica Completo/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('Editar título do Hero e botão Salvar habilitado', async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.goto('/super-admin?tab=landing');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);

    const heroBlock = page.getByRole('button', { name: /Seção Principal \(Hero\)/i }).first();
    await expect(heroBlock).toBeVisible({ timeout: 10000 });
    const hasBadgeField = await page.getByLabel('Badge do Hero').isVisible().catch(() => false);
    if (!hasBadgeField) {
      await heroBlock.click();
      await page.waitForTimeout(400);
    }

    const tituloInput = page.getByLabel('Título Principal').first();
    await expect(tituloInput).toBeVisible({ timeout: 5000 });
    await tituloInput.fill('Teste E2E Landing Horizon');
    await page.waitForTimeout(300);

    const saveBtn = page.getByRole('button', { name: /Salvar/i }).first();
    await expect(saveBtn).toBeVisible({ timeout: 5000 });
    await expect(saveBtn).toBeEnabled();
  });

  test('Botão Ver Landing abre página de vendas', async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.goto('/super-admin?tab=landing');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(600);

    const verLandingBtn = page.getByRole('button', { name: /Ver Landing/i }).first();
    await expect(verLandingBtn).toBeVisible({ timeout: 10000 });

    const [newPage] = await Promise.all([
      page.context().waitForEvent('page'),
      verLandingBtn.click(),
    ]);
    await newPage.waitForLoadState('domcontentloaded');
    expect(newPage.url()).toMatch(/\/vendas|localhost.*8080/);
    await newPage.close();
  });

  test('Bloco Planos e Preços e Rodapé presentes', async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.goto('/super-admin?tab=landing');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);

    await expect(page.getByText('Planos e Preços').first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('Rodapé').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Planos Exibidos na Landing').first()).toBeVisible({ timeout: 8000 });
  });
});
