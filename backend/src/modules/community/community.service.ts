import { Prisma, TipoAcademico, TipoInstituicao } from '@prisma/client';
import prisma from '../../lib/prisma.js';
import { AppError } from '../../middlewares/errorHandler.js';
import { institutionVisibleInCommunityWhere } from '../../policies/instituicaoComunidadePublica.policy.js';
import * as social from '../social/social.service.js';

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

  if (cidade) {
    where.endereco = { contains: cidade, mode: 'insensitive' };
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

  const [total, rows] = await Promise.all([
    prisma.instituicao.count({ where }),
    prisma.instituicao.findMany({
      where,
      select: institutionCardSelect,
      orderBy: { nome: 'asc' },
      skip,
      take: pageSize,
    }),
  ]);

  const data = rows.map((r) => ({
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
  }));

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
    courses: inst.communityCourses.map(serializeCourse),
    publicPosts: feed.data,
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
