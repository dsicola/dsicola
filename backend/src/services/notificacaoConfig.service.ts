/**
 * Serviço de configuração de notificações por instituição
 * O admin configura nas Configurações quais eventos enviam mensagem e por quais canais
 */

import prisma from '../lib/prisma.js';

export type CanalNotificacao = 'email' | 'telegram' | 'sms';

/** Tipos de trigger de notificação configuráveis pelo admin */
export type TriggerNotificacao =
  | 'conta_criada'           // Conta de acesso criada (aluno)
  | 'funcionario_criado'     // Funcionário/professor cadastrado
  | 'matricula_realizada'    // Matrícula efectuada
  | 'pagamento_confirmado'   // Mensalidade/propina paga
  | 'mensalidade_estornada'  // Pagamento estornado
  | 'mensalidade_pendente';  // Broadcast: aviso de mensalidade pendente

export interface TriggerConfig {
  enabled: boolean;
  canais: CanalNotificacao[];
}

export interface NotificacaoConfig {
  triggers: Record<string, TriggerConfig>;
}

const TRIGGERS_PADRAO: Record<TriggerNotificacao, TriggerConfig> = {
  conta_criada: { enabled: true, canais: ['email'] },
  funcionario_criado: { enabled: true, canais: ['email'] },
  matricula_realizada: { enabled: true, canais: ['email'] },
  pagamento_confirmado: { enabled: true, canais: ['email'] },
  mensalidade_estornada: { enabled: true, canais: ['email'] },
  mensalidade_pendente: { enabled: false, canais: ['email'] },
};

/**
 * Obtém a configuração de notificação da instituição
 */
export async function getNotificacaoConfig(instituicaoId: string | null): Promise<NotificacaoConfig> {
  if (!instituicaoId) {
    return { triggers: { ...TRIGGERS_PADRAO } };
  }

  const config = await prisma.configuracaoInstituicao.findFirst({
    where: { instituicaoId },
    select: { notificacaoConfig: true },
  });

  const raw = config?.notificacaoConfig as NotificacaoConfig | null;
  if (!raw?.triggers || typeof raw.triggers !== 'object') {
    return { triggers: { ...TRIGGERS_PADRAO } };
  }

  const triggers: Record<string, TriggerConfig> = {};
  for (const key of Object.keys(TRIGGERS_PADRAO) as TriggerNotificacao[]) {
    const t = raw.triggers[key];
    if (t && typeof t === 'object' && 'enabled' in t) {
      const canais: CanalNotificacao[] = Array.isArray(t.canais)
        ? (t.canais.filter((c: string) => ['email', 'telegram', 'sms'].includes(c)) as CanalNotificacao[])
        : ['email'];
      triggers[key] = { enabled: !!t.enabled, canais: canais.length ? canais : ['email'] };
    } else {
      triggers[key] = TRIGGERS_PADRAO[key];
    }
  }
  return { triggers };
}

/**
 * Verifica se um trigger está habilitado e retorna os canais
 */
export async function getTriggerConfig(
  instituicaoId: string | null,
  trigger: TriggerNotificacao
): Promise<{ enabled: boolean; canais: CanalNotificacao[] }> {
  const config = await getNotificacaoConfig(instituicaoId);
  const t = config.triggers[trigger] ?? TRIGGERS_PADRAO[trigger];
  return { enabled: t.enabled, canais: t.canais };
}

/**
 * Atualiza a configuração de notificações
 */
export async function updateNotificacaoConfig(
  instituicaoId: string,
  data: Partial<NotificacaoConfig>
): Promise<NotificacaoConfig> {
  const current = await getNotificacaoConfig(instituicaoId);
  const triggers = data.triggers ? { ...current.triggers, ...data.triggers } : current.triggers;

  await prisma.configuracaoInstituicao.upsert({
    where: { instituicaoId },
    update: { notificacaoConfig: { triggers } as object },
    create: {
      instituicaoId,
      nomeInstituicao: 'DSICOLA',
      tipoInstituicao: 'ENSINO_MEDIO',
      numeracaoAutomatica: true,
      notificacaoConfig: { triggers } as object,
    },
  });

  return { triggers };
}
