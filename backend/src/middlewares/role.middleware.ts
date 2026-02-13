import { Request, Response, NextFunction } from 'express';
import { authorize } from './auth.js';
import { UserRole } from '@prisma/client';
import { AppError } from './errorHandler.js';

/**
 * Middleware para requerer role de SECRETARIA ou superior
 */
export const requireSecretaria = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(new AppError('Não autenticado', 401));
  }

  const allowedRoles: UserRole[] = ['SECRETARIA', 'ADMIN', 'SUPER_ADMIN'];
  const hasRole = req.user.roles.some(role => allowedRoles.includes(role));
  
  if (!hasRole) {
    return next(new AppError('Acesso negado: requer role de SECRETARIA ou superior', 403));
  }

  next();
};

/**
 * Middleware para requerer role de ADMIN ou superior
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(new AppError('Não autenticado', 401));
  }

  const allowedRoles: UserRole[] = ['ADMIN', 'SUPER_ADMIN'];
  const hasRole = req.user.roles.some(role => allowedRoles.includes(role));
  
  if (!hasRole) {
    return next(new AppError('Acesso negado: requer role de ADMIN ou superior', 403));
  }

  next();
};

/**
 * Middleware para requerer role de SUPER_ADMIN
 */
export const requireSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(new AppError('Não autenticado', 401));
  }

  if (!req.user.roles.includes('SUPER_ADMIN')) {
    return next(new AppError('Acesso negado: requer role de SUPER_ADMIN', 403));
  }

  next();
};

