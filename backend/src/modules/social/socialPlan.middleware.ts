import { Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import type { AuthenticatedRequest } from '../../middlewares/auth.js';
import { validatePlanFuncionalidade } from '../../services/planFeatures.service.js';

const PLANO_COMUNIDADE = 'comunidade';

/**
 * Staff de plataforma (sem vínculo académico ao plano da escola) acede sem validar plano.
 * Utilizadores com instituição precisam da funcionalidade `comunidade` no plano ativo.
 */
export async function requireComunidadePlano(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
) {
  try {
    const u = req.user;
    if (!u) return next();
    if (u.roles.includes(UserRole.SUPER_ADMIN) || u.roles.includes(UserRole.COMERCIAL)) {
      return next();
    }
    const instId = u.instituicaoId;
    if (!instId) {
      return next();
    }
    await validatePlanFuncionalidade(instId, PLANO_COMUNIDADE, false, u.roles as string[]);
    next();
  } catch (e) {
    next(e);
  }
}
