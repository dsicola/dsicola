import { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../middlewares/auth.js';
import { AppError } from '../../middlewares/errorHandler.js';
import * as community from './community.service.js';

function tenantId(req: AuthenticatedRequest): string {
  const id = req.user?.instituicaoId;
  if (!id) throw new AppError('Apenas utilizadores ligados a uma instituição.', 403);
  return id;
}

export async function listCourses(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await community.adminListMyCommunityCourses(tenantId(req));
    res.json({ data });
  } catch (e) {
    next(e);
  }
}

export async function createCourse(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const created = await community.adminCreateCommunityCourse(tenantId(req), req.body || {});
    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
}

export async function updateCourse(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) throw new AppError('ID inválido.', 400);
    const updated = await community.adminUpdateCommunityCourse(tenantId(req), id, req.body || {});
    res.json(updated);
  } catch (e) {
    next(e);
  }
}

export async function deleteCourse(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) throw new AppError('ID inválido.', 400);
    const out = await community.adminDeleteCommunityCourse(tenantId(req), id);
    res.json(out);
  } catch (e) {
    next(e);
  }
}
