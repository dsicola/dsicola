import prisma from '../../lib/prisma.js';
import type { Prisma, SocialPostReactionType } from '@prisma/client';
import { UserRole } from '@prisma/client';

const INST_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
import { AppError } from '../../middlewares/errorHandler.js';
import { assertInstituicaoPodePublicarNaVitrineComPublicidade } from '../community-ad/communityAd.service.js';
import {
  canModeratePost,
  isPlatformStaff,
  socialPostVisibilityWhere,
  socialPostWhereVitrinePublica,
} from './social.policy.js';
import {
  parseSocialContactVideoUrl,
  socialPostContactForCreate,
  socialPostContactForPatch,
  type SocialPostContactInput,
} from '../../utils/socialPostContactMedia.js';

const STORY_PREVIEW_LEN = 100;

const authorSelect = {
  id: true,
  nomeCompleto: true,
  email: true,
  avatarUrl: true,
  instituicaoId: true,
} as const;

const postInclude = {
  author: { select: authorSelect },
  instituicao: { select: { id: true, nome: true, subdominio: true } },
  group: { select: { id: true, name: true } },
  _count: { select: { comments: true, reactions: true, views: true } },
} as const;

export type Viewer = {
  userId: string;
  instituicaoId: string | null;
  roles: UserRole[];
};

/** Post legível: regras de visibilidade da rede + posts de grupo só para membros. */
function postReadableWhere(viewer: Viewer): Prisma.SocialPostWhereInput {
  const vis = socialPostVisibilityWhere(viewer.instituicaoId, viewer.roles);
  const groupOk: Prisma.SocialPostWhereInput = {
    OR: [
      { socialGroupId: null },
      { group: { members: { some: { userId: viewer.userId } } } },
    ],
  };
  return { AND: [vis, groupOk] };
}

async function assertPostVisible(postId: string, viewer: Viewer) {
  const where = { id: postId, ...postReadableWhere(viewer) };
  const post = await prisma.socialPost.findFirst({ where });
  if (!post) throw new AppError('Publicação não encontrada ou sem permissão.', 404);
  return post;
}

/** Comentários: apenas utilizadores cuja instituição (JWT) é a mesma da publicação. */
function assertViewerMemberOfPostInstitution(viewer: Viewer, postInstituicaoId: string) {
  if (!viewer.instituicaoId || viewer.instituicaoId !== postInstituicaoId) {
    throw new AppError('Só membros da instituição desta publicação podem comentar.', 403);
  }
}

function whatsappPublicHref(raw: string): string {
  const s = raw.trim();
  if (/^https?:\/\//i.test(s)) return s;
  const digits = s.replace(/\D/g, '');
  if (digits.length >= 8) return `https://wa.me/${digits}`;
  return `https://wa.me/${encodeURIComponent(s)}`;
}

function enrichSocialPostForClient<
  T extends {
    contactWhatsappShow: boolean;
    contactWhatsapp: string | null;
    contactLocationShow: boolean;
    contactLocation: string | null;
    contactVideoShow: boolean;
    contactVideoUrl: string | null;
  },
>(post: T) {
  let contactVideoEmbedSrc: string | null = null;
  if (post.contactVideoShow && post.contactVideoUrl) {
    try {
      contactVideoEmbedSrc = parseSocialContactVideoUrl(post.contactVideoUrl).embedSrc;
    } catch {
      contactVideoEmbedSrc = null;
    }
  }
  const contactWhatsappHref =
    post.contactWhatsappShow && post.contactWhatsapp ? whatsappPublicHref(post.contactWhatsapp) : null;
  return { ...post, contactVideoEmbedSrc, contactWhatsappHref };
}

async function assertGroupMember(viewer: Viewer, groupId: string) {
  if (!viewer.instituicaoId) throw new AppError('Instituição necessária para grupos.', 403);
  const m = await prisma.socialGroupMember.findFirst({
    where: { groupId, userId: viewer.userId, group: { instituicaoId: viewer.instituicaoId } },
  });
  if (!m) throw new AppError('Não é membro deste grupo.', 403);
}

/**
 * Vitrine pública: plano elegível + (se `COMMUNITY_PUBLICIDADE_OBRIGATORIA`) campanha aprovada em vigência.
 * Ver `community-ad/communityAd.config.ts` e `communityAd.service.ts`.
 */
async function assertInstituicaoPodePublicarNaVitrineSocial(instituicaoId: string) {
  await assertInstituicaoPodePublicarNaVitrineComPublicidade(instituicaoId);
}

function parsePagination(pageRaw: unknown, pageSizeRaw: unknown) {
  const page = Math.max(1, parseInt(String(pageRaw || '1'), 10) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(String(pageSizeRaw || '20'), 10) || 20));
  return { page, pageSize, skip: (page - 1) * pageSize };
}

export async function listFeed(
  viewer: Viewer,
  query: { page?: unknown; pageSize?: unknown; groupId?: unknown },
) {
  const { page, pageSize, skip } = parsePagination(query.page, query.pageSize);
  const groupIdRaw =
    typeof query.groupId === 'string' && query.groupId.trim() ? query.groupId.trim() : null;

  let total: number;
  let rows: { id: string }[];

  if (groupIdRaw) {
    if (!viewer.instituicaoId) throw new AppError('Instituição necessária para o feed do grupo.', 403);
    await assertGroupMember(viewer, groupIdRaw);
    const baseWhere: Prisma.SocialPostWhereInput = {
      instituicaoId: viewer.instituicaoId,
      socialGroupId: groupIdRaw,
    };
    total = await prisma.socialPost.count({ where: baseWhere });
    rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT p.id FROM social_posts p
      WHERE p.social_group_id = ${groupIdRaw}::text AND p.instituicao_id = ${viewer.instituicaoId}::text
      ORDER BY (
        p.reaction_count * 2 + p.comment_count * 3 + p.view_count * 1.5
        - (EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600) * 0.5
      ) DESC
      LIMIT ${pageSize} OFFSET ${skip}
    `;
  } else {
    const baseWhere: Prisma.SocialPostWhereInput = {
      AND: [socialPostVisibilityWhere(viewer.instituicaoId, viewer.roles), { socialGroupId: null }],
    };
    total = await prisma.socialPost.count({ where: baseWhere });

    const platformOnly = isPlatformStaff(viewer.roles) && !viewer.instituicaoId;
    rows = platformOnly
      ? await prisma.$queryRaw<{ id: string }[]>`
          SELECT p.id FROM social_posts p
          WHERE p.is_public = true
            AND p.social_group_id IS NULL
            AND EXISTS (
              SELECT 1 FROM instituicoes i
              INNER JOIN assinaturas ass ON ass.instituicao_id = i.id
              WHERE i.id = p.instituicao_id
                AND i.status = 'ativa'
                AND ass.status IN ('ativa', 'teste')
            )
          ORDER BY (
            p.reaction_count * 2 + p.comment_count * 3 + p.view_count * 1.5
            - (EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600) * 0.5
          ) DESC
          LIMIT ${pageSize} OFFSET ${skip}
        `
      : await prisma.$queryRaw<{ id: string }[]>`
          SELECT p.id FROM social_posts p
          WHERE p.social_group_id IS NULL
            AND (
              p.instituicao_id = ${viewer.instituicaoId!}::text
              OR (
                p.is_public = true
                AND EXISTS (
                  SELECT 1 FROM instituicoes i
                  INNER JOIN assinaturas ass ON ass.instituicao_id = i.id
                  WHERE i.id = p.instituicao_id
                    AND i.status = 'ativa'
                    AND ass.status IN ('ativa', 'teste')
                )
              )
            )
          ORDER BY (
            p.reaction_count * 2 + p.comment_count * 3 + p.view_count * 1.5
            - (EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600) * 0.5
          ) DESC
          LIMIT ${pageSize} OFFSET ${skip}
        `;
  }

  const ids = rows.map((r) => r.id);
  if (ids.length === 0) {
    return {
      data: [],
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  const posts = await prisma.socialPost.findMany({
    where: { id: { in: ids } },
    include: postInclude,
  });
  const byId = new Map(posts.map((p) => [p.id, p]));
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean) as typeof posts;

  const reactions = await prisma.socialPostReaction.findMany({
    where: { postId: { in: ids }, userId: viewer.userId },
    select: { postId: true, type: true },
  });
  const myReactionByPost = new Map(reactions.map((r) => [r.postId, r.type]));

  const data = ordered.map((p) =>
    enrichSocialPostForClient({
      ...p,
      myReaction: myReactionByPost.get(p.id) ?? null,
    }),
  );

  return {
    data,
    meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

/** Faixa “ativos” + histórias (posts recentes) acima do feed principal — só feed raiz (sem grupo). */
export async function listFeedOverview(viewer: Viewer) {
  const baseWhere: Prisma.SocialPostWhereInput = {
    AND: [socialPostVisibilityWhere(viewer.instituicaoId, viewer.roles), { socialGroupId: null }],
  };

  if (!viewer.instituicaoId && !isPlatformStaff(viewer.roles)) {
    return {
      activeUsers: [] as Array<{
        id: string;
        nomeCompleto: string;
        avatarUrl: string | null;
        lastAt: string;
      }>,
      stories: [] as Array<{
        id: string;
        bodyPreview: string;
        createdAt: string;
        author: { id: string; nomeCompleto: string; avatarUrl: string | null };
      }>,
    };
  }

  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  type ActiveRow = { author_id: string; last_at: Date };
  let activeRows: ActiveRow[] = [];

  const instId = viewer.instituicaoId;
  const staffPlatform = isPlatformStaff(viewer.roles);

  if (instId && !staffPlatform) {
    activeRows = await prisma.$queryRaw<ActiveRow[]>`
      SELECT p.author_id as author_id, MAX(p.created_at) as last_at
      FROM social_posts p
      WHERE p.social_group_id IS NULL
        AND p.created_at >= ${since}
        AND (
          p.instituicao_id = ${instId}::text
          OR (
            p.is_public = true
            AND EXISTS (
              SELECT 1 FROM instituicoes i
              INNER JOIN assinaturas ass ON ass.instituicao_id = i.id
              WHERE i.id = p.instituicao_id
                AND i.status = 'ativa'
                AND ass.status IN ('ativa', 'teste')
            )
          )
        )
      GROUP BY p.author_id
      ORDER BY MAX(p.created_at) DESC
      LIMIT 18
    `;
  } else if (staffPlatform && !instId) {
    activeRows = await prisma.$queryRaw<ActiveRow[]>`
      SELECT p.author_id as author_id, MAX(p.created_at) as last_at
      FROM social_posts p
      WHERE p.social_group_id IS NULL
        AND p.is_public = true
        AND p.created_at >= ${since}
        AND EXISTS (
          SELECT 1 FROM instituicoes i
          INNER JOIN assinaturas ass ON ass.instituicao_id = i.id
          WHERE i.id = p.instituicao_id
            AND i.status = 'ativa'
            AND ass.status IN ('ativa', 'teste')
        )
      GROUP BY p.author_id
      ORDER BY MAX(p.created_at) DESC
      LIMIT 18
    `;
  } else if (instId && staffPlatform) {
    activeRows = await prisma.$queryRaw<ActiveRow[]>`
      SELECT p.author_id as author_id, MAX(p.created_at) as last_at
      FROM social_posts p
      WHERE p.social_group_id IS NULL
        AND p.created_at >= ${since}
        AND (
          p.instituicao_id = ${instId}::text
          OR (
            p.is_public = true
            AND EXISTS (
              SELECT 1 FROM instituicoes i
              INNER JOIN assinaturas ass ON ass.instituicao_id = i.id
              WHERE i.id = p.instituicao_id
                AND i.status = 'ativa'
                AND ass.status IN ('ativa', 'teste')
            )
          )
        )
      GROUP BY p.author_id
      ORDER BY MAX(p.created_at) DESC
      LIMIT 18
    `;
  }

  const authorIds = activeRows.map((r) => r.author_id);
  const users =
    authorIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: authorIds } },
          select: { id: true, nomeCompleto: true, avatarUrl: true },
        })
      : [];
  const userById = new Map(users.map((u) => [u.id, u]));
  const lastAtByAuthor = new Map(activeRows.map((r) => [r.author_id, r.last_at]));

  const activeUsers = authorIds
    .map((id) => {
      const u = userById.get(id);
      if (!u) return null;
      const lastAt = lastAtByAuthor.get(id);
      return {
        id: u.id,
        nomeCompleto: u.nomeCompleto,
        avatarUrl: u.avatarUrl,
        lastAt: lastAt?.toISOString() ?? new Date().toISOString(),
      };
    })
    .filter(Boolean) as Array<{
    id: string;
    nomeCompleto: string;
    avatarUrl: string | null;
    lastAt: string;
  }>;

  const storyPosts = await prisma.socialPost.findMany({
    where: baseWhere,
    orderBy: { createdAt: 'desc' },
    take: 14,
    select: {
      id: true,
      body: true,
      createdAt: true,
      author: { select: { id: true, nomeCompleto: true, avatarUrl: true } },
    },
  });

  const stories = storyPosts.map((p) => {
    const raw = p.body.replace(/\s+/g, ' ').trim();
    const bodyPreview =
      raw.length > STORY_PREVIEW_LEN ? `${raw.slice(0, STORY_PREVIEW_LEN)}…` : raw;
    return {
      id: p.id,
      bodyPreview,
      createdAt: p.createdAt.toISOString(),
      author: p.author,
    };
  });

  return { activeUsers, stories };
}

export async function getPostById(postId: string, viewer: Viewer) {
  await assertPostVisible(postId, viewer);
  const post = await prisma.socialPost.findFirst({
    where: { id: postId },
    include: {
      ...postInclude,
      comments: {
        orderBy: { createdAt: 'asc' },
        include: { author: { select: authorSelect } },
      },
    },
  });
  const myReaction = await prisma.socialPostReaction.findUnique({
    where: { postId_userId: { postId, userId: viewer.userId } },
  });
  return enrichSocialPostForClient({ ...post!, myReaction: myReaction?.type ?? null });
}

/** SUPER_ADMIN: aceita instituicaoId no corpo (UUID); restantes usam só o JWT. */
function resolveInstituicaoForCreate(viewer: Viewer, bodyInstituicaoId?: string): string {
  if (viewer.instituicaoId) return viewer.instituicaoId;
  if (viewer.roles.includes(UserRole.SUPER_ADMIN) && bodyInstituicaoId?.trim()) {
    const id = bodyInstituicaoId.trim();
    if (!INST_UUID.test(id)) throw new AppError('instituicaoId inválido.', 400);
    return id;
  }
  throw new AppError('Instituição necessária para criar publicação.', 403);
}

export async function createPost(
  viewer: Viewer,
  input: {
    body: string;
    isPublic?: boolean;
    instituicaoId?: string;
    socialGroupId?: string | null;
  } & SocialPostContactInput,
) {
  const instituicaoId = resolveInstituicaoForCreate(viewer, input.instituicaoId);
  const body = (input.body || '').trim();
  if (!body) throw new AppError('Texto da publicação é obrigatório.', 400);
  if (body.length > 20000) throw new AppError('Texto demasiado longo (máx. 20000 caracteres).', 400);

  if (viewer.instituicaoId && instituicaoId !== viewer.instituicaoId) {
    throw new AppError('Não pode publicar noutra instituição.', 403);
  }

  let socialGroupId: string | null = null;
  if (input.socialGroupId != null && String(input.socialGroupId).trim()) {
    if (!viewer.instituicaoId) throw new AppError('Grupo só com conta de instituição.', 403);
    socialGroupId = String(input.socialGroupId).trim();
    await assertGroupMember(viewer, socialGroupId);
    const g = await prisma.socialGroup.findFirst({
      where: { id: socialGroupId, instituicaoId },
    });
    if (!g) throw new AppError('Grupo inválido.', 400);
  }

  const isPublic = socialGroupId ? false : Boolean(input.isPublic);
  if (isPublic) {
    await assertInstituicaoPodePublicarNaVitrineSocial(instituicaoId);
  }

  const contact = socialPostContactForCreate(input);
  const post = await prisma.socialPost.create({
    data: {
      instituicaoId,
      authorId: viewer.userId,
      body,
      isPublic,
      socialGroupId,
      ...contact,
    },
    include: postInclude,
  });
  return enrichSocialPostForClient({ ...post, myReaction: null as null });
}

export async function updatePost(
  postId: string,
  viewer: Viewer,
  input: { body?: string; isPublic?: boolean } & SocialPostContactInput,
) {
  const post = await assertPostVisible(postId, viewer);
  const isAuthor = post.authorId === viewer.userId;
  const isMod = canModeratePost(viewer.roles, post.instituicaoId, viewer.instituicaoId);
  if (!isAuthor && !isMod) throw new AppError('Sem permissão para editar.', 403);

  const data: Prisma.SocialPostUpdateInput = {};
  if (input.body !== undefined) {
    const b = input.body.trim();
    if (!b) throw new AppError('Texto não pode ser vazio.', 400);
    if (b.length > 20000) throw new AppError('Texto demasiado longo.', 400);
    data.body = b;
  }
  if (input.isPublic !== undefined && (isAuthor || isMod)) {
    if (post.socialGroupId && input.isPublic) {
      throw new AppError('Publicações de grupo não podem ser marcadas como públicas na vitrine.', 400);
    }
    if (input.isPublic === true) {
      await assertInstituicaoPodePublicarNaVitrineSocial(post.instituicaoId);
    }
    data.isPublic = input.isPublic;
  }

  const contactKeys: (keyof SocialPostContactInput)[] = [
    'contactWhatsappShow',
    'contactWhatsapp',
    'contactLocationShow',
    'contactLocation',
    'contactVideoShow',
    'contactVideoUrl',
  ];
  const hasContact = contactKeys.some((k) => input[k] !== undefined);
  if (hasContact) {
    Object.assign(data, socialPostContactForPatch(input));
  }

  if (Object.keys(data).length === 0) {
    throw new AppError('Nada para atualizar.', 400);
  }

  const updated = await prisma.socialPost.update({
    where: { id: postId },
    data,
    include: postInclude,
  });
  const myR = await prisma.socialPostReaction.findUnique({
    where: { postId_userId: { postId, userId: viewer.userId } },
  });
  return enrichSocialPostForClient({ ...updated, myReaction: myR?.type ?? null });
}

export async function deletePost(postId: string, viewer: Viewer) {
  const post = await assertPostVisible(postId, viewer);
  const isAuthor = post.authorId === viewer.userId;
  const isMod = canModeratePost(viewer.roles, post.instituicaoId, viewer.instituicaoId);
  if (!isAuthor && !isMod) throw new AppError('Sem permissão para eliminar.', 403);
  await prisma.socialPost.delete({ where: { id: postId } });
  return { ok: true };
}

export async function listComments(postId: string, viewer: Viewer) {
  await assertPostVisible(postId, viewer);
  return prisma.socialComment.findMany({
    where: { postId },
    orderBy: { createdAt: 'asc' },
    include: { author: { select: authorSelect } },
  });
}

export async function createComment(postId: string, viewer: Viewer, body: string) {
  const visible = await assertPostVisible(postId, viewer);
  assertViewerMemberOfPostInstitution(viewer, visible.instituicaoId);
  const b = (body || '').trim();
  if (!b) throw new AppError('Comentário vazio.', 400);
  if (b.length > 10000) throw new AppError('Comentário demasiado longo.', 400);

  const comment = await prisma.$transaction(async (tx) => {
    const c = await tx.socialComment.create({
      data: { postId, authorId: viewer.userId, body: b },
      include: { author: { select: authorSelect } },
    });
    await tx.socialPost.update({
      where: { id: postId },
      data: { commentCount: { increment: 1 } },
    });
    return c;
  });
  return comment;
}

export async function updateComment(commentId: string, viewer: Viewer, body: string) {
  const comment = await prisma.socialComment.findUnique({ where: { id: commentId } });
  if (!comment) throw new AppError('Comentário não encontrado.', 404);
  await assertPostVisible(comment.postId, viewer);
  const post = await prisma.socialPost.findUnique({ where: { id: comment.postId } });
  if (!post) throw new AppError('Publicação não encontrada.', 404);
  assertViewerMemberOfPostInstitution(viewer, post.instituicaoId);
  const isAuthor = comment.authorId === viewer.userId;
  const isMod = canModeratePost(viewer.roles, post.instituicaoId, viewer.instituicaoId);
  if (!isAuthor && !isMod) throw new AppError('Sem permissão.', 403);

  const b = (body || '').trim();
  if (!b) throw new AppError('Comentário vazio.', 400);
  return prisma.socialComment.update({
    where: { id: commentId },
    data: { body: b },
    include: { author: { select: authorSelect } },
  });
}

export async function deleteComment(commentId: string, viewer: Viewer) {
  const comment = await prisma.socialComment.findUnique({ where: { id: commentId } });
  if (!comment) throw new AppError('Comentário não encontrado.', 404);
  await assertPostVisible(comment.postId, viewer);
  const post = await prisma.socialPost.findUnique({ where: { id: comment.postId } });
  if (!post) throw new AppError('Publicação não encontrada.', 404);
  assertViewerMemberOfPostInstitution(viewer, post.instituicaoId);
  const isAuthor = comment.authorId === viewer.userId;
  const isMod = canModeratePost(viewer.roles, post.instituicaoId, viewer.instituicaoId);
  if (!isAuthor && !isMod) throw new AppError('Sem permissão.', 403);

  await prisma.$transaction([
    prisma.socialComment.delete({ where: { id: commentId } }),
    prisma.socialPost.update({
      where: { id: comment.postId },
      data: { commentCount: { decrement: 1 } },
    }),
  ]);
  return { ok: true };
}

export async function upsertReaction(postId: string, viewer: Viewer, type: SocialPostReactionType) {
  await assertPostVisible(postId, viewer);
  const existing = await prisma.socialPostReaction.findUnique({
    where: { postId_userId: { postId, userId: viewer.userId } },
  });

  if (existing && existing.type === type) {
    return prisma.socialPostReaction.findFirst({
      where: { postId, userId: viewer.userId },
    });
  }

  return prisma.$transaction(async (tx) => {
    if (existing && existing.type !== type) {
      await tx.socialPostReaction.update({
        where: { id: existing.id },
        data: { type },
      });
    } else if (!existing) {
      await tx.socialPostReaction.create({
        data: { postId, userId: viewer.userId, type },
      });
      await tx.socialPost.update({
        where: { id: postId },
        data: { reactionCount: { increment: 1 } },
      });
    }
    return tx.socialPostReaction.findFirst({
      where: { postId, userId: viewer.userId },
    });
  });
}

export async function removeReaction(postId: string, viewer: Viewer) {
  await assertPostVisible(postId, viewer);
  const existing = await prisma.socialPostReaction.findUnique({
    where: { postId_userId: { postId, userId: viewer.userId } },
  });
  if (!existing) return { ok: true };

  await prisma.$transaction([
    prisma.socialPostReaction.delete({ where: { id: existing.id } }),
    prisma.socialPost.update({
      where: { id: postId },
      data: { reactionCount: { decrement: 1 } },
    }),
  ]);
  return { ok: true };
}

export async function registerView(postId: string, viewer: Viewer) {
  await assertPostVisible(postId, viewer);
  const created = await prisma.socialPostView.createMany({
    data: [{ postId, userId: viewer.userId }],
    skipDuplicates: true,
  });
  if (created.count > 0) {
    await prisma.socialPost.update({
      where: { id: postId },
      data: { viewCount: { increment: 1 } },
    });
  }
  return { ok: true };
}

async function assertSameInstitution(aId: string, bId: string) {
  const [a, b] = await Promise.all([
    prisma.user.findUnique({ where: { id: aId }, select: { instituicaoId: true } }),
    prisma.user.findUnique({ where: { id: bId }, select: { instituicaoId: true } }),
  ]);
  if (!a?.instituicaoId || !b?.instituicaoId || a.instituicaoId !== b.instituicaoId) {
    throw new AppError('Só pode seguir utilizadores da mesma instituição.', 403);
  }
}

export async function followUser(targetUserId: string, viewer: Viewer) {
  if (targetUserId === viewer.userId) throw new AppError('Não pode seguir a si próprio.', 400);
  if (!viewer.instituicaoId) throw new AppError('Instituição necessária para seguir utilizadores.', 403);
  await assertSameInstitution(viewer.userId, targetUserId);

  await prisma.socialUserFollow.upsert({
    where: {
      followerId_followingId: { followerId: viewer.userId, followingId: targetUserId },
    },
    create: { followerId: viewer.userId, followingId: targetUserId },
    update: {},
  });
  return { ok: true };
}

export async function unfollowUser(targetUserId: string, viewer: Viewer) {
  await prisma.socialUserFollow.deleteMany({
    where: { followerId: viewer.userId, followingId: targetUserId },
  });
  return { ok: true };
}

/** Campos expostos na API pública (sem emails nem IDs de utilizador). */
const publicPostSelect = {
  id: true,
  body: true,
  createdAt: true,
  reactionCount: true,
  commentCount: true,
  viewCount: true,
  contactWhatsappShow: true,
  contactWhatsapp: true,
  contactLocationShow: true,
  contactLocation: true,
  contactVideoShow: true,
  contactVideoUrl: true,
  author: { select: { nomeCompleto: true } },
  instituicao: { select: { nome: true, subdominio: true } },
} as const;

function parsePublicPagination(pageRaw: unknown, pageSizeRaw: unknown) {
  const page = Math.max(1, parseInt(String(pageRaw || '1'), 10) || 1);
  const pageSize = Math.min(24, Math.max(1, parseInt(String(pageSizeRaw || '12'), 10) || 12));
  return { page, pageSize, skip: (page - 1) * pageSize };
}

const publicCommentSelect = {
  id: true,
  postId: true,
  body: true,
  createdAt: true,
  author: { select: { nomeCompleto: true } },
} as const;

/** Feed apenas de posts marcados como públicos, instituições ativas (landing dsicola.com). */
export async function listPublicFeed(query: {
  page?: unknown;
  pageSize?: unknown;
  instituicaoId?: string;
  /** Incluir comentários (leitura pública) nos posts — vitrine dsicola.com / página da escola. */
  includeComments?: boolean;
  commentsPerPost?: unknown;
}) {
  const { page, pageSize, skip } = parsePublicPagination(query.page, query.pageSize);
  const where = socialPostWhereVitrinePublica(query.instituicaoId ?? null);
  const total = await prisma.socialPost.count({ where });
  const rows = await prisma.socialPost.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip,
    take: pageSize,
    select: publicPostSelect,
  });

  let data;

  if (query.includeComments && rows.length > 0) {
    const postIds = rows.map((r) => r.id);
    const perPost = Math.min(80, Math.max(1, parseInt(String(query.commentsPerPost ?? 40), 10) || 40));
    const byPost = new Map<
      string,
      Array<{
        id: string;
        postId: string;
        body: string;
        createdAt: Date;
        author: { nomeCompleto: string };
      }>
    >();
    for (const postId of postIds) {
      const comments = await prisma.socialComment.findMany({
        where: {
          postId,
          post: socialPostWhereVitrinePublica(),
        },
        select: publicCommentSelect,
        orderBy: { createdAt: 'asc' },
        take: perPost,
      });
      byPost.set(postId, comments);
    }
    data = rows.map((p) =>
      enrichSocialPostForClient({
        ...p,
        comments: byPost.get(p.id) ?? [],
      }),
    );
  } else {
    data = rows.map((p) => enrichSocialPostForClient(p));
  }

  return {
    data,
    meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 0 },
  };
}

export async function getPublicPostById(postId: string) {
  const post = await prisma.socialPost.findFirst({
    where: {
      id: postId,
      ...socialPostWhereVitrinePublica(),
    },
    select: publicPostSelect,
  });
  if (!post) throw new AppError('Publicação não encontrada ou não é pública.', 404);
  return enrichSocialPostForClient(post);
}

export async function listGroups(viewer: Viewer) {
  if (!viewer.instituicaoId) throw new AppError('Instituição necessária para listar grupos.', 403);
  const groups = await prisma.socialGroup.findMany({
    where: { instituicaoId: viewer.instituicaoId },
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      _count: { select: { members: true, posts: true } },
      members: { where: { userId: viewer.userId }, select: { id: true } },
    },
    orderBy: { name: 'asc' },
  });
  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    createdAt: g.createdAt,
    memberCount: g._count.members,
    postCount: g._count.posts,
    isMember: g.members.length > 0,
  }));
}

export async function createGroup(viewer: Viewer, input: { name: string; description?: string }) {
  if (!viewer.instituicaoId) throw new AppError('Instituição necessária para criar grupo.', 403);
  const name = (input.name || '').trim();
  if (!name || name.length > 160) throw new AppError('Nome do grupo inválido (1–160 caracteres).', 400);
  const description = input.description?.trim() || null;
  if (description && description.length > 5000) throw new AppError('Descrição demasiado longa.', 400);

  return prisma.$transaction(async (tx) => {
    const g = await tx.socialGroup.create({
      data: {
        instituicaoId: viewer.instituicaoId!,
        name,
        description,
        createdById: viewer.userId,
      },
      select: { id: true, name: true, description: true, createdAt: true },
    });
    await tx.socialGroupMember.create({
      data: { groupId: g.id, userId: viewer.userId },
    });
    return {
      ...g,
      memberCount: 1,
      postCount: 0,
      isMember: true,
    };
  });
}

export async function joinGroup(viewer: Viewer, groupId: string) {
  if (!viewer.instituicaoId) throw new AppError('Instituição necessária.', 403);
  const gid = groupId.trim();
  const g = await prisma.socialGroup.findFirst({
    where: { id: gid, instituicaoId: viewer.instituicaoId },
  });
  if (!g) throw new AppError('Grupo não encontrado.', 404);

  await prisma.socialGroupMember.upsert({
    where: { groupId_userId: { groupId: gid, userId: viewer.userId } },
    create: { groupId: gid, userId: viewer.userId },
    update: {},
  });
  return { ok: true };
}

export async function leaveGroup(viewer: Viewer, groupId: string) {
  const gid = groupId.trim();
  await prisma.socialGroupMember.deleteMany({
    where: { groupId: gid, userId: viewer.userId },
  });
  return { ok: true };
}
