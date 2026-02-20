#!/usr/bin/env npx tsx
/**
 * LIMPA O BANCO DE DADOS - Mantém apenas o Super Admin
 *
 * Executa: prisma migrate reset --force
 * - Remove TODOS os dados (instituições, usuários, cursos, etc.)
 * - Recria o schema via migrations
 * - Executa o seed que cria o super-admin (superadmin@dsicola.com)
 *
 * ATENÇÃO: Esta operação é IRREVERSÍVEL. Faça backup se necessário.
 *
 * Uso: npx tsx scripts/limpar-banco-manter-super-admin.ts
 *      ou: npm run db:limpar-manter-super-admin
 */
import { execSync } from 'child_process';

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  🗑️  LIMPAR BANCO - Manter apenas Super Admin');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log('  O que será feito:');
  console.log('  1. Reset completo do banco (drop + recria via migrations)');
  console.log('  2. Execução do seed (cria superadmin@dsicola.com)\n');

  try {
    execSync('npx prisma migrate reset --force', {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
    console.log('\n✅ Banco limpo com sucesso. Apenas o Super Admin permanece.');
    console.log('   Email: superadmin@dsicola.com');
    console.log('   Senha: SuperAdmin@123 (ou a definida no .env)\n');
  } catch (error) {
    console.error('\n❌ Erro ao limpar banco:', (error as Error).message);
    process.exit(1);
  }
}

main();
