import { Prisma, StatusAssinatura } from '@prisma/client';

const assinaturaPlanoAtivo: Prisma.AssinaturaWhereInput = {
  status: { in: [StatusAssinatura.ativa, StatusAssinatura.teste] },
};

/**
 * Instituição pode aparecer no diretório Comunidade e veicular ofertas públicas.
 * Alinhado com listagens públicas: estado ativo + assinatura em dia (ou teste).
 */
export function institutionVisibleInCommunityWhere(): Prisma.InstituicaoWhereInput {
  return {
    status: 'ativa',
    assinatura: { is: assinaturaPlanoAtivo },
  };
}
