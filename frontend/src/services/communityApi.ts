import { api } from './api';

export interface CommunityInstitutionCard {
  id: string;
  name: string;
  subdomain: string;
  customDomain: string | null;
  logoUrl: string | null;
  address: string | null;
  contactEmail: string | null;
  phone: string | null;
  institutionType: string;
  academicType: string | null;
  courseCount: number;
  followerCount: number;
  /** Média 1–5 no diretório; null se ainda não houver avaliações. */
  ratingAverage: number | null;
  ratingCount: number;
  /** Destaque pago no diretório /comunidade (campanha aprovada em vigência). */
  directoryFeatured?: boolean;
}

export interface CommunityCourseItem {
  id: string;
  institutionId: string;
  name: string;
  price: number | null;
  description: string | null;
}

export interface CommunityInstitutionDetail {
  id: string;
  name: string;
  subdomain: string;
  customDomain: string | null;
  logoUrl: string | null;
  address: string | null;
  contactEmail: string | null;
  phone: string | null;
  institutionType: string;
  academicType: string | null;
  followerCount: number;
  viewerFollowing: boolean;
  ratingAverage: number | null;
  ratingCount: number;
  /** Classificação do visitante autenticado (se existir). */
  viewerRating: number | null;
  courses: CommunityCourseItem[];
  publicPosts: Array<{
    id: string;
    body: string;
    createdAt: string;
    instituicao?: { nome: string; subdominio: string };
    author?: { nomeCompleto: string | null };
    comments?: Array<{
      id: string;
      postId: string;
      body: string;
      createdAt: string;
      author: { nomeCompleto: string };
    }>;
  }>;
}

export interface CommunityRatingReview {
  id: string;
  stars: number;
  comment: string | null;
  createdAt: string;
  authorLabel: string;
}

export interface PaginatedMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export const communityApi = {
  listInstitutions(params?: {
    page?: number;
    pageSize?: number;
    cidade?: string;
    tipoAcademico?: string;
    tipoInstituicao?: string;
    curso?: string;
  }) {
    return api.get<{ data: CommunityInstitutionCard[]; meta: PaginatedMeta }>(
      '/api/community/institutions',
      { params }
    );
  },

  getInstitution(id: string) {
    return api.get<CommunityInstitutionDetail>(`/api/community/institutions/${id}`);
  },

  listRatings(id: string, params?: { page?: number; pageSize?: number }) {
    return api.get<{ data: CommunityRatingReview[]; meta: PaginatedMeta }>(
      `/api/community/institutions/${id}/ratings`,
      { params },
    );
  },

  submitRating(id: string, body: { stars: number; comment?: string }) {
    return api.post<{ stars: number; ratingAverage: number | null; ratingCount: number }>(
      `/api/community/institutions/${id}/ratings`,
      body,
    );
  },

  listCourses(params?: { page?: number; pageSize?: number; instituicaoId?: string; search?: string }) {
    return api.get<{ data: Array<CommunityCourseItem & { institution: { id: string; name: string; subdomain: string; logoUrl: string | null } }>; meta: PaginatedMeta }>(
      '/api/community/courses',
      { params }
    );
  },

  follow(instituicaoId: string) {
    return api.post<{ following: boolean }>('/api/community/follow', { instituicaoId });
  },

  unfollow(instituicaoId: string) {
    return api.delete<{ following: boolean }>(`/api/community/follow/${instituicaoId}`);
  },
};

/** Ofertas do diretório /comunidade (admin: ADMIN / DIRECAO / SUPER_ADMIN com instituição). */
export const communityAdminApi = {
  listCourses() {
    return api.get<{ data: CommunityCourseItem[] }>('/api/community/admin/courses');
  },
  createCourse(body: { name: string; price?: number | null; description?: string | null }) {
    return api.post<CommunityCourseItem>('/api/community/admin/courses', body);
  },
  updateCourse(
    id: string,
    body: { name?: string; price?: number | null; description?: string | null },
  ) {
    return api.patch<CommunityCourseItem>(`/api/community/admin/courses/${id}`, body);
  },
  deleteCourse(id: string) {
    return api.delete<{ ok: boolean }>(`/api/community/admin/courses/${id}`);
  },
};

export type CommunityAdScope = 'VITRINE_SOCIAL' | 'DESTAQUE_DIRETORIO' | 'BOTH';
export type CommunityAdBookingStatus =
  | 'AGUARDANDO_ANALISE'
  | 'APROVADA'
  | 'REJEITADA'
  | 'CANCELADA';

export interface CommunityAdBookingDto {
  id: string;
  instituicaoId: string;
  institutionName?: string;
  socialPostId: string | null;
  scope: CommunityAdScope;
  duracaoDiasSolicitada: number;
  valorPagoDeclarado: number | null;
  comprovativoUrl: string | null;
  referenciaPagamento: string | null;
  notasInstituicao: string | null;
  status: CommunityAdBookingStatus;
  startsAt: string | null;
  endsAt: string | null;
  reviewedAt: string | null;
  reviewedByUserId: string | null;
  motivoRejeicao: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommunityAdMySummary {
  publicidadeObrigatoria: boolean;
  vitrineAtiva: boolean;
  destaqueDiretorioAtivo: boolean;
  serverTime: string;
}

/**
 * Publicidade na Comunidade / vitrine — pedidos (instituição) e análise (Super Admin via `/super`).
 */
export const communityAdApi = {
  getMine() {
    return api.get<{ summary: CommunityAdMySummary; bookings: CommunityAdBookingDto[] }>(
      '/api/community/ad-bookings/me',
    );
  },
  create(body: {
    scope: CommunityAdScope;
    duracaoDiasSolicitada: number;
    valorPagoDeclarado?: number | null;
    comprovativoUrl?: string | null;
    referenciaPagamento?: string | null;
    notasInstituicao?: string | null;
    socialPostId?: string | null;
  }) {
    return api.post<CommunityAdBookingDto>('/api/community/ad-bookings', body);
  },
  cancel(id: string) {
    return api.patch<{ ok: boolean }>(`/api/community/ad-bookings/me/${id}/cancel`);
  },
  /** Mesmo padrão que licença: upload via `storageApi.upload` e depois enviar a URL aqui. */
  attachComprovativo(id: string, comprovativoUrl: string) {
    return api.patch<CommunityAdBookingDto>(`/api/community/ad-bookings/me/${id}/comprovativo`, {
      comprovativoUrl,
    });
  },
  superList(params?: { status?: string; page?: number; pageSize?: number }) {
    return api.get<{ data: CommunityAdBookingDto[]; meta: PaginatedMeta }>('/api/community/ad-bookings/super', {
      params,
    });
  },
  superReview(
    id: string,
    body: {
      action: 'APROVAR' | 'REJEITAR';
      pagamentoVerificado?: boolean;
      startsAtIso?: string | null;
      duracaoDiasEfetiva?: number | null;
      motivoRejeicao?: string | null;
      notasInternasAdmin?: string | null;
    },
  ) {
    return api.patch<CommunityAdBookingDto>(`/api/community/ad-bookings/super/${id}`, body);
  },
};
