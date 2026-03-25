import type { SocialPostDTO } from '@/services/socialApi';
import type { UserRole } from '@/types/auth';

/** Autor da publicação ou ADMIN/DIRECAO da mesma instituição. */
export function canEditSocialPost(
  user: { id: string; instituicao_id?: string | null } | null,
  role: UserRole | null,
  post: SocialPostDTO,
): boolean {
  if (!user) return false;
  const sameInst = Boolean(user.instituicao_id && user.instituicao_id === post.instituicaoId);
  const isAuthor = post.authorId === user.id;
  const isMod = sameInst && (role === 'ADMIN' || role === 'DIRECAO');
  return isAuthor || isMod;
}
