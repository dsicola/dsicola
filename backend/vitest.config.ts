import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: process.env.CI ? ['**/notas-isolamento-professores.test.ts'] : [],
    testTimeout: 10000,
    // Em CI: execução sequencial para evitar race conditions entre testes que partilham seed
    ...(process.env.CI && { fileParallelism: false }),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
