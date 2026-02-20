#!/usr/bin/env npx tsx
/**
 * SUITE: Plano de Ensino (Secundário + Superior) + Perfil Professor
 *
 * Executa em sequência:
 * 1. seed-multi-tenant-test (pré-requisito)
 * 2. test-plano-ensino-fluxo-completo-secundario
 * 3. test-plano-ensino-fluxo-completo-superior
 * 4. test-plano-ensino-professor-secundario-superior
 * 5. test-professor-fluxo-completo
 *
 * Requer: Backend rodando em http://localhost:3001
 * Uso: npm run test:plano-ensino-e-professor-suite
 */
import { spawn } from 'child_process';
import path from 'path';

const SCRIPTS = [
  { name: 'Seed multi-tenant', script: 'seed-multi-tenant-test.ts' },
  { name: 'Plano Ensino Secundário', script: 'test-plano-ensino-fluxo-completo-secundario.ts' },
  { name: 'Plano Ensino Superior', script: 'test-plano-ensino-fluxo-completo-superior.ts' },
  { name: 'Plano Ensino + Professor (Sec+Sup)', script: 'test-plano-ensino-professor-secundario-superior.ts' },
  {
    name: 'Fluxo Professor',
    script: 'test-professor-fluxo-completo.ts',
    env: {
      ...process.env,
      TEST_PROFESSOR_EMAIL: 'prof.inst.a@teste.dsicola.com',
      TEST_PROFESSOR_PASSWORD: 'TestMultiTenant123!',
    },
  },
];

function run(script: string, env?: NodeJS.ProcessEnv): Promise<number> {
  return new Promise((resolve) => {
    const p = path.join(__dirname, script);
    const child = spawn('npx', ['tsx', p], {
      cwd: path.join(__dirname, '..'),
      env: env || process.env,
      stdio: 'inherit',
    });
    child.on('close', (code) => resolve(code ?? 0));
    child.on('error', () => resolve(1));
  });
}

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════════════════╗');
  console.log('║  SUITE: Plano de Ensino + Professor (Secundário + Superior)            ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════╝\n');

  for (let i = 0; i < SCRIPTS.length; i++) {
    const { name, script, env } = SCRIPTS[i];
    console.log(`\n[${i + 1}/${SCRIPTS.length}] ${name} (${script})`);
    const code = await run(script, env);
    if (code !== 0) {
      console.error(`\n❌ ${name} falhou (exit ${code})`);
      process.exit(1);
    }
    console.log(`✅ ${name} OK`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('  ✅ TODOS OS TESTES PASSARAM');
  console.log('  • Plano de Ensino Secundário - fluxo completo');
  console.log('  • Plano de Ensino Superior - fluxo completo');
  console.log('  • Plano de Ensino + Professor (Sec+Sup) - admin cria, professor vê/lança');
  console.log('  • Perfil Professor - fluxo completo (rotas, notas, aulas, etc.)');
  console.log('═══════════════════════════════════════════════════════════════════════\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
