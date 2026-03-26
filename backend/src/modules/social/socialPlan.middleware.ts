import { Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import type { AuthenticatedRequest } from '../../middlewares/auth.js';
import { validatePlanFuncionalidade } from '../../services/planFeatures.service.js';

const PLANO_COMUNIDADE = 'comunidade';

/** Equipa da instituição: API Social alinhada ao gate no front (moderar/publicar sem exigir flag `comunidade` no plano). */
const SOCIAL_STAFF_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.DIRECAO,
  UserRole.COORDENADOR,
  UserRole.SECRETARIA,
  UserRole.PROFESSOR,
  UserRole.RH,
  UserRole.FINANCEIRO,
  UserRole.POS,
  UserRole.AUDITOR,
];

/**
 * Staff de plataforma (sem vínculo académico ao plano da escola) acede sem validar plano.
 * Staff da instituição (ADMIN, secretaria, etc.) acede sem validar `comunidade`; ALUNO/RESPONSAVEL exigem o plano.
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
    if (u.roles.some((r) => SOCIAL_STAFF_ROLES.includes(r))) {
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
