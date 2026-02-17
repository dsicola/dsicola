import { Request, Response, NextFunction } from 'express';
import { BiometriaService } from '../services/biometria.service.js';
import { AppError } from '../middlewares/errorHandler.js';
import { requireTenantScope } from '../middlewares/auth.js';
import { AuditService } from '../services/audit.service.js';
import prisma from '../lib/prisma.js';

/**
 * Registrar biometria de funcionário
 * Apenas ADMIN ou RH pode autorizar
 */
export const registrarBiometria = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { funcionarioId, template } = req.body;
    const dedo = Math.floor(Number(req.body.dedo ?? 1));

    if (!funcionarioId || !template) {
      throw new AppError('Funcionário e template biométrico são obrigatórios', 400);
    }

    if (!req.user?.userId) {
      throw new AppError('Usuário não autenticado', 401);
    }

    const instituicaoId = requireTenantScope(req);

    // Verificar permissão (ADMIN ou RH)
    const userRoles = req.user?.roles || [];
    if (!['ADMIN', 'SUPER_ADMIN', 'RH'].some(role => userRoles.includes(role as any))) {
      throw new AppError('Apenas ADMIN ou RH pode registrar biometria', 403);
    }

    const biometria = await BiometriaService.registrarBiometria(
      funcionarioId,
      template,
      dedo,
      req.user.userId,
      instituicaoId
    );

    // Registrar auditoria
    await AuditService.logCreate(req, {
      modulo: 'BIOMETRIA',
      entidade: 'BIOMETRIA_FUNCIONARIO',
      entidadeId: biometria.id,
      dadosNovos: {
        funcionarioId,
        dedo,
      },
    });

    res.status(201).json({
      id: biometria.id,
      funcionarioId: biometria.funcionarioId,
      dedo: biometria.dedo,
      ativo: biometria.ativo,
      createdAt: biometria.createdAt,
      // NUNCA retornar templateHash
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Marcar presença via biometria
 */
export const marcarPresenca = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { template, horarioPadraoEntrada, horarioPadraoSaida } = req.body;

    if (!template) {
      throw new AppError('Template biométrico é obrigatório', 400);
    }

    const instituicaoId = requireTenantScope(req);

    const { PresencaBiometricaService } = await import('../services/presencaBiometrica.service.js');
    const frequencia = await PresencaBiometricaService.marcarPresenca(
      template,
      instituicaoId,
      horarioPadraoEntrada,
      horarioPadraoSaida
    );

    // Registrar auditoria
    const isCheckIn = frequencia.horaEntrada && !frequencia.horaSaida;
    if (isCheckIn) {
      await AuditService.logCreate(req, {
        modulo: 'PRESENCA_BIOMETRICA',
        entidade: 'FREQUENCIA_FUNCIONARIO',
        entidadeId: frequencia.id,
        dadosNovos: {
          funcionarioId: frequencia.funcionarioId,
          data: frequencia.data,
          horaEntrada: frequencia.horaEntrada,
          origem: frequencia.origem,
        },
      });
    } else {
      // Para check-out, precisamos buscar o estado anterior
      const frequenciaAnterior = await prisma.frequenciaFuncionario.findUnique({
        where: { id: frequencia.id },
      });
      
      await AuditService.logUpdate(req, {
        modulo: 'PRESENCA_BIOMETRICA',
        entidade: 'FREQUENCIA_FUNCIONARIO',
        entidadeId: frequencia.id,
        dadosAnteriores: {
          horaEntrada: frequenciaAnterior?.horaEntrada,
          horaSaida: null,
          status: frequenciaAnterior?.status,
        },
        dadosNovos: {
          horaSaida: frequencia.horaSaida,
          status: frequencia.status,
          horasTrabalhadas: frequencia.horasTrabalhadas,
        },
      });
    }

    res.json(frequencia);
  } catch (error) {
    next(error);
  }
};

/**
 * Buscar biometrias de um funcionário
 */
export const getBiometriasFuncionario = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { funcionarioId } = req.params;

    if (!funcionarioId) {
      throw new AppError('Funcionário é obrigatório', 400);
    }

    const instituicaoId = requireTenantScope(req);

    // Verificar permissão: funcionário só pode ver suas próprias biometrias
    // ADMIN/RH pode ver todas
    const userRoles = req.user?.roles || [];
    if (!['ADMIN', 'SUPER_ADMIN', 'RH'].some(role => userRoles.includes(role as any))) {
      // Verificar se o funcionário pertence ao usuário logado
      // (assumindo que funcionário tem userId vinculado)
      throw new AppError('Acesso negado', 403);
    }

    const biometrias = await BiometriaService.getBiometriasFuncionario(
      funcionarioId,
      instituicaoId
    );

    res.json(biometrias);
  } catch (error) {
    next(error);
  }
};

/**
 * Desativar biometria
 */
export const desativarBiometria = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { biometriaId } = req.params;

    if (!biometriaId) {
      throw new AppError('Biometria é obrigatória', 400);
    }

    const instituicaoId = requireTenantScope(req);

    // Apenas ADMIN ou RH pode desativar
    const userRoles = req.user?.roles || [];
    if (!['ADMIN', 'SUPER_ADMIN', 'RH'].some(role => userRoles.includes(role as any))) {
      throw new AppError('Apenas ADMIN ou RH pode desativar biometria', 403);
    }

    const biometria = await BiometriaService.desativarBiometria(biometriaId, instituicaoId);

    // Registrar auditoria
    await AuditService.log(req, {
      modulo: 'BIOMETRIA',
      entidade: 'BIOMETRIA_FUNCIONARIO',
      entidadeId: biometriaId,
      acao: 'BLOCK',
      observacao: 'Biometria desativada',
    });

    res.json({ message: 'Biometria desativada com sucesso' });
  } catch (error) {
    next(error);
  }
};

