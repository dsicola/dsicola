import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler.js';
import prisma from '../lib/prisma.js';
import { StatusFuncionario } from '@prisma/client';

/**
 * ========================================
 * MIDDLEWARE DE VALIDAÇÃO DE STATUS RH
 * ========================================
 * 
 * Regras institucionais:
 * - ENCERRADO: bloqueia acesso ao sistema
 * - SUSPENSO: acesso limitado (somente leitura)
 * - ATIVO: acesso normal
 */

/**
 * Verificar se funcionário está ativo
 * Usado para validar ações acadêmicas (professor)
 */
export const verificarFuncionarioAtivo = async (
  userId: string,
  instituicaoId: string
): Promise<{ ativo: boolean; funcionario: any | null; motivo?: string }> => {
  const funcionario = await prisma.funcionario.findFirst({
    where: {
      userId,
      instituicaoId,
    },
    include: {
      contratos: {
        where: {
          status: 'ATIVO',
        },
        orderBy: {
          dataInicio: 'desc',
        },
        take: 1,
      },
    },
  });

  if (!funcionario) {
    return { ativo: false, funcionario: null, motivo: 'Funcionário não encontrado no RH' };
  }

  // Verificar status do funcionário
  if (funcionario.status === 'ENCERRADO') {
    return { ativo: false, funcionario, motivo: 'Vínculo encerrado. Acesso bloqueado.' };
  }

  if (funcionario.status === 'SUSPENSO') {
    return { ativo: false, funcionario, motivo: 'Vínculo suspenso. Acesso limitado.' };
  }

  // Verificar se tem contrato ativo
  if (funcionario.contratos.length === 0) {
    return { ativo: false, funcionario, motivo: 'Nenhum contrato ativo encontrado' };
  }

  const contratoAtivo = funcionario.contratos[0];
  if (contratoAtivo.dataFim && contratoAtivo.dataFim < new Date()) {
    return { ativo: false, funcionario, motivo: 'Contrato expirado' };
  }

  return { ativo: true, funcionario };
};

/**
 * Middleware para bloquear acesso se funcionário está ENCERRADO
 */
export const bloquearAcessoSeEncerrado = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user?.userId || !req.user?.instituicaoId) {
      // Se não tem userId ou instituicaoId, não é funcionário vinculado ao RH
      // Permitir acesso (pode ser SUPER_ADMIN ou usuário sem vínculo RH)
      return next();
    }

    const funcionario = await prisma.funcionario.findFirst({
      where: {
        userId: req.user.userId,
        instituicaoId: req.user.instituicaoId,
      },
      select: {
        id: true,
        status: true,
        nomeCompleto: true,
      },
    });

    if (!funcionario) {
      // Funcionário não encontrado no RH - permitir acesso (pode ser usuário sem vínculo)
      return next();
    }

    if (funcionario.status === 'ENCERRADO') {
      throw new AppError(
        'Seu vínculo está encerrado. Acesso ao sistema bloqueado. Entre em contato com o RH.',
        403
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware para limitar acesso se funcionário está SUSPENSO
 * Permite apenas leitura (GET)
 */
export const limitarAcessoSeSuspenso = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user?.userId || !req.user?.instituicaoId) {
      return next();
    }

    // Permitir métodos GET (leitura)
    if (req.method === 'GET') {
      return next();
    }

    const funcionario = await prisma.funcionario.findFirst({
      where: {
        userId: req.user.userId,
        instituicaoId: req.user.instituicaoId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!funcionario) {
      return next();
    }

    if (funcionario.status === 'SUSPENSO') {
      throw new AppError(
        'Seu vínculo está suspenso. Apenas consulta é permitida. Entre em contato com o RH.',
        403
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Validar se professor pode executar ação acadêmica
 * Verifica: status ATIVO + contrato ativo (se cadastrado no RH)
 * 
 * REGRAS:
 * - Se professor NÃO está cadastrado no RH: PERMITIR (instituição pode não usar RH)
 * - Se professor está cadastrado mas sem contrato: PERMITIR (pode estar em processo de cadastro)
 * - Se status é ENCERRADO: BLOQUEAR
 * - Se status é SUSPENSO: BLOQUEAR
 * - Se status é ATIVO mas contrato expirado: BLOQUEAR apenas se contrato existir
 */
export const validarProfessorAtivo = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user?.userId || !req.user?.instituicaoId) {
      throw new AppError('Usuário não identificado', 401);
    }

    // Verificar se é professor
    const isProfessor = req.user.roles?.includes('PROFESSOR');
    if (!isProfessor) {
      // Não é professor, não precisa validar
      return next();
    }

    // Verificar se professor está cadastrado no RH
    const funcionario = await prisma.funcionario.findFirst({
      where: {
        userId: req.user.userId,
        instituicaoId: req.user.instituicaoId,
      },
      include: {
        contratos: {
          where: {
            status: 'ATIVO',
          },
          orderBy: {
            dataInicio: 'desc',
          },
          take: 1,
        },
      },
    });

    // Se não está cadastrado no RH, permitir (instituição pode não usar RH)
    if (!funcionario) {
      return next();
    }

    // Se está cadastrado, validar status
    if (funcionario.status === 'ENCERRADO') {
      throw new AppError(
        'Ação não permitida: Vínculo encerrado. Acesso bloqueado.',
        403
      );
    }

    if (funcionario.status === 'SUSPENSO') {
      throw new AppError(
        'Ação não permitida: Vínculo suspenso. Acesso limitado.',
        403
      );
    }

    // Se tem contratos cadastrados, verificar se há contrato ativo válido
    if (funcionario.contratos.length > 0) {
      const contratoAtivo = funcionario.contratos[0];
      if (contratoAtivo.dataFim && contratoAtivo.dataFim < new Date()) {
        throw new AppError(
          'Ação não permitida: Contrato expirado.',
          403
        );
      }
    }
    // Se não tem contratos mas status é ATIVO, permitir (pode estar em processo de cadastro)

    next();
  } catch (error) {
    next(error);
  }
};

