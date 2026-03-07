import { test, expect } from '@playwright/test';
import { loginAsSuperAdmin } from './fixtures/auth';

/**
 * Teste E2E: Fluxo completo Criar Instituição + Criar Admin
 *
 * Valida:
 * 1. Login como Super Admin
 * 2. Criar nova instituição (nome, subdomínio, email, tipo acadêmico)
 * 3. Criar administrador para a instituição (nome, email, senha)
 * 4. Verificar que o admin foi criado (toast de sucesso e/ou admin visível na lista)
 *
 * Requer: frontend em :8080, backend em :3001
 * Credenciais: superadmin@dsicola.com / SuperAdmin@123 (seed padrão)
 */
test.describe('Super Admin - Fluxo Instituição + Admin', () => {
  test.setTimeout(90000);

  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('domcontentloaded');
  });

  test('Fluxo completo: criar instituição e criar admin', async ({ page }) => {
    const uniqueId = Date.now();
    const nomeInstituicao = `Instituição E2E ${uniqueId}`;
    const subdominio = `e2e-test-${uniqueId}`;
    const emailContato = `contato-${uniqueId}@teste.dsicola.com`;
    const adminNome = `Admin E2E ${uniqueId}`;
    const adminEmail = `admin-${uniqueId}@teste.dsicola.com`;
    const adminPassword = 'Admin@123'; // Senha forte: 8+ chars, maiúscula, minúscula, número, especial

    // 1. Login como Super Admin
    await loginAsSuperAdmin(page);
    await page.waitForURL(/super-admin|\/\?/, { timeout: 20000 });

    // 2. Ir para tab Instituições
    await page.goto('/super-admin?tab=instituicoes');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);

    await expect(page.getByRole('heading', { name: /Instituições/i })).toBeVisible({
      timeout: 10000,
    });

    // 3. Abrir diálogo Criar Nova Instituição
    const criarBtn = page.getByRole('button', { name: /Criar Nova Instituição/i });
    await expect(criarBtn).toBeVisible({ timeout: 10000 });
    await criarBtn.click();
    await page.waitForTimeout(500);

    const dialogInst = page.getByRole('dialog', { name: /Nova Instituição/i });
    await expect(dialogInst).toBeVisible({ timeout: 5000 });

    // 4. Preencher formulário da instituição
    await dialogInst.getByLabel(/Nome da Instituição/i).fill(nomeInstituicao);
    await dialogInst.getByLabel(/Subdomínio/i).fill(subdominio);
    await dialogInst.getByLabel(/E-mail de Contato/i).fill(emailContato);

    // Tipo Acadêmico - clicar no Select e escolher Ensino Secundário
    await dialogInst.locator('[role="combobox"]').first().click();
    await page.waitForTimeout(300);
    await page.getByRole('option', { name: /Ensino Secundário/i }).click();
    await page.waitForTimeout(300);

    // 5. Submeter (Criar)
    await dialogInst.getByRole('button', { name: /^Criar$/ }).click();

    // 6. Aguardar sucesso
    await expect(page.getByText(/Instituição criada com sucesso/i)).toBeVisible({
      timeout: 15000,
    });
    await page.waitForTimeout(1000);

    // 7. Verificar que a instituição aparece na tabela
    await expect(page.getByText(nomeInstituicao)).toBeVisible({ timeout: 10000 });

    // 8. Clicar no botão "Adicionar administrador" (UserPlus) para a nova instituição
    const row = page.locator('tbody tr').filter({ hasText: nomeInstituicao }).first();
    await expect(row).toBeVisible({ timeout: 5000 });
    const actionsCell = row.locator('td').last();
    const userPlusBtn = actionsCell.locator('button').nth(1); // ExternalLink=0, UserPlus=1
    await userPlusBtn.click();
    await page.waitForTimeout(500);

    // 9. Diálogo Criar Administrador
    const dialogAdmin = page.getByRole('dialog', { name: /Criar Administrador/i });
    await expect(dialogAdmin).toBeVisible({ timeout: 5000 });
    await expect(dialogAdmin.getByText(new RegExp(nomeInstituicao))).toBeVisible({ timeout: 3000 });

    // 10. Preencher formulário do admin
    await dialogAdmin.getByLabel(/Nome Completo/i).fill(adminNome);
    await dialogAdmin.getByLabel(/E-mail/i).first().fill(adminEmail);
    await dialogAdmin.getByLabel(/Senha/i).fill(adminPassword);

    // Aguardar validação da senha (PasswordStrengthIndicator)
    await page.waitForTimeout(500);

    // 11. Submeter (Criar Admin)
    await dialogAdmin.getByRole('button', { name: /Criar Admin/i }).click();

    // 12. Verificar sucesso
    await expect(page.getByText(new RegExp(`Admin.*${adminNome}.*criado`))).toBeVisible({
      timeout: 15000,
    });

    // 13. Expandir lista de admins e verificar que o admin aparece
    const chevronBtn = actionsCell.locator('button').nth(2); // Botão "Ver administradores"
    await chevronBtn.click();
    await page.waitForTimeout(800);

    await expect(page.getByText(adminNome)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(adminEmail)).toBeVisible({ timeout: 3000 });
  });
});
