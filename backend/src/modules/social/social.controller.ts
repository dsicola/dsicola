import { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../middlewares/auth.js';
import { SocialPostReactionType } from '@prisma/client';
import { AppError } from '../../middlewares/errorHandler.js';
import type { SocialPostContactInput } from '../../utils/socialPostContactMedia.js';
import * as social from './social.service.js';

function contactFieldsFromRequest(body: Record<string, unknown>): SocialPostContactInput {
  const out: SocialPostContactInput = {};
  if ('contactWhatsappShow' in body) out.contactWhatsappShow = Boolean(body.contactWhatsappShow);
  if ('contactWhatsapp' in body)
    out.contactWhatsapp =
      typeof body.contactWhatsapp === 'string' ? body.contactWhatsapp : String(body.contactWhatsapp ?? '');
  if ('contactLocationShow' in body) out.contactLocationShow = Boolean(body.contactLocationShow);
  if ('contactLocation' in body)
    out.contactLocation =
      typeof body.contactLocation === 'string' ? body.contactLocation : String(body.contactLocation ?? '');
  if ('contactVideoShow' in body) out.contactVideoShow = Boolean(body.contactVideoShow);
  if ('contactVideoUrl' in body)
    out.contactVideoUrl =
      typeof body.contactVideoUrl === 'string' ? body.contactVideoUrl : String(body.contactVideoUrl ?? '');
  return out;
}

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function viewer(req: AuthenticatedRequest) {
  const u = req.user;
  if (!u) throw new AppError('Não autenticado.', 401);
  return { userId: u.userId, instituicaoId: u.instituicaoId, roles: u.roles };
}

export async function getPublicFeed(req: Request, res: Response, next: NextFunction) {
  try {
    const instId =
      typeof req.query.instituicaoId === 'string' && req.query.instituicaoId.trim()
        ? req.query.instituicaoId.trim()
        : undefined;
    if (instId && !UUID_V4_REGEX.test(instId)) {
      throw new AppError('Parâmetro instituicaoId inválido.', 400);
    }
    const ic = req.query.includeComments;
    const includeComments = ic === '1' || ic === 'true';
    const data = await social.listPublicFeed({
      page: req.query.page,
      pageSize: req.query.pageSize,
      instituicaoId: instId,
      includeComments,
      commentsPerPost: req.query.commentsPerPost,
    });
    res.json(data);
  } catch (e) {
    next(e);
  }
}

export async function getPublicPost(req: Request, res: Response, next: NextFunction) {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    if (!id || !UUID_V4_REGEX.test(id)) {
      throw new AppError('Identificador de publicação inválido.', 400);
    }
    const post = await social.getPublicPostById(id);
    res.json(post);
  } catch (e) {
    next(e);
  }
}

export async function getFeed(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const groupId =
      typeof req.query.groupId === 'string' && req.query.groupId.trim() ? req.query.groupId.trim() : undefined;
    const data = await social.listFeed(viewer(req), {
      page: req.query.page,
      pageSize: req.query.pageSize,
      groupId,
    });
    res.json(data);
  } catch (e) {
    next(e);
  }
}

export async function getFeedOverview(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await social.listFeedOverview(viewer(req));
    res.json(data);
  } catch (e) {
    next(e);
  }
}

/** Alias REST: mesma ordenação por score que o feed */
export async function listPosts(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  return getFeed(req, res, next);
}

export async function getPost(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const post = await social.getPostById(req.params.id, viewer(req));
    res.json(post);
  } catch (e) {
    next(e);
  }
}

export async function postCreate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const raw = (req.body || {}) as Record<string, unknown>;
    const { body, isPublic, instituicaoId, socialGroupId } = raw;
    const post = await social.createPost(viewer(req), {
      body: typeof body === 'string' ? body : String(body ?? ''),
      isPublic: Boolean(isPublic),
      instituicaoId: typeof instituicaoId === 'string' ? instituicaoId : undefined,
      socialGroupId:
        socialGroupId === null || socialGroupId === ''
          ? null
          : typeof socialGroupId === 'string'
            ? socialGroupId
            : undefined,
      ...contactFieldsFromRequest(raw),
    });
    res.status(201).json(post);
  } catch (e) {
    next(e);
  }
}

export async function postUpdate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const raw = (req.body || {}) as Record<string, unknown>;
    const { body, isPublic } = raw;
    const patch: { body?: string; isPublic?: boolean } & SocialPostContactInput = {
      ...contactFieldsFromRequest(raw),
    };
    if (body !== undefined) patch.body = typeof body === 'string' ? body : String(body);
    if (isPublic !== undefined) patch.isPublic = Boolean(isPublic);
    const contactKeys: (keyof SocialPostContactInput)[] = [
      'contactWhatsappShow',
      'contactWhatsapp',
      'contactLocationShow',
      'contactLocation',
      'contactVideoShow',
      'contactVideoUrl',
    ];
    const hasContact = contactKeys.some((k) => k in raw);
    if (patch.body === undefined && patch.isPublic === undefined && !hasContact) {
      throw new AppError('Nada para atualizar.', 400);
    }
    const post = await social.updatePost(req.params.id, viewer(req), patch);
    res.json(post);
  } catch (e) {
    next(e);
  }
}

export async function postDelete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const out = await social.deletePost(req.params.id, viewer(req));
    res.json(out);
  } catch (e) {
    next(e);
  }
}

export async function getComments(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const list = await social.listComments(req.params.id, viewer(req));
    res.json(list);
  } catch (e) {
    next(e);
  }
}

export async function postComment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { body } = req.body || {};
    const c = await social.createComment(
      req.params.id,
      viewer(req),
      typeof body === 'string' ? body : String(body ?? ''),
    );
    res.status(201).json(c);
  } catch (e) {
    next(e);
  }
}

export async function patchComment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { body } = req.body || {};
    const c = await social.updateComment(
      req.params.commentId,
      viewer(req),
      typeof body === 'string' ? body : String(body ?? ''),
    );
    res.json(c);
  } catch (e) {
    next(e);
  }
}

export async function deleteComment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const out = await social.deleteComment(req.params.commentId, viewer(req));
    res.json(out);
  } catch (e) {
    next(e);
  }
}

function parseReactionType(raw: unknown): SocialPostReactionType {
  const t = String(raw || '').toUpperCase();
  if (t === 'LIKE' || t === 'LOVE' || t === 'EDUCATIONAL') return t as SocialPostReactionType;
  throw new AppError('Tipo de reação inválido. Use LIKE, LOVE ou EDUCATIONAL.', 400);
}

export async function putReaction(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const type = parseReactionType(req.body?.type);
    const r = await social.upsertReaction(req.params.id, viewer(req), type);
    res.json(r);
  } catch (e) {
    next(e);
  }
}

export async function deleteReaction(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const out = await social.removeReaction(req.params.id, viewer(req));
    res.json(out);
  } catch (e) {
    next(e);
  }
}

export async function postView(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const out = await social.registerView(req.params.id, viewer(req));
    res.json(out);
  } catch (e) {
    next(e);
  }
}

export async function follow(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const out = await social.followUser(req.params.userId, viewer(req));
    res.status(201).json(out);
  } catch (e) {
    next(e);
  }
}

export async function unfollow(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const out = await social.unfollowUser(req.params.userId, viewer(req));
    res.json(out);
  } catch (e) {
    next(e);
  }
}

export async function getGroups(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const list = await social.listGroups(viewer(req));
    res.json(list);
  } catch (e) {
    next(e);
  }
}

export async function postGroup(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { name, description } = req.body || {};
    const g = await social.createGroup(viewer(req), {
      name: typeof name === 'string' ? name : String(name ?? ''),
      description: typeof description === 'string' ? description : undefined,
    });
    res.status(201).json(g);
  } catch (e) {
    next(e);
  }
}

export async function postJoinGroup(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const out = await social.joinGroup(viewer(req), req.params.id);
    res.status(201).json(out);
  } catch (e) {
    next(e);
  }
}

export async function postLeaveGroup(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const out = await social.leaveGroup(viewer(req), req.params.id);
    res.json(out);
  } catch (e) {
    next(e);
  }
}
