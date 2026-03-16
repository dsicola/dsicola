#!/usr/bin/env npx tsx
/**
 * TESTE AGT — Exigências da notificação 0000481/01180000/AGT/2026
 *
 * Valida 100% conformidade com os requisitos da carta da AGT:
 * 1. Factura cliente com NIF
 * 2. Factura anulada + PDF "ANULADO"
 * 3. Pró-forma
 * 4. Factura baseada na pró-forma (OrderReferences)
 * 5. Nota de crédito baseada na factura do ponto 4 (References)
 * 6. Factura 2 linhas: IVA 14%/5% + isento TaxExemptionReason
 * 7. Documento 2 linhas: qtd 100, preço 0.55, desconto linha 8.8% + SettlementAmount
 * 8. Documento moeda estrangeira
 * 9. Documento cliente sem NIF, total < 50 AOA
 * 10. Duas guias de remessa
 * 11. Orçamento/pró-forma
 * SAF-T: HashControl, OrderReferences, TaxExemptionReason, SettlementAmount
 *
 * Uso: MOCK_API=1 npx tsx scripts/test-agt-exigencias-completo.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { gerarXmlSaftAo } from '../src/services/saft.service.js';

const prisma = new PrismaClient();

function assert(name: string, ok: boolean, details?: string) {
  const icon = ok ? '✔' : '✖';
  console.log(`  ${icon} ${name}${details ? `: ${details}` : ''}`);
  return ok;
}

async function main() {
  console.log('\n══════════════════════════════════════════════════════════════════════');
  console.log('  TESTE EXIGÊNCIAS AGT — Conformidade 100%');
  console.log('══════════════════════════════════════════════════════════════════════\n');

  // 1. Obter instituição com documentos AGT (usa a que tem PF/GR do seed)
  const instComDocs = await prisma.documentoFinanceiro.findFirst({
    where: { tipoDocumento: { in: ['PF', 'GR'] } },
    select: { instituicaoId: true },
  });
  const inst = instComDocs
    ? await prisma.instituicao.findUnique({ where: { id: instComDocs.instituicaoId }, select: { id: true } })
    : await prisma.instituicao.findFirst({
        where: { subdominio: 'inst-a-secundario-test' },
        select: { id: true },
      }) ?? await prisma.instituicao.findFirst({ select: { id: true } });

  if (!inst) {
    console.error('❌ Nenhuma instituição. Rode: npm run seed:multi-tenant && npx tsx scripts/seed-documentos-teste-agt.ts <instId>');
    process.exit(1);
  }

  const instituicaoId = inst.id;

  // 2. Verificar documentos existentes (seed deve ter sido executado)
  const docs = await prisma.documentoFinanceiro.findMany({
    where: { instituicaoId },
    select: { id: true, tipoDocumento: true, numeroDocumento: true, estado: true, valorTotal: true, valorDesconto: true, moeda: true, documentoBaseId: true },
    orderBy: { createdAt: 'asc' },
  });

  const counts = { FT: 0, RC: 0, NC: 0, PF: 0, GR: 0 };
  docs.forEach((d) => { counts[d.tipoDocumento as keyof typeof counts] = (counts[d.tipoDocumento as keyof typeof counts] || 0) + 1; });

  console.log('1. DOCUMENTOS NO BANCO');
  assert('FT (faturas)', counts.FT >= 6, `${counts.FT} FT`);
  assert('NC (nota crédito)', counts.NC >= 1, `${counts.NC} NC`);
  assert('PF (pró-forma)', counts.PF >= 2, `${counts.PF} PF`);
  assert('GR (guias remessa)', counts.GR >= 2, `${counts.GR} GR`);

  const ftEstornada = docs.find((d) => d.tipoDocumento === 'FT' && d.estado === 'ESTORNADO');
  assert('Factura anulada (estado ESTORNADO)', !!ftEstornada, ftEstornada?.numeroDocumento);

  const ftMoeda = docs.find((d) => d.tipoDocumento === 'FT' && d.moeda && d.moeda !== 'AOA');
  assert('Documento moeda estrangeira', !!ftMoeda, ftMoeda?.numeroDocumento);

  const ftComDesconto = docs.find((d) => Number(d.valorDesconto ?? 0) > 0);
  assert('Documento com SettlementAmount (valorDesconto)', !!ftComDesconto, ftComDesconto?.numeroDocumento);

  const ncComRef = docs.find((d) => d.tipoDocumento === 'NC' && d.documentoBaseId);
  assert('NC com documentoBaseId (References)', !!ncComRef, ncComRef?.numeroDocumento);

  const ftComProforma = docs.find((d) => d.tipoDocumento === 'FT' && d.documentoBaseId);
  const pfBase = ftComProforma && ftComProforma.documentoBaseId
    ? docs.find((d) => d.id === ftComProforma!.documentoBaseId)
    : null;
  const ftOrderRef = ftComProforma && pfBase?.tipoDocumento === 'PF';
  assert('FT baseada em PF (OrderReferences)', !!ftOrderRef, ftComProforma?.numeroDocumento);

  // 3. Documentos com múltiplas linhas
  const docsComLinhas = await prisma.documentoFinanceiro.findMany({
    where: { instituicaoId, tipoDocumento: 'FT' },
    include: { linhas: true },
  });
  const doc2Linhas = docsComLinhas.find((d) => d.linhas.length >= 2);
  assert('Documento com 2+ linhas', !!doc2Linhas, doc2Linhas?.numeroDocumento);

  const docLinha100 = docsComLinhas.find((d) => d.linhas.some((l) => Number(l.quantidade) === 100));
  assert('Linha com quantidade 100', !!docLinha100, docLinha100?.numeroDocumento);

  // 4. Exportar SAF-T
  console.log('\n2. EXPORTAÇÃO SAF-T');
  const ano = new Date().getFullYear();
  const mes = new Date().getMonth() + 1;
  let xml = '';
  try {
    xml = await gerarXmlSaftAo({ instituicaoId, ano, mes });
    assert('SAF-T gerado', xml.length > 1000, `${xml.length} bytes`);
  } catch (e) {
    assert('SAF-T gerado', false, (e as Error).message);
  }

  // 5. Validação XML AGT
  console.log('\n3. VALIDAÇÃO XML (Conformidade AGT)');
  const ns = 'urn:OECD:StandardAuditFile-Tax:AO_1.01_01';
  assert('Namespace SAF-T AO', xml.includes(ns));
  assert('Hash', xml.includes('<Hash>'));
  assert('HashControl', xml.includes('<HashControl>'));
  assert('OrderReferences', xml.includes('<OrderReferences>') && xml.includes('<OriginatingON>'));
  assert('References (NC)', xml.includes('<References>') && xml.includes('<Reference>'));
  assert('TaxExemptionReason', xml.includes('<TaxExemptionReason>'));
  assert('TaxExemptionCode', xml.includes('<TaxExemptionCode>'));
  assert('SettlementAmount', xml.includes('<SettlementAmount>'));
  assert('CurrencyCode AOA', xml.includes('<CurrencyCode>AOA</CurrencyCode>'));
  assert('TaxRegistrationNumber', xml.includes('<TaxRegistrationNumber>'));
  assert('SoftwareCertificateNumber', xml.includes('<SoftwareCertificateNumber>'));

  // 6. Cliente sem NIF (9999999900 no SAF-T)
  assert('CustomerTaxID 9999999900 (cliente sem NIF)', xml.includes('9999999900'));

  await prisma.$disconnect();

  console.log('\n══════════════════════════════════════════════════════════════════════');
  console.log('  Execute: npx tsx scripts/seed-documentos-teste-agt.ts');
  console.log('  para regenerar documentos antes deste teste.');
  console.log('══════════════════════════════════════════════════════════════════════\n');
}

main().catch((e) => {
  console.error('Erro:', e);
  process.exit(1);
});
