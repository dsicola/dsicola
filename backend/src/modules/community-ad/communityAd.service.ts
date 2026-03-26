import {
  CommunityAdBookingStatus,
  CommunityAdScope,
  Prisma,
} from '@prisma/client';
import prisma from '../../lib/prisma.js';
import { AppError } from '../../middlewares/errorHandler.js';
import { institutionVisibleInCommunityWhere } from '../../policies/instituicaoComunidadePublica.policy.js';
import { isCommunityPublicidadeObrigatoria } from './communityAd.config.js';

const SCOPES_VITRINE: CommunityAdScope[] = [CommunityAdScope.VITRINE_SOCIAL, CommunityAdScope.BOTH];
const SCOPES_DIR: CommunityAdScope[] = [CommunityAdScope.DESTAQUE_DIRETORIO, CommunityAdScope.BOTH];

function nowOr(date?: Date): Date {
  return date ?? new Date();
}

/** Vigência activa: campanha aprovada e intervalo [startsAt, endsAt] contendo `at`. */
function windowWhere(at: Date): Prisma.CommunityAdBookingWhereInput {
  return {
    status: CommunityAdBookingStatus.APROVADA,
    startsAt: { not: null, lte: at },
    endsAt: { not: null, gte: at },
  };
}

export async function hasActiveVitrineAd(instituicaoId: string, at?: Date): Promise<boolean> {
  const t = nowOr(at);
  const row = await prisma.communityAdBooking.findFirst({
    where: {
      instituicaoId,
      ...windowWhere(t),
      scope: { in: SCOPES_VITRINE },
    },
    select: { id: true },
  });
  return Boolean(row);
}

export async function hasActiveDirectoryBoost(instituicaoId: string, at?: Date): Promise<boolean> {
  const t = nowOr(at);
  const row = await prisma.communityAdBooking.findFirst({
    where: {
      instituicaoId,
      ...windowWhere(t),
      scope: { in: SCOPES_DIR },
    },
    select: { id: true },
  });
  return Boolean(row);
}

/**
 * IDs com destaque pago no diretório /comunidade (ordenar antes nas listagens).
 */
export async function institutionIdsWithActiveDirectoryBoost(at?: Date): Promise<Set<string>> {
  const t = nowOr(at);
  const rows = await prisma.communityAdBooking.findMany({
    where: {
      ...windowWhere(t),
      scope: { in: SCOPES_DIR },
    },
    select: { instituicaoId: true },
  });
  return new Set(rows.map((r) => r.instituicaoId));
}

function serializeBooking(row: {
  id: string;
  instituicaoId: string;
  socialPostId: string | null;
  scope: CommunityAdScope;
  duracaoDiasSolicitada: number;
  valorPagoDeclarado: Prisma.Decimal | null;
  comprovativoUrl: string | null;
  referenciaPagamento: string | null;
  notasInstituicao: string | null;
  status: CommunityAdBookingStatus;
  startsAt: Date | null;
  endsAt: Date | null;
  reviewedAt: Date | null;
  reviewedByUserId: string | null;
  motivoRejeicao: string | null;
  createdAt: Date;
  updatedAt: Date;
  instituicao?: { id: string; nome: string };
}) {
  return {
    id: row.id,
    instituicaoId: row.instituicaoId,
    institutionName: row.instituicao?.nome,
    socialPostId: row.socialPostId,
    scope: row.scope,
    duracaoDiasSolicitada: row.duracaoDiasSolicitada,
    valorPagoDeclarado: row.valorPagoDeclarado != null ? Number(row.valorPagoDeclarado) : null,
    comprovativoUrl: row.comprovativoUrl,
    referenciaPagamento: row.referenciaPagamento,
    notasInstituicao: row.notasInstituicao,
    status: row.status,
    startsAt: row.startsAt?.toISOString() ?? null,
    endsAt: row.endsAt?.toISOString() ?? null,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewedByUserId: row.reviewedByUserId,
    motivoRejeicao: row.motivoRejeicao,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Instituição precisa de plano elegível na Comunidade **e**, se a flag de publicidade obrigatória
 * estiver ligada, de campanha de vitrine activa para publicar `isPublic`.
 */
export async function assertInstituicaoPodePublicarNaVitrineComPublicidade(instituicaoId: string) {
  const okPlan = await prisma.instituicao.findFirst({
    where: { id: instituicaoId, ...institutionVisibleInCommunityWhere() },
    select: { id: true },
  });
  if (!okPlan) {
    throw new AppError(
      'Publicação pública indisponível: instituição inactiva ou sem plano elegível para a Comunidade. Utilize publicação privada (só a sua escola) ou regularize a subscrição.',
      403,
    );
  }
  if (!isCommunityPublicidadeObrigatoria()) {
    return;
  }
  const ad = await hasActiveVitrineAd(instituicaoId);
  if (!ad) {
    throw new AppError(
      'Publicação na vitrine pública (Comunidade) requer uma campanha de publicidade **aprovada** pela plataforma e em vigência. Envie um pedido em Configurações → Publicidade na Comunidade e aguarde análise do Super Admin após confirmação do pagamento.',
      403,
    );
  }
}

export async function listBookingsForInstituicao(instituicaoId: string) {
  const rows = await prisma.communityAdBooking.findMany({
    where: { instituicaoId },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((r) => serializeBooking(r));
}

export async function getMyActiveSummary(instituicaoId: string) {
  const t = new Date();
  const [vitrine, diretorio] = await Promise.all([
    hasActiveVitrineAd(instituicaoId, t),
    hasActiveDirectoryBoost(instituicaoId, t),
  ]);
  return {
    publicidadeObrigatoria: isCommunityPublicidadeObrigatoria(),
    vitrineAtiva: vitrine,
    destaqueDiretorioAtivo: diretorio,
    serverTime: t.toISOString(),
  };
}

export async function createBooking(
  instituicaoId: string,
  input: {
    scope: CommunityAdScope;
    duracaoDiasSolicitada: number;
    valorPagoDeclarado?: number | null;
    comprovativoUrl?: string | null;
    referenciaPagamento?: string | null;
    notasInstituicao?: string | null;
    socialPostId?: string | null;
  },
) {
  const dur = Math.floor(Number(input.duracaoDiasSolicitada));
  if (!Number.isFinite(dur) || dur < 7 || dur > 366) {
    throw new AppError('Duração solicitada deve ser entre 7 e 366 dias.', 400);
  }

  if (input.socialPostId?.trim()) {
    const pid = input.socialPostId.trim();
    const post = await prisma.socialPost.findFirst({
      where: { id: pid, instituicaoId },
      select: { id: true },
    });
    if (!post) throw new AppError('Post Social indicado não existe ou não pertence à instituição.', 400);
  }

  const row = await prisma.communityAdBooking.create({
    data: {
      instituicaoId,
      scope: input.scope,
      duracaoDiasSolicitada: dur,
      valorPagoDeclarado:
        input.valorPagoDeclarado != null && Number.isFinite(input.valorPagoDeclarado)
          ? input.valorPagoDeclarado
          : null,
      comprovativoUrl: input.comprovativoUrl?.trim() || null,
      referenciaPagamento: input.referenciaPagamento?.trim() || null,
      notasInstituicao: input.notasInstituicao?.trim() || null,
      socialPostId: input.socialPostId?.trim() || null,
      status: CommunityAdBookingStatus.AGUARDANDO_ANALISE,
    },
  });
  return serializeBooking(row);
}

/**
 * Anexar ou substituir comprovativo enquanto o pedido está em fila (paridade com pagamento de licença PENDING).
 */
export async function attachComprovativo(
  instituicaoId: string,
  bookingId: string,
  comprovativoUrl: string,
) {
  const trimmed = comprovativoUrl.trim();
  if (!trimmed) {
    throw new AppError('URL do comprovativo é obrigatória.', 400);
  }

  const row = await prisma.communityAdBooking.findFirst({
    where: { id: bookingId, instituicaoId },
  });
  if (!row) throw new AppError('Pedido não encontrado.', 404);
  if (row.status !== CommunityAdBookingStatus.AGUARDANDO_ANALISE) {
    throw new AppError(
      'Só é possível enviar comprovativo para pedidos em análise. Submeta um novo pedido se necessário.',
      400,
    );
  }

  const updated = await prisma.communityAdBooking.update({
    where: { id: bookingId },
    data: { comprovativoUrl: trimmed },
  });
  return serializeBooking(updated);
}

export async function cancelPendingBooking(instituicaoId: string, bookingId: string) {
  const row = await prisma.communityAdBooking.findFirst({
    where: { id: bookingId, instituicaoId },
  });
  if (!row) throw new AppError('Pedido não encontrado.', 404);
  if (row.status !== CommunityAdBookingStatus.AGUARDANDO_ANALISE) {
    throw new AppError('Só é possível cancelar pedidos ainda em análise.', 400);
  }
  await prisma.communityAdBooking.update({
    where: { id: bookingId },
    data: { status: CommunityAdBookingStatus.CANCELADA },
  });
  return { ok: true };
}

export async function superListBookings(query: {
  status?: string | null;
  page?: unknown;
  pageSize?: unknown;
}) {
  const page = Math.max(1, parseInt(String(query.page || '1'), 10) || 1);
  const pageSize = Math.min(80, Math.max(1, parseInt(String(query.pageSize || '20'), 10) || 20));
  const skip = (page - 1) * pageSize;

  const st = typeof query.status === 'string' ? query.status.trim().toUpperCase() : '';
  const statusEnum = Object.values(CommunityAdBookingStatus).includes(st as CommunityAdBookingStatus)
    ? (st as CommunityAdBookingStatus)
    : undefined;

  const where: Prisma.CommunityAdBookingWhereInput = statusEnum ? { status: statusEnum } : {};

  const [total, rows] = await Promise.all([
    prisma.communityAdBooking.count({ where }),
    prisma.communityAdBooking.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      include: {
        instituicao: { select: { id: true, nome: true } },
      },
    }),
  ]);

  return {
    data: rows.map((r) =>
      serializeBooking({
        ...r,
        instituicao: r.instituicao,
      }),
    ),
    meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 0 },
  };
}

export async function superReviewBooking(
  bookingId: string,
  adminUserId: string,
  input: {
    action: 'APROVAR' | 'REJEITAR';
    pagamentoVerificado: boolean;
    startsAtIso?: string | null;
    duracaoDiasEfetiva?: number | null;
    motivoRejeicao?: string | null;
    notasInternasAdmin?: string | null;
  },
) {
  const row = await prisma.communityAdBooking.findUnique({ where: { id: bookingId } });
  if (!row) throw new AppError('Pedido não encontrado.', 404);
  if (row.status !== CommunityAdBookingStatus.AGUARDANDO_ANALISE) {
    throw new AppError('Este pedido já foi analisado ou cancelado.', 400);
  }

  if (input.action === 'REJEITAR') {
    const motivo = (input.motivoRejeicao || '').trim();
    if (!motivo) throw new AppError('Indique o motivo da rejeição (ex.: pagamento não confirmado).', 400);
    await prisma.communityAdBooking.update({
      where: { id: bookingId },
      data: {
        status: CommunityAdBookingStatus.REJEITADA,
        reviewedAt: new Date(),
        reviewedByUserId: adminUserId,
        motivoRejeicao: motivo,
        notasInternasAdmin: input.notasInternasAdmin?.trim() || null,
      },
    });
    const updated = await prisma.communityAdBooking.findUnique({ where: { id: bookingId } });
    return serializeBooking(updated!);
  }

  if (input.action === 'APROVAR') {
    if (!input.pagamentoVerificado) {
      throw new AppError(
        'Para aprovar é necessário confirmar o pagamento (`pagamentoVerificado: true`). Se o pagamento não consta, rejeite o pedido.',
        400,
      );
    }
    const startsAt = input.startsAtIso?.trim()
      ? new Date(input.startsAtIso)
      : new Date();
    if (Number.isNaN(startsAt.getTime())) {
      throw new AppError('Data de início inválida.', 400);
    }
    let dias =
      input.duracaoDiasEfetiva != null && Number.isFinite(input.duracaoDiasEfetiva)
        ? Math.floor(input.duracaoDiasEfetiva)
        : row.duracaoDiasSolicitada;
    if (dias < 1 || dias > 366) {
      throw new AppError('Duração efectiva deve ser entre 1 e 366 dias.', 400);
    }
    const endsAt = new Date(startsAt);
    endsAt.setUTCDate(endsAt.getUTCDate() + dias);
    endsAt.setUTCHours(23, 59, 59, 999);

    await prisma.communityAdBooking.update({
      where: { id: bookingId },
      data: {
        status: CommunityAdBookingStatus.APROVADA,
        startsAt,
        endsAt,
        reviewedAt: new Date(),
        reviewedByUserId: adminUserId,
        motivoRejeicao: null,
        notasInternasAdmin: input.notasInternasAdmin?.trim() || null,
      },
    });
    const updated = await prisma.communityAdBooking.findUnique({ where: { id: bookingId } });
    return serializeBooking(updated!);
  }

  throw new AppError('Acção inválida.', 400);
}
