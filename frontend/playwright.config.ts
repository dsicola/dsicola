import { defineConfig, devices } from '@playwright/test';

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
    actionTimeout: 15000,
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
          command: 'npm run dev',
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 60000,
        },
});
