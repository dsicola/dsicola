#!/usr/bin/env npx tsx
/**
 * Script: Verificar e preencher tipoAcademico em instituições
 *
 * Lista instituições sem tipoAcademico definido e, opcionalmente,
 * preenche automaticamente usando identificarTipoAcademico.
 *
 * Uso:
 *   npx tsx scripts/verificar-tipo-academico.ts           # apenas listar
 *   npx tsx scripts/verificar-tipo-academico.ts --fill    # listar e preencher
 *   npx tsx scripts/verificar-tipo-academico.ts --force    # forçar atualização em todas
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { identificarTipoAcademico, atualizarTipoAcademico } from '../src/services/instituicao.service.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const doFill = args.includes('--fill');
  const forceUpdate = args.includes('--force');

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  VERIFICAÇÃO DE TIPO ACADÊMICO (Instituições)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const instituicoes = await prisma.instituicao.findMany({
    select: {
      id: true,
      nome: true,
      subdominio: true,
      tipoAcademico: true,
    },
    orderBy: { nome: 'asc' },
  });

  const semTipo = instituicoes.filter((i) => !i.tipoAcademico);
  const comTipo = instituicoes.filter((i) => i.tipoAcademico);

  console.log(`Total de instituições: ${instituicoes.length}`);
  console.log(`  - Com tipoAcademico: ${comTipo.length}`);
  console.log(`  - Sem tipoAcademico: ${semTipo.length}\n`);

  if (semTipo.length === 0 && !forceUpdate) {
    console.log('✅ Todas as instituições já possuem tipoAcademico definido.\n');
    await prisma.$disconnect();
    return;
  }

  const alvo = forceUpdate ? instituicoes : semTipo;
  if (alvo.length === 0) {
    await prisma.$disconnect();
    return;
  }

  console.log(forceUpdate ? 'Modo --force: atualizando todas as instituições.\n' : 'Instituições sem tipoAcademico:\n');

  for (const inst of alvo) {
    const identificado = await identificarTipoAcademico(inst.id);
    const status = identificado
      ? `→ ${identificado}`
      : '(não identificado automaticamente)';

    console.log(`  ${inst.nome} (${inst.subdominio || inst.id.slice(0, 8)})`);
    console.log(`    Atual: ${inst.tipoAcademico ?? 'null'} | Identificado: ${status}`);

    if (doFill || forceUpdate) {
      try {
        const resultado = await atualizarTipoAcademico(inst.id, forceUpdate);
        if (resultado) {
          console.log(`    ✓ Atualizado para: ${resultado}`);
        } else if (!forceUpdate && !identificado) {
          console.log(`    ⚠ Mantido (sem dados suficientes para identificar)`);
        }
      } catch (e) {
        console.log(`    ✗ Erro: ${(e as Error).message}`);
      }
    }
    console.log('');
  }

  if (!doFill && !forceUpdate && semTipo.length > 0) {
    console.log('Para preencher automaticamente, execute com --fill:');
    console.log('  npx tsx scripts/verificar-tipo-academico.ts --fill\n');
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Erro:', e);
  process.exit(1);
});
