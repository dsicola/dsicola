import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { requireTenantScope, addInstitutionFilter } from '../middlewares/auth.js';
import { AuditService } from '../services/audit.service.js';

/**
 * Criar solicitação de justificativa de falta
 */
export const criarJustificativa = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { frequenciaId, motivo, documentoUrl } = req.body;

    if (!frequenciaId || !motivo) {
      throw new AppError('Frequência e motivo são obrigatórios', 400);
    }

    const instituicaoId = requireTenantScope(req);
    const filter = addInstitutionFilter(req);

    // Verificar se frequência existe e pertence à instituição
    const frequencia = await prisma.frequenciaFuncionario.findFirst({
      where: {
        id: frequenciaId,
        ...filter,
      },
      include: {
        funcionario: true,
      },
    });

    if (!frequencia) {
      throw new AppError('Frequência não encontrada', 404);
    }

    // Verificar se já existe justificativa
    const existing = await prisma.justificativaFalta.findUnique({
      where: {
        frequenciaId,
      },
    });

    if (existing) {
      throw new AppError('Já existe uma justificativa para esta frequência', 400);
    }

    // PERMITIR justificativas para presenças biométricas
    // (é o único meio de alterar status de presença biométrica)

    // Verificar permissão: funcionário só pode criar para suas próprias faltas
    if (!['ADMIN', 'SUPER_ADMIN', 'RH'].some(r => req.user?.roles?.includes(r))) {
      if (frequencia.funcionario.userId !== req.user?.userId) {
        throw new AppError('Você só pode criar justificativas para suas próprias faltas', 403);
      }
    }

    const justificativa = await prisma.justificativaFalta.create({
      data: {
        frequenciaId,
        motivo,
        documentoUrl: documentoUrl || null,
        status: 'PENDENTE',
        instituicaoId,
      },
      include: {
        frequencia: {
          include: {
            funcionario: {
              select: {
                id: true,
                nomeCompleto: true,
              },
            },
          },
        },
      },
    });

    // Registrar auditoria
    await AuditService.logCreate(req, {
      modulo: 'JUSTIFICATIVA_FALTA',
      entidade: 'JUSTIFICATIVA_FALTA',
      entidadeId: justificativa.id,
      dadosNovos: {
        frequenciaId,
        motivo,
        status: 'PENDENTE',
      },
    });

    res.status(201).json(justificativa);
  } catch (error) {
    next(error);
  }
};

/**
 * Aprovar justificativa de falta
 */
export const aprovarJustificativa = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { justificativaId } = req.params;
    const { observacoes } = req.body;

    // Apenas ADMIN ou RH pode aprovar
    if (!['ADMIN', 'SUPER_ADMIN', 'RH'].some(r => req.user?.roles?.includes(r))) {
      throw new AppError('Apenas ADMIN ou RH pode aprovar justificativas', 403);
    }

    const instituicaoId = requireTenantScope(req);
    const filter = addInstitutionFilter(req);

    const justificativa = await prisma.justificativaFalta.findFirst({
      where: {
        id: justificativaId,
        ...filter,
      },
      include: {
        frequencia: true,
      },
    });

    if (!justificativa) {
      throw new AppError('Justificativa não encontrada', 404);
    }

    if (justificativa.status !== 'PENDENTE') {
      throw new AppError('Apenas justificativas pendentes podem ser aprovadas', 400);
    }

    // Atualizar status da justificativa
    const justificativaAtualizada = await prisma.justificativaFalta.update({
      where: { id: justificativaId },
      data: {
        status: 'APROVADA',
        aprovadoPor: req.user?.userId || null,
        aprovadoEm: new Date(),
        observacoes: observacoes || null,
      },
    });

    // Buscar frequência para auditoria
    const frequenciaAntes = await prisma.frequenciaFuncionario.findUnique({
      where: { id: justificativa.frequenciaId },
    });

    // Atualizar status da frequência para FALTA_JUSTIFICADA
    // PERMITIDO mesmo para presenças biométricas (única forma de alterar status)
    const frequenciaAtualizada = await prisma.frequenciaFuncionario.update({
      where: { id: justificativa.frequenciaId },
      data: {
        status: 'FALTA_JUSTIFICADA',
      },
    });

    // Registrar auditoria completa
    await AuditService.log(req, {
      modulo: 'JUSTIFICATIVA_FALTA',
      entidade: 'JUSTIFICATIVA_FALTA',
      entidadeId: justificativaId,
      acao: 'APPROVE',
      dadosAnteriores: {
        status: 'PENDENTE',
        frequenciaStatus: frequenciaAntes?.status,
        frequenciaOrigem: frequenciaAntes?.origem,
      },
      dadosNovos: {
        status: 'APROVADA',
        aprovadoPor: req.user?.userId,
        frequenciaStatus: 'FALTA_JUSTIFICADA',
      },
      observacao: observacoes || `Justificativa aprovada para presença ${frequenciaAntes?.origem === 'BIOMETRIA' ? 'biométrica' : 'manual'}`,
    });

    // Registrar também auditoria na frequência (mudança de status)
    if (frequenciaAntes) {
      await AuditService.logUpdate(req, {
        modulo: 'PRESENCA_BIOMETRICA',
        entidade: 'FREQUENCIA_FUNCIONARIO',
        entidadeId: justificativa.frequenciaId,
        dadosAnteriores: {
          status: frequenciaAntes.status,
        },
        dadosNovos: {
          status: 'FALTA_JUSTIFICADA',
        },
        observacao: `Status alterado via aprovação de justificativa. Origem: ${frequenciaAntes.origem}`,
      });
    }

    res.json(justificativaAtualizada);
  } catch (error) {
    next(error);
  }
};

/**
 * Rejeitar justificativa de falta
 */
export const rejeitarJustificativa = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { justificativaId } = req.params;
    const { observacoes } = req.body;

    if (!observacoes) {
      throw new AppError('Observação é obrigatória para rejeição', 400);
    }

    // Apenas ADMIN ou RH pode rejeitar
    if (!['ADMIN', 'SUPER_ADMIN', 'RH'].some(r => req.user?.roles?.includes(r))) {
      throw new AppError('Apenas ADMIN ou RH pode rejeitar justificativas', 403);
    }

    const instituicaoId = requireTenantScope(req);
    const filter = addInstitutionFilter(req);

    const justificativa = await prisma.justificativaFalta.findFirst({
      where: {
        id: justificativaId,
        ...filter,
      },
      include: {
        frequencia: true,
      },
    });

    if (!justificativa) {
      throw new AppError('Justificativa não encontrada', 404);
    }

    if (justificativa.status !== 'PENDENTE') {
      throw new AppError('Apenas justificativas pendentes podem ser rejeitadas', 400);
    }

    // Atualizar status da justificativa
    const justificativaAtualizada = await prisma.justificativaFalta.update({
      where: { id: justificativaId },
      data: {
        status: 'REJEITADA',
        aprovadoPor: req.user?.userId || null,
        aprovadoEm: new Date(),
        observacoes,
      },
    });

    // Buscar frequência para auditoria
    const frequenciaAntes = await prisma.frequenciaFuncionario.findUnique({
      where: { id: justificativa.frequenciaId },
    });

    // Atualizar status da frequência para FALTA_NAO_JUSTIFICADA
    // PERMITIDO mesmo para presenças biométricas
    const frequenciaAtualizada = await prisma.frequenciaFuncionario.update({
      where: { id: justificativa.frequenciaId },
      data: {
        status: 'FALTA_NAO_JUSTIFICADA',
      },
    });

    // Registrar auditoria completa
    await AuditService.log(req, {
      modulo: 'JUSTIFICATIVA_FALTA',
      entidade: 'JUSTIFICATIVA_FALTA',
      entidadeId: justificativaId,
      acao: 'REJECT',
      dadosAnteriores: {
        status: 'PENDENTE',
        frequenciaStatus: frequenciaAntes?.status,
        frequenciaOrigem: frequenciaAntes?.origem,
      },
      dadosNovos: {
        status: 'REJEITADA',
        aprovadoPor: req.user?.userId,
        frequenciaStatus: 'FALTA_NAO_JUSTIFICADA',
      },
      observacao: observacoes || `Justificativa rejeitada para presença ${frequenciaAntes?.origem === 'BIOMETRIA' ? 'biométrica' : 'manual'}`,
    });

    // Registrar também auditoria na frequência (mudança de status)
    if (frequenciaAntes) {
      await AuditService.logUpdate(req, {
        modulo: 'PRESENCA_BIOMETRICA',
        entidade: 'FREQUENCIA_FUNCIONARIO',
        entidadeId: justificativa.frequenciaId,
        dadosAnteriores: {
          status: frequenciaAntes.status,
        },
        dadosNovos: {
          status: 'FALTA_NAO_JUSTIFICADA',
        },
        observacao: `Status alterado via rejeição de justificativa. Origem: ${frequenciaAntes.origem}`,
      });
    }

    res.json(justificativaAtualizada);
  } catch (error) {
    next(error);
  }
};

/**
 * Buscar justificativas
 */
export const getJustificativas = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, funcionarioId } = req.query;
    const instituicaoId = requireTenantScope(req);
    const filter = addInstitutionFilter(req);

    const where: any = {
      ...filter,
    };

    if (status) {
      where.status = status;
    }

    if (funcionarioId) {
      where.frequencia = {
        funcionarioId: funcionarioId as string,
      };
    }

    // Verificar permissão: funcionário só pode ver suas próprias justificativas
    if (!['ADMIN', 'SUPER_ADMIN', 'RH'].some(r => req.user?.roles?.includes(r))) {
      // Buscar funcionário do usuário logado
      const funcionario = await prisma.funcionario.findFirst({
        where: {
          userId: req.user?.userId,
          ...filter,
        },
      });

      if (funcionario) {
        where.frequencia = {
          funcionarioId: funcionario.id,
        };
      } else {
        return res.json([]);
      }
    }

    const justificativas = await prisma.justificativaFalta.findMany({
      where,
      include: {
        frequencia: {
          include: {
            funcionario: {
              select: {
                id: true,
                nomeCompleto: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json(justificativas);
  } catch (error) {
    next(error);
  }
};

