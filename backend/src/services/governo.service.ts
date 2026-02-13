import prisma from '../lib/prisma.js';
import { AuditService, ModuloAuditoria, EntidadeAuditoria, AcaoAuditoria } from './audit.service.js';
import { AppError } from '../middlewares/errorHandler.js';

/**
 * Tipos de eventos governamentais
 */
export enum TipoEventoGovernamental {
  MATRICULA = 'MATRICULA',
  CONCLUSAO = 'CONCLUSAO',
  DIPLOMA = 'DIPLOMA',
  TRANSFERENCIA = 'TRANSFERENCIA',
  CANCELAMENTO_MATRICULA = 'CANCELAMENTO_MATRICULA',
}

/**
 * Status dos eventos governamentais
 */
export enum StatusEventoGovernamental {
  PENDENTE = 'PENDENTE',
  ENVIADO = 'ENVIADO',
  ERRO = 'ERRO',
  CANCELADO = 'CANCELADO',
}

/**
 * Interface para criar evento governamental
 */
export interface CriarEventoGovernamentalInput {
  instituicaoId: string;
  tipoEvento: TipoEventoGovernamental;
  payloadJson: any;
  criadoPor?: string;
  observacoes?: string;
}

/**
 * Interface para resposta de envio (futuro)
 */
export interface RespostaEnvioGoverno {
  sucesso: boolean;
  protocolo?: string;
  mensagem?: string;
  erro?: string;
}

/**
 * Serviço de Integração Governamental
 * 
 * ARQUITETURA DESACOPLADA:
 * - Eventos são gerados internamente pelo sistema
 * - Envio é OPCIONAL e configurável via feature flag
 * - Sistema NÃO depende do governo para funcionar
 * - Auditoria obrigatória em todas as operações
 */
export class GovernoService {
  /**
   * Feature flag para ativar/desativar integração
   * Por padrão, integração está DESATIVADA
   * Pode ser configurada via variável de ambiente ou configuração da instituição
   */
  private static isIntegracaoAtiva(instituicaoId: string): boolean {
    // Por padrão, integração está desativada
    // No futuro, pode verificar configuração da instituição ou variável de ambiente
    const envFlag = process.env.INTEGRACAO_GOVERNO_ATIVA === 'true';
    // TODO: Verificar configuração da instituição se necessário
    return envFlag;
  }

  /**
   * Criar evento governamental
   * Eventos são gerados internamente pelo sistema
   * Não depende de integração externa para funcionar
   */
  static async criarEvento(
    input: CriarEventoGovernamentalInput
  ): Promise<any> {
    try {
      // Validar input
      if (!input.instituicaoId) {
        throw new AppError('instituicaoId é obrigatório', 400);
      }
      if (!input.tipoEvento) {
        throw new AppError('tipoEvento é obrigatório', 400);
      }
      if (!input.payloadJson) {
        throw new AppError('payloadJson é obrigatório', 400);
      }

      // Criar evento no banco de dados
      const evento = await prisma.eventoGovernamental.create({
        data: {
          instituicaoId: input.instituicaoId,
          tipoEvento: input.tipoEvento as any,
          payloadJson: input.payloadJson,
          status: 'PENDENTE',
          criadoPor: input.criadoPor || undefined,
          observacoes: input.observacoes || undefined,
          tentativas: 0,
        },
        include: {
          instituicao: {
            select: {
              id: true,
              nome: true,
            },
          },
        },
      });

      // Auditoria obrigatória
      await AuditService.log(null, {
        modulo: ModuloAuditoria.INTEGRACAO_GOVERNAMENTAL,
        acao: AcaoAuditoria.CREATE,
        entidade: EntidadeAuditoria.EVENTO_GOVERNAMENTAL,
        entidadeId: evento.id,
        dadosNovos: {
          tipoEvento: input.tipoEvento,
          status: 'PENDENTE',
        },
        observacao: `Evento governamental criado: ${input.tipoEvento}`,
        instituicaoId: input.instituicaoId,
      });

      // Se integração estiver ativa, tentar enviar automaticamente (futuro)
      if (this.isIntegracaoAtiva(input.instituicaoId)) {
        // TODO: Implementar envio automático quando integração estiver ativa
        // Por enquanto, apenas criar o evento
      }

      return evento;
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(`Erro ao criar evento governamental: ${error.message}`, 500);
    }
  }

  /**
   * Listar eventos governamentais
   * Filtrado por instituição (multi-tenant)
   */
  static async listarEventos(
    instituicaoId: string,
    filtros?: {
      tipoEvento?: TipoEventoGovernamental;
      status?: StatusEventoGovernamental;
      dataInicio?: Date;
      dataFim?: Date;
    }
  ): Promise<any[]> {
    try {
      const where: any = {
        instituicaoId,
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

      const eventos = await prisma.eventoGovernamental.findMany({
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

      return eventos;
    } catch (error: any) {
      throw new AppError(`Erro ao listar eventos governamentais: ${error.message}`, 500);
    }
  }

  /**
   * Obter evento por ID
   */
  static async obterEventoPorId(
    eventoId: string,
    instituicaoId: string
  ): Promise<any> {
    try {
      const evento = await prisma.eventoGovernamental.findFirst({
        where: {
          id: eventoId,
          instituicaoId, // Multi-tenant security
        },
        include: {
          instituicao: {
            select: {
              id: true,
              nome: true,
            },
          },
        },
      });

      if (!evento) {
        throw new AppError('Evento governamental não encontrado', 404);
      }

      return evento;
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(`Erro ao obter evento governamental: ${error.message}`, 500);
    }
  }

  /**
   * Tentar enviar evento ao órgão governamental
   * 
   * NOTA: Esta função é um PLACEHOLDER para integração futura
   * Por enquanto, apenas simula o envio e atualiza o status
   * 
   * Quando a integração real for implementada:
   * 1. Fazer chamada HTTP/API ao órgão governamental
   * 2. Processar resposta
   * 3. Atualizar status e protocolo
   * 4. Registrar erro se necessário
   */
  static async enviarEvento(
    eventoId: string,
    instituicaoId: string
  ): Promise<RespostaEnvioGoverno> {
    try {
      // Verificar se integração está ativa
      if (!this.isIntegracaoAtiva(instituicaoId)) {
        throw new AppError('Integração governamental não está ativa para esta instituição', 400);
      }

      // Buscar evento
      const evento = await this.obterEventoPorId(eventoId, instituicaoId);

      if (evento.status === 'ENVIADO') {
        throw new AppError('Evento já foi enviado', 400);
      }

      if (evento.status === 'CANCELADO') {
        throw new AppError('Evento foi cancelado e não pode ser enviado', 400);
      }

      // PLACEHOLDER: Simular envio
      // No futuro, aqui será feita a chamada real à API governamental
      const sucesso = true; // Simular sucesso
      const protocolo = `PROT-${Date.now()}`; // Protocolo simulado

      // Atualizar evento
      const eventoAtualizado = await prisma.eventoGovernamental.update({
        where: { id: eventoId },
        data: {
          status: sucesso ? 'ENVIADO' : 'ERRO',
          protocolo: sucesso ? protocolo : null,
          enviadoEm: sucesso ? new Date() : null,
          tentativas: evento.tentativas + 1,
          erro: sucesso ? null : 'Erro simulado (integração não implementada)',
        },
      });

      // Auditoria obrigatória
      await AuditService.log(null, {
        modulo: ModuloAuditoria.INTEGRACAO_GOVERNAMENTAL,
        acao: AcaoAuditoria.SUBMIT,
        entidade: EntidadeAuditoria.EVENTO_GOVERNAMENTAL,
        entidadeId: eventoId,
        dadosAnteriores: {
          status: evento.status,
          tentativas: evento.tentativas,
        },
        dadosNovos: {
          status: eventoAtualizado.status,
          protocolo: eventoAtualizado.protocolo,
          tentativas: eventoAtualizado.tentativas,
        },
        observacao: `Evento enviado ao órgão governamental${protocolo ? ` - Protocolo: ${protocolo}` : ''}`,
        instituicaoId,
      });

      return {
        sucesso,
        protocolo: sucesso ? protocolo : undefined,
        mensagem: sucesso ? 'Evento enviado com sucesso' : 'Erro ao enviar evento',
      };
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(`Erro ao enviar evento governamental: ${error.message}`, 500);
    }
  }

  /**
   * Cancelar evento governamental
   * Apenas eventos PENDENTE ou ERRO podem ser cancelados
   */
  static async cancelarEvento(
    eventoId: string,
    instituicaoId: string,
    motivo?: string
  ): Promise<any> {
    try {
      const evento = await this.obterEventoPorId(eventoId, instituicaoId);

      if (evento.status === 'ENVIADO') {
        throw new AppError('Evento já foi enviado e não pode ser cancelado', 400);
      }

      if (evento.status === 'CANCELADO') {
        throw new AppError('Evento já está cancelado', 400);
      }

      const eventoAtualizado = await prisma.eventoGovernamental.update({
        where: { id: eventoId },
        data: {
          status: 'CANCELADO',
          observacoes: motivo ? `${evento.observacoes || ''}\nCancelado: ${motivo}`.trim() : evento.observacoes,
        },
      });

      // Auditoria obrigatória
      await AuditService.log(null, {
        modulo: ModuloAuditoria.INTEGRACAO_GOVERNAMENTAL,
        acao: AcaoAuditoria.CANCELAR,
        entidade: EntidadeAuditoria.EVENTO_GOVERNAMENTAL,
        entidadeId: eventoId,
        dadosAnteriores: {
          status: evento.status,
        },
        dadosNovos: {
          status: eventoAtualizado.status,
        },
        observacao: motivo ? `Evento cancelado: ${motivo}` : 'Evento cancelado',
        instituicaoId,
      });

      return eventoAtualizado;
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(`Erro ao cancelar evento governamental: ${error.message}`, 500);
    }
  }

  /**
   * Retentar envio de evento com erro
   * Incrementa tentativas e tenta enviar novamente
   */
  static async retentarEnvio(
    eventoId: string,
    instituicaoId: string
  ): Promise<RespostaEnvioGoverno> {
    try {
      const evento = await this.obterEventoPorId(eventoId, instituicaoId);

      if (evento.status !== 'ERRO') {
        throw new AppError('Apenas eventos com status ERRO podem ser reenviados', 400);
      }

      return await this.enviarEvento(eventoId, instituicaoId);
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(`Erro ao retentar envio: ${error.message}`, 500);
    }
  }

  /**
   * Obter estatísticas de eventos por instituição
   */
  static async obterEstatisticas(
    instituicaoId: string
  ): Promise<{
    total: number;
    pendentes: number;
    enviados: number;
    erros: number;
    cancelados: number;
    porTipo: Record<string, number>;
  }> {
    try {
      const eventos = await prisma.eventoGovernamental.findMany({
        where: { instituicaoId },
        select: {
          tipoEvento: true,
          status: true,
        },
      });

      const estatisticas = {
        total: eventos.length,
        pendentes: eventos.filter(e => e.status === 'PENDENTE').length,
        enviados: eventos.filter(e => e.status === 'ENVIADO').length,
        erros: eventos.filter(e => e.status === 'ERRO').length,
        cancelados: eventos.filter(e => e.status === 'CANCELADO').length,
        porTipo: {} as Record<string, number>,
      };

      eventos.forEach(evento => {
        const tipo = evento.tipoEvento as string;
        estatisticas.porTipo[tipo] = (estatisticas.porTipo[tipo] || 0) + 1;
      });

      return estatisticas;
    } catch (error: any) {
      throw new AppError(`Erro ao obter estatísticas: ${error.message}`, 500);
    }
  }
}

