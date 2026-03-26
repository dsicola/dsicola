import { Prisma, TipoAcademico, TipoInstituicao } from '@prisma/client';
import prisma from '../../lib/prisma.js';
import { AppError } from '../../middlewares/errorHandler.js';
import { institutionVisibleInCommunityWhere } from '../../policies/instituicaoComunidadePublica.policy.js';
import * as social from '../social/social.service.js';
import { institutionIdsWithActiveDirectoryBoost } from '../community-ad/communityAd.service.js';

export { institutionVisibleInCommunityWhere };

function parsePagination(pageRaw: unknown, pageSizeRaw: unknown) {
  const page = Math.max(1, parseInt(String(pageRaw || '1'), 10) || 1);
  const pageSize = Math.min(48, Math.max(1, parseInt(String(pageSizeRaw || '12'), 10) || 12));
  return { page, pageSize, skip: (page - 1) * pageSize };
}

const institutionCardSelect = {
  id: true,
  nome: true,
  subdominio: true,
  dominioCustomizado: true,
  logoUrl: true,
  endereco: true,
  emailContato: true,
  telefone: true,
  tipoInstituicao: true,
  tipoAcademico: true,
  _count: { select: { communityCourses: true, communityFollows: true } },
} as const;

function maskAuthorLabel(nomeCompleto: string): string {
  const t = nomeCompleto.trim();
  if (!t) return 'Utilizador';
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const last = parts[parts.length - 1];
  const initial = last[0]?.toUpperCase() ?? '';
  return `${first} ${initial}.`;
}

async function ratingAggregatesByInstitutionIds(
  ids: string[],
): Promise<Map<string, { average: number; count: number }>> {
  const map = new Map<string, { average: number; count: number }>();
  if (!ids.length) return map;
  const groups = await prisma.communityInstitutionRating.groupBy({
    by: ['instituicaoId'],
    where: { instituicaoId: { in: ids } },
    _avg: { stars: true },
    _count: { _all: true },
  });
  for (const g of groups) {
    const avg = g._avg.stars;
    map.set(g.instituicaoId, {
      average: avg != null ? Math.round(Number(avg) * 10) / 10 : 0,
      count: g._count._all,
    });
  }
  return map;
}

function serializeCourse(row: {
  id: string;
  name: string;
  price: Prisma.Decimal | null;
  description: string | null;
  instituicaoId: string;
}) {
  return {
    id: row.id,
    institutionId: row.instituicaoId,
    name: row.name,
    price: row.price != null ? Number(row.price) : null,
    description: row.description,
  };
}

export async function listInstitutions(query: {
  page?: unknown;
  pageSize?: unknown;
  cidade?: unknown;
  tipoAcademico?: unknown;
  tipoInstituicao?: unknown;
  curso?: unknown;
}) {
  const { page, pageSize, skip } = parsePagination(query.page, query.pageSize);
  const base = institutionVisibleInCommunityWhere();
  const cidade = typeof query.cidade === 'string' ? query.cidade.trim() : '';
  const curso = typeof query.curso === 'string' ? query.curso.trim() : '';

  const where: Prisma.InstituicaoWhereInput = { ...base };

  /** Texto livre: procura no endereço ou no nome da instituição (ex.: “Luanda” no endereço ou no nome). */
  if (cidade) {
    where.OR = [
      { endereco: { contains: cidade, mode: 'insensitive' } },
      { nome: { contains: cidade, mode: 'insensitive' } },
    ];
  }

  const ta = typeof query.tipoAcademico === 'string' ? query.tipoAcademico.trim().toUpperCase() : '';
  if (ta === 'SECUNDARIO' || ta === 'SUPERIOR') {
    where.tipoAcademico = ta as TipoAcademico;
  }

  const ti = typeof query.tipoInstituicao === 'string' ? query.tipoInstituicao.trim().toUpperCase() : '';
  if (ti && Object.values(TipoInstituicao).includes(ti as TipoInstituicao)) {
    where.tipoInstituicao = ti as TipoInstituicao;
  }

  if (curso) {
    where.communityCourses = {
      some: { name: { contains: curso, mode: 'insensitive' } },
    };
  }

  // Ordenação “patrocinado primeiro” requer ordenar em memória pelos IDs do filtro.
  // Escalas muito grandes: considerar ORDER BY com CASE em SQL bruto mantendo os mesmos filtros.
  const [countTotal, slim, featuredSet] = await Promise.all([
    prisma.instituicao.count({ where }),
    prisma.instituicao.findMany({
      where,
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    }),
    institutionIdsWithActiveDirectoryBoost(),
  ]);

  const sortedSlim = [...slim].sort((a, b) => {
    const fa = featuredSet.has(a.id) ? 0 : 1;
    const fb = featuredSet.has(b.id) ? 0 : 1;
    if (fa !== fb) return fa - fb;
    return a.nome.localeCompare(b.nome, 'pt', { sensitivity: 'base' });
  });

  const total = countTotal;
  const pageIds = sortedSlim.slice(skip, skip + pageSize).map((x) => x.id);
  const idOrder = new Map(pageIds.map((id, i) => [id, i]));

  const rows =
    pageIds.length === 0
      ? []
      : await prisma.instituicao.findMany({
          where: { id: { in: pageIds } },
          select: institutionCardSelect,
        });

  rows.sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));

  const ratingMap = await ratingAggregatesByInstitutionIds(pageIds);

  const data = rows.map((r) => {
    const agg = ratingMap.get(r.id);
    return {
      id: r.id,
      name: r.nome,
      subdomain: r.subdominio,
      customDomain: r.dominioCustomizado,
      logoUrl: r.logoUrl,
      address: r.endereco,
      contactEmail: r.emailContato,
      phone: r.telefone,
      institutionType: r.tipoInstituicao,
      academicType: r.tipoAcademico,
      courseCount: r._count.communityCourses,
      followerCount: r._count.communityFollows,
      directoryFeatured: featuredSet.has(r.id),
      ratingAverage: agg && agg.count > 0 ? agg.average : null,
      ratingCount: agg?.count ?? 0,
    };
  });

  return {
    data,
    meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 0 },
  };
}

export async function getInstitutionPublic(
  id: string,
  viewerUserId: string | undefined,
) {
  const inst = await prisma.instituicao.findFirst({
    where: { id, ...institutionVisibleInCommunityWhere() },
    select: {
      id: true,
      nome: true,
      subdominio: true,
      dominioCustomizado: true,
      logoUrl: true,
      endereco: true,
      emailContato: true,
      telefone: true,
      tipoInstituicao: true,
      tipoAcademico: true,
      communityCourses: {
        orderBy: { name: 'asc' },
        select: { id: true, name: true, price: true, description: true, instituicaoId: true },
      },
      _count: { select: { communityFollows: true } },
    },
  });
  if (!inst) {
    throw new AppError('Instituição não encontrada ou indisponível no diretório.', 404);
  }

  let viewerFollowing = false;
  if (viewerUserId) {
    const f = await prisma.communityInstitutionFollow.findUnique({
      where: {
        userId_instituicaoId: { userId: viewerUserId, instituicaoId: id },
      },
      select: { userId: true },
    });
    viewerFollowing = Boolean(f);
  }

  const [ratingAgg, viewerRatingRow] = await Promise.all([
    prisma.communityInstitutionRating.aggregate({
      where: { instituicaoId: id },
      _avg: { stars: true },
      _count: { _all: true },
    }),
    viewerUserId
      ? prisma.communityInstitutionRating.findUnique({
          where: {
            userId_instituicaoId: { userId: viewerUserId, instituicaoId: id },
          },
          select: { stars: true },
        })
      : Promise.resolve(null),
  ]);

  const ratingCount = ratingAgg._count._all;
  const ratingAverage =
    ratingCount > 0 && ratingAgg._avg.stars != null
      ? Math.round(Number(ratingAgg._avg.stars) * 10) / 10
      : null;

  const feed = await social.listPublicFeed({
    page: 1,
    pageSize: 12,
    instituicaoId: id,
    includeComments: true,
    commentsPerPost: 50,
  });

  return {
    id: inst.id,
    name: inst.nome,
    subdomain: inst.subdominio,
    customDomain: inst.dominioCustomizado,
    logoUrl: inst.logoUrl,
    address: inst.endereco,
    contactEmail: inst.emailContato,
    phone: inst.telefone,
    institutionType: inst.tipoInstituicao,
    academicType: inst.tipoAcademico,
    followerCount: inst._count.communityFollows,
    viewerFollowing,
    ratingAverage,
    ratingCount,
    viewerRating: viewerRatingRow?.stars ?? null,
    courses: inst.communityCourses.map(serializeCourse),
    publicPosts: feed.data,
  };
}

export async function submitInstitutionRating(
  userId: string,
  instituicaoId: string,
  body: { stars?: unknown; comment?: unknown },
) {
  const ok = await prisma.instituicao.findFirst({
    where: { id: instituicaoId, ...institutionVisibleInCommunityWhere() },
    select: { id: true },
  });
  if (!ok) {
    throw new AppError('Instituição não encontrada ou indisponível no diretório.', 404);
  }

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { instituicaoId: true },
  });
  if (me?.instituicaoId && me.instituicaoId === instituicaoId) {
    throw new AppError('Não é possível avaliar a própria instituição.', 403);
  }

  const starsRaw = Number(body.stars);
  if (!Number.isInteger(starsRaw) || starsRaw < 1 || starsRaw > 5) {
    throw new AppError('Indique uma classificação de 1 a 5 estrelas.', 400);
  }
  let comment: string | null = null;
  if (body.comment !== undefined && body.comment !== null) {
    const c = String(body.comment).trim();
    comment = c.length ? c.slice(0, 600) : null;
  }

  await prisma.communityInstitutionRating.upsert({
    where: { userId_instituicaoId: { userId, instituicaoId } },
    create: { userId, instituicaoId, stars: starsRaw, comment },
    update: { stars: starsRaw, comment },
  });

  const agg = await prisma.communityInstitutionRating.aggregate({
    where: { instituicaoId },
    _avg: { stars: true },
    _count: { _all: true },
  });
  const count = agg._count._all;
  const average =
    count > 0 && agg._avg.stars != null ? Math.round(Number(agg._avg.stars) * 10) / 10 : null;

  return { stars: starsRaw, ratingAverage: average, ratingCount: count };
}

export async function listInstitutionRatingsPublic(
  instituicaoId: string,
  query: { page?: unknown; pageSize?: unknown },
) {
  const visible = await prisma.instituicao.findFirst({
    where: { id: instituicaoId, ...institutionVisibleInCommunityWhere() },
    select: { id: true },
  });
  if (!visible) {
    throw new AppError('Instituição não encontrada ou indisponível no diretório.', 404);
  }

  const page = Math.max(1, parseInt(String(query.page ?? '1'), 10) || 1);
  const pageSize = Math.min(
    30,
    Math.max(1, parseInt(String(query.pageSize ?? '12'), 10) || 12),
  );
  const skip = (page - 1) * pageSize;

  const [total, rows] = await Promise.all([
    prisma.communityInstitutionRating.count({ where: { instituicaoId } }),
    prisma.communityInstitutionRating.findMany({
      where: { instituicaoId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      select: {
        id: true,
        stars: true,
        comment: true,
        createdAt: true,
        user: { select: { nomeCompleto: true } },
      },
    }),
  ]);

  const data = rows.map((r) => ({
    id: r.id,
    stars: r.stars,
    comment: r.comment,
    createdAt: r.createdAt.toISOString(),
    authorLabel: maskAuthorLabel(r.user.nomeCompleto),
  }));

  return {
    data,
    meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 0 },
  };
}

export async function listCourses(query: {
  page?: unknown;
  pageSize?: unknown;
  instituicaoId?: unknown;
  search?: unknown;
}) {
  const { page, pageSize, skip } = parsePagination(query.page, query.pageSize);
  const instId = typeof query.instituicaoId === 'string' ? query.instituicaoId.trim() : '';
  const search = typeof query.search === 'string' ? query.search.trim() : '';

  const where: Prisma.CommunityCourseWhereInput = {
    instituicao: institutionVisibleInCommunityWhere(),
  };
  if (instId) where.instituicaoId = instId;
  if (search) where.name = { contains: search, mode: 'insensitive' };

  const [total, rows] = await Promise.all([
    prisma.communityCourse.count({ where }),
    prisma.communityCourse.findMany({
      where,
      select: {
        id: true,
        name: true,
        price: true,
        description: true,
        instituicaoId: true,
        instituicao: {
          select: { id: true, nome: true, subdominio: true, logoUrl: true },
        },
      },
      orderBy: { name: 'asc' },
      skip,
      take: pageSize,
    }),
  ]);

  const data = rows.map((r) => ({
    ...serializeCourse(r),
    institution: {
      id: r.instituicao.id,
      name: r.instituicao.nome,
      subdomain: r.instituicao.subdominio,
      logoUrl: r.instituicao.logoUrl,
    },
  }));

  return {
    data,
    meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 0 },
  };
}

export async function followInstitution(userId: string, instituicaoId: string) {
  const ok = await prisma.instituicao.findFirst({
    where: { id: instituicaoId, ...institutionVisibleInCommunityWhere() },
    select: { id: true },
  });
  if (!ok) {
    throw new AppError('Instituição não encontrada ou indisponível para seguir.', 404);
  }
  await prisma.communityInstitutionFollow.upsert({
    where: { userId_instituicaoId: { userId, instituicaoId } },
    create: { userId, instituicaoId },
    update: {},
  });
  return { following: true };
}

export async function unfollowInstitution(userId: string, instituicaoId: string) {
  await prisma.communityInstitutionFollow.deleteMany({
    where: { userId, instituicaoId },
  });
  return { following: false };
}

// --- Admin: ofertas no diretório público /comunidade (não são cursos académicos) ---

export async function adminListMyCommunityCourses(instituicaoId: string) {
  const rows = await prisma.communityCourse.findMany({
    where: { instituicaoId },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, price: true, description: true, instituicaoId: true },
  });
  return rows.map(serializeCourse);
}

export async function adminCreateCommunityCourse(
  instituicaoId: string,
  body: { name?: unknown; price?: unknown; description?: unknown },
) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) throw new AppError('Nome é obrigatório.', 400);
  let price: Prisma.Decimal | null = null;
  if (body.price !== undefined && body.price !== null && String(body.price).trim() !== '') {
    const n = Number(body.price);
    if (!Number.isFinite(n) || n < 0) throw new AppError('Preço inválido.', 400);
    price = new Prisma.Decimal(n);
  }
  const description =
    typeof body.description === 'string' ? body.description.trim() || null : null;
  const row = await prisma.communityCourse.create({
    data: { instituicaoId, name, price, description },
    select: { id: true, name: true, price: true, description: true, instituicaoId: true },
  });
  return serializeCourse(row);
}

export async function adminUpdateCommunityCourse(
  instituicaoId: string,
  courseId: string,
  body: { name?: unknown; price?: unknown; description?: unknown },
) {
  const existing = await prisma.communityCourse.findFirst({
    where: { id: courseId, instituicaoId },
    select: { id: true },
  });
  if (!existing) throw new AppError('Oferta não encontrada.', 404);
  const data: Prisma.CommunityCourseUpdateInput = {};
  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) throw new AppError('Nome não pode ser vazio.', 400);
    data.name = name;
  }
  if (body.price !== undefined) {
    if (body.price === null || String(body.price).trim() === '') {
      data.price = null;
    } else {
      const n = Number(body.price);
      if (!Number.isFinite(n) || n < 0) throw new AppError('Preço inválido.', 400);
      data.price = new Prisma.Decimal(n);
    }
  }
  if (body.description !== undefined) {
    data.description =
      typeof body.description === 'string' ? body.description.trim() || null : null;
  }
  const row = await prisma.communityCourse.update({
    where: { id: courseId },
    data,
    select: { id: true, name: true, price: true, description: true, instituicaoId: true },
  });
  return serializeCourse(row);
}

export async function adminDeleteCommunityCourse(instituicaoId: string, courseId: string) {
  const r = await prisma.communityCourse.deleteMany({ where: { id: courseId, instituicaoId } });
  if (r.count === 0) throw new AppError('Oferta não encontrada.', 404);
  return { ok: true };
}
