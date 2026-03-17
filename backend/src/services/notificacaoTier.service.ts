/**
 * Serviço de tier de notificação por plano
 * START: email | PRO: email+telegram | ENTERPRISE: email+telegram+sms
 */

import prisma from '../lib/prisma.js';

export type CanalNotificacao = 'email' | 'telegram' | 'sms';

export type TierNotificacao = 'start' | 'pro' | 'enterprise';

export interface NotificacaoTier {
  tier: TierNotificacao;
  canais: CanalNotificacao[];
  planoNome: string;
}

/**
 * Determina o tier e canais disponíveis a partir do nome do plano
 */
function planoNomeParaTier(planoNome: string): TierNotificacao {
  const n = (planoNome || '').toLowerCase();
  if (n.includes('enterprise')) return 'enterprise';
  if (n.includes('pro') || n.includes('profissional')) return 'pro';
  return 'start';
}

/**
 * Canais disponíveis por tier
 */
const CANAIS_POR_TIER: Record<TierNotificacao, CanalNotificacao[]> = {
  start: ['email'],
  pro: ['email', 'telegram'],
  enterprise: ['email', 'telegram', 'sms'],
};

/**
 * Obtém o tier de notificação da instituição
 */
export async function getNotificacaoTier(instituicaoId: string | null): Promise<NotificacaoTier | null> {
  if (!instituicaoId) return null;

  const assinatura = await prisma.assinatura.findUnique({
    where: { instituicaoId, status: 'ativa' },
    include: { plano: true },
  });

  if (!assinatura?.plano) return null;

  const planoNome = assinatura.plano.nome || '';
  const tier = planoNomeParaTier(planoNome);
  const canais = CANAIS_POR_TIER[tier];

  return {
    tier,
    canais,
    planoNome,
  };
}

/**
 * Verifica se o plano inclui um canal
 */
export async function planoIncluiCanal(
  instituicaoId: string | null,
  canal: CanalNotificacao
): Promise<boolean> {
  const tier = await getNotificacaoTier(instituicaoId);
  return tier?.canais.includes(canal) ?? false;
}
