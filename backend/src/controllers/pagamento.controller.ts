import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { requireTenantScope } from '../middlewares/auth.js';
import { Decimal } from '@prisma/client/runtime/library';
import { AuditService } from '../services/audit.service.js';
import { ModuloAuditoria, EntidadeAuditoria } from '../services/audit.service.js';
import { emitirReciboAoConfirmarPagamento, estornarRecibo } from '../services/recibo.service.js';
import { EmailService } from '../services/email.service.js';

/**
 * Registrar um pagamento (total ou parcial) para uma mensalidade
 */
export const registrarPagamento = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { mensalidadeId } = req.params;
    const { valor, metodoPagamento, observacoes } = req.body;
    const userId = req.user?.userId;

    if (!valor || !metodoPagamento) {
      throw new AppError('Valor e método de pagamento são obrigatórios', 400);
    }

    const valorDecimal = new Decimal(valor);

    // Buscar mensalidade com filtro de instituição
    const instituicaoId = requireTenantScope(req);
    const mensalidade = await prisma.mensalidade.findFirst({
      where: {
        id: mensalidadeId,
        aluno: { instituicaoId },
      },
      include: {
        aluno: true,
        pagamentos: true,
      },
    });

    if (!mensalidade) {
      throw new AppError('Mensalidade não encontrada', 404);
    }

    // Calcular valores
    const valorBase = new Decimal(mensalidade.valor);
    const valorDesconto = mensalidade.valorDesconto || new Decimal(0);
    const valorMulta = mensalidade.valorMulta || new Decimal(0);
    const valorTotal = valorBase.minus(valorDesconto).plus(valorMulta);

    // Calcular total já pago
    const totalPago = mensalidade.pagamentos.reduce(
      (sum, p) => sum.plus(p.valor),
      new Decimal(0)
    );

    // Calcular saldo restante
    const saldoRestante = valorTotal.minus(totalPago);

    // Validar valor do pagamento
    if (valorDecimal.gt(saldoRestante)) {
      throw new AppError(
        `Valor do pagamento (${valorDecimal}) excede o saldo restante (${saldoRestante})`,
        400
      );
    }

    if (valorDecimal.lte(0)) {
      throw new AppError('Valor do pagamento deve ser maior que zero', 400);
    }

    // Criar pagamento
    const pagamento = await prisma.pagamento.create({
      data: {
        mensalidadeId,
        valor: valorDecimal,
        metodoPagamento,
        observacoes: observacoes || undefined,
        registradoPor: userId || undefined,
      },
    });

    // Calcular novo total pago
    const novoTotalPago = totalPago.plus(valorDecimal);

    // Atualizar status da mensalidade
    let novoStatus: 'Pendente' | 'Pago' | 'Parcial' | 'Atrasado' | 'Cancelado' = 'Pendente';
    
    if (novoTotalPago.gte(valorTotal)) {
      novoStatus = 'Pago';
    } else if (novoTotalPago.gt(0)) {
      novoStatus = 'Parcial';
    }

    // Atualizar mensalidade
    const mensalidadeAtualizada = await prisma.mensalidade.update({
      where: { id: mensalidadeId },
      data: {
        status: novoStatus,
        dataPagamento: novoStatus === 'Pago' ? new Date() : mensalidade.dataPagamento,
        metodoPagamento: novoStatus === 'Pago' ? metodoPagamento : mensalidade.metodoPagamento,
      },
      include: {
        aluno: true,
        pagamentos: {
          orderBy: { dataPagamento: 'desc' },
        },
      },
    });

    // SIGAE: Emitir recibo ao confirmar pagamento (módulo FINANCEIRO)
    // Passar pagamento+mensalidade pré-carregados para evitar findUnique (reduz latency)
    let reciboId: string | null = null;
    let numeroRecibo: string | null = null;
    try {
      const pagamentoComMensalidade = {
        ...pagamento,
        mensalidade: {
          matriculaId: mensalidadeAtualizada.matriculaId ?? null,
          alunoId: mensalidadeAtualizada.alunoId,
          valorDesconto: mensalidadeAtualizada.valorDesconto ?? null,
        },
      };
      const reciboResult = await emitirReciboAoConfirmarPagamento(pagamento.id, instituicaoId, pagamentoComMensalidade);
      reciboId = reciboResult.id;
      numeroRecibo = reciboResult.numeroRecibo;
    } catch (reciboError: any) {
      console.error('[registrarPagamento] Erro ao emitir recibo:', reciboError?.message);
    }

    // Enviar e-mail e auditoria em background - não bloquear resposta (reduz atraso no POS)
    const alunoEmail = mensalidadeAtualizada.aluno?.email;
    if (alunoEmail && numeroRecibo) {
      EmailService.sendEmail(
        req,
        alunoEmail,
        'PAGAMENTO_CONFIRMADO',
        {
          nomeDestinatario: mensalidadeAtualizada.aluno?.nomeCompleto || 'Aluno',
          valor: pagamento.valor.toString(),
          dataPagamento: pagamento.dataPagamento.toLocaleDateString('pt-BR'),
          referencia: numeroRecibo,
        },
        { instituicaoId }
      ).catch((emailError: any) => {
        console.error('[registrarPagamento] Erro ao enviar e-mail de recibo (não crítico):', emailError?.message);
      });
    }

    // Auditoria em background
    AuditService.logCreate(req, {
      modulo: ModuloAuditoria.FINANCEIRO,
      entidade: EntidadeAuditoria.PAGAMENTO,
      entidadeId: pagamento.id,
      dadosNovos: {
        pagamentoId: pagamento.id,
        reciboId: reciboId || undefined,
        valor: pagamento.valor.toString(),
        metodoPagamento: pagamento.metodoPagamento,
        dataPagamento: pagamento.dataPagamento,
        mensalidadeId: pagamento.mensalidadeId,
        statusMensalidadeAntes: mensalidade.status,
        statusMensalidadeDepois: novoStatus,
        totalPagoAntes: totalPago.toString(),
        totalPagoDepois: novoTotalPago.toString(),
        saldoRestante: valorTotal.minus(novoTotalPago).toNumber(),
      },
      observacao: observacoes || undefined,
    }).catch((error) => {
      console.error('[registrarPagamento] Erro ao gerar audit log:', error);
    }); // fire-and-forget

    res.status(201).json({
      pagamento,
      mensalidade: {
        ...mensalidadeAtualizada,
        comprovativo: numeroRecibo ?? mensalidadeAtualizada.comprovativo,
        recibo_numero: numeroRecibo ?? mensalidadeAtualizada.comprovativo,
      },
      saldoRestante: valorTotal.minus(novoTotalPago).toNumber(),
      reciboId: reciboId || undefined,
      recibo_numero: numeroRecibo || undefined,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Listar pagamentos de uma mensalidade
 */
export const getPagamentosByMensalidade = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { mensalidadeId } = req.params;
    const instituicaoId = requireTenantScope(req);

    // Verificar se mensalidade pertence à instituição
    const mensalidade = await prisma.mensalidade.findFirst({
      where: {
        id: mensalidadeId,
        aluno: { instituicaoId },
      },
    });

    if (!mensalidade) {
      throw new AppError('Mensalidade não encontrada', 404);
    }

    const pagamentos = await prisma.pagamento.findMany({
      where: { mensalidadeId },
      orderBy: { dataPagamento: 'desc' },
    });

    res.json(pagamentos);
  } catch (error) {
    next(error);
  }
};

/**
 * Listar todos os pagamentos (com filtros)
 */
export const getAllPagamentos = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { mensalidadeId, alunoId, dataInicio, dataFim } = req.query;

    const where: any = {};

    if (mensalidadeId) {
      where.mensalidadeId = mensalidadeId as string;
    }

    if (alunoId) {
      where.mensalidade = { alunoId: alunoId as string };
    }

    if (dataInicio || dataFim) {
      where.dataPagamento = {};
      if (dataInicio) {
        where.dataPagamento.gte = new Date(dataInicio as string);
      }
      if (dataFim) {
        where.dataPagamento.lte = new Date(dataFim as string);
      }
    }

    // Aplicar filtro de instituição através da mensalidade -> aluno
    where.mensalidade = {
      ...where.mensalidade,
      aluno: { instituicaoId },
    };

    const pagamentos = await prisma.pagamento.findMany({
      where,
      include: {
        mensalidade: {
          include: {
            aluno: {
              select: {
                id: true,
                nomeCompleto: true,
                email: true,
                numeroIdentificacao: true,
                numeroIdentificacaoPublica: true,
              },
            },
          },
        },
      },
      orderBy: { dataPagamento: 'desc' },
    });

    res.json(pagamentos);
  } catch (error) {
    next(error);
  }
};

/**
 * Obter um pagamento por ID
 */
export const getPagamentoById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const instituicaoId = requireTenantScope(req);

    const pagamento = await prisma.pagamento.findFirst({
      where: {
        id,
        mensalidade: {
          aluno: { instituicaoId },
        },
      },
      include: {
        mensalidade: {
          include: {
            aluno: true,
            pagamentos: {
              orderBy: { dataPagamento: 'desc' },
            },
          },
        },
      },
    });

    if (!pagamento) {
      throw new AppError('Pagamento não encontrado', 404);
    }

    res.json(pagamento);
  } catch (error) {
    next(error);
  }
};

/**
 * Bloquear DELETE de pagamentos - Histórico imutável
 * Pagamentos nunca devem ser deletados, apenas estornados
 */
export const deletePagamento = async (req: Request, res: Response, next: NextFunction) => {
  throw new AppError(
    'Pagamentos não podem ser deletados. O histórico é imutável. Use o endpoint de estorno (/pagamentos/:id/estornar) para criar um registro de estorno.',
    403
  );
};

/**
 * Estornar um pagamento
 * Cria um novo registro de estorno (não deleta o pagamento original)
 * Histórico permanece imutável
 */
export const estornarPagamento = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { observacoes } = req.body;
    const userId = req.user?.userId;
    const instituicaoId = requireTenantScope(req);

    // Buscar pagamento original
    const pagamentoOriginal = await prisma.pagamento.findFirst({
      where: {
        id,
        mensalidade: {
          aluno: { instituicaoId },
        },
      },
      include: {
        mensalidade: {
          include: {
            aluno: true,
            pagamentos: true,
          },
        },
      },
    });

    if (!pagamentoOriginal) {
      throw new AppError('Pagamento não encontrado', 404);
    }

    // SIGAE: Marcar recibo original como ESTORNADO (nunca deletar)
    let reciboEstornadoId: string | null = null;
    try {
      reciboEstornadoId = await estornarRecibo(pagamentoOriginal.id, instituicaoId);
      if (reciboEstornadoId) {
        await AuditService.logUpdate(req, {
          modulo: ModuloAuditoria.FINANCEIRO,
          entidade: EntidadeAuditoria.RECIBO,
          entidadeId: reciboEstornadoId,
          dadosAnteriores: { status: 'EMITIDO' },
          dadosNovos: { status: 'ESTORNADO', pagamentoId: pagamentoOriginal.id },
          observacao: 'Estorno de recibo ao estornar pagamento',
        }).catch((err) => console.error('[estornarPagamento] Erro audit recibo:', err));
      }
    } catch (reciboError: any) {
      console.error('[estornarPagamento] Erro ao estornar recibo:', reciboError?.message);
    }

    // Criar registro de estorno (valor negativo - usar minus para garantir Decimal)
    const valorEstorno = new Decimal(0).minus(pagamentoOriginal.valor);
    const observacoesEstorno = observacoes 
      ? `ESTORNO: ${observacoes}` 
      : `ESTORNO do pagamento ${pagamentoOriginal.id} de ${pagamentoOriginal.valor} registrado em ${pagamentoOriginal.dataPagamento.toISOString().split('T')[0]}`;

    const estorno = await prisma.pagamento.create({
      data: {
        mensalidadeId: pagamentoOriginal.mensalidadeId,
        valor: valorEstorno, // Valor negativo para estorno
        metodoPagamento: `ESTORNO_${pagamentoOriginal.metodoPagamento}`,
        observacoes: observacoesEstorno,
        registradoPor: userId || undefined,
      },
    });

    // Recalcular status da mensalidade incluindo o estorno
    const mensalidade = await prisma.mensalidade.findUnique({
      where: { id: pagamentoOriginal.mensalidadeId },
      include: { 
        pagamentos: {
          orderBy: { dataPagamento: 'desc' },
        },
      },
    });

    if (mensalidade) {
      const valorBase = new Decimal(mensalidade.valor);
      const valorDesconto = mensalidade.valorDesconto || new Decimal(0);
      const valorMulta = mensalidade.valorMulta || new Decimal(0);
      const valorTotal = valorBase.minus(valorDesconto).plus(valorMulta);

      // Calcular total pago incluindo estornos (valores negativos)
      const totalPago = mensalidade.pagamentos.reduce(
        (sum, p) => sum.plus(p.valor),
        new Decimal(0)
      );

      let novoStatus: 'Pendente' | 'Pago' | 'Parcial' | 'Atrasado' | 'Cancelado' = 'Pendente';
      
      if (totalPago.gte(valorTotal)) {
        novoStatus = 'Pago';
      } else if (totalPago.gt(0)) {
        novoStatus = 'Parcial';
      } else {
        novoStatus = 'Pendente';
      }

      const mensalidadeAtualizada = await prisma.mensalidade.update({
        where: { id: mensalidade.id },
        data: {
          status: novoStatus,
          dataPagamento: novoStatus === 'Pago' ? new Date() : null,
        },
        include: {
          aluno: true,
          pagamentos: {
            orderBy: { dataPagamento: 'desc' },
          },
        },
      });

      // Auditoria: Log ESTORNAR (com antes/depois)
      await AuditService.log(req, {
        modulo: ModuloAuditoria.FINANCEIRO,
        acao: 'ESTORNAR',
        entidade: EntidadeAuditoria.PAGAMENTO,
        entidadeId: estorno.id,
        dadosAnteriores: {
          pagamentoId: pagamentoOriginal.id,
          valor: pagamentoOriginal.valor.toString(),
          metodoPagamento: pagamentoOriginal.metodoPagamento,
          dataPagamento: pagamentoOriginal.dataPagamento,
          mensalidadeId: pagamentoOriginal.mensalidadeId,
          statusMensalidade: mensalidade.status,
        },
        dadosNovos: {
          estornoId: estorno.id,
          valorEstorno: valorEstorno.toString(),
          metodoPagamento: estorno.metodoPagamento,
          dataPagamento: estorno.dataPagamento,
          mensalidadeId: estorno.mensalidadeId,
          statusMensalidade: novoStatus,
          saldoRestante: valorTotal.minus(totalPago).toNumber(),
        },
        observacao: observacoesEstorno,
      }).catch((error) => {
        console.error('[estornarPagamento] Erro ao gerar audit log:', error);
      });

      res.status(201).json({
        estorno,
        pagamentoOriginal,
        mensalidade: mensalidadeAtualizada,
        saldoRestante: valorTotal.minus(totalPago).toNumber(),
        message: 'Pagamento estornado com sucesso. O histórico original foi preservado.',
      });
    } else {
      // Auditoria: Log ESTORNAR (sem mensalidade atualizada)
      await AuditService.log(req, {
        modulo: ModuloAuditoria.FINANCEIRO,
        acao: 'ESTORNAR',
        entidade: EntidadeAuditoria.PAGAMENTO,
        entidadeId: estorno.id,
        dadosAnteriores: {
          pagamentoId: pagamentoOriginal.id,
          valor: pagamentoOriginal.valor.toString(),
          metodoPagamento: pagamentoOriginal.metodoPagamento,
          dataPagamento: pagamentoOriginal.dataPagamento,
        },
        dadosNovos: {
          estornoId: estorno.id,
          valorEstorno: valorEstorno.toString(),
          metodoPagamento: estorno.metodoPagamento,
          dataPagamento: estorno.dataPagamento,
        },
        observacao: observacoesEstorno,
      }).catch((error) => {
        console.error('[estornarPagamento] Erro ao gerar audit log:', error);
      });

      res.status(201).json({
        estorno,
        pagamentoOriginal,
        message: 'Pagamento estornado com sucesso. O histórico original foi preservado.',
      });
    }
  } catch (error) {
    next(error);
  }
};

