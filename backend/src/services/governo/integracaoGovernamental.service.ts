/**
 * Serviço de Integração Governamental
 * 
 * ARQUITETURA DESACOPLADA:
 * - Nenhuma chamada real a APIs externas
 * - Feature flag controla ativação
 * - Sistema funciona SEM integração ativa
 * 
 * REGRAS:
 * - instituicao_id sempre do token
 * - Envio é OPCIONAL e configurável
 * - Logs e auditoria obrigatórios
 */

import prisma from '../../lib/prisma.js';
import { AppError } from '../../middlewares/errorHandler.js';
import { StatusEventoGovernamental, TipoEventoGovernamental } from '@prisma/client';
import { AuditService, ModuloAuditoria, EntidadeAuditoria, AcaoAuditoria } from '../audit.service.js';

/**
 * Feature flag para integração governamental
 * 
 * REGRA: Sistema funciona SEM integração ativa
 * Quando ativada, apenas tenta enviar eventos PENDENTES
 */
const INTEGRACAO_ATIVA = process.env.INTEGRACAO_GOVERNAMENTAL_ATIVA === 'true';

/**
 * URL base da API governamental (configurável via env)
 * 
 * REGRA: Se não configurada, integração não funciona
 */
const API_GOVERNO_URL = process.env.API_GOVERNO_URL || null;
const API_GOVERNO_TOKEN = process.env.API_GOVERNO_TOKEN || null;

/**
 * Verificar se integração está ativa e configurada
 */
export function isIntegracaoAtiva(): boolean {
  return INTEGRACAO_ATIVA && !!API_GOVERNO_URL && !!API_GOVERNO_TOKEN;
}

/**
 * Enviar evento governamental (SIMULADO - não implementa API real)
 * 
 * REGRA: Esta função é chamada apenas se integração estiver ativa
 * Por enquanto, apenas simula o envio e atualiza status
 */
export async function enviarEventoGovernamental(
  eventoId: string,
  instituicaoId: string
): Promise<{ sucesso: boolean; protocolo?: string; erro?: string }> {
  try {
    // Verificar se integração está ativa
    if (!isIntegracaoAtiva()) {
      return {
        sucesso: false,
        erro: 'Integração governamental não está ativa ou configurada',
      };
    }

    // Buscar evento
    const evento = await prisma.eventoGovernamental.findFirst({
      where: {
        id: eventoId,
        instituicaoId, // Multi-tenant security
      },
    });

    if (!evento) {
      throw new AppError('Evento governamental não encontrado', 404);
    }

    if (evento.status !== StatusEventoGovernamental.PENDENTE) {
      throw new AppError(`Evento já foi processado (status: ${evento.status})`, 400);
    }

    // SIMULAÇÃO: Por enquanto, apenas simula envio bem-sucedido
    // FUTURO: Aqui será implementada a chamada real à API governamental
    // 
    // Exemplo de implementação futura:
    // const response = await fetch(`${API_GOVERNO_URL}/eventos`, {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${API_GOVERNO_TOKEN}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({
    //     tipo: evento.tipoEvento,
    //     payload: evento.payloadJson,
    //     instituicaoId,
    //   }),
    // });
    //
    // if (!response.ok) {
    //   throw new Error(`API governamental retornou erro: ${response.statusText}`);
    // }
    //
    // const resultado = await response.json();
    // const protocolo = resultado.protocolo;

    // Por enquanto, simular envio bem-sucedido
    const protocolo = `PROT-${Date.now()}-${eventoId.substring(0, 8).toUpperCase()}`;

    // Atualizar status do evento
    await prisma.eventoGovernamental.update({
      where: { id: eventoId },
      data: {
        status: StatusEventoGovernamental.ENVIADO,
        protocolo,
        enviadoEm: new Date(),
      },
    });

    // Auditoria
    await AuditService.log(null, {
      modulo: ModuloAuditoria.INTEGRACAO_GOVERNAMENTAL,
      entidade: EntidadeAuditoria.EVENTO_GOVERNAMENTAL,
      acao: AcaoAuditoria.UPDATE,
      entidadeId: eventoId,
      instituicaoId,
      dadosAnteriores: {
        status: StatusEventoGovernamental.PENDENTE,
      },
      dadosNovos: {
        status: StatusEventoGovernamental.ENVIADO,
        protocolo,
      },
      observacao: 'Evento enviado para órgão governamental (simulado)',
    });

    return {
      sucesso: true,
      protocolo,
    };
  } catch (error: any) {
    // Em caso de erro, atualizar status do evento
    try {
      await prisma.eventoGovernamental.update({
        where: { id: eventoId },
        data: {
          status: StatusEventoGovernamental.ERRO,
          erro: error.message || 'Erro desconhecido ao enviar evento',
          tentativas: { increment: 1 },
        },
      });

      // Auditoria do erro
      await AuditService.log(null, {
        modulo: ModuloAuditoria.INTEGRACAO_GOVERNAMENTAL,
        entidade: EntidadeAuditoria.EVENTO_GOVERNAMENTAL,
        acao: AcaoAuditoria.UPDATE,
        entidadeId: eventoId,
        instituicaoId,
        observacao: `Erro ao enviar evento: ${error.message}`,
      });
    } catch (updateError) {
      console.error('[IntegracaoGovernamental] Erro ao atualizar status do evento:', updateError);
    }

    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(`Erro ao enviar evento governamental: ${error.message}`, 500);
  }
}

/**
 * Reprocessar eventos com erro
 * 
 * REGRA: Permite tentar reenviar eventos que falharam
 */
export async function reprocessarEventosComErro(
  instituicaoId: string,
  limite?: number
): Promise<{ processados: number; sucessos: number; erros: number }> {
  try {
    if (!isIntegracaoAtiva()) {
      throw new AppError('Integração governamental não está ativa', 400);
    }

    // Buscar eventos com erro
    const eventos = await prisma.eventoGovernamental.findMany({
      where: {
        instituicaoId,
        status: StatusEventoGovernamental.ERRO,
      },
      take: limite || 100,
      orderBy: {
        updatedAt: 'desc',
      },
    });

    let sucessos = 0;
    let erros = 0;

    for (const evento of eventos) {
      try {
        // Resetar status para PENDENTE antes de tentar novamente
        await prisma.eventoGovernamental.update({
          where: { id: evento.id },
          data: {
            status: StatusEventoGovernamental.PENDENTE,
          },
        });

        const resultado = await enviarEventoGovernamental(evento.id, instituicaoId);
        if (resultado.sucesso) {
          sucessos++;
        } else {
          erros++;
        }
      } catch (error) {
        erros++;
        console.error(`[ReprocessarEventos] Erro ao reprocessar evento ${evento.id}:`, error);
      }
    }

    return {
      processados: eventos.length,
      sucessos,
      erros,
    };
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(`Erro ao reprocessar eventos: ${error.message}`, 500);
  }
}

/**
 * Obter configuração de integração (sem expor tokens)
 */
export async function obterConfiguracaoIntegracao(
  instituicaoId: string
): Promise<{
  ativa: boolean;
  configurada: boolean;
  urlConfigurada: boolean;
  tokenConfigurado: boolean;
  totalEventos: number;
  eventosPendentes: number;
  eventosEnviados: number;
  eventosComErro: number;
}> {
  try {
    const eventos = await prisma.eventoGovernamental.findMany({
      where: { instituicaoId },
      select: { status: true },
    });

    return {
      ativa: INTEGRACAO_ATIVA,
      configurada: isIntegracaoAtiva(),
      urlConfigurada: !!API_GOVERNO_URL,
      tokenConfigurado: !!API_GOVERNO_TOKEN,
      totalEventos: eventos.length,
      eventosPendentes: eventos.filter(e => e.status === StatusEventoGovernamental.PENDENTE).length,
      eventosEnviados: eventos.filter(e => e.status === StatusEventoGovernamental.ENVIADO).length,
      eventosComErro: eventos.filter(e => e.status === StatusEventoGovernamental.ERRO).length,
    };
  } catch (error: any) {
    throw new AppError(`Erro ao obter configuração: ${error.message}`, 500);
  }
}

