import { Response, NextFunction } from 'express';
import type { Request } from 'express';
import type { AuthenticatedRequest } from '../../middlewares/auth.js';
import { AppError } from '../../middlewares/errorHandler.js';
import * as community from './community.service.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireUuid(raw: string, label: string): string {
  const t = raw.trim();
  if (!UUID_RE.test(t)) throw new AppError(`${label} inválido.`, 400);
  return t;
}

export async function listInstitutions(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await community.listInstitutions({
      page: req.query.page,
      pageSize: req.query.pageSize,
      cidade: req.query.cidade,
      tipoAcademico: req.query.tipoAcademico,
      tipoInstituicao: req.query.tipoInstituicao,
      curso: req.query.curso,
    });
    res.json(data);
  } catch (e) {
    next(e);
  }
}

export async function getInstitution(req: Request, res: Response, next: NextFunction) {
  try {
    const id = requireUuid(String(req.params.id || ''), 'Identificador');
    const viewerUserId = req.user?.userId;
    const data = await community.getInstitutionPublic(id, viewerUserId);
    res.json(data);
  } catch (e) {
    next(e);
  }
}

export async function listCourses(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await community.listCourses({
      page: req.query.page,
      pageSize: req.query.pageSize,
      instituicaoId: req.query.instituicaoId,
      search: req.query.search,
    });
    res.json(data);
  } catch (e) {
    next(e);
  }
}

export async function follow(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const uid = req.user?.userId;
    if (!uid) throw new AppError('Não autenticado.', 401);
    const instituicaoId = req.body?.instituicaoId;
    if (typeof instituicaoId !== 'string' || !instituicaoId.trim()) {
      throw new AppError('instituicaoId é obrigatório.', 400);
    }
    const data = await community.followInstitution(uid, requireUuid(instituicaoId, 'instituicaoId'));
    res.json(data);
  } catch (e) {
    next(e);
  }
}

export async function unfollow(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const uid = req.user?.userId;
    if (!uid) throw new AppError('Não autenticado.', 401);
    const instituicaoId = requireUuid(String(req.params.instituicaoId || ''), 'instituicaoId');
    const data = await community.unfollowInstitution(uid, instituicaoId);
    res.json(data);
  } catch (e) {
    next(e);
  }
}
