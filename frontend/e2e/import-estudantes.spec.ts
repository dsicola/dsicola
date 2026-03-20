/**
 * E2E: página Importar estudantes (Excel) com API real.
 *
 * Modo automático: `bash scripts/run-e2e-import-estudantes.sh` (sobe backend:3001 + frontend:8080, seeds opcional).
 * Modo manual: backend + frontend já a correr, depois:
 *   cd frontend && E2E_SKIP_WEB_SERVER=1 E2E_BASE_URL=http://127.0.0.1:8080 npm run test:e2e:import-estudantes:no-server
 *
 * Requer utilizador admin instituição A (seed multi-tenant), ver e2e/fixtures/auth.ts.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import { test, expect } from '@playwright/test';
import * as XLSX from 'xlsx';
import { loginAsAdmin } from './fixtures/auth';

function writeMinimalImportXlsx(): string {
  const fp = path.join(os.tmpdir(), `dsicola-e2e-import-estudantes-${Date.now()}.xlsx`);
  const data = [
    ['Nome completo', 'Classe / curso', 'Turma'],
    ['Aluno E2E Import Playwright', '10ª Classe', ''],
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Folha1');
  XLSX.writeFile(wb, fp);
  return fp;
}

test.describe('Importar estudantes (Excel)', () => {
  test.describe.configure({ timeout: 120_000 });

  test('admin: página carrega e preview após upload', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin-dashboard/importar-estudantes');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('heading', { name: /Importar estudantes/i })).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/Modo de importação/i).first()).toBeVisible({ timeout: 10000 });

    const fp = writeMinimalImportXlsx();
    try {
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(fp);

      await expect(page.getByRole('heading', { name: /Pré-visualização/i })).toBeVisible({
        timeout: 90_000,
      });
      await expect(page.getByText(/aluno\(s\) prontos para importar/i)).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText(/Aluno E2E Import Playwright/i).first()).toBeVisible({ timeout: 15_000 });
    } finally {
      try {
        fs.unlinkSync(fp);
      } catch {
        /* ignore */
      }
    }
  });
});
