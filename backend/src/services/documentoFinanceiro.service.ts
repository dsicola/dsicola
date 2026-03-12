import crypto from 'crypto';
import prisma from '../lib/prisma.js';
import { Decimal } from '@prisma/client/runtime/library';
import { AppError } from '../middlewares/errorHandler.js';
import { TipoDocumentoFinanceiro } from '@prisma/client';

/**
 * Calcular hash e hashControl para documento fiscal (conformidade AGT/SAFT-AO)
 * Hash: SHA-256 dos dados fiscais do documento
 * HashControl: sequência alfanumérica para controlo
 */
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

/**
 * Gerar número sequencial de documento fiscal por instituição
 * Formato: FT-YYYY-NNNN, RC-YYYY-NNNN, NC-YYYY-NNNN
 */
export async function gerarNumeroDocumentoFinanceiro(
  instituicaoId: string,
  tipo: TipoDocumentoFinanceiro
): Promise<string> {
  const prefixo = tipo;
  const ano = new Date().getFullYear();

  const ultimo = await prisma.documentoFinanceiro.findFirst({
    where: { instituicaoId, tipoDocumento: tipo },
    orderBy: { numeroDocumento: 'desc' },
  });

  if (!ultimo) {
    return `${prefixo}-${ano}-0001`;
  }

  const match = ultimo.numeroDocumento.match(/\d+$/);
  const ultimoNumero = match ? parseInt(match[0], 10) : 0;
  const ultimoAno = ultimo.numeroDocumento.match(/\d{4}/)?.[0];
  let proximoNumero = 1;

  if (ultimoAno === ano.toString()) {
    proximoNumero = ultimoNumero + 1;
  }

  return `${prefixo}-${ano}-${String(proximoNumero).padStart(4, '0')}`;
}

/**
 * Criar Fatura (FT) automaticamente ao gerar propina/mensalidade
 */
export async function criarFaturaAoGerarMensalidade(
  mensalidadeId: string,
  instituicaoId: string
): Promise<string> {
  const mensalidade = await prisma.mensalidade.findUnique({
    where: { id: mensalidadeId },
    include: {
      aluno: { select: { id: true, instituicaoId: true } },
      curso: { select: { nome: true, codigo: true } },
      classe: { select: { nome: true } },
    },
  });

  if (!mensalidade) {
    throw new AppError('Mensalidade não encontrada', 404);
  }

  const alunoInstId = mensalidade.aluno?.instituicaoId;
  if (alunoInstId && alunoInstId !== instituicaoId) {
    throw new AppError('Mensalidade não pertence à instituição', 403);
  }

  const existente = await prisma.documentoFinanceiro.findFirst({
    where: { mensalidadeId, tipoDocumento: 'FT' },
  });

  if (existente) {
    return existente.id;
  }

  const valorBase = new Decimal(mensalidade.valor);
  const valorDesconto = mensalidade.valorDesconto ?? new Decimal(0);
  const valorMulta = mensalidade.valorMulta ?? new Decimal(0);
  const valorJuros = mensalidade.valorJuros ?? new Decimal(0);
  const valorTotal = valorBase.minus(valorDesconto).plus(valorMulta).plus(valorJuros);

  const numeroDocumento = await gerarNumeroDocumentoFinanceiro(instituicaoId, 'FT');
  const nomeCurso = mensalidade.curso?.nome ?? mensalidade.classe?.nome ?? 'Propina';
  const descricao = `Propina ${mensalidade.mesReferencia}/${mensalidade.anoReferencia} - ${nomeCurso}`;

  const config = await prisma.configuracaoInstituicao.findFirst({
    where: { instituicaoId },
    select: { nif: true },
  });
  const nif = config?.nif?.replace(/\D/g, '') || '999999999';
  const { hash, hashControl } = calcularHashFiscal(
    numeroDocumento,
    mensalidade.dataVencimento,
    valorTotal.toString(),
    nif,
    mensalidade.alunoId
  );

  const [doc] = await prisma.$transaction([
    prisma.documentoFinanceiro.create({
      data: {
        instituicaoId,
        tipoDocumento: 'FT',
        numeroDocumento,
        dataDocumento: mensalidade.dataVencimento,
        entidadeId: mensalidade.alunoId,
        valorTotal,
        valorPago: new Decimal(0),
        mensalidadeId,
        hash,
        hashControl,
        linhas: {
          create: {
            descricao,
            quantidade: new Decimal(1),
            precoUnitario: valorTotal,
            valorTotal,
            taxaIVA: new Decimal(0),
          },
        },
      },
    }),
  ]);

  return doc.id;
}

/**
 * Criar Recibo (RC) automaticamente ao registrar pagamento
 * Vincula ao Recibo existente (emitido pelo recibo.service)
 */
export async function criarDocumentoFinanceiroRecibo(
  reciboId: string,
  instituicaoId: string
): Promise<string> {
  const recibo = await prisma.recibo.findUnique({
    where: { id: reciboId, instituicaoId },
    include: {
      mensalidade: {
        include: {
          aluno: { select: { id: true } },
        },
      },
      pagamento: true,
    },
  });

  if (!recibo) {
    throw new AppError('Recibo não encontrado', 404);
  }

  const existente = await prisma.documentoFinanceiro.findFirst({
    where: { reciboId },
  });

  if (existente) {
    return existente.id;
  }

  const valorPago = new Decimal(recibo.valor);
  const numeroDocumento = await gerarNumeroDocumentoFinanceiro(instituicaoId, 'RC');

  const config = await prisma.configuracaoInstituicao.findFirst({
    where: { instituicaoId },
    select: { nif: true },
  });
  const nif = config?.nif?.replace(/\D/g, '') || '999999999';
  const entidadeId = recibo.estudanteId ?? recibo.mensalidade.alunoId;
  const { hash, hashControl } = calcularHashFiscal(
    numeroDocumento,
    recibo.dataEmissao,
    valorPago.toString(),
    nif,
    entidadeId
  );

  const [doc] = await prisma.$transaction([
    prisma.documentoFinanceiro.create({
      data: {
        instituicaoId,
        tipoDocumento: 'RC',
        numeroDocumento,
        dataDocumento: recibo.dataEmissao,
        entidadeId,
        valorTotal: valorPago,
        valorPago,
        reciboId,
        hash,
        hashControl,
        linhas: {
          create: {
            descricao: `Recibo de pagamento - ${recibo.numeroRecibo}`,
            quantidade: new Decimal(1),
            precoUnitario: valorPago,
            valorTotal: valorPago,
            taxaIVA: new Decimal(0),
          },
        },
        pagamentos: {
          create: {
            metodoPagamento: recibo.formaPagamento ?? recibo.pagamento.metodoPagamento,
            valor: valorPago,
            dataPagamento: recibo.pagamento.dataPagamento,
          },
        },
      },
    }),
  ]);

  // Atualizar valorPago na Fatura (FT) correspondente à mensalidade
  const fatura = await prisma.documentoFinanceiro.findFirst({
    where: {
      mensalidadeId: recibo.mensalidadeId,
      tipoDocumento: 'FT',
      estado: 'EMITIDO',
    },
  });
  if (fatura) {
    const novoValorPago = new Decimal(fatura.valorPago).plus(valorPago);
    await prisma.documentoFinanceiro.update({
      where: { id: fatura.id },
      data: { valorPago: novoValorPago },
    });
  }

  return doc.id;
}
