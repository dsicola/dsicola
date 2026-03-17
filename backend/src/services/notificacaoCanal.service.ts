/**
 * Orquestrador de notificações por canal (email, telegram, sms)
 * Usa configuração do admin em Configurações - o admin escolhe quais eventos enviam e por quais canais
 */

import { Request } from 'express';
import prisma from '../lib/prisma.js';
import { EmailService, type EmailType } from './email.service.js';
import {
  getTriggerConfig,
  type TriggerNotificacao,
  type CanalNotificacao,
} from './notificacaoConfig.service.js';
import { enviarSms } from './sms.service.js';
import { enviarTelegram } from './telegram.service.js';

export type TipoNotificacaoCredencial =
  | 'CRIACAO_CONTA_ACESSO'
  | 'CRIACAO_CONTA_FUNCIONARIO'
  | 'MATRICULA_ALUNO'
  | 'PAGAMENTO_CONFIRMADO'
  | 'PAGAMENTO_ESTORNADO';

const TIPO_TO_TRIGGER: Record<TipoNotificacaoCredencial, TriggerNotificacao> = {
  CRIACAO_CONTA_ACESSO: 'conta_criada',
  CRIACAO_CONTA_FUNCIONARIO: 'funcionario_criado',
  MATRICULA_ALUNO: 'matricula_realizada',
  PAGAMENTO_CONFIRMADO: 'pagamento_confirmado',
  PAGAMENTO_ESTORNADO: 'mensalidade_estornada',
};

export interface DadosCredencial {
  email: string;
  senhaTemporaria?: string;
  nomeUsuario: string;
  linkLogin?: string;
  [key: string]: unknown;
}

export interface DadosFuncionario extends DadosCredencial {
  nomeFuncionario: string;
  cargo: string;
}

export interface DadosMatricula {
  nomeAluno: string;
  curso: string;
  turma: string;
  anoLetivo: string;
  numeroMatricula?: string;
}

export interface DadosPagamento {
  nomeAluno: string;
  valor?: string | number;
  referencia?: string;
  dataPagamento?: string;
}

/**
 * Monta mensagem curta para SMS/Telegram (texto amigável e conciso)
 */
function montarMensagemCurta(
  tipo: TipoNotificacaoCredencial,
  dados: DadosCredencial | DadosFuncionario | DadosMatricula | DadosPagamento
): string {
  switch (tipo) {
    case 'CRIACAO_CONTA_ACESSO':
    case 'CRIACAO_CONTA_FUNCIONARIO': {
      const d = dados as DadosCredencial | DadosFuncionario;
      return (
        `Olá ${d.nomeUsuario || 'Utilizador'}!\n` +
        `A sua conta de acesso foi criada com sucesso.\n` +
        `Email: ${d.email}\n` +
        `Senha temporária: ${d.senhaTemporaria || '(consulte o email)'}\n` +
        `Acesso: ${d.linkLogin || '(link no email)'}\n` +
        `Por segurança, altere a senha no primeiro login.`
      );
    }
    case 'MATRICULA_ALUNO': {
      const d = dados as DadosMatricula;
      return (
        `Olá ${d.nomeAluno}!\n` +
        `A sua matrícula foi confirmada com sucesso.\n` +
        `Curso: ${d.curso}\n` +
        `Turma: ${d.turma}\n` +
        `Ano letivo: ${d.anoLetivo}` +
        (d.numeroMatricula ? `\nN.º matrícula: ${d.numeroMatricula}` : '')
      );
    }
    case 'PAGAMENTO_CONFIRMADO': {
      const d = dados as DadosPagamento;
      return (
        `Olá ${d.nomeAluno}!\n` +
        `O seu pagamento foi confirmado com sucesso.` +
        (d.referencia ? ` Ref.: ${d.referencia}` : '') +
        (d.valor ? ` Valor: ${d.valor}` : '')
      );
    }
    case 'PAGAMENTO_ESTORNADO': {
      const d = dados as DadosPagamento;
      return (
        `Olá ${d.nomeAluno}!\n` +
        `Informamos que o seu pagamento foi estornado` +
        (d.referencia ? ` (Ref.: ${d.referencia})` : '') +
        `.\nEm caso de dúvidas, contacte a secretaria.`
      );
    }
    default:
      return 'Recebeu uma notificação. Consulte o seu email para mais detalhes.';
  }
}

/** Exposto para testes - validação do formato das mensagens SMS/Telegram */
export function buildMensagemCurtaParaTest(
  tipo: TipoNotificacaoCredencial,
  dados: DadosCredencial | DadosFuncionario | DadosMatricula | DadosPagamento
): string {
  return montarMensagemCurta(tipo, dados);
}

/**
 * Envia notificação nos canais configurados pelo admin para o trigger
 * Só envia se o trigger estiver enabled e os canais estiverem seleccionados
 */
export async function enviarNotificacaoCredencial(
  req: Request,
  params: {
    instituicaoId: string | null;
    userId: string;
    tipo: TipoNotificacaoCredencial;
    emailType: EmailType;
    dados: DadosCredencial | DadosFuncionario | DadosMatricula | DadosPagamento;
    opts?: { destinatarioNome?: string };
  }
): Promise<{ email: boolean; telegram: boolean; sms: boolean }> {
  const { instituicaoId, userId, tipo, emailType, dados, opts } = params;
  const resultado = { email: false, telegram: false, sms: false };

  const trigger = TIPO_TO_TRIGGER[tipo];
  if (!trigger) return resultado;

  const { enabled, canais } = await getTriggerConfig(instituicaoId, trigger);
  if (!enabled || canais.length === 0) return resultado;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, nomeCompleto: true, telefone: true, telegramChatId: true },
  });

  if (!user?.email) return resultado;

  // 1. Email
  if (canais.includes('email')) {
    try {
      await EmailService.sendEmail(req, user.email, emailType, dados as Record<string, unknown>, {
        destinatarioNome: opts?.destinatarioNome || user.nomeCompleto || undefined,
        instituicaoId: instituicaoId || undefined,
      });
      resultado.email = true;
    } catch (e: unknown) {
      console.error('[NotificacaoCanal] Erro email:', (e as Error)?.message);
    }
  }

  const msg = montarMensagemCurta(tipo, dados);

  // 2. Telegram (se configurado e user tiver chatId)
  if (canais.includes('telegram') && user.telegramChatId) {
    const res = await enviarTelegram(user.telegramChatId, msg);
    if (res.success) resultado.telegram = true;
    else if (res.error) console.error('[NotificacaoCanal] Telegram:', res.error);
  }

  // 3. SMS (se configurado e user tiver telefone)
  if (canais.includes('sms') && user.telefone) {
    const res = await enviarSms(user.telefone, msg);
    if (res.success) resultado.sms = true;
    else if (res.error) console.error('[NotificacaoCanal] SMS:', res.error);
  }

  return resultado;
}

/**
 * Envia broadcast de mensalidade pendente para múltiplos utilizadores
 * Usa trigger mensalidade_pendente da config
 */
export async function enviarBroadcastMensalidadePendente(
  req: Request,
  params: {
    instituicaoId: string;
    userIds: string[];
    mensagem: string;
    assuntoEmail?: string;
  }
): Promise<{ enviados: number; erros: number }> {
  const { instituicaoId, userIds, mensagem, assuntoEmail } = params;
  const { enabled, canais } = await getTriggerConfig(instituicaoId, 'mensalidade_pendente');
  if (!enabled || userIds.length === 0) return { enviados: 0, erros: 0 };

  let enviados = 0;
  let erros = 0;

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, email: true, nomeCompleto: true, telefone: true, telegramChatId: true },
  });

  for (const user of users) {
    try {
      if (canais.includes('email') && user.email) {
        await EmailService.sendEmail(
          req,
          user.email,
          'NOTIFICACAO_GERAL',
          { mensagem, titulo: assuntoEmail || 'Mensalidade pendente' },
          {
            destinatarioNome: user.nomeCompleto || undefined,
            instituicaoId,
            customSubject: assuntoEmail || 'Mensalidade pendente - DSICOLA',
          }
        );
        enviados++;
      }
      if (canais.includes('telegram') && user.telegramChatId) {
        const res = await enviarTelegram(user.telegramChatId, mensagem);
        if (res.success) enviados++;
      }
      if (canais.includes('sms') && user.telefone) {
        const res = await enviarSms(user.telefone, mensagem);
        if (res.success) enviados++;
      }
    } catch (e: unknown) {
      erros++;
      console.error('[BroadcastMensalidade] Erro para user', user.id, (e as Error)?.message);
    }
  }

  return { enviados, erros };
}
