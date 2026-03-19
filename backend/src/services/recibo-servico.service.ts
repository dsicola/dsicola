import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { StatusRecibo } from '@prisma/client';
import type { TipoServicoAvulso } from '@prisma/client';

/**
 * Gerar número sequencial de recibo de serviço (bata/passe) por instituição
 * Formato: RCS-YYYY-NNNN (ex: RCS-2026-0001)
 */
export async function gerarNumeroReciboServico(instituicaoId: string): Promise<string> {
  const ultimo = await prisma.reciboServico.findFirst({
    where: { instituicaoId },
    orderBy: { numeroRecibo: 'desc' },
  });

  const ano = new Date().getFullYear();
  const prefixo = `RCS-${ano}-`;

  if (!ultimo) {
    return `${prefixo}0001`;
  }

  const match = ultimo.numeroRecibo.match(/\d+$/);
  const ultimoNumero = match ? parseInt(match[0], 10) : 0;
  const ultimoAno = ultimo.numeroRecibo.match(/\d{4}/)?.[0];
  let proximoNumero = 1;

  if (ultimoAno === ano.toString()) {
    proximoNumero = ultimoNumero + 1;
  }

  return `${prefixo}${String(proximoNumero).padStart(4, '0')}`;
}

export interface EmitirReciboServicoParams {
  pagamentoServicoId: string;
  instituicaoId: string;
  estudanteId: string;
  tipoServico: TipoServicoAvulso;
  valor: number;
  formaPagamento: string;
  operadorId?: string | null;
}

/**
 * Emitir recibo ao confirmar pagamento avulso de bata/passe
 */
export async function emitirReciboServico(
  params: EmitirReciboServicoParams
): Promise<{ id: string; numeroRecibo: string }> {
  const existente = await prisma.reciboServico.findUnique({
    where: { pagamentoServicoId: params.pagamentoServicoId },
  });

  if (existente) {
    return { id: existente.id, numeroRecibo: existente.numeroRecibo };
  }

  const numeroRecibo = await gerarNumeroReciboServico(params.instituicaoId);

  const recibo = await prisma.reciboServico.create({
    data: {
      instituicaoId: params.instituicaoId,
      pagamentoServicoId: params.pagamentoServicoId,
      estudanteId: params.estudanteId,
      numeroRecibo,
      status: StatusRecibo.EMITIDO,
      tipoServico: params.tipoServico,
      valor: params.valor,
      formaPagamento: params.formaPagamento,
      operadorId: params.operadorId ?? undefined,
    },
  });

  return { id: recibo.id, numeroRecibo: recibo.numeroRecibo };
}

/**
 * Marcar recibo de serviço como ESTORNADO
 */
export async function estornarReciboServico(
  pagamentoServicoId: string,
  instituicaoId: string
): Promise<string | null> {
  const recibo = await prisma.reciboServico.findFirst({
    where: {
      pagamentoServicoId,
      instituicaoId,
    },
  });

  if (recibo) {
    await prisma.reciboServico.update({
      where: { id: recibo.id },
      data: { status: StatusRecibo.ESTORNADO },
    });
    return recibo.id;
  }
  return null;
}
