import { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../middlewares/auth.js';
import { AppError } from '../../middlewares/errorHandler.js';
import { CommunityAdScope } from '@prisma/client';
import * as service from './communityAd.service.js';

const SCOPES = new Set(Object.values(CommunityAdScope));

function parseScope(raw: unknown): CommunityAdScope {
  const s = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  if (!SCOPES.has(s as CommunityAdScope)) {
    throw new AppError(
      `Âmbito inválido. Use: ${[...SCOPES].join(', ')}.`,
      400,
    );
  }
  return s as CommunityAdScope;
}

/** ADMIN/DIRECAO/SUPER_ADMIN com tenant: rotas da instituição. */
function requireInstituicaoId(req: AuthenticatedRequest): string {
  const id = req.user?.instituicaoId;
  if (!id?.trim()) {
    throw new AppError(
      'Esta área é para gestores com instituição associada. Super Admin: use o painel global para analisar pedidos.',
      403,
    );
  }
  return id.trim();
}

export async function listMine(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const instituicaoId = requireInstituicaoId(req);
    const [summary, bookings] = await Promise.all([
      service.getMyActiveSummary(instituicaoId),
      service.listBookingsForInstituicao(instituicaoId),
    ]);
    res.json({ summary, bookings });
  } catch (e) {
    next(e);
  }
}

export async function create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const instituicaoId = requireInstituicaoId(req);
    const b = req.body || {};
    const scope = parseScope(b.scope);
    const created = await service.createBooking(instituicaoId, {
      scope,
      duracaoDiasSolicitada: b.duracaoDiasSolicitada,
      valorPagoDeclarado: b.valorPagoDeclarado,
      comprovativoUrl: typeof b.comprovativoUrl === 'string' ? b.comprovativoUrl : null,
      referenciaPagamento: typeof b.referenciaPagamento === 'string' ? b.referenciaPagamento : null,
      notasInstituicao: typeof b.notasInstituicao === 'string' ? b.notasInstituicao : null,
      socialPostId: typeof b.socialPostId === 'string' ? b.socialPostId : null,
    });
    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
}

/**
 * Corpo: { comprovativoUrl: string } — URL obtida após upload no bucket `comprovativos` (ou URL externa).
 */
export async function attachComprovativo(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const instituicaoId = requireInstituicaoId(req);
    const id = String(req.params.id || '').trim();
    if (!id) throw new AppError('Identificador obrigatório.', 400);
    const raw = req.body?.comprovativoUrl;
    if (typeof raw !== 'string' || !raw.trim()) {
      throw new AppError('comprovativoUrl é obrigatório.', 400);
    }
    const updated = await service.attachComprovativo(instituicaoId, id, raw);
    res.json(updated);
  } catch (e) {
    next(e);
  }
}

export async function cancelMine(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const instituicaoId = requireInstituicaoId(req);
    const id = String(req.params.id || '').trim();
    if (!id) throw new AppError('Identificador obrigatório.', 400);
    const out = await service.cancelPendingBooking(instituicaoId, id);
    res.json(out);
  } catch (e) {
    next(e);
  }
}

export async function superList(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await service.superListBookings({
      status: typeof req.query.status === 'string' ? req.query.status : null,
      page: req.query.page,
      pageSize: req.query.pageSize,
    });
    res.json(data);
  } catch (e) {
    next(e);
  }
}

export async function superReview(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const adminUserId = req.user?.userId;
    if (!adminUserId) throw new AppError('Sessão inválida.', 401);
    const id = String(req.params.id || '').trim();
    if (!id) throw new AppError('Identificador obrigatório.', 400);
    const b = req.body || {};
    const action = String(b.action || '').trim().toUpperCase();
    if (action !== 'APROVAR' && action !== 'REJEITAR') {
      throw new AppError('Ação deve ser APROVAR ou REJEITAR.', 400);
    }
    const updated = await service.superReviewBooking(id, adminUserId, {
      action,
      pagamentoVerificado: Boolean(b.pagamentoVerificado),
      startsAtIso: typeof b.startsAtIso === 'string' ? b.startsAtIso : null,
      duracaoDiasEfetiva:
        b.duracaoDiasEfetiva != null ? Number(b.duracaoDiasEfetiva) : null,
      motivoRejeicao: typeof b.motivoRejeicao === 'string' ? b.motivoRejeicao : null,
      notasInternasAdmin: typeof b.notasInternasAdmin === 'string' ? b.notasInternasAdmin : null,
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
}
