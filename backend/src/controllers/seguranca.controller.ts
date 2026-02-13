import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter, requireTenantScope } from '../middlewares/auth.js';

/**
 * Obter tentativas de login (apenas ADMIN)
 * GET /seguranca/login-attempts
 */
export const getLoginAttempts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    
    // Verificar permissões (apenas ADMIN)
    const userRoles = req.user?.roles || [];
    const isAdmin = userRoles.includes('ADMIN') || userRoles.includes('SUPER_ADMIN');
    
    if (!isAdmin) {
      throw new AppError('Acesso negado. Apenas administradores podem visualizar tentativas de login.', 403);
    }

    const { 
      email,
      dataInicio,
      dataFim,
      bloqueado,
      limit = 100
    } = req.query;

    const where: any = {
      instituicaoId: instituicaoId || undefined,
    };

    if (email) {
      where.email = { contains: (email as string).toLowerCase() };
    }

    if (bloqueado === 'true') {
      where.lockedUntil = { gt: new Date() };
    } else if (bloqueado === 'false') {
      where.OR = [
        { lockedUntil: null },
        { lockedUntil: { lte: new Date() } }
      ];
    }

    if (dataInicio || dataFim) {
      where.lastAttemptAt = {};
      if (dataInicio) {
        where.lastAttemptAt.gte = new Date(dataInicio as string);
      }
      if (dataFim) {
        const dataFimObj = new Date(dataFim as string);
        dataFimObj.setHours(23, 59, 59, 999);
        where.lastAttemptAt.lte = dataFimObj;
      }
    }

    const attempts = await prisma.loginAttempt.findMany({
      where,
      orderBy: { lastAttemptAt: 'desc' },
      take: parseInt(limit as string),
      include: {
        instituicao: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
    });

    res.json(attempts);
  } catch (error) {
    next(error);
  }
};

/**
 * Obter resets de senha (apenas ADMIN)
 * GET /seguranca/password-resets
 */
export const getPasswordResets = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    
    // Verificar permissões (apenas ADMIN)
    const userRoles = req.user?.roles || [];
    const isAdmin = userRoles.includes('ADMIN') || userRoles.includes('SUPER_ADMIN');
    
    if (!isAdmin) {
      throw new AppError('Acesso negado. Apenas administradores podem visualizar resets de senha.', 403);
    }

    const { 
      userId,
      usado,
      dataInicio,
      dataFim,
      limit = 100
    } = req.query;

    const where: any = {};

    if (userId) {
      where.userId = userId as string;
    }

    if (usado === 'true') {
      where.used = true;
    } else if (usado === 'false') {
      where.used = false;
    }

    if (dataInicio || dataFim) {
      where.createdAt = {};
      if (dataInicio) {
        where.createdAt.gte = new Date(dataInicio as string);
      }
      if (dataFim) {
        const dataFimObj = new Date(dataFim as string);
        dataFimObj.setHours(23, 59, 59, 999);
        where.createdAt.lte = dataFimObj;
      }
    }

    // Filtrar por instituição através do usuário
    const resets = await prisma.passwordResetToken.findMany({
      where: {
        ...where,
        user: {
          instituicaoId: instituicaoId || undefined,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      include: {
        user: {
          select: {
            id: true,
            email: true,
            nomeCompleto: true,
            instituicaoId: true,
          },
        },
      },
    });

    res.json(resets);
  } catch (error) {
    next(error);
  }
};

/**
 * Obter painel de segurança consolidado (apenas ADMIN)
 * GET /seguranca/dashboard
 */
export const getSecurityDashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    
    // Verificar permissões (apenas ADMIN)
    const userRoles = req.user?.roles || [];
    const isAdmin = userRoles.includes('ADMIN') || userRoles.includes('SUPER_ADMIN');
    
    if (!isAdmin) {
      throw new AppError('Acesso negado. Apenas administradores podem acessar o painel de segurança.', 403);
    }

    const { dataInicio, dataFim } = req.query;

    // Construir filtro de data
    const dateFilter: any = {};
    if (dataInicio) {
      dateFilter.gte = new Date(dataInicio as string);
    }
    if (dataFim) {
      const dataFimObj = new Date(dataFim as string);
      dataFimObj.setHours(23, 59, 59, 999);
      dateFilter.lte = dataFimObj;
    }

    // Estatísticas de tentativas de login
    const loginAttemptsWhere: any = {
      instituicaoId: instituicaoId || undefined,
      ...(Object.keys(dateFilter).length > 0 && { lastAttemptAt: dateFilter }),
    };

    const [
      totalLoginAttempts,
      blockedAccounts,
      recentFailedAttempts,
      loginAttemptsByDay,
    ] = await Promise.all([
      // Total de tentativas
      prisma.loginAttempt.count({
        where: loginAttemptsWhere,
      }),
      // Contas bloqueadas
      prisma.loginAttempt.count({
        where: {
          ...loginAttemptsWhere,
          lockedUntil: { gt: new Date() },
        },
      }),
      // Tentativas falhadas recentes (últimas 24h)
      prisma.loginAttempt.findMany({
        where: {
          ...loginAttemptsWhere,
          attemptCount: { gte: 1 },
          lastAttemptAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
        orderBy: { lastAttemptAt: 'desc' },
        take: 10,
        include: {
          instituicao: {
            select: {
              id: true,
              nome: true,
            },
          },
        },
      }),
      // Tentativas por dia (últimos 7 dias) - simplificado
      prisma.loginAttempt.findMany({
        where: loginAttemptsWhere,
        select: {
          lastAttemptAt: true,
        },
        orderBy: { lastAttemptAt: 'desc' },
        take: 100, // Limitar para processar
      }),
    ]);

    // Estatísticas de resets de senha
    const passwordResetsWhere: any = {
      user: {
        instituicaoId: instituicaoId || undefined,
      },
      ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
    };

    const [
      totalPasswordResets,
      usedPasswordResets,
      pendingPasswordResets,
    ] = await Promise.all([
      prisma.passwordResetToken.count({
        where: passwordResetsWhere,
      }),
      prisma.passwordResetToken.count({
        where: {
          ...passwordResetsWhere,
          used: true,
        },
      }),
      prisma.passwordResetToken.count({
        where: {
          ...passwordResetsWhere,
          used: false,
          expiresAt: { gt: new Date() },
        },
      }),
    ]);

    // Estatísticas de auditoria de segurança
    const securityAuditWhere: any = {
      instituicaoId: instituicaoId || undefined,
      dominio: 'SEGURANCA',
      ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
    };

    const [
      totalSecurityAudits,
      securityAuditsByAction,
      recentSecurityAudits,
    ] = await Promise.all([
      prisma.logAuditoria.count({
        where: securityAuditWhere,
      }),
      prisma.logAuditoria.groupBy({
        by: ['acao'],
        where: securityAuditWhere,
        _count: true,
      }),
      prisma.logAuditoria.findMany({
        where: securityAuditWhere,
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          acao: true,
          entidade: true,
          userEmail: true,
          userNome: true,
          ipOrigem: true,
          createdAt: true,
          observacao: true,
        },
      }),
    ]);

    // Processar tentativas por dia
    const byDayMap = new Map<string, number>();
    loginAttemptsByDay.forEach((attempt: any) => {
      if (attempt.lastAttemptAt) {
        const date = new Date(attempt.lastAttemptAt).toISOString().split('T')[0];
        byDayMap.set(date, (byDayMap.get(date) || 0) + 1);
      }
    });
    const byDay = Array.from(byDayMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 7);

    res.json({
      loginAttempts: {
        total: totalLoginAttempts,
        blocked: blockedAccounts,
        recentFailed: recentFailedAttempts,
        byDay: byDay,
      },
      passwordResets: {
        total: totalPasswordResets,
        used: usedPasswordResets,
        pending: pendingPasswordResets,
      },
      securityAudits: {
        total: totalSecurityAudits,
        byAction: securityAuditsByAction.map((item) => ({
          acao: item.acao,
          quantidade: item._count,
        })),
        recent: recentSecurityAudits,
      },
    });
  } catch (error) {
    next(error);
  }
};

