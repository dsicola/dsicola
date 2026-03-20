#!/usr/bin/env npx tsx
/**
 * Script legacy: gera na consola o conjunto de documentos fiscais de amostra exigidos pela AGT
 * (Decreto 312/18). Preferir `gerar-exigencias-agt.ts` ou a API `/agt/gerar-certificacao-*`.
 *
 * Documentos gerados:
 * 1. 1 fatura com cliente com NIF
 * 2. 1 fatura anulada
 * 3. 1 proforma
 * 4. 1 fatura baseada na proforma (OrderReferences)
 * 5. 1 nota de crédito baseada na fatura
 * 6. 1 fatura com 2 linhas (IVA + Isento)
 * 7. 1 documento com desconto (SettlementAmount)
 * 8. 1 documento em moeda estrangeira
 * 9. 1 documento cliente sem NIF (< 50 AOA)
 * 10. 2 guias de remessa
 * 11. 1 orçamento/proforma adicional
 *
 * Uso: npx tsx scripts/seed-documentos-certificacao-agt.ts [instituicaoId] [data]
 *   instituicaoId: (opcional) ID da instituição. Se omitido, usa a primeira.
 *   data: (opcional) Data dos documentos no formato YYYY-MM-DD (ex: 2026-02-15).
 *         Se omitido, usa a data de hoje. Use para gerar documentos em 2 meses diferentes (exigência AGT).
 *
 * Exemplo para 2 meses (AGT): Execute duas vezes:
 *   npx tsx scripts/seed-documentos-certificacao-agt.ts 2026-02-15    # Documentos em Fevereiro
 *   npx tsx scripts/seed-documentos-certificacao-agt.ts 2026-03-15   # Documentos em Março
 *
 * Pré-requisito: Instituição configurada com NIF e dados fiscais
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import crypto from 'crypto';
import {
  gerarNumeroDocumentoFinanceiro,
  criarProforma,
  criarGuiaRemessa,
  criarNotaCredito,
  criarFaturaBaseadaEmProforma,
} from '../src/services/documentoFinanceiro.service.js';

const prisma = new PrismaClient();

function calcularHashFiscal(
  numeroDocumento: string,
  dataDocumento: Date,
  valorTotal: string,
  nifEmissor: string,
  entidadeId: string
): { hash: string; hashControl: string } {
  const dataStr = dataDocumento.toISOString().slice(0, 10);
  const concat = `${nifEmissor}|${numeroDocumento}|${dataStr}|${valorTotal}|${entidadeId}`;
  const hash = crypto.createHash('sha256').update(concat, 'utf8').digest('hex');
  const hashControl = hash.slice(0, 4).toUpperCase() + String(Date.now()).slice(-4);
  return { hash, hashControl };
}

async function main() {
  // argv[2] = instituicaoId ou data (se único arg)
  const arg2 = process.argv[2];
  const arg3 = process.argv[3];
  let instituicaoId: string | undefined;
  let dataStr: string | undefined;
  if (arg2 && /^\d{4}-\d{2}-\d{2}$/.test(arg2)) {
    dataStr = arg2;
    instituicaoId = arg3;
  } else {
    instituicaoId = arg2;
    dataStr = arg3;
  }
  if (dataStr) {
    const hojeStr = new Date().toISOString().slice(0, 10);
    if (dataStr > hojeStr) {
      console.error(`Erro: data ${dataStr} é futura (hoje UTC: ${hojeStr}). Use uma data já passada para a AGT.`);
      process.exit(1);
    }
  }
  const dataBase = dataStr ? new Date(dataStr + 'T12:00:00Z') : new Date();
  const dataAte10h = dataStr ? new Date(dataStr + 'T09:00:00Z') : new Date(new Date().toISOString().slice(0, 10) + 'T09:00:00Z');
  if (dataStr) console.log(`Data dos documentos: ${dataStr}`);

  if (!instituicaoId) {
    const inst = await prisma.instituicao.findFirst({
      where: { subdominio: { not: undefined } },
      select: { id: true, nome: true },
    }) ?? await prisma.instituicao.findFirst({ select: { id: true, nome: true } });
    if (!inst) {
      console.error('Uso: npx tsx scripts/seed-documentos-certificacao-agt.ts [instituicaoId]');
      process.exit(1);
    }
    console.log(`Usando instituição: ${inst.nome} (${inst.id})`);
  }
  const instId = instituicaoId ?? (await prisma.instituicao.findFirst({ select: { id: true } }))!.id;

  const config = await prisma.configuracaoInstituicao.findFirst({
    where: { instituicaoId: instId },
    select: { nif: true },
  });
  const nif = config?.nif?.replace(/\D/g, '') || '123456789';

  // Garantir aluno com NIF e aluno sem NIF
  let alunoComNif = await prisma.user.findFirst({
    where: { instituicaoId: instId, roles: { some: { role: 'ALUNO' } } },
  });
  if (!alunoComNif) {
    alunoComNif = await prisma.user.create({
      data: {
        instituicaoId: instId,
        nomeCompleto: 'Aluno Teste AGT',
        email: `aluno-agt-${Date.now()}@teste.ao`,
        password: 'hash',
        roles: { create: { role: 'ALUNO' } },
        numeroIdentificacao: `BI${Date.now().toString().slice(-8)}`,
      },
    });
  } else if (!alunoComNif.numeroIdentificacao) {
    await prisma.user.update({
      where: { id: alunoComNif.id },
      data: { numeroIdentificacao: `BI${Date.now().toString().slice(-8)}` },
    });
    alunoComNif = await prisma.user.findUniqueOrThrow({ where: { id: alunoComNif.id } });
  }

  let alunoSemNif = await prisma.user.findFirst({
    where: {
      instituicaoId: instId,
      roles: { some: { role: 'ALUNO' } },
      id: { not: alunoComNif.id },
      numeroIdentificacao: null,
    },
  });
  if (!alunoSemNif) {
    alunoSemNif = await prisma.user.create({
      data: {
        instituicaoId: instId,
        nomeCompleto: 'Consumidor Final Sem NIF',
        email: `sem-nif-${Date.now()}@teste.ao`,
        password: 'hash',
        roles: { create: { role: 'ALUNO' } },
        numeroIdentificacao: null,
      },
    });
  }

  let alunoSemNif2 = await prisma.user.findFirst({
    where: {
      instituicaoId: instId,
      roles: { some: { role: 'ALUNO' } },
      id: { notIn: [alunoComNif.id, alunoSemNif.id] },
      numeroIdentificacao: null,
    },
  });
  if (!alunoSemNif2) {
    alunoSemNif2 = await prisma.user.create({
      data: {
        instituicaoId: instId,
        nomeCompleto: 'Outro Consumidor Sem NIF',
        email: `sem-nif2-${Date.now()}@teste.ao`,
        password: 'hash',
        roles: { create: { role: 'ALUNO' } },
        numeroIdentificacao: null,
      },
    });
  }

  const ano = new Date().getFullYear();

  console.log('\n=== Gerando documentos (script legacy certificação AGT) ===\n');

  // 1. Fatura com cliente com NIF
  const ft1Num = await gerarNumeroDocumentoFinanceiro(instId, 'FT');
  const { hash: h1, hashControl: hc1 } = calcularHashFiscal(ft1Num, dataBase, '50000', nif, alunoComNif.id);
  const ft1 = await prisma.documentoFinanceiro.create({
    data: {
      instituicaoId: instId,
      tipoDocumento: 'FT',
      numeroDocumento: ft1Num,
      dataDocumento: dataBase,
      entidadeId: alunoComNif.id,
      valorTotal: 50000,
      hash: h1,
      hashControl: hc1,
      linhas: {
        create: { descricao: 'Propina teste', quantidade: 1, precoUnitario: 50000, valorTotal: 50000, taxaIVA: 0, taxExemptionCode: 'M01' },
      },
    },
  });
  console.log('1. Fatura com NIF:', ft1.numeroDocumento);

  // 2. Fatura anulada (estornada)
  const ft2Num = await gerarNumeroDocumentoFinanceiro(instId, 'FT');
  const { hash: h2, hashControl: hc2 } = calcularHashFiscal(ft2Num, dataBase, '25000', nif, alunoComNif.id);
  const ft2 = await prisma.documentoFinanceiro.create({
    data: {
      instituicaoId: instId,
      tipoDocumento: 'FT',
      numeroDocumento: ft2Num,
      dataDocumento: dataBase,
      entidadeId: alunoComNif.id,
      valorTotal: 25000,
      estado: 'ESTORNADO',
      hash: h2,
      hashControl: hc2,
      linhas: {
        create: { descricao: 'Propina anulada', quantidade: 1, precoUnitario: 25000, valorTotal: 25000, taxaIVA: 0, taxExemptionCode: 'M01' },
      },
    },
  });
  console.log('2. Fatura anulada:', ft2.numeroDocumento);

  // 3. Proforma
  const pf = await criarProforma(instId, alunoComNif.id, [
    { descricao: 'Serviço educacional', quantidade: 1, precoUnitario: 100000, valorTotal: 100000, taxaIVA: 0, taxExemptionCode: 'M01' },
  ], { dataDocumento: dataBase });
  console.log('3. Proforma:', (await prisma.documentoFinanceiro.findUnique({ where: { id: pf } }))?.numeroDocumento);

  // 4. Fatura baseada na proforma
  const ft4 = await criarFaturaBaseadaEmProforma(pf, instId, { dataDocumento: dataBase });
  console.log('4. Fatura baseada em proforma:', (await prisma.documentoFinanceiro.findUnique({ where: { id: ft4 } }))?.numeroDocumento);

  // 5. Nota de crédito baseada na fatura do ponto 4 (OrderReferences/References conforme AGT)
  const nc = await criarNotaCredito(ft4, instId, 10000, 'Ajuste de valor', { dataDocumento: dataBase });
  console.log('5. Nota de crédito:', (await prisma.documentoFinanceiro.findUnique({ where: { id: nc } }))?.numeroDocumento);

  // 6. Fatura com 2 linhas: 1ª IVA 14% ou 5%; 2ª isenta (TaxExemptionReason - AGT: M00, M02, M04, M11-M20, M30-M38)
  const ft6Num = await gerarNumeroDocumentoFinanceiro(instId, 'FT');
  const vl6a = 50000; // linha 1: isento (TaxExemptionCode M02 - Transmissão bens/serviço não sujeita)
  const vl6b = 10000; // linha 2: base IVA 14%
  const iva6 = 1400;
  const tot6 = vl6a + vl6b + iva6;
  const { hash: h6, hashControl: hc6 } = calcularHashFiscal(ft6Num, dataBase, String(tot6), nif, alunoComNif.id);
  await prisma.documentoFinanceiro.create({
    data: {
      instituicaoId: instId,
      tipoDocumento: 'FT',
      numeroDocumento: ft6Num,
      dataDocumento: dataBase,
      entidadeId: alunoComNif.id,
      valorTotal: tot6,
      hash: h6,
      hashControl: hc6,
      linhas: {
        create: [
          { descricao: 'Material com IVA 14%', quantidade: 1, precoUnitario: vl6b, valorTotal: vl6b + iva6, taxaIVA: 14 },
          { descricao: 'Propina isenta', quantidade: 1, precoUnitario: vl6a, valorTotal: vl6a, taxaIVA: 0, taxExemptionCode: 'M02' },
        ],
      },
    },
  });
  console.log('6. Fatura 2 linhas (IVA 14% + Isento M02):', ft6Num);

  // 7. Documento AGT exato: 2 linhas - (a) qtd 100, preço 0.55, desconto linha 8.8%; (b) segunda linha; desconto global (SettlementAmount)
  const ft7Num = await gerarNumeroDocumentoFinanceiro(instId, 'FT');
  const qtd7a = 100;
  const precoun7 = 0.55;
  const subtotalLinha7a = qtd7a * precoun7; // 55
  const descLinha7Pct = 8.8;
  const descLinha7a = (subtotalLinha7a * descLinha7Pct) / 100; // 4.84
  const valorLinha7a = subtotalLinha7a - descLinha7a; // 50.16
  const valorLinha7b = 10; // segunda linha
  const subtotal7 = valorLinha7a + valorLinha7b; // 60.16
  const descGlobal7 = 5; // SettlementAmount (desconto global)
  const tot7 = subtotal7 - descGlobal7; // 55.16
  const { hash: h7, hashControl: hc7 } = calcularHashFiscal(ft7Num, dataBase, tot7.toFixed(2), nif, alunoComNif.id);
  await prisma.documentoFinanceiro.create({
    data: {
      instituicaoId: instId,
      tipoDocumento: 'FT',
      numeroDocumento: ft7Num,
      dataDocumento: dataBase,
      entidadeId: alunoComNif.id,
      valorTotal: tot7,
      valorDesconto: descGlobal7,
      hash: h7,
      hashControl: hc7,
      linhas: {
        create: [
          { descricao: 'Produto qtd 100, preço 0.55', quantidade: qtd7a, precoUnitario: precoun7, valorTotal: valorLinha7a, valorDesconto: descLinha7a, taxaIVA: 0, taxExemptionCode: 'M02' },
          { descricao: 'Serviço adicional', quantidade: 1, precoUnitario: valorLinha7b, valorTotal: valorLinha7b, taxaIVA: 0, taxExemptionCode: 'M02' },
        ],
      },
    },
  });
  console.log('7. Documento 100x0.55 + 8.8% linha + SettlementAmount:', ft7Num);

  // 8. Documento em moeda estrangeira
  const ft8Num = await gerarNumeroDocumentoFinanceiro(instId, 'FT');
  const { hash: h8, hashControl: hc8 } = calcularHashFiscal(ft8Num, dataBase, '100', nif, alunoComNif.id);
  await prisma.documentoFinanceiro.create({
    data: {
      instituicaoId: instId,
      tipoDocumento: 'FT',
      numeroDocumento: ft8Num,
      dataDocumento: dataBase,
      entidadeId: alunoComNif.id,
      valorTotal: 100,
      moeda: 'USD',
      hash: h8,
      hashControl: hc8,
      linhas: {
        create: { descricao: 'Taxa em USD', quantidade: 1, precoUnitario: 100, valorTotal: 100, taxaIVA: 0, taxExemptionCode: 'M01' },
      },
    },
  });
  console.log('8. Documento moeda estrangeira (USD):', ft8Num);

  // 9. Documento cliente sem NIF (< 50 AOA), SystemEntryDate até 10h (AGT)
  await prisma.configuracaoInstituicao.upsert({
    where: { instituicaoId: instId },
    create: { instituicaoId: instId, permitirClienteSemNifAteValor: 50 },
    update: { permitirClienteSemNifAteValor: 50 },
  });
  const ft9Num = await gerarNumeroDocumentoFinanceiro(instId, 'FT');
  const { hash: h9, hashControl: hc9 } = calcularHashFiscal(ft9Num, dataAte10h, '35', nif, alunoSemNif.id);
  await prisma.documentoFinanceiro.create({
    data: {
      instituicaoId: instId,
      tipoDocumento: 'FT',
      numeroDocumento: ft9Num,
      dataDocumento: dataAte10h,
      entidadeId: alunoSemNif.id,
      valorTotal: 35,
      hash: h9,
      hashControl: hc9,
      linhas: {
        create: { descricao: 'Taxa mínima sem NIF', quantidade: 1, precoUnitario: 35, valorTotal: 35, taxaIVA: 0, taxExemptionCode: 'M01' },
      },
    },
  });
  console.log('9. Documento cliente sem NIF (<50 AOA, até 10h):', ft9Num);

  // 10. Outro documento para outro cliente identificado sem NIF (AGT)
  const ft10Num = await gerarNumeroDocumentoFinanceiro(instId, 'FT');
  const { hash: h10, hashControl: hc10 } = calcularHashFiscal(ft10Num, dataBase, '45', nif, alunoSemNif2.id);
  await prisma.documentoFinanceiro.create({
    data: {
      instituicaoId: instId,
      tipoDocumento: 'FT',
      numeroDocumento: ft10Num,
      dataDocumento: dataBase,
      entidadeId: alunoSemNif2.id,
      valorTotal: 45,
      hash: h10,
      hashControl: hc10,
      linhas: {
        create: { descricao: 'Serviço consumidor final', quantidade: 1, precoUnitario: 45, valorTotal: 45, taxaIVA: 0, taxExemptionCode: 'M01' },
      },
    },
  });
  console.log('10. Outro documento cliente sem NIF:', ft10Num);

  // 11. 2 guias de remessa (AGT documento 11)
  const gr1 = await criarGuiaRemessa(instId, alunoComNif.id, [
    { descricao: 'Material escolar - Lote 1', quantidade: 1, precoUnitario: 5000, valorTotal: 5000, taxaIVA: 0, taxExemptionCode: 'M04' },
  ], { dataDocumento: dataBase });
  const gr2 = await criarGuiaRemessa(instId, alunoComNif.id, [
    { descricao: 'Material escolar - Lote 2', quantidade: 1, precoUnitario: 3000, valorTotal: 3000, taxaIVA: 0, taxExemptionCode: 'M04' },
  ], { dataDocumento: dataBase });
  console.log('11. Guias de remessa:', (await prisma.documentoFinanceiro.findMany({ where: { id: { in: [gr1, gr2] } }, select: { numeroDocumento: true } })).map((d) => d.numeroDocumento).join(', '));

  // 12. Orçamento/Proforma adicional
  const pf2 = await criarProforma(instId, alunoComNif.id, [
    { descricao: 'Orçamento ano letivo', quantidade: 12, precoUnitario: 15000, valorTotal: 180000, taxaIVA: 0, taxExemptionCode: 'M01' },
  ], { dataDocumento: dataBase });
  console.log('12. Orçamento/Proforma:', (await prisma.documentoFinanceiro.findUnique({ where: { id: pf2 } }))?.numeroDocumento);

  console.log('\n=== Documentos criados (script legacy certificação AGT) ===');
  console.log('Execute a exportação SAF-T para validar o XML.\n');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Erro:', e);
  process.exit(1);
});
