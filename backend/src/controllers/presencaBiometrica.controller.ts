import { Request, Response, NextFunction } from 'express';
import { PresencaBiometricaService } from '../services/presencaBiometrica.service.js';
import { AppError } from '../middlewares/errorHandler.js';
import { requireTenantScope, addInstitutionFilter } from '../middlewares/auth.js';
import prisma from '../lib/prisma.js';

/**
 * Processar presenças do dia e marcar faltas
 */
export const processarPresencasDia = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, horarioPadraoEntrada } = req.body;

    const instituicaoId = requireTenantScope(req);

    // Apenas ADMIN ou RH pode processar
    if (!['ADMIN', 'SUPER_ADMIN', 'RH'].some(r => req.user?.roles?.includes(r))) {
      throw new AppError('Apenas ADMIN ou RH pode processar presenças', 403);
    }

    const dataProcessamento = data ? new Date(data) : new Date();

    const resultado = await PresencaBiometricaService.processarPresencasDia(
      dataProcessamento,
      instituicaoId,
      horarioPadraoEntrada
    );

    res.json(resultado);
  } catch (error) {
    next(error);
  }
};

/**
 * Buscar presenças de funcionário
 */
export const getPresencas = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { funcionarioId } = req.params;
    const { dataInicio, dataFim } = req.query;

    const instituicaoId = requireTenantScope(req);
    const filter = addInstitutionFilter(req);

    // Verificar permissão: funcionário só pode ver suas próprias presenças
    if (!['ADMIN', 'SUPER_ADMIN', 'RH'].some(r => req.user?.roles?.includes(r))) {
      // Verificar se o funcionário pertence ao usuário logado
      const funcionario = await prisma.funcionario.findFirst({
        where: {
          id: funcionarioId,
          userId: req.user?.userId,
          ...filter,
        },
      });

      if (!funcionario) {
        throw new AppError('Acesso negado', 403);
      }
    }

    const presencas = await PresencaBiometricaService.getPresencas(
      funcionarioId,
      instituicaoId,
      dataInicio ? new Date(dataInicio as string) : undefined,
      dataFim ? new Date(dataFim as string) : undefined
    );

    res.json(presencas);
  } catch (error) {
    next(error);
  }
};

/**
 * Buscar presenças do dia (painel diário)
 */
export const getPresencasDia = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data } = req.query;
    const instituicaoId = requireTenantScope(req);
    const filter = addInstitutionFilter(req);

    // Apenas ADMIN, RH ou SECRETARIA
    if (!['ADMIN', 'SUPER_ADMIN', 'RH', 'SECRETARIA'].some(r => req.user?.roles?.includes(r))) {
      throw new AppError('Acesso negado', 403);
    }

    const dataConsulta = data ? new Date(data as string) : new Date();
    dataConsulta.setHours(0, 0, 0, 0);

    const presencas = await prisma.frequenciaFuncionario.findMany({
      where: {
        data: dataConsulta,
        ...filter,
      },
      include: {
        funcionario: {
          select: {
            id: true,
            nomeCompleto: true,
            cargo: {
              select: {
                nome: true,
              },
            },
          },
        },
        justificativa: {
          select: {
            id: true,
            status: true,
            motivo: true,
          },
        },
      },
      orderBy: {
        funcionario: {
          nomeCompleto: 'asc',
        },
      },
    });

    res.json(presencas);
  } catch (error) {
    next(error);
  }
};

