import { Request } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { AuditService } from './audit.service.js';

export type MetodoPagamento = 'TRANSFERENCIA' | 'CASH' | 'MOBILE_MONEY' | 'CHEQUE';

/**
 * Serviço para gerenciamento de pagamento de folhas de pagamento
 */
export class PayrollPaymentService {
  /**
   * Marcar uma folha fechada como PAGA
   * Apenas folhas em status CLOSED podem ser pagas
   * 
   * @param req - Request do Express (para audit log)
   * @param folhaId - ID da folha de pagamento
   * @param userId - ID do usuário que está pagando
   * @param instituicaoId - ID da instituição (multi-tenant)
   * @param metodoPagamento - Método de pagamento (TRANSFERENCIA, CASH, MOBILE_MONEY, CHEQUE)
   * @param referencia - Referência do pagamento (opcional)
   * @param observacaoPagamento - Observação específica do pagamento (opcional)
   * @returns Folha de pagamento marcada como paga
   */
  static async pagarFolha(
    req: Request,
    folhaId: string,
    userId: string,
    instituicaoId: string,
    metodoPagamento: MetodoPagamento,
    referencia?: string,
    observacaoPagamento?: string
  ) {
    // Validar método de pagamento
    const metodosValidos: MetodoPagamento[] = ['TRANSFERENCIA', 'CASH', 'MOBILE_MONEY', 'CHEQUE'];
    if (!metodosValidos.includes(metodoPagamento)) {
      throw new AppError(`Método de pagamento inválido. Valores permitidos: ${metodosValidos.join(', ')}`, 400);
    }

    // Buscar folha com verificação de instituição
    const folha = await prisma.folhaPagamento.findFirst({
      where: {
        id: folhaId,
        funcionario: {
          instituicaoId,
        },
      },
      include: {
        funcionario: {
          select: {
            id: true,
            nomeCompleto: true,
            instituicaoId: true,
          },
        },
      },
    });

    if (!folha) {
      throw new AppError('Folha de pagamento não encontrada ou não pertence à sua instituição', 404);
    }

    // Verificar se já está paga (idempotência)
    if (folha.status === 'PAID') {
      // Se já está paga, retornar a folha atual (idempotência)
      const folhaPaga = await prisma.folhaPagamento.findUnique({
        where: { id: folhaId },
        include: {
          funcionario: {
            include: {
              cargo: true,
              departamento: true,
            },
          },
        },
      });
      return folhaPaga;
    }

    // VALIDAÇÃO CRÍTICA: Somente folhas CLOSED podem ser pagas
    if (folha.status !== 'CLOSED') {
      throw new AppError(
        `Apenas folhas FECHADAS podem ser pagas. Status atual: ${folha.status}. Feche a folha antes de marcar como paga.`,
        400
      );
    }

    // Dados antigos para auditoria
    const dadosAnteriores = {
      status: folha.status,
      pagoEm: folha.pagoEm,
      pagoPor: folha.pagoPor,
      metodoPagamento: folha.metodoPagamento,
      referencia: folha.referencia,
      observacaoPagamento: folha.observacaoPagamento,
    };

    // Marcar como paga
    const folhaPaga = await prisma.folhaPagamento.update({
      where: { id: folhaId },
      data: {
        status: 'PAID',
        pagoEm: new Date(),
        pagoPor: userId,
        metodoPagamento,
        referencia: referencia?.trim() || null,
        observacaoPagamento: observacaoPagamento?.trim() || null,
        // Manter compatibilidade com campos legados
        dataPagamento: new Date(),
        formaPagamento: metodoPagamento,
      },
      include: {
        funcionario: {
          include: {
            cargo: true,
            departamento: true,
          },
        },
      },
    });

    // Gerar audit log
    try {
      await AuditService.log(req, {
        modulo: 'FOLHA_PAGAMENTO',
        acao: 'PAY',
        entidade: 'FOLHA_PAGAMENTO',
        entidadeId: folhaId,
        dadosAnteriores,
        dadosNovos: {
          status: 'PAID',
          pagoEm: folhaPaga.pagoEm,
          pagoPor: folhaPaga.pagoPor,
          metodoPagamento: folhaPaga.metodoPagamento,
          referencia: folhaPaga.referencia,
          observacaoPagamento: folhaPaga.observacaoPagamento,
        },
        observacao: `Folha de pagamento marcada como PAGA - Funcionário: ${folha.funcionario.nomeCompleto} (${folha.funcionario.id}), Mês: ${folha.mes}/${folha.ano}, Método: ${metodoPagamento}`,
      });
    } catch (auditError) {
      console.error('Erro ao gerar audit log:', auditError);
      // Não bloquear o fluxo se audit log falhar
    }

    return folhaPaga;
  }

  /**
   * Reverter pagamento de uma folha
   * Apenas ADMIN/DIRECAO podem reverter
   * Volta para status CLOSED
   * 
   * @param req - Request do Express (para audit log)
   * @param folhaId - ID da folha de pagamento
   * @param userId - ID do usuário que está revertendo
   * @param instituicaoId - ID da instituição (multi-tenant)
   * @param justificativa - Justificativa obrigatória para reversão
   * @param userRole - Role do usuário (deve ser ADMIN, SUPER_ADMIN ou DIRECAO)
   * @returns Folha de pagamento com pagamento revertido
   */
  static async reverterPagamento(
    req: Request,
    folhaId: string,
    userId: string,
    instituicaoId: string,
    justificativa: string,
    userRole: string
  ) {
    // Validar permissão
    const rolesPermitidos = ['ADMIN', 'SUPER_ADMIN', 'DIRECAO'];
    if (!rolesPermitidos.includes(userRole)) {
      throw new AppError('Apenas ADMIN, DIRECAO ou SUPER_ADMIN podem reverter pagamentos de folhas', 403);
    }

    if (!justificativa || justificativa.trim().length === 0) {
      throw new AppError('Justificativa é obrigatória para reverter pagamento', 400);
    }

    // Buscar folha com verificação de instituição
    const folha = await prisma.folhaPagamento.findFirst({
      where: {
        id: folhaId,
        funcionario: {
          instituicaoId,
        },
      },
      include: {
        funcionario: {
          select: {
            id: true,
            nomeCompleto: true,
            instituicaoId: true,
          },
        },
      },
    });

    if (!folha) {
      throw new AppError('Folha de pagamento não encontrada ou não pertence à sua instituição', 404);
    }

    // VALIDAÇÃO: Somente folhas PAID podem ter pagamento revertido
    if (folha.status !== 'PAID') {
      throw new AppError(
        `Apenas folhas PAGAS podem ter pagamento revertido. Status atual: ${folha.status}`,
        400
      );
    }

    // Dados antigos para auditoria
    const dadosAnteriores = {
      status: folha.status,
      pagoEm: folha.pagoEm,
      pagoPor: folha.pagoPor,
      metodoPagamento: folha.metodoPagamento,
      referencia: folha.referencia,
      observacaoPagamento: folha.observacaoPagamento,
    };

    // Reverter pagamento (voltar para CLOSED)
    const folhaRevertida = await prisma.folhaPagamento.update({
      where: { id: folhaId },
      data: {
        status: 'CLOSED',
        // Limpar campos de pagamento
        pagoEm: null,
        pagoPor: null,
        metodoPagamento: null,
        referencia: null,
        observacaoPagamento: null,
        // Manter compatibilidade com campos legados
        dataPagamento: null,
        formaPagamento: null,
      },
      include: {
        funcionario: {
          include: {
            cargo: true,
            departamento: true,
          },
        },
      },
    });

    // Gerar audit log
    try {
      await AuditService.log(req, {
        modulo: 'FOLHA_PAGAMENTO',
        acao: 'REVERSE_PAY',
        entidade: 'FOLHA_PAGAMENTO',
        entidadeId: folhaId,
        dadosAnteriores,
        dadosNovos: {
          status: 'CLOSED',
          pagoEm: null,
          pagoPor: null,
          metodoPagamento: null,
          referencia: null,
          observacaoPagamento: null,
        },
        observacao: `Pagamento revertido - Funcionário: ${folha.funcionario.nomeCompleto} (${folha.funcionario.id}), Mês: ${folha.mes}/${folha.ano}. Justificativa: ${justificativa.trim()}`,
      });
    } catch (auditError) {
      console.error('Erro ao gerar audit log:', auditError);
      // Não bloquear o fluxo se audit log falhar
    }

    return folhaRevertida;
  }

  /**
   * Verificar se uma folha pode ser paga
   * 
   * @param folhaId - ID da folha
   * @param instituicaoId - ID da instituição
   * @returns true se pode pagar, false caso contrário
   */
  static async podePagar(folhaId: string, instituicaoId: string): Promise<boolean> {
    const folha = await prisma.folhaPagamento.findFirst({
      where: {
        id: folhaId,
        funcionario: {
          instituicaoId,
        },
      },
    });

    if (!folha) {
      return false;
    }

    return folha.status === 'CLOSED';
  }
}

