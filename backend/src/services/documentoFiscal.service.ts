import prisma from '../lib/prisma.js';
import { Decimal } from '@prisma/client/runtime/library';
import { AppError } from '../middlewares/errorHandler.js';

/**
 * Gerar número sequencial de documento fiscal por instituição
 */
export async function gerarNumeroDocumentoFiscal(
  instituicaoId: string,
  tipo: 'RECIBO' | 'FATURA'
): Promise<string> {
  // Buscar último documento fiscal da instituição
  const ultimoDocumento = await prisma.documentoFiscal.findFirst({
    where: {
      instituicaoId,
      tipo,
    },
    orderBy: {
      numeroDocumento: 'desc',
    },
  });

  const ano = new Date().getFullYear();
  const prefixo = tipo === 'RECIBO' ? 'RCB' : 'FAT';

  if (!ultimoDocumento) {
    // Primeiro documento do ano
    return `${prefixo}${ano}0001`;
  }

  // Extrair número sequencial do último documento
  const match = ultimoDocumento.numeroDocumento.match(/\d+$/);
  const ultimoNumero = match ? parseInt(match[0], 10) : 0;

  // Verificar se o documento é do ano atual
  const ultimoAno = ultimoDocumento.numeroDocumento.match(/\d{4}/)?.[0];
  let proximoNumero = 1;

  if (ultimoAno === ano.toString()) {
    // Mesmo ano, incrementar sequência
    proximoNumero = ultimoNumero + 1;
  }
  // Se for de ano diferente, começar do 1

  return `${prefixo}${ano}${String(proximoNumero).padStart(4, '0')}`;
}

/**
 * Criar documento fiscal automaticamente quando pagamento vira PAID
 * REGRA: Só cria se status for PAID e não existir documento ainda
 */
export async function criarDocumentoFiscalAutomatico(
  pagamentoId: string,
  tipo: 'RECIBO' | 'FATURA' = 'RECIBO'
): Promise<string> {
  // Buscar pagamento
  const pagamento = await prisma.pagamentoLicenca.findUnique({
    where: { id: pagamentoId },
    include: {
      instituicao: true,
      assinatura: {
        include: {
          plano: true,
        },
      },
    },
  });

  if (!pagamento) {
    throw new AppError('Pagamento não encontrado', 404);
  }

  // VALIDAÇÃO CRÍTICA: Só criar se status for PAID
  if (pagamento.status !== 'PAID') {
    throw new AppError(
      `Documento fiscal só pode ser gerado para pagamentos com status PAID. Status atual: ${pagamento.status}`,
      400
    );
  }

  // Verificar se já existe documento fiscal
  const documentoExistente = await prisma.documentoFiscal.findUnique({
    where: { pagamentoLicencaId: pagamentoId },
  });

  if (documentoExistente) {
    // Já existe, retornar ID existente (não duplicar)
    return documentoExistente.id;
  }

  // Gerar número sequencial
  const numeroDocumento = await gerarNumeroDocumentoFiscal(
    pagamento.instituicaoId,
    tipo
  );

  // Criar documento fiscal
  const documento = await prisma.documentoFiscal.create({
    data: {
      tipo,
      numeroDocumento,
      pagamentoLicencaId: pagamentoId,
      instituicaoId: pagamento.instituicaoId,
      planoNome: pagamento.plano,
      valor: pagamento.valor, // Snapshot do valor pago
      moeda: 'AOA', // Pode ser configurável no futuro
      dataEmissao: pagamento.pagoEm || new Date(),
    },
  });

  return documento.id;
}

/**
 * Verificar se pagamento pode ter documento fiscal gerado
 */
export async function podeGerarDocumentoFiscal(
  pagamentoId: string
): Promise<{ pode: boolean; motivo?: string }> {
  const pagamento = await prisma.pagamentoLicenca.findUnique({
    where: { id: pagamentoId },
    include: {
      documentoFiscal: true,
    },
  });

  if (!pagamento) {
    return { pode: false, motivo: 'Pagamento não encontrado' };
  }

  if (pagamento.status !== 'PAID') {
    return {
      pode: false,
      motivo: `Pagamento deve estar PAID para gerar documento fiscal. Status atual: ${pagamento.status}`,
    };
  }

  if (pagamento.documentoFiscal) {
    return {
      pode: false,
      motivo: 'Documento fiscal já existe para este pagamento',
    };
  }

  return { pode: true };
}

