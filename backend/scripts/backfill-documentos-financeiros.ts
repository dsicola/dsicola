/**
 * Backfill DocumentoFinanceiro para dados existentes
 *
 * Cria Faturas (FT) para mensalidades sem documento fiscal
 * Cria Recibos (RC) para recibos sem documento fiscal
 *
 * Uso: npm run script:backfill-documentos-financeiros [--instituicaoId=xxx] [--dry-run]
 *
 * --instituicaoId=xxx  Opcional: processar apenas uma instituição
 * --dry-run            Não persiste alterações, apenas simula
 */

import 'dotenv/config';
import prisma from '../src/lib/prisma.js';
import { criarFaturaAoGerarMensalidade, criarDocumentoFinanceiroRecibo } from '../src/services/documentoFinanceiro.service.js';

const args = process.argv.slice(2);
const filtroInstituicaoId = args.find((a) => a.startsWith('--instituicaoId='))?.split('=')[1];
const dryRun = args.includes('--dry-run');

async function main() {
  console.log('=== Backfill DocumentoFinanceiro (SAFT-AO) ===');
  if (dryRun) console.log('[DRY-RUN] Nenhuma alteração será persistida\n');

  const whereInst: any = filtroInstituicaoId ? { id: filtroInstituicaoId } : {}; // ativas
  const instituicoes = await prisma.instituicao.findMany({
    where: whereInst,
    select: { id: true, nome: true },
  });

  if (instituicoes.length === 0) {
    console.log('Nenhuma instituição encontrada.');
    process.exit(1);
  }

  console.log(`Instituições a processar: ${instituicoes.length}\n`);

  let totalFaturas = 0;
  let totalRecibos = 0;
  const erros: string[] = [];

  for (const inst of instituicoes) {
    console.log(`\n--- ${inst.nome} (${inst.id}) ---`);

    // 1. Faturas (FT) para mensalidades sem documento
    const docsFT = await prisma.documentoFinanceiro.findMany({
      where: { instituicaoId: inst.id, tipoDocumento: 'FT', mensalidadeId: { not: null } },
      select: { mensalidadeId: true },
    });
    const idsComFT = docsFT.map((d) => d.mensalidadeId).filter((id): id is string => !!id);

    const mensalidadesSemFT = await prisma.mensalidade.findMany({
      where: {
        aluno: { instituicaoId: inst.id },
        id: idsComFT.length > 0 ? { notIn: idsComFT } : undefined,
      },
      select: { id: true },
    });

    const idsMensalidades = mensalidadesSemFT.map((m) => m.id);
    if (idsMensalidades.length > 0) {
      console.log(`  Mensalidades sem FT: ${idsMensalidades.length}`);
      for (const mid of idsMensalidades) {
        try {
          if (!dryRun) {
            await criarFaturaAoGerarMensalidade(mid, inst.id);
          }
          totalFaturas++;
        } catch (e: any) {
          erros.push(`FT mensalidade ${mid}: ${e?.message}`);
        }
      }
    }

    // 2. Recibos (RC) para recibos sem documento
    const docsRC = await prisma.documentoFinanceiro.findMany({
      where: { instituicaoId: inst.id, tipoDocumento: 'RC', reciboId: { not: null } },
      select: { reciboId: true },
    });
    const idsComRC = docsRC.map((d) => d.reciboId).filter((id): id is string => !!id);

    const recibosSemRC = await prisma.recibo.findMany({
      where: {
        instituicaoId: inst.id,
        id: idsComRC.length > 0 ? { notIn: idsComRC } : undefined,
      },
      select: { id: true },
    });

    const idsRecibos = recibosSemRC.map((r) => r.id);
    if (idsRecibos.length > 0) {
      console.log(`  Recibos sem RC: ${idsRecibos.length}`);
      for (const rid of idsRecibos) {
        try {
          if (!dryRun) {
            await criarDocumentoFinanceiroRecibo(rid, inst.id);
          }
          totalRecibos++;
        } catch (e: any) {
          erros.push(`RC recibo ${rid}: ${e?.message}`);
        }
      }
    }

    if (idsMensalidades.length === 0 && idsRecibos.length === 0) {
      console.log('  Nenhum dado pendente.');
    }
  }

  console.log('\n=== Resumo ===');
  console.log(`Faturas (FT) criadas: ${totalFaturas}`);
  console.log(`Recibos (RC) criados: ${totalRecibos}`);
  if (erros.length > 0) {
    console.log(`\nErros (${erros.length}):`);
    erros.slice(0, 10).forEach((e) => console.log(`  - ${e}`));
    if (erros.length > 10) console.log(`  ... e mais ${erros.length - 10}`);
  }
  if (dryRun) {
    console.log('\n[DRY-RUN] Nenhuma alteração foi persistida.');
  }

  await prisma.$disconnect();
  process.exit(erros.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Erro fatal:', e);
  process.exit(1);
});
