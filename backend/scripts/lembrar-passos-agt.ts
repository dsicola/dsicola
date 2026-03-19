#!/usr/bin/env npx tsx
/**
 * Checklist e lembrete dos passos pós-geração AGT.
 * Para instituição NOVA em PRODUÇÃO — valida documentos e gera mapeamento para a carta.
 *
 * Uso:
 *   npx tsx scripts/lembrar-passos-agt.ts <instituicaoId>
 *   npx tsx scripts/lembrar-passos-agt.ts                    # Lista instituições
 *
 * Ref. AGT: 0000481/01180000/AGT/2026
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PONTOS_AGT = [
  { ponto: 1, doc: 'Factura com cliente NIF', tipo: 'FT', semEstorno: true },
  { ponto: 2, doc: 'Factura anulada (visível no PDF)', tipo: 'FT', estornado: true },
  { ponto: 3, doc: 'Pró-forma', tipo: 'PF' },
  { ponto: 4, doc: 'Fatura baseada na pró-forma (OrderReferences)', tipo: 'FT', comDocBase: true },
  { ponto: 5, doc: 'Nota de crédito baseada na fatura ponto 4', tipo: 'NC', comDocBase: true },
  { ponto: 6, doc: 'Factura 2 linhas (IVA 14% + isento)', tipo: 'FT', linhas: 2 },
  { ponto: 7, doc: 'Documento qtd 100, preço 0.55, desconto global', tipo: 'FT' },
  { ponto: 8, doc: 'Documento moeda estrangeira (USD/EUR)', tipo: 'FT', moeda: true },
  { ponto: 9, doc: 'Documento cliente sem NIF, total < 50 AOA', tipo: 'FT' },
  { ponto: 10, doc: 'Outro documento cliente sem NIF', tipo: 'FT' },
  { ponto: 11, doc: 'Duas guias de remessa', tipo: 'GR', minQtd: 2 },
  { ponto: 12, doc: 'Orçamento ou pró-forma', tipo: 'PF' },
  { ponto: 13, doc: 'Factura genérica', naoAplicavel: true },
  { ponto: 14, doc: 'Auto-facturação', naoAplicavel: true },
  { ponto: 15, doc: 'Factura global', naoAplicavel: true },
];

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
    console.log('\nUso: npx tsx scripts/lembrar-passos-agt.ts <instituicaoId>\n');
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

  const inicioPeriodo = new Date(ano1, mes1Num - 1, 1);
  const fimPeriodo = new Date(ano2, mes2Num, 0); // último dia do mês

  const docs = await prisma.documentoFinanceiro.findMany({
    where: {
      instituicaoId,
      dataDocumento: {
        gte: inicioPeriodo,
        lte: fimPeriodo,
      },
    },
    include: {
      linhas: true,
      documentoBase: { select: { numeroDocumento: true, tipoDocumento: true } },
    },
    orderBy: [{ dataDocumento: 'asc' }, { numeroDocumento: 'asc' }],
  });

  const nomesMeses: Record<number, string> = {
    1: 'Jan', 2: 'Fev', 3: 'Mar', 4: 'Abr', 5: 'Mai', 6: 'Jun',
    7: 'Jul', 8: 'Ago', 9: 'Set', 10: 'Out', 11: 'Nov', 12: 'Dez',
  };

  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║  CHECKLIST AGT — Próximos Passos (Instituição em Produção)      ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');
  console.log(`Instituição: ${inst.nome}`);
  console.log(`Período: ${nomesMeses[mes1Num]}/${ano1} e ${nomesMeses[mes2Num]}/${ano2}`);
  console.log(`Documentos no período: ${docs.length}\n`);

  // Mapeamento para carta (exemplos por ponto)
  const ftComNif = docs.find((d) => d.tipoDocumento === 'FT' && d.estado === 'EMITIDO' && !d.documentoBaseId);
  const ftAnulada = docs.find((d) => d.tipoDocumento === 'FT' && d.estado === 'ESTORNADO');
  const proformas = docs.filter((d) => d.tipoDocumento === 'PF');
  const ftDePf = docs.find((d) => d.tipoDocumento === 'FT' && d.documentoBase?.tipoDocumento === 'PF');
  const ncDeFt = docs.find((d) => d.tipoDocumento === 'NC' && d.documentoBaseId);
  const ft2Linhas = docs.find((d) => d.tipoDocumento === 'FT' && d.linhas.length >= 2 && d.linhas.some((l) => Number(l.taxaIVA) > 0));
  const ftDesconto = docs.find((d) => d.tipoDocumento === 'FT' && Number(d.valorDesconto) > 0);
  const ftMoeda = docs.find((d) => d.tipoDocumento === 'FT' && d.moeda && d.moeda !== 'AOA');
  const guias = docs.filter((d) => d.tipoDocumento === 'GR');

  const mapeamento: Array<{ ponto: number; doc: string; numero?: string; pdf?: string }> = [
    { ponto: 1, doc: 'Factura com cliente NIF', numero: ftComNif?.numeroDocumento, pdf: ftComNif ? `${ftComNif.numeroDocumento}.pdf` : '—' },
    { ponto: 2, doc: 'Factura anulada', numero: ftAnulada?.numeroDocumento, pdf: ftAnulada ? `${ftAnulada.numeroDocumento}_anulada.pdf` : '—' },
    { ponto: 3, doc: 'Pró-forma', numero: proformas[0]?.numeroDocumento, pdf: proformas[0] ? `${proformas[0].numeroDocumento}.pdf` : '—' },
    { ponto: 4, doc: 'Fatura baseada em PF', numero: ftDePf?.numeroDocumento, pdf: ftDePf ? `${ftDePf.numeroDocumento}.pdf` : '—' },
    { ponto: 5, doc: 'Nota de crédito', numero: ncDeFt?.numeroDocumento, pdf: ncDeFt ? `${ncDeFt.numeroDocumento}.pdf` : '—' },
    { ponto: 6, doc: 'Factura IVA + isento', numero: ft2Linhas?.numeroDocumento, pdf: ft2Linhas ? `${ft2Linhas.numeroDocumento}.pdf` : '—' },
    { ponto: 7, doc: 'Documento com desconto', numero: ftDesconto?.numeroDocumento, pdf: ftDesconto ? `${ftDesconto.numeroDocumento}.pdf` : '—' },
    { ponto: 8, doc: 'Documento moeda estrangeira', numero: ftMoeda?.numeroDocumento, pdf: ftMoeda ? `${ftMoeda.numeroDocumento}.pdf` : '—' },
    { ponto: 9, doc: 'Cliente sem NIF (<50)', numero: '—', pdf: '—' },
    { ponto: 10, doc: 'Outro cliente sem NIF', numero: '—', pdf: '—' },
    { ponto: 11, doc: '2 guias de remessa', numero: guias.map((g) => g.numeroDocumento).join(', '), pdf: guias.length >= 2 ? guias.slice(0, 2).map((g) => `${g.numeroDocumento}.pdf`).join(', ') : '—' },
    { ponto: 12, doc: 'Orçamento/Pró-forma', numero: proformas[1]?.numeroDocumento ?? proformas[0]?.numeroDocumento, pdf: proformas[1] ? `${proformas[1].numeroDocumento}.pdf` : proformas[0] ? `${proformas[0].numeroDocumento}.pdf` : '—' },
    { ponto: 13, doc: 'Factura genérica', numero: '—', pdf: 'Não aplicável' },
    { ponto: 14, doc: 'Auto-facturação', numero: '—', pdf: 'Não aplicável' },
    { ponto: 15, doc: 'Factura global', numero: '—', pdf: 'Não aplicável' },
  ];

  // Melhorar pontos 9 e 10 (clientes sem NIF - entidade sem numeroIdentificacao)
  const usersSemNif = await prisma.user.findMany({
    where: { instituicaoId, numeroIdentificacao: null },
    select: { id: true },
  });
  const idsSemNif = new Set(usersSemNif.map((u) => u.id));
  const docsSemNif = docs.filter((d) => d.tipoDocumento === 'FT' && idsSemNif.has(d.entidadeId) && Number(d.valorTotal) < 50);
  const docsSemNif2 = docs.filter((d) => d.tipoDocumento === 'FT' && idsSemNif.has(d.entidadeId) && Number(d.valorTotal) >= 50);
  if (docsSemNif[0]) {
    mapeamento[8].numero = docsSemNif[0].numeroDocumento;
    mapeamento[8].pdf = `${docsSemNif[0].numeroDocumento}.pdf`;
  }
  if (docsSemNif2[0] || docsSemNif[1]) {
    const doc10 = docsSemNif2[0] ?? docsSemNif[1];
    mapeamento[9].numero = doc10?.numeroDocumento;
    mapeamento[9].pdf = doc10 ? `${doc10.numeroDocumento}.pdf` : '—';
  }

  console.log('┌─────────────────────────────────────────────────────────────────────┐');
  console.log('│  MAPEAMENTO PARA CARTA (copie para CARTA_ENVIO_AGT_PREENCHIR.md)    │');
  console.log('└─────────────────────────────────────────────────────────────────────┘\n');
  console.log('| Ponto | Documento DSICOLA | Ficheiro PDF anexo |');
  console.log('|-------|------------------|--------------------|');
  mapeamento.forEach((m) => {
    const num = (m.numero ?? '—').toString().padEnd(18);
    const pdf = (m.pdf ?? '—').toString().padEnd(30);
    console.log(`| ${String(m.ponto).padStart(2)} | ${num} | ${pdf} |`);
  });

  console.log('\n┌─────────────────────────────────────────────────────────────────────┐');
  console.log('│  CHECKLIST — O QUE FAZER AGORA                                       │');
  console.log('└─────────────────────────────────────────────────────────────────────┘\n');
  console.log('  [ ] 1. Verificar Documentos Fiscais → Lista (todos os 12 tipos presentes)');
  console.log('  [ ] 2. Exportar SAF-T: Menu → Exportar SAFT → Ano e Mês');
  console.log(`       - Exportar ${nomesMeses[mes1Num]}/${ano1} e ${nomesMeses[mes2Num]}/${ano2} (ou ano completo)`);
  console.log('  [ ] 3. Gerar PDFs de cada documento (Documentos Fiscais → Download PDF)');
  console.log('       - Incluir factura anulada (ponto 2) com selo "ANULADO" visível');
  console.log('  [ ] 4. Preencher docs/CARTA_ENVIO_AGT_PREENCHIR.md com o mapeamento acima');
  console.log('  [ ] 5. Enviar à AGT: produtos.dfe.dcrr.agt@minfin.gov.ao');
  console.log('       Assunto: Validação software DSICOLA — Ref. 0000481/01180000/AGT/2026');
  console.log('       Anexos: PDFs + ficheiro XML SAF-T + carta\n');

  const faltam = docs.length < 12 ? '⚠️  Pode faltar documentos. Execute: npx tsx scripts/gerar-exigencias-agt.ts ' + instituicaoId : '✓ Documentos suficientes';
  console.log(faltam + '\n');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Erro:', e);
  process.exit(1);
});
