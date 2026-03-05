/**
 * Backfill de funcionalidades em planos legados
 *
 * Planos com funcionalidades null ou vazias recebem o conjunto base.
 * Garante que a validação 100% dinâmica em planFeatures.service funcione.
 *
 * Executar: npx tsx scripts/backfill-planos-funcionalidades.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Conjunto base - mínimo que todo plano deve ter para operar */
const FUNCIONALIDADES_BASE = [
  'gestao_alunos',
  'gestao_professores',
  'notas',
  'frequencia',
  'financeiro',
  'documentos',
];

async function main() {
  console.log('🔧 Backfill de funcionalidades em planos legados\n');

  const planos = await prisma.plano.findMany({
    where: { ativo: true },
    select: { id: true, nome: true, funcionalidades: true, tipoAcademico: true },
  });

  let atualizados = 0;

  for (const plano of planos) {
    const funcs = plano.funcionalidades as string[] | null;
    const isEmpty = !funcs || !Array.isArray(funcs) || funcs.length === 0;

    if (!isEmpty) {
      continue;
    }

    await prisma.plano.update({
      where: { id: plano.id },
      data: { funcionalidades: FUNCIONALIDADES_BASE },
    });

    console.log(`   ✓ ${plano.nome} (${plano.tipoAcademico ?? 'ambos'}) → funcionalidades base`);
    atualizados++;
  }

  if (atualizados === 0) {
    console.log('   Nenhum plano precisou de backfill.');
  } else {
    console.log(`\n✅ ${atualizados} plano(s) atualizado(s).`);
  }
}

main()
  .catch((e) => {
    console.error('Erro:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
