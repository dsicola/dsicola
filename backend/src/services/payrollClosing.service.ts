import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { AuditService } from './audit.service.js';

/**
 * Serviço para gerenciamento de fechamento/reabertura de folhas de pagamento
 */
export class PayrollClosingService {
  /**
   * Fechar uma folha de pagamento
   * Bloqueia todas as edições e marca como imutável
   * 
   * @param folhaId - ID da folha de pagamento
   * @param userId - ID do usuário que está fechando
   * @param instituicaoId - ID da instituição (multi-tenant)
   * @returns Folha de pagamento fechada
   */
  static async fecharFolha(
    folhaId: string,
    userId: string,
    instituicaoId: string
  ) {
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

    // Validar estado atual
    if (folha.status === 'CLOSED') {
      throw new AppError('Folha já está fechada', 400);
    }

    if (folha.status === 'PAID') {
      throw new AppError('Folha paga não pode ser alterada', 400);
    }

    // Fechar folha
    const folhaFechada = await prisma.folhaPagamento.update({
      where: { id: folhaId },
      data: {
        status: 'CLOSED',
        fechadoEm: new Date(),
        fechadoPor: userId,
        reabertoEm: null,
        reabertoPor: null,
        justificativaReabertura: null,
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

    return folhaFechada;
  }

  /**
   * Reabrir uma folha de pagamento fechada
   * Apenas ADMIN ou DIRECAO podem reabrir
   * 
   * @param folhaId - ID da folha de pagamento
   * @param userId - ID do usuário que está reabrindo
   * @param instituicaoId - ID da instituição (multi-tenant)
   * @param justificativa - Justificativa obrigatória para reabertura
   * @param userRole - Role do usuário (deve ser ADMIN, SUPER_ADMIN ou DIRECAO)
   * @returns Folha de pagamento reaberta
   */
  static async reabrirFolha(
    folhaId: string,
    userId: string,
    instituicaoId: string,
    justificativa: string,
    userRole: string
  ) {
    // Validar permissão
    const rolesPermitidos = ['ADMIN', 'SUPER_ADMIN', 'DIRECAO'];
    if (!rolesPermitidos.includes(userRole)) {
      throw new AppError('Apenas ADMIN, DIRECAO ou SUPER_ADMIN podem reabrir folhas de pagamento', 403);
    }

    if (!justificativa || justificativa.trim().length === 0) {
      throw new AppError('Justificativa é obrigatória para reabertura de folha', 400);
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

    // Validar estado atual
    if (folha.status === 'PAID') {
      throw new AppError('Folha paga não pode ser reaberta', 400);
    }
    if (folha.status !== 'CLOSED') {
      throw new AppError(`Folha não está fechada. Status atual: ${folha.status}`, 400);
    }

    // Reabrir folha (voltar para CALCULATED para permitir edições)
    const folhaReaberta = await prisma.folhaPagamento.update({
      where: { id: folhaId },
      data: {
        status: 'CALCULATED', // Volta para CALCULATED (editável)
        reabertoEm: new Date(),
        reabertoPor: userId,
        justificativaReabertura: justificativa.trim(),
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

    return folhaReaberta;
  }

  /**
   * Verificar se uma folha pode ser editada
   * 
   * @param folhaId - ID da folha
   * @param instituicaoId - ID da instituição
   * @returns true se pode editar, false caso contrário
   */
  static async podeEditar(folhaId: string, instituicaoId: string): Promise<boolean> {
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

    return folha.status !== 'CLOSED' && folha.status !== 'PAID';
  }
}

