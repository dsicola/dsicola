/**
 * ========================================
 * SERVIÇO DE INTEGRAÇÃO GOVERNAMENTAL
 * ========================================
 * 
 * Camada desacoplada para integração com órgãos governamentais
 * Sistema NÃO depende do governo para funcionar
 * Integração é OPCIONAL e configurável via feature flag
 */

import prisma from '../../lib/prisma.js';
import { TipoEventoGovernamental, StatusEventoGovernamental } from '@prisma/client';
import { AuditService, ModuloAuditoria, EntidadeAuditoria, AcaoAuditoria } from '../audit.service.js';
import { Request } from 'express';

/**
 * Feature Flag: Ativar/Desativar integração governamental
 * Por padrão: DESATIVADA (false)
 * Pode ser configurada por instituição via ConfiguracaoInstituicao
 */
export async function isIntegracaoGovernamentalAtiva(instituicaoId: string): Promise<boolean> {
  try {
    const config = await prisma.configuracaoInstituicao.findUnique({
      where: { instituicaoId },
      select: { integracaoGovernoAtiva: true },
    });
    
    // Se não houver configuração, retornar false (desativado por padrão)
    return config?.integracaoGovernoAtiva === true;
  } catch {
    // Em caso de erro, retornar false (desativado por padrão)
    return false;
  }
}

/**
 * Gerar evento governamental
 * Cria o evento no banco de dados (sempre)
 * Envio ao governo é OPCIONAL e controlado por feature flag
 */
export async function gerarEventoGovernamental(
  req: Request | null,
  params: {
    instituicaoId: string;
    tipoEvento: TipoEventoGovernamental;
    payload: any; // Payload JSON com dados do evento
    criadoPor?: string; // ID do usuário que gerou o evento
    observacoes?: string;
  }
): Promise<{ id: string; status: StatusEventoGovernamental }> {
  // CRITICAL: Multi-tenant - instituicaoId sempre do token, nunca do body
  if (!params.instituicaoId) {
    throw new Error('instituicao_id é obrigatório e deve vir do token de autenticação');
  }

  // Verificar se instituição existe
  const instituicao = await prisma.instituicao.findUnique({
    where: { id: params.instituicaoId },
  });

  if (!instituicao) {
    throw new Error('Instituição não encontrada');
  }

  // Criar evento (sempre criar, independente de feature flag)
  const evento = await prisma.eventoGovernamental.create({
    data: {
      instituicaoId: params.instituicaoId,
      tipoEvento: params.tipoEvento,
      payloadJson: params.payload,
      status: StatusEventoGovernamental.PENDENTE,
      criadoPor: params.criadoPor || null,
      observacoes: params.observacoes || null,
    },
  });

  // Auditoria obrigatória
  if (req) {
    await AuditService.log(req, {
      modulo: ModuloAuditoria.INTEGRACAO_GOVERNAMENTAL,
      acao: AcaoAuditoria.CREATE,
      entidade: EntidadeAuditoria.EVENTO_GOVERNAMENTAL,
      entidadeId: evento.id,
      dadosNovos: {
        tipoEvento: params.tipoEvento,
        status: StatusEventoGovernamental.PENDENTE,
        instituicaoId: params.instituicaoId,
      },
      observacao: `Evento governamental criado: ${params.tipoEvento}`,
    });
  }

  // Tentar enviar ao governo (se feature flag estiver ativa)
  const integracaoAtiva = await isIntegracaoGovernamentalAtiva(params.instituicaoId);
  if (integracaoAtiva) {
    // Enviar de forma assíncrona (não bloquear a operação principal)
    Promise.resolve().then(async () => {
      try {
        await enviarEventoGovernamental(req, evento.id, params.instituicaoId);
      } catch (error) {
        // Erro não deve quebrar a operação principal
        console.error('[GovernoService] Erro ao enviar evento governamental:', error);
      }
    });
  }

  return {
    id: evento.id,
    status: evento.status,
  };
}

/**
 * Enviar evento governamental ao órgão
 * Esta função será implementada quando a integração real for necessária
 * Por enquanto, apenas simula o envio
 * 
 * P0 MULTI-TENANT: instituicaoId obrigatório para garantir que só acessamos evento da instituição
 */
async function enviarEventoGovernamental(
  req: Request | null,
  eventoId: string,
  instituicaoId: string
): Promise<void> {
  const evento = await prisma.eventoGovernamental.findFirst({
    where: { id: eventoId, instituicaoId },
    include: { instituicao: true },
  });

  if (!evento) {
    throw new Error('Evento governamental não encontrado ou não pertence à instituição');
  }

  // Verificar se já foi enviado
  if (evento.status === StatusEventoGovernamental.ENVIADO) {
    return; // Já foi enviado, não reenviar
  }

  // Atualizar tentativas
  const tentativas = evento.tentativas + 1;

  try {
    // TODO: Implementar chamada real à API governamental quando necessário
    // Por enquanto, apenas simular sucesso
    // const response = await axios.post(GOV_API_URL, evento.payloadJson, { ... });
    
    // Simulação: Marcar como enviado
    const protocolo = `PROT-${Date.now()}-${eventoId.substring(0, 8)}`;
    
    await prisma.eventoGovernamental.update({
      where: { id: eventoId },
      data: {
        status: StatusEventoGovernamental.ENVIADO,
        protocolo,
        enviadoEm: new Date(),
        tentativas,
      },
    });

    // Auditoria
    if (req) {
      await AuditService.log(req, {
        modulo: ModuloAuditoria.INTEGRACAO_GOVERNAMENTAL,
        acao: 'ENVIAR',
        entidade: EntidadeAuditoria.EVENTO_GOVERNAMENTAL,
        entidadeId: eventoId,
        dadosNovos: {
          status: StatusEventoGovernamental.ENVIADO,
          protocolo,
          enviadoEm: new Date(),
        },
        observacao: `Evento enviado ao órgão governamental. Protocolo: ${protocolo}`,
      });
    }
  } catch (error: any) {
    // Marcar como erro
    await prisma.eventoGovernamental.update({
      where: { id: eventoId },
      data: {
        status: StatusEventoGovernamental.ERRO,
        erro: error?.message || 'Erro ao enviar evento ao órgão governamental',
        tentativas,
      },
    });

    // Auditoria de erro
    if (req) {
      await AuditService.log(req, {
        modulo: ModuloAuditoria.INTEGRACAO_GOVERNAMENTAL,
        acao: 'ENVIAR',
        entidade: EntidadeAuditoria.EVENTO_GOVERNAMENTAL,
        entidadeId: eventoId,
        dadosNovos: {
          status: StatusEventoGovernamental.ERRO,
          erro: error?.message,
        },
        observacao: `Erro ao enviar evento ao órgão governamental: ${error?.message}`,
      });
    }

    throw error;
  }
}

/**
 * Reenviar evento governamental
 * Permite reenviar eventos que falharam
 */
export async function reenviarEventoGovernamental(
  req: Request,
  eventoId: string,
  instituicaoId: string
): Promise<{ status: StatusEventoGovernamental; protocolo?: string }> {
  // Verificar se integração está ativa
  const integracaoAtiva = await isIntegracaoGovernamentalAtiva(instituicaoId);
  if (!integracaoAtiva) {
    throw new Error('Integração governamental não está ativa para esta instituição');
  }

  // Buscar evento
  const evento = await prisma.eventoGovernamental.findFirst({
    where: {
      id: eventoId,
      instituicaoId, // Multi-tenant security
    },
  });

  if (!evento) {
    throw new Error('Evento governamental não encontrado');
  }

  // Resetar status para PENDENTE para permitir reenvio
  await prisma.eventoGovernamental.update({
    where: { id: eventoId },
    data: {
      status: StatusEventoGovernamental.PENDENTE,
      erro: null,
    },
  });

  // Tentar enviar novamente
  await enviarEventoGovernamental(req, eventoId, instituicaoId);

  // Buscar evento atualizado (com filtro multi-tenant)
  const eventoAtualizado = await prisma.eventoGovernamental.findFirst({
    where: { id: eventoId, instituicaoId },
  });

  return {
    status: eventoAtualizado!.status,
    protocolo: eventoAtualizado!.protocolo || undefined,
  };
}

/**
 * Cancelar evento governamental
 * Apenas eventos PENDENTE podem ser cancelados
 */
export async function cancelarEventoGovernamental(
  req: Request,
  eventoId: string,
  instituicaoId: string,
  observacoes?: string
): Promise<void> {
  const evento = await prisma.eventoGovernamental.findFirst({
    where: {
      id: eventoId,
      instituicaoId, // Multi-tenant security
    },
  });

  if (!evento) {
    throw new Error('Evento governamental não encontrado');
  }

  if (evento.status !== StatusEventoGovernamental.PENDENTE) {
    throw new Error('Apenas eventos PENDENTE podem ser cancelados');
  }

  await prisma.eventoGovernamental.update({
    where: { id: eventoId },
    data: {
      status: StatusEventoGovernamental.CANCELADO,
      observacoes: observacoes || evento.observacoes || null,
    },
  });

  // Auditoria
  await AuditService.log(req, {
    modulo: ModuloAuditoria.INTEGRACAO_GOVERNAMENTAL,
    acao: AcaoAuditoria.CANCELAR,
    entidade: EntidadeAuditoria.EVENTO_GOVERNAMENTAL,
    entidadeId: eventoId,
    dadosAnteriores: {
      status: StatusEventoGovernamental.PENDENTE,
    },
    dadosNovos: {
      status: StatusEventoGovernamental.CANCELADO,
    },
    observacao: observacoes || 'Evento governamental cancelado',
  });
}

/**
 * Buscar eventos governamentais
 */
export async function buscarEventosGovernamentais(
  instituicaoId: string,
  filtros?: {
    tipoEvento?: TipoEventoGovernamental;
    status?: StatusEventoGovernamental;
    dataInicio?: Date;
    dataFim?: Date;
  }
) {
  const where: any = {
    instituicaoId, // Multi-tenant security
  };

  if (filtros?.tipoEvento) {
    where.tipoEvento = filtros.tipoEvento;
  }

  if (filtros?.status) {
    where.status = filtros.status;
  }

  if (filtros?.dataInicio || filtros?.dataFim) {
    where.createdAt = {};
    if (filtros.dataInicio) {
      where.createdAt.gte = filtros.dataInicio;
    }
    if (filtros.dataFim) {
      where.createdAt.lte = filtros.dataFim;
    }
  }

  return await prisma.eventoGovernamental.findMany({
    where,
    include: {
      instituicao: {
        select: {
          id: true,
          nome: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

