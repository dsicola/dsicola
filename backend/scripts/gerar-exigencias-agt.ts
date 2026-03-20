#!/usr/bin/env npx tsx
/**
 * Gera TODAS as exigências AGT (Ref. 0000481/01180000/AGT/2026) para uma instituição.
 *
 * Destinado a: instituição NOVA em PRODUÇÃO (não requer seed).
 *
 * Documentos gerados (conforme ofício Software agt.pdf):
 *  1. Factura para cliente com NIF
 *  2. Factura anulada + PDF visível "ANULADO"
 *  3. Pró-forma (conferência bens/serviços)
 *  4. Factura baseada na pró-forma (OrderReferences)
 *  5. Nota de crédito baseada na factura do ponto 4
 *  6. Factura 2 linhas: 1ª IVA 14%; 2ª isenta (TaxExemptionReason)
 *  7. Documento: qtd 100, preço 0.55, desconto linha 8.8% + SettlementAmount
 *  8. Documento em moeda estrangeira (USD)
 *  9. Cliente sem NIF, total < 50 AOA, SystemEntryDate até 10h
 * 10. Outro documento para outro cliente sem NIF
 * 11. Duas guias de remessa
 * 12. Orçamento ou factura pró-forma
 *
 * Pontos 13–15 (factura genérica, auto-facturação, factura global): Não aplicável ao DSICOLA.
 *
 * Exigência AGT: documentos em DOIS MESES DIFERENTES, com pelo menos 2 meses atrás.
 * O script usa automaticamente os 2 meses anteriores ao mês atual (ex: em Março → Jan e Fev).
 *
 * Uso:
 *   npx tsx scripts/gerar-exigencias-agt.ts <instituicaoId>
 *   npx tsx scripts/gerar-exigencias-agt.ts                    # Lista instituições
 *
 * Após executar, rode: npx tsx scripts/lembrar-passos-agt.ts <instituicaoId>
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
      console.error('Nenhuma instituição encontrada. Crie uma instituição primeiro.');
      process.exit(1);
    }
    console.log('\nInstituições disponíveis:\n');
    insts.forEach((i) => console.log(`  ${i.id}  ${i.nome} (${i.subdominio || '-'})`));
    console.log('\nUso: npx tsx scripts/gerar-exigencias-agt.ts <instituicaoId>\n');
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

  const config = await prisma.configuracaoInstituicao.findFirst({
    where: { instituicaoId },
    select: { nif: true },
  });
  if (!config?.nif?.trim()) {
    console.warn('Aviso: NIF da instituição não configurado. Configure em Configurações → dados fiscais.');
  }

  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth() + 1; // 1-12

  // Exigência AGT: 2 meses diferentes, com pelo menos 2 meses atrás
  // Ex: em Março → Jan e Fev; em Jan → Nov e Dez do ano anterior
  let ano1 = anoAtual;
  let mes1Num = mesAtual - 2;
  if (mes1Num <= 0) {
    mes1Num += 12;
    ano1--;
  }
  let ano2 = anoAtual;
  let mes2Num = mesAtual - 1;
  if (mes2Num <= 0) {
    mes2Num += 12;
    ano2--;
  }

  const mes1 = `${ano1}-${String(mes1Num).padStart(2, '0')}-15`;
  const mes2 = `${ano2}-${String(mes2Num).padStart(2, '0')}-15`;

  const nomesMeses: Record<number, string> = {
    1: 'Janeiro', 2: 'Fevereiro', 3: 'Março', 4: 'Abril', 5: 'Maio', 6: 'Junho',
    7: 'Julho', 8: 'Agosto', 9: 'Setembro', 10: 'Outubro', 11: 'Novembro', 12: 'Dezembro',
  };

  console.log('\n=== Gerar Exigências AGT (Decreto 312/18) ===\n');
  console.log(`Instituição: ${inst.nome} (produção)`);
  console.log(`Meses (2 meses atrás): ${nomesMeses[mes1Num]} ${ano1} e ${nomesMeses[mes2Num]} ${ano2}\n`);

  console.log('Gerando documentos (1.º mês — substitui pacote AGT anterior)...');
  const r1 = await gerarDocumentosCertificacaoAgt(instituicaoId, mes1, { substituirPacoteAnterior: true });
  console.log(`  ${r1.mensagem}\n`);

  console.log('Gerando documentos (2.º mês — mesmo lote, sem apagar o 1.º)...');
  const r2 = await gerarDocumentosCertificacaoAgt(instituicaoId, mes2, {
    substituirPacoteAnterior: false,
    certificacaoAgtLoteId: r1.certificacaoAgtLoteId,
  });
  console.log(`  ${r2.mensagem}`);
  console.log(`  Lote certificação AGT: ${r1.certificacaoAgtLoteId}\n`);

  console.log('=== Concluído ===');
  console.log('\nExecute o script de lembrete para ver o checklist e mapeamento:');
  console.log(`  npx tsx scripts/lembrar-passos-agt.ts ${instituicaoId}\n`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Erro:', e);
  process.exit(1);
});
