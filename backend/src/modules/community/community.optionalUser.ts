import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { getJwtSecret } from '../../lib/jwtSecrets.js';
import type { JwtPayload } from '../../middlewares/auth.js';
import prisma from '../../lib/prisma.js';
import { UserRole } from '@prisma/client';

/**
 * Anexa req.user se o Bearer JWT for válido; não falha nem corre validateTenantDomain.
 * Usado só no diretório Comunidade (ex.: indicador "a seguir").
 */
export async function attachCommunityViewer(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      next();
      return;
    }
    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, getJwtSecret()) as JwtPayload;
    const userId = decoded.sub || decoded.userId;
    if (!userId || !decoded.email) {
      next();
      return;
    }
    let roles: UserRole[] = Array.isArray(decoded.roles) && decoded.roles.length ? decoded.roles : [];
    if (!roles.length) {
      const userRoles = await prisma.userRole_.findMany({
        where: { userId },
        select: { role: true },
      });
      roles = userRoles.map((r) => r.role);
    }
    const rawInst = decoded.instituicaoId;
    const instituicaoId =
      typeof rawInst === 'string' && rawInst.trim() ? rawInst.trim() : null;

    req.user = {
      userId,
      email: decoded.email,
      instituicaoId,
      roles,
      tipoAcademico: decoded.tipoAcademico ?? null,
      professorId: decoded.professorId ?? null,
    };
    next();
  } catch {
    next();
  }
}
