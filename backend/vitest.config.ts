import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Excluir integrações pesadas só no GitHub Actions (npm run test na pipeline).
    // Usar `process.env.CI` quebra ambientes locais (ex. CI=1 no IDE) e scripts como test:isolamento-professores.
    exclude:
      process.env.GITHUB_ACTIONS === 'true'
        ? [
            // Integrações longas / partilham DB; isolamento de notas usa supertest e pode correr no CI
            '**/contabilidade-multitenant.test.ts',
            '**/campus-config-multitenant.test.ts',
          ]
        : [],
    testTimeout: 10000,
    ...(process.env.GITHUB_ACTIONS === 'true' && { fileParallelism: false }),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
