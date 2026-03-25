import { api } from '@/services/api';

export type SocialReactionType = 'LIKE' | 'LOVE' | 'EDUCATIONAL';

export interface SocialPostAuthor {
  id: string;
  nomeCompleto: string;
  email: string;
  avatarUrl: string | null;
  instituicaoId: string | null;
}

export interface SocialPostDTO {
  id: string;
  instituicaoId: string;
  authorId: string;
  body: string;
  isPublic: boolean;
  socialGroupId: string | null;
  contactWhatsappShow: boolean;
  contactWhatsapp: string | null;
  contactLocationShow: boolean;
  contactLocation: string | null;
  contactVideoShow: boolean;
  contactVideoUrl: string | null;
  contactVideoEmbedSrc: string | null;
  contactWhatsappHref: string | null;
  reactionCount: number;
  commentCount: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  author: SocialPostAuthor;
  instituicao: { id: string; nome: string; subdominio: string };
  group: { id: string; name: string } | null;
  _count: { comments: number; reactions: number; views: number };
  myReaction: SocialReactionType | null;
  comments?: Array<{
    id: string;
    postId: string;
    authorId: string;
    body: string;
    createdAt: string;
    updatedAt: string;
    author: SocialPostAuthor;
  }>;
}

export interface SocialFeedResponse {
  data: SocialPostDTO[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

/** Resposta da API pública (sem autenticação) — landing dsicola.com */
export interface SocialPublicCommentDTO {
  id: string;
  postId: string;
  body: string;
  createdAt: string;
  author: { nomeCompleto: string };
}

export interface SocialPublicPostDTO {
  id: string;
  body: string;
  createdAt: string;
  reactionCount: number;
  commentCount: number;
  viewCount: number;
  contactWhatsappShow: boolean;
  contactWhatsapp: string | null;
  contactLocationShow: boolean;
  contactLocation: string | null;
  contactVideoShow: boolean;
  contactVideoUrl: string | null;
  contactVideoEmbedSrc: string | null;
  contactWhatsappHref: string | null;
  author: { nomeCompleto: string };
  instituicao: { nome: string; subdominio: string };
  comments?: SocialPublicCommentDTO[];
}

export interface SocialPublicFeedResponse {
  data: SocialPublicPostDTO[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface SocialGroupDTO {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  memberCount: number;
  postCount: number;
  isMember: boolean;
}

export interface SocialFeedOverviewDTO {
  activeUsers: Array<{
    id: string;
    nomeCompleto: string;
    avatarUrl: string | null;
    lastAt: string;
  }>;
  stories: Array<{
    id: string;
    bodyPreview: string;
    createdAt: string;
    author: { id: string; nomeCompleto: string; avatarUrl: string | null };
  }>;
}

const base = '/api/social';

export const socialApi = {
  getPublicFeed: async (params?: {
    page?: number;
    pageSize?: number;
    instituicaoId?: string;
    includeComments?: boolean;
    commentsPerPost?: number;
  }) => {
    const { data } = await api.get<SocialPublicFeedResponse>(`${base}/public/feed`, {
      params: {
        ...params,
        includeComments: params?.includeComments ? '1' : undefined,
      },
    });
    return data;
  },

  getPublicPost: async (id: string) => {
    const { data } = await api.get<SocialPublicPostDTO>(`${base}/public/posts/${id}`);
    return data;
  },

  getFeed: async (params?: { page?: number; pageSize?: number; groupId?: string | null }) => {
    const { data } = await api.get<SocialFeedResponse>(`${base}/feed`, {
      params: {
        page: params?.page,
        pageSize: params?.pageSize,
        groupId: params?.groupId && params.groupId.trim() ? params.groupId.trim() : undefined,
      },
    });
    return data;
  },

  getFeedOverview: async () => {
    const { data } = await api.get<SocialFeedOverviewDTO>(`${base}/overview`);
    return data;
  },

  listGroups: async () => {
    const { data } = await api.get<SocialGroupDTO[]>(`${base}/groups`);
    return data;
  },

  createGroup: async (payload: { name: string; description?: string }) => {
    const { data } = await api.post<SocialGroupDTO>(`${base}/groups`, payload);
    return data;
  },

  joinGroup: async (groupId: string) => {
    const { data } = await api.post<{ ok: boolean }>(`${base}/groups/${groupId}/join`, {});
    return data;
  },

  leaveGroup: async (groupId: string) => {
    const { data } = await api.delete<{ ok: boolean }>(`${base}/groups/${groupId}/membership`);
    return data;
  },

  getPost: async (id: string) => {
    const { data } = await api.get<SocialPostDTO>(`${base}/posts/${id}`);
    return data;
  },

  createPost: async (payload: {
    body: string;
    isPublic?: boolean;
    socialGroupId?: string | null;
    contactWhatsappShow?: boolean;
    contactWhatsapp?: string;
    contactLocationShow?: boolean;
    contactLocation?: string;
    contactVideoShow?: boolean;
    contactVideoUrl?: string;
  }) => {
    const { data } = await api.post<SocialPostDTO>(`${base}/posts`, payload);
    return data;
  },

  updatePost: async (
    id: string,
    payload: {
      body?: string;
      isPublic?: boolean;
      contactWhatsappShow?: boolean;
      contactWhatsapp?: string;
      contactLocationShow?: boolean;
      contactLocation?: string;
      contactVideoShow?: boolean;
      contactVideoUrl?: string;
    },
  ) => {
    const { data } = await api.patch<SocialPostDTO>(`${base}/posts/${id}`, payload);
    return data;
  },

  deletePost: async (id: string) => {
    const { data } = await api.delete<{ ok: boolean }>(`${base}/posts/${id}`);
    return data;
  },

  registerView: async (postId: string) => {
    await api.post(`${base}/posts/${postId}/view`, {});
  },

  listComments: async (postId: string) => {
    const { data } = await api.get<SocialPostDTO['comments']>(`${base}/posts/${postId}/comments`);
    return data!;
  },

  createComment: async (postId: string, body: string) => {
    const { data } = await api.post(`${base}/posts/${postId}/comments`, { body });
    return data;
  },

  updateComment: async (postId: string, commentId: string, body: string) => {
    const { data } = await api.patch(
      `${base}/posts/${postId}/comments/${commentId}`,
      { body },
    );
    return data;
  },

  deleteComment: async (postId: string, commentId: string) => {
    const { data } = await api.delete(`${base}/posts/${postId}/comments/${commentId}`);
    return data;
  },

  setReaction: async (postId: string, type: SocialReactionType) => {
    const { data } = await api.post(`${base}/posts/${postId}/reactions`, { type });
    return data;
  },

  clearReaction: async (postId: string) => {
    const { data } = await api.delete(`${base}/posts/${postId}/reactions`);
    return data;
  },

  follow: async (userId: string) => {
    const { data } = await api.post(`${base}/users/${userId}/follow`, {});
    return data;
  },

  unfollow: async (userId: string) => {
    const { data } = await api.delete(`${base}/users/${userId}/follow`);
    return data;
  },
};
