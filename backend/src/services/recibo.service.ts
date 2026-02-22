import prisma from '../lib/prisma.js';
import { Decimal } from '@prisma/client/runtime/library';
import { AppError } from '../middlewares/errorHandler.js';
import { StatusRecibo } from '@prisma/client';

/**
 * Gerar número sequencial de recibo por instituição (SIGAE)
 * Formato: RCB-YYYY-NNNN (ex: RCB-2025-0001)
 */
export async function gerarNumeroRecibo(instituicaoId: string): Promise<string> {
  const ultimoRecibo = await prisma.recibo.findFirst({
    where: { instituicaoId },
    orderBy: { numeroRecibo: 'desc' },
  });

  const ano = new Date().getFullYear();
  const prefixo = `RCB-${ano}-`;

  if (!ultimoRecibo) {
    return `${prefixo}0001`;
  }

  const match = ultimoRecibo.numeroRecibo.match(/\d+$/);
  const ultimoNumero = match ? parseInt(match[0], 10) : 0;
  const ultimoAno = ultimoRecibo.numeroRecibo.match(/\d{4}/)?.[0];
  let proximoNumero = 1;

  if (ultimoAno === ano.toString()) {
    proximoNumero = ultimoNumero + 1;
  }

  return `${prefixo}${String(proximoNumero).padStart(4, '0')}`;
}

/** Tipo para pagamento pré-carregado (evita findUnique no controller) */
type PagamentoComMensalidade = {
  id: string;
  valor: Decimal;
  metodoPagamento: string;
  mensalidadeId: string;
  registradoPor: string | null;
  mensalidade?: {
    matriculaId: string | null;
    alunoId: string;
    valorDesconto: Decimal | null;
    aluno?: { instituicaoId: string };
  };
};

/**
 * Emitir recibo ao confirmar pagamento (módulo FINANCEIRO)
 * Recibo é VINCULADO ao pagamento/mensalidade, não "nasce" da matrícula
 * @param pagamentoPreloaded - opcional: pagamento já carregado (evita findUnique, reduz latency)
 */
export async function emitirReciboAoConfirmarPagamento(
  pagamentoId: string,
  instituicaoId: string,
  pagamentoPreloaded?: PagamentoComMensalidade
): Promise<{ id: string; numeroRecibo: string }> {
  const pagamento = pagamentoPreloaded ?? await prisma.pagamento.findUnique({
    where: { id: pagamentoId },
    include: {
      mensalidade: {
        include: {
          aluno: { select: { instituicaoId: true } },
        },
      },
    },
  });

  if (!pagamento) {
    throw new AppError('Pagamento não encontrado', 404);
  }

  // Multi-tenant: validar instituição (apenas quando não preloaded)
  if (!pagamentoPreloaded) {
    const alunoInstId = (pagamento as any).mensalidade?.aluno?.instituicaoId;
    if (alunoInstId && alunoInstId !== instituicaoId) {
      throw new AppError('Pagamento não pertence à sua instituição', 403);
    }
  }

  // Verificar se já existe recibo para este pagamento
  const existente = await prisma.recibo.findUnique({
    where: { pagamentoId },
  });

  if (existente) {
    return { id: existente.id, numeroRecibo: existente.numeroRecibo };
  }

  const numeroRecibo = await gerarNumeroRecibo(instituicaoId);
  const matriculaId = (pagamento as any).mensalidade?.matriculaId ?? null;
  const estudanteId = (pagamento as any).mensalidade?.alunoId ?? null;
  const valorDesconto = (pagamento as any).mensalidade?.valorDesconto ?? new Decimal(0);

  // Criar recibo e atualizar mensalidade em transação (menos round-trips, evita findUnique posterior)
  const [recibo] = await prisma.$transaction([
    prisma.recibo.create({
      data: {
        instituicaoId,
        mensalidadeId: pagamento.mensalidadeId,
        pagamentoId,
        matriculaId,
        estudanteId,
        numeroRecibo,
        status: StatusRecibo.EMITIDO,
        valor: pagamento.valor,
        valorDesconto,
        formaPagamento: pagamento.metodoPagamento,
        operadorId: pagamento.registradoPor ?? undefined,
      },
    }),
    prisma.mensalidade.update({
      where: { id: pagamento.mensalidadeId },
      data: { comprovativo: numeroRecibo },
    }),
  ]);

  return { id: recibo.id, numeroRecibo: recibo.numeroRecibo };
}

/**
 * Marcar recibo como ESTORNADO (nunca deletar - imutável)
 * Retorna o id do recibo estornado para auditoria
 */
export async function estornarRecibo(pagamentoId: string, instituicaoId: string): Promise<string | null> {
  const recibo = await prisma.recibo.findFirst({
    where: {
      pagamentoId,
      instituicaoId,
    },
  });

  if (recibo) {
    await prisma.recibo.update({
      where: { id: recibo.id },
      data: { status: StatusRecibo.ESTORNADO },
    });
    return recibo.id;
  }
  return null;
}
