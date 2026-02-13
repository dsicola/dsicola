/**
 * Script para verificar se todos os controllers estão respeitando
 * o multi-tenant (filter.instituicaoId)
 */

import * as fs from 'fs';
import * as path from 'path';

const controllersDir = path.join(__dirname, '../src/controllers');
const controllers = fs.readdirSync(controllersDir).filter(f => f.endsWith('.controller.ts'));

console.log('🔍 Verificando multi-tenant em todos os controllers...\n');

const issues: Array<{ file: string; line: number; issue: string }> = [];
const good: Array<{ file: string }> = [];

controllers.forEach(file => {
  const filePath = path.join(controllersDir, file);
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  // Verificar se importa addInstitutionFilter
  const hasImport = content.includes('addInstitutionFilter') || content.includes('requireTenantScope');
  
  // Verificar se usa filter em queries
  const hasFilterUsage = content.includes('addInstitutionFilter(req)') || 
                         content.includes('requireTenantScope(req)') ||
                         content.includes('filter.instituicaoId');

  // Verificar se há queries Prisma sem filtro
  const hasPrismaQueries = /prisma\.\w+\.(findMany|findFirst|findUnique|create|update|delete)/.test(content);
  
  // Verificar se há where clauses sem filter
  const hasWhereWithoutFilter = /where:\s*\{[^}]*\}/.test(content) && 
                                 !content.includes('...filter') &&
                                 !content.includes('filter.instituicaoId') &&
                                 hasPrismaQueries;

  if (hasPrismaQueries) {
    if (!hasImport && !content.includes('SUPER_ADMIN')) {
      lines.forEach((line, idx) => {
        if (/prisma\.\w+\.(findMany|findFirst|findUnique)/.test(line)) {
          issues.push({
            file,
            line: idx + 1,
            issue: 'Query Prisma sem import de addInstitutionFilter'
          });
        }
      });
    } else if (!hasFilterUsage && hasWhereWithoutFilter) {
      lines.forEach((line, idx) => {
        if (/where:\s*\{/.test(line) && !line.includes('filter') && !line.includes('SUPER_ADMIN')) {
          issues.push({
            file,
            line: idx + 1,
            issue: 'Where clause sem uso de filter.instituicaoId'
          });
        }
      });
    } else {
      good.push({ file });
    }
  } else {
    good.push({ file });
  }
});

console.log(`✅ Controllers OK: ${good.length}`);
good.forEach(({ file }) => {
  console.log(`   ✓ ${file}`);
});

if (issues.length > 0) {
  console.log(`\n⚠️  Possíveis problemas encontrados: ${issues.length}`);
  issues.forEach(({ file, line, issue }) => {
    console.log(`   ⚠ ${file}:${line} - ${issue}`);
  });
} else {
  console.log('\n✨ Todos os controllers parecem estar respeitando multi-tenant!');
}

console.log(`\n📊 Resumo:`);
console.log(`   Total de controllers: ${controllers.length}`);
console.log(`   OK: ${good.length}`);
console.log(`   Possíveis problemas: ${issues.length}`);

