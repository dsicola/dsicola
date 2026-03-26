import type { Prisma } from '@prisma/client';
import { CommunityAdBookingStatus, CommunityAdScope } from '@prisma/client';
import { institutionVisibleInCommunityWhere } from '../../policies/instituicaoComunidadePublica.policy.js';
import { isCommunityPublicidadeObrigatoria } from './communityAd.config.js';

/**
 * Critério de instituição para posts públicos aparecerem na vitrine anónima e em feeds “Outras escolas”.
 * Quando `COMMUNITY_PUBLICIDADE_OBRIGATORIA` está activo, soma-se à elegibilidade de plano a existência
 * de campanha paga **APROVADA** a cobrir `VITRINE_SOCIAL` ou `BOTH` dentro da vigência (startsAt/endsAt).
 */
export function institucaoWhereParaPostsVitrinePublica(at: Date = new Date()): Prisma.InstituicaoWhereInput {
  const base = institutionVisibleInCommunityWhere();
  if (!isCommunityPublicidadeObrigatoria()) {
    return base;
  }
  return {
    AND: [
      base,
      {
        communityAdBookings: {
          some: {
            status: CommunityAdBookingStatus.APROVADA,
            startsAt: { lte: at },
            endsAt: { gte: at },
            scope: { in: [CommunityAdScope.VITRINE_SOCIAL, CommunityAdScope.BOTH] },
          },
        },
      },
    ],
  };
}
