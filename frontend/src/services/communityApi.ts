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
