#!/usr/bin/env npx tsx
/**
 * Gera o pacote MÍNIMO de exigências AGT (Ref. 0000481/01180000/AGT/2026):
 * - Uma única data (mês anterior ao atual)
 * - Sem segunda pró-forma (pontos 3 e 12 na carta podem citar a mesma PF da cadeia)
 * - ~11 documentos: FT+NIF, FT anulada, PF→FT→NC, FT 2 linhas IVA, FT settlement, FT USD,
 *   2× sem NIF, 2× GR
 *
 * Comparado com gerar-exigencias-agt.ts: não duplica o segundo mês (~ metade do volume).
 * A notificação pede PDFs em dois meses: corra este script duas vezes em meses distintos
 * ou use gerar-exigencias-agt.ts para gerar os dois de uma vez.
 *
 * Uso:
 *   npx tsx scripts/gerar-exigencias-agt-minimo.ts <instituicaoId>
 *   npx tsx scripts/gerar-exigencias-agt-minimo.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { gerarDocumentosCertificacaoAgt } from '../src/services/certificacaoAgtDocumentos.service.js';

const prisma = new PrismaClient();

async function main() {
  const instituicaoId = process.argv[2]?.trim();

  if (!instituicaoId) {
    const insts = await prisma.instituicao.findMany({
      select: { id: true, nome: true, subdominio: true },
      orderBy: { nome: 'asc' },
    });
    if (insts.length === 0) {
      console.error('Nenhuma instituição encontrada.');
      process.exit(1);
    }
    console.log('\nInstituições disponíveis:\n');
    insts.forEach((i) => console.log(`  ${i.id}  ${i.nome} (${i.subdominio || '-'})`));
    console.log('\nUso: npx tsx scripts/gerar-exigencias-agt-minimo.ts <instituicaoId>\n');
    process.exit(0);
  }

  const inst = await prisma.instituicao.findUnique({
    where: { id: instituicaoId },
    select: { id: true, nome: true },
  });

  if (!inst) {
    console.error(`Instituição não encontrada: ${instituicaoId}`);
    process.exit(1);
  }

  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth() + 1;
  let ano1 = anoAtual;
  let mes1Num = mesAtual - 1;
  if (mes1Num <= 0) {
    mes1Num = 12;
    ano1--;
  }
  const mesStr = `${ano1}-${String(mes1Num).padStart(2, '0')}-15`;

  const nomesMeses: Record<number, string> = {
    1: 'Janeiro', 2: 'Fevereiro', 3: 'Março', 4: 'Abril', 5: 'Maio', 6: 'Junho',
    7: 'Julho', 8: 'Agosto', 9: 'Setembro', 10: 'Outubro', 11: 'Novembro', 12: 'Dezembro',
  };

  console.log('\n=== AGT — Pacote mínimo (1 mês, 1 estudante com NIF + 2 perfis sem NIF) ===\n');
  console.log(`Instituição: ${inst.nome}`);
  console.log(`Data base: ${mesStr} (${nomesMeses[mes1Num]} ${ano1})\n`);

  const r = await gerarDocumentosCertificacaoAgt(instituicaoId, mesStr, {
    incluirSegundaProforma: false,
    substituirPacoteAnterior: true,
  });
  console.log(r.mensagem);
  console.log('Lote certificação AGT:', r.certificacaoAgtLoteId);
  console.log('\nPara checklist: npx tsx scripts/lembrar-passos-agt.ts', instituicaoId);
  console.log('Dois meses (ofício AGT): volte a correr com outra data ou use scripts/gerar-exigencias-agt.ts\n');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Erro:', e);
  process.exit(1);
});
