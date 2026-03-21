import { defineConfig, devices } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Alinha credenciais E2E ao backend local: `fixtures/auth.ts` usa TEST_SUPER_ADMIN_*,
 * mas o seed real usa SUPER_ADMIN_* do `backend/.env` (senhas diferentes quebram vários specs).
 */
function applyBackendEnvForE2E() {
  const envPath = path.resolve(__dirname, '../backend/.env');
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1);
    if (process.env[key] === undefined || process.env[key] === '') process.env[key] = val;
  }
  if (!process.env.TEST_SUPER_ADMIN_EMAIL && process.env.SUPER_ADMIN_EMAIL) {
    process.env.TEST_SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL;
  }
  if (!process.env.TEST_SUPER_ADMIN_PASSWORD && process.env.SUPER_ADMIN_PASSWORD) {
    process.env.TEST_SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD;
  }
}

applyBackendEnvForE2E();

/** URL do frontend para E2E. Em produção/staging use E2E_BASE_URL (ex.: https://staging.dsicola.com) */
const baseURL =
  process.env.E2E_BASE_URL ||
  process.env.PLAYWRIGHT_TEST_BASE_URL ||
  'http://localhost:8080';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 60000,
  expect: { timeout: 10000 },
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 40000,
    navigationTimeout: 20000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], browserName: 'chromium' } },
    /** Usar Chrome instalado no sistema (evita SIGSEGV do chromium headless em alguns macOS): USE_CHROME=1 npm run test:e2e:roadmap-academico */
    { name: 'chrome', use: { ...devices['Desktop Chrome'], browserName: 'chromium', channel: 'chrome' } },
    /** Firefox: alternativa quando Chrome crasha (SIGABRT) em alguns ambientes */
    { name: 'firefox', use: { ...devices['Desktop Firefox'], browserName: 'firefox' } },
    { name: 'chromium-mobile', use: { ...devices['Pixel 5'], browserName: 'chromium' } },
    { name: 'iPhone 12', use: { ...devices['iPhone 12'] } },
    { name: 'Pixel 5', use: { ...devices['Pixel 5'] } },
  ],
  webServer:
    process.env.E2E_SKIP_WEB_SERVER || baseURL !== 'http://localhost:8080'
      ? undefined
      : {
          command: 'E2E_HOST=127.0.0.1 npm run dev',
          url: baseURL,
          /** Reutilizar dev em 8080 se já responder (evita conflito de porta com CI=1 + servidor local). */
          reuseExistingServer: true,
          timeout: 60000,
        },
});
