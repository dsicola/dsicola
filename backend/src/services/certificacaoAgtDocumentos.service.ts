/**
 * Assistente de certificação AGT: emite documentos fiscais reais (hash, numeração, SAFT)
 * com o mesmo tipo que a faturação manual; agrupados por lote só para poder substituir o pacote.
 */
import crypto from 'crypto';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
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

export type GerarDocumentosCertificacaoAgtOptions = {
  /**
   * Se false, não cria a segunda pró-forma (orçamento) no fim — os pontos 3 e 12 da carta à AGT
   * podem referir a mesma PF da cadeia PF→FT→NC. Reduz 1 documento por execução.
   * @default true (comportamento anterior / pacote completo por mês)
   */
  incluirSegundaProforma?: boolean;
  /**
   * Se true (padrão), remove o último lote de certificação AGT antes de criar um lote novo.
   * Em 2 meses: true só na 1.ª chamada; false na 2.ª e passar certificacaoAgtLoteId da 1.ª.
   */
  substituirPacoteAnterior?: boolean;
  /** Reutilizar o lote da 1.ª execução (2.º mês do pacote completo). */
  certificacaoAgtLoteId?: string;
};

/** Remove documentos do lote de certificação AGT (mesmos tipos que produção; só o agrupamento difere). */
export async function removerDocumentosLoteCertificacaoAgt(
  instituicaoId: string,
  loteId: string
): Promise<number> {
  const ordem: Array<'NC' | 'FT' | 'GR' | 'PF'> = ['NC', 'FT', 'GR', 'PF'];
  let total = 0;
  for (const tipoDocumento of ordem) {
    const r = await prisma.documentoFinanceiro.deleteMany({
      where: { instituicaoId, certificacaoAgtLoteId: loteId, tipoDocumento },
    });
    total += r.count;
  }
  return total;
}

/** Gera documentos fiscais para amostra/certificação AGT (uma execução ≈ 11–12 documentos). */
export async function gerarDocumentosCertificacaoAgt(
  instId: string,
  dataStr: string,
  options?: GerarDocumentosCertificacaoAgtOptions
): Promise<{ success: boolean; mensagem: string; certificacaoAgtLoteId: string }> {
  const incluirSegundaProforma = options?.incluirSegundaProforma !== false;
  const substituirPacoteAnterior = options?.substituirPacoteAnterior !== false;

  const inst = await prisma.instituicao.findUnique({
    where: { id: instId },
    select: { nome: true },
  });
  const nomeInst = inst?.nome ?? 'DSICOLA';

  const confAgenda = await prisma.configuracaoInstituicao.findFirst({
    where: { instituicaoId: instId },
    select: { ultimoCertificacaoAgtLoteId: true },
  });

  let loteId: string;
  if (substituirPacoteAnterior) {
    if (confAgenda?.ultimoCertificacaoAgtLoteId) {
      await removerDocumentosLoteCertificacaoAgt(instId, confAgenda.ultimoCertificacaoAgtLoteId);
    }
    loteId = randomUUID();
    await prisma.configuracaoInstituicao.upsert({
      where: { instituicaoId: instId },
      create: {
        instituicaoId: instId,
        nomeInstituicao: nomeInst,
        tipoInstituicao: 'ENSINO_MEDIO',
        numeracaoAutomatica: true,
        ultimoCertificacaoAgtLoteId: loteId,
      },
      update: { ultimoCertificacaoAgtLoteId: loteId },
    });
  } else {
    loteId = options?.certificacaoAgtLoteId ?? confAgenda?.ultimoCertificacaoAgtLoteId ?? '';
    if (!loteId) {
      throw new AppError(
        'Gere primeiro o 1.º mês do pacote AGT ou use «Gerar todos AGT».',
        400
      );
    }
  }

  const dataBase = new Date(dataStr + 'T12:00:00Z');
  // Ponto 9 AGT: SystemEntryDate até 10h — usar 09:00 para doc. cliente sem NIF
  const dataAte10h = new Date(dataStr + 'T09:00:00Z');

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
      numeroIdentificacao: null,
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

  // Ponto 10 AGT: segundo cliente identificado sem NIF
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
      certificacaoAgtLoteId: loteId,
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
      certificacaoAgtLoteId: loteId,
      hash: h2,
      hashControl: hc2,
      linhas: {
        create: { descricao: 'Propina anulada', quantidade: 1, precoUnitario: 25000, valorTotal: 25000, taxaIVA: 0, taxExemptionCode: 'M01' },
      },
    },
  });

  const pf = await criarProforma(
    instId,
    alunoComNif.id,
    [{ descricao: 'Serviço educacional', quantidade: 1, precoUnitario: 100000, taxaIVA: 0, taxExemptionCode: 'M01' }],
    { certificacaoAgtLoteId: loteId }
  );
  await prisma.documentoFinanceiro.update({ where: { id: pf }, data: { dataDocumento: dataBase } });

  const ft4 = await criarFaturaBaseadaEmProforma(pf, instId, { certificacaoAgtLoteId: loteId });

  await criarNotaCredito(ft4, instId, 10000, 'Ajuste de valor', { certificacaoAgtLoteId: loteId });

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
      certificacaoAgtLoteId: loteId,
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
      certificacaoAgtLoteId: loteId,
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
      certificacaoAgtLoteId: loteId,
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
  const { hash: h9, hashControl: hc9 } = calcularHashFiscal(ft9Num, dataAte10h, '35', nif, alunoSemNif.id);
  await prisma.documentoFinanceiro.create({
    data: {
      instituicaoId: instId,
      tipoDocumento: 'FT',
      numeroDocumento: ft9Num,
      dataDocumento: dataAte10h,
      entidadeId: alunoSemNif.id,
      valorTotal: 35,
      certificacaoAgtLoteId: loteId,
      hash: h9,
      hashControl: hc9,
      linhas: {
        create: { descricao: 'Taxa mínima sem NIF', quantidade: 1, precoUnitario: 35, valorTotal: 35, taxaIVA: 0, taxExemptionCode: 'M01' },
      },
    },
  });

  // Ponto 10 AGT: outro documento para outro cliente identificado sem NIF
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
      certificacaoAgtLoteId: loteId,
      hash: h10,
      hashControl: hc10,
      linhas: {
        create: { descricao: 'Serviço consumidor final', quantidade: 1, precoUnitario: 45, valorTotal: 45, taxaIVA: 0, taxExemptionCode: 'M01' },
      },
    },
  });

  await criarGuiaRemessa(
    instId,
    alunoComNif.id,
    [{ descricao: 'Material escolar - Lote 1', quantidade: 1, precoUnitario: 5000, taxaIVA: 0, taxExemptionCode: 'M04' }],
    { certificacaoAgtLoteId: loteId }
  );
  await criarGuiaRemessa(
    instId,
    alunoComNif.id,
    [{ descricao: 'Material escolar - Lote 2', quantidade: 1, precoUnitario: 3000, taxaIVA: 0, taxExemptionCode: 'M04' }],
    { certificacaoAgtLoteId: loteId }
  );

  if (incluirSegundaProforma) {
    await criarProforma(
      instId,
      alunoComNif.id,
      [{ descricao: 'Orçamento ano letivo', quantidade: 12, precoUnitario: 15000, taxaIVA: 0, taxExemptionCode: 'M01' }],
      { certificacaoAgtLoteId: loteId }
    );
  }

  const n = incluirSegundaProforma ? 12 : 11;
  return {
    success: true,
    mensagem: `${n} documentos fiscais criados para ${dataStr} (lote certificação AGT).`,
    certificacaoAgtLoteId: loteId,
  };
}
