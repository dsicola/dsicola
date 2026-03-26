import { UserRole } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { AppError } from '../../middlewares/errorHandler.js';
import { institucaoWhereParaPostsVitrinePublica } from '../community-ad/communityAd.policy.js';

const PLATFORM_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.COMERCIAL];

export function isPlatformStaff(roles: UserRole[]): boolean {
  return roles.some((r) => PLATFORM_ROLES.includes(r));
}

export function canModeratePost(roles: UserRole[], postInstituicaoId: string, viewerInstituicaoId: string | null): boolean {
  if (!viewerInstituicaoId || viewerInstituicaoId !== postInstituicaoId) return false;
  return roles.some((r) => r === UserRole.ADMIN || r === UserRole.DIRECAO);
}

/**
 * REGRA DE OURO — utilizador autenticado com escola (JWT `instituicaoId`):
 * - Vê **todos** os posts da **própria** `instituicaoId` (públicos e privados).
 * - Vê posts `isPublic: true` de **outras** escolas **só** se a instituição autora cumprir o filtro
 *   de vitrine pública (plano +, se activo, campanha paga aprovada — ver `community-ad`) e fora de grupos.
 *
 * Nunca expõe conteúdo privado de outra escola nem “público” de escola fora do diretório.
 *
 * Staff de plataforma **sem** `instituicaoId`: mesma regra que a vitrine (público elegível).
 */
export function socialPostVisibilityWhere(
  instituicaoId: string | null,
  roles: UserRole[],
): Prisma.SocialPostWhereInput {
  const vitrineInstituicao = institucaoWhereParaPostsVitrinePublica();
  if (isPlatformStaff(roles) && !instituicaoId) {
    return {
      isPublic: true,
      socialGroupId: null,
      instituicao: vitrineInstituicao,
    };
  }
  if (!instituicaoId) {
    throw new AppError('Instituição necessária para aceder ao módulo social.', 403);
  }
  return {
    OR: [
      { instituicaoId },
      {
        isPublic: true,
        socialGroupId: null,
        instituicao: vitrineInstituicao,
      },
    ],
  };
}

/**
 * Vitrine pública (sem JWT): só posts explicitamente públicos, fora de grupos,
 * cujo autor instituição está elegível no diretório Comunidade.
 */
export function socialPostWhereVitrinePublica(instituicaoIdFilter?: string | null): Prisma.SocialPostWhereInput {
  const where: Prisma.SocialPostWhereInput = {
    isPublic: true,
    socialGroupId: null,
    instituicao: institucaoWhereParaPostsVitrinePublica(),
  };
  const trimmed = instituicaoIdFilter?.trim();
  if (trimmed) {
    where.instituicaoId = trimmed;
  }
  return where;
}
