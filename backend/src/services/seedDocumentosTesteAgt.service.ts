/**
 * Serviço para gerar documentos de teste exigidos pela AGT.
 * Usado pelo script CLI e pelo endpoint API.
 */
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import {
  gerarNumeroDocumentoFinanceiro,
  criarProforma,
  criarGuiaRemessa,
  criarNotaCredito,
  criarFaturaBaseadaEmProforma,
} from './documentoFinanceiro.service.js';

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

/** Gera os 11 documentos de teste AGT para uma instituição e data. */
export async function gerarDocumentosTesteAgt(
  instId: string,
  dataStr: string
): Promise<{ success: boolean; mensagem: string }> {
  const dataBase = new Date(dataStr + 'T12:00:00Z');

  const config = await prisma.configuracaoInstituicao.findFirst({
    where: { instituicaoId: instId },
    select: { nif: true },
  });
  const nif = config?.nif?.replace(/\D/g, '') || '123456789';

  const passwordHash = await bcrypt.hash('TempAgt2026!', 10);

  let alunoComNif = await prisma.user.findFirst({
    where: { instituicaoId: instId, roles: { some: { role: 'ALUNO' } } },
  });
  if (!alunoComNif) {
    alunoComNif = await prisma.user.create({
      data: {
        instituicaoId: instId,
        nomeCompleto: 'Aluno Teste AGT',
        email: `aluno-agt-${Date.now()}@teste.ao`,
        password: passwordHash,
        roles: { create: { role: 'ALUNO', instituicaoId: instId } },
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
    },
  });
  if (!alunoSemNif) {
    alunoSemNif = await prisma.user.create({
      data: {
        instituicaoId: instId,
        nomeCompleto: 'Consumidor Final Sem NIF',
        email: `sem-nif-${Date.now()}@teste.ao`,
        password: passwordHash,
        roles: { create: { role: 'ALUNO', instituicaoId: instId } },
        numeroIdentificacao: null,
      },
    });
  }

  const ft1Num = await gerarNumeroDocumentoFinanceiro(instId, 'FT');
  const { hash: h1, hashControl: hc1 } = calcularHashFiscal(ft1Num, dataBase, '50000', nif, alunoComNif.id);
  await prisma.documentoFinanceiro.create({
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

  const ft2Num = await gerarNumeroDocumentoFinanceiro(instId, 'FT');
  const { hash: h2, hashControl: hc2 } = calcularHashFiscal(ft2Num, dataBase, '25000', nif, alunoComNif.id);
  await prisma.documentoFinanceiro.create({
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

  const pf = await criarProforma(instId, alunoComNif.id, [
    { descricao: 'Serviço educacional', quantidade: 1, precoUnitario: 100000, valorTotal: 100000, taxaIVA: 0, taxExemptionCode: 'M01' },
  ]);
  await prisma.documentoFinanceiro.update({ where: { id: pf }, data: { dataDocumento: dataBase } });

  const ft4 = await criarFaturaBaseadaEmProforma(pf, instId);

  await criarNotaCredito(ft4, instId, 10000, 'Ajuste de valor');

  const ft6Num = await gerarNumeroDocumentoFinanceiro(instId, 'FT');
  const vl6a = 50000;
  const vl6b = 10000;
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

  const ft7Num = await gerarNumeroDocumentoFinanceiro(instId, 'FT');
  const qtd7a = 100;
  const precoun7 = 0.55;
  const subtotalLinha7a = qtd7a * precoun7;
  const descLinha7Pct = 8.8;
  const descLinha7a = (subtotalLinha7a * descLinha7Pct) / 100;
  const valorLinha7a = subtotalLinha7a - descLinha7a;
  const valorLinha7b = 10;
  const subtotal7 = valorLinha7a + valorLinha7b;
  const descGlobal7 = 5;
  const tot7 = subtotal7 - descGlobal7;
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

  const configExists = await prisma.configuracaoInstituicao.findFirst({
    where: { instituicaoId: instId },
  });
  if (configExists) {
    await prisma.configuracaoInstituicao.update({
      where: { id: configExists.id },
      data: { permitirClienteSemNifAteValor: 50 },
    });
  } else {
    await prisma.configuracaoInstituicao.create({
      data: { instituicaoId: instId, permitirClienteSemNifAteValor: 50 },
    });
  }

  const ft9Num = await gerarNumeroDocumentoFinanceiro(instId, 'FT');
  const { hash: h9, hashControl: hc9 } = calcularHashFiscal(ft9Num, dataBase, '35', nif, alunoSemNif.id);
  await prisma.documentoFinanceiro.create({
    data: {
      instituicaoId: instId,
      tipoDocumento: 'FT',
      numeroDocumento: ft9Num,
      dataDocumento: dataBase,
      entidadeId: alunoSemNif.id,
      valorTotal: 35,
      hash: h9,
      hashControl: hc9,
      linhas: {
        create: { descricao: 'Taxa mínima sem NIF', quantidade: 1, precoUnitario: 35, valorTotal: 35, taxaIVA: 0, taxExemptionCode: 'M01' },
      },
    },
  });

  const gr1 = await criarGuiaRemessa(instId, alunoComNif.id, [
    { descricao: 'Material escolar - Lote 1', quantidade: 1, precoUnitario: 5000, valorTotal: 5000, taxaIVA: 0, taxExemptionCode: 'M04' },
  ]);
  const gr2 = await criarGuiaRemessa(instId, alunoComNif.id, [
    { descricao: 'Material escolar - Lote 2', quantidade: 1, precoUnitario: 3000, valorTotal: 3000, taxaIVA: 0, taxExemptionCode: 'M04' },
  ]);

  const pf2 = await criarProforma(instId, alunoComNif.id, [
    { descricao: 'Orçamento ano letivo', quantidade: 12, precoUnitario: 15000, valorTotal: 180000, taxaIVA: 0, taxExemptionCode: 'M01' },
  ]);

  return { success: true, mensagem: `11 documentos criados para ${dataStr}` };
}
