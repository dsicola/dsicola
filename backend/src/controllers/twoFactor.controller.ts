import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../middlewares/errorHandler.js';
import { requireTenantScope } from '../middlewares/auth.js';
import twoFactorService from '../services/twoFactor.service.js';
import prisma from '../lib/prisma.js';

/**
 * Gerar secret e QR code para setup de 2FA
 * POST /2fa/setup
 */
export const setupTwoFactor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Usuário não autenticado', 401);
    }

    // Buscar dados do usuário
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        instituicao: { select: { nome: true } },
        roles: { select: { role: true } }
      }
    });

    if (!user) {
      throw new AppError('Usuário não encontrado', 404);
    }

    // Verificar se é ADMIN
    const isAdmin = user.roles.some(r => r.role === 'ADMIN' || r.role === 'SUPER_ADMIN');
    if (!isAdmin) {
      throw new AppError('2FA está disponível apenas para administradores', 403);
    }

    // Gerar secret e QR code
    const result = await twoFactorService.generateSecret(
      userId,
      user.email,
      user.instituicao?.nome || undefined
    );

    res.json({
      secret: result.secret,
      qrCode: result.qrCode,
      otpauthUrl: result.otpauthUrl
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verificar código e ativar 2FA
 * POST /2fa/verify
 */
export const verifyAndEnable = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      token: z.string().regex(/^\d{6}$/, 'Token deve ter 6 dígitos'),
      secret: z.string().min(1, 'Secret é obrigatório')
    });

    const { token, secret } = schema.parse(req.body);
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('Usuário não autenticado', 401);
    }

    await twoFactorService.verifyAndEnable(userId, token, secret, req);

    res.json({
      message: '2FA ativado com sucesso',
      twoFactorEnabled: true
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Desativar 2FA
 * POST /2fa/disable
 */
export const disableTwoFactor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Usuário não autenticado', 401);
    }

    await twoFactorService.disable(userId, req);

    res.json({
      message: '2FA desativado com sucesso',
      twoFactorEnabled: false
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Resetar 2FA (apenas ADMIN/SUPER_ADMIN)
 * POST /2fa/reset
 */
export const resetTwoFactor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      userId: z.string().uuid('userId deve ser um UUID válido')
    });

    const { userId } = schema.parse(req.body);
    const requestedBy = req.user?.userId;

    if (!requestedBy) {
      throw new AppError('Usuário não autenticado', 401);
    }

    await twoFactorService.reset(userId, requestedBy, req);

    res.json({
      message: '2FA resetado com sucesso'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verificar status de 2FA do usuário
 * GET /2fa/status
 */
export const getTwoFactorStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Usuário não autenticado', 401);
    }

    const isEnabled = await twoFactorService.isEnabled(userId);

    res.json({
      twoFactorEnabled: isEnabled
    });
  } catch (error) {
    next(error);
  }
};
