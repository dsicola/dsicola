import prisma from '../../lib/prisma.js';
import { TipoEventoGovernamental, StatusEventoGovernamental } from '@prisma/client';
import { AuditService } from '../audit.service.js';
import { ModuloAuditoria, EntidadeAuditoria, AcaoAuditoria } from '../audit.service.js';
import axios, { AxiosError } from 'axios';

// Usar módulo correto da auditoria
const ModuloIntegracao = ModuloAuditoria.INTEGRACAO_GOVERNAMENTAL;
const EntidadeEvento = EntidadeAuditoria.EVENTO_GOVERNAMENTAL;

// Configurações da API Governamental (variáveis de ambiente)
const API_GOVERNO_URL_DEFAULT = process.env.API_GOVERNO_URL || '';
const API_GOVERNO_TOKEN_DEFAULT = process.env.API_GOVERNO_TOKEN || '';
const API_GOVERNO_TIMEOUT = parseInt(process.env.API_GOVERNO_TIMEOUT || '30000', 10); // 30s padrão
const MAX_TENTATIVAS_ENVIO = parseInt(process.env.MAX_TENTATIVAS_ENVIO || '5', 10); // Máximo 5 tentativas
const RETRY_DELAY_MS = parseInt(process.env.RETRY_DELAY_MS || '60000', 10); // 1 minuto entre tentativas

/**
 * Obter configuração da API governamental (prioridade: configuração da instituição > env)
 */
async function obterConfiguracaoAPI(instituicaoId: string): Promise<{
  url: string;
  token: string;
}> {
  try {
    const config = await prisma.configuracaoInstituicao.findUnique({
      where: { instituicaoId },
      select: {
        integracaoGovernoUrl: true,
        integracaoGovernoToken: true,
      },
    });

    return {
      url: config?.integracaoGovernoUrl || API_GOVERNO_URL_DEFAULT,
      token: config?.integracaoGovernoToken || API_GOVERNO_TOKEN_DEFAULT,
    };
  } catch (error) {
    console.warn('[Integração Governamental] Erro ao buscar configuração:', error);
    return {
      url: API_GOVERNO_URL_DEFAULT,
      token: API_GOVERNO_TOKEN_DEFAULT,
    };
  }
}

/**
 * Serviço para gerenciar eventos governamentais
 * Arquitetura desacoplada - nenhuma chamada externa real
 * Feature flag controla se integração está ativa
 */

export interface CriarEventoGovernamentalInput {
  instituicaoId: string;
  tipoEvento: TipoEventoGovernamental;
  payloadJson: any;
  criadoPor?: string;
  observacoes?: string;
}

export interface EnviarEventoInput {
  eventoId: string;
  instituicaoId: string;
  forcarEnvio?: boolean; // Forçar envio mesmo se feature flag desativada (apenas para testes)
}

/**
 * Verificar se integração governamental está ativa
 * Feature flag: pode ser controlado via variável de ambiente ou configuração por instituição
 */
export async function isIntegracaoGovernamentalAtiva(instituicaoId?: string): Promise<boolean> {
  // Verificar variável de ambiente global (prioridade)
  const envFlag = process.env.INTEGRACAO_GOVERNO_ATIVA === 'true';
  
  // Se não estiver ativa globalmente, retornar false
  if (!envFlag) {
    return false;
  }
  
  // Se não houver instituicaoId, retornar flag global
  if (!instituicaoId) {
    return envFlag;
  }
  
  // Verificar configuração específica da instituição (opcional)
  try {
    const config = await prisma.configuracaoInstituicao.findUnique({
      where: { instituicaoId },
      select: { integracaoGovernoAtiva: true },
    });
    
    // Se houver configuração específica, usar ela; senão, usar flag global
    return config?.integracaoGovernoAtiva ?? envFlag;
  } catch (error) {
    // Em caso de erro, usar flag global
    console.warn('[Integração Governamental] Erro ao verificar configuração da instituição:', error);
    return envFlag;
  }
}

/**
 * Versão síncrona para compatibilidade (usa flag global apenas)
 */
export function isIntegracaoGovernamentalAtivaSync(): boolean {
  return process.env.INTEGRACAO_GOVERNO_ATIVA === 'true';
}

/**
 * Criar evento governamental
 * Eventos são gerados internamente pelo sistema
 */
export async function criarEventoGovernamental(
  input: CriarEventoGovernamentalInput
): Promise<any> {
  const evento = await prisma.eventoGovernamental.create({
    data: {
      instituicaoId: input.instituicaoId,
      tipoEvento: input.tipoEvento,
      payloadJson: input.payloadJson,
      status: StatusEventoGovernamental.PENDENTE,
      criadoPor: input.criadoPor || undefined,
      observacoes: input.observacoes || undefined,
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

  // Auditoria obrigatória (usar log diretamente com instituicaoId)
  if (input.criadoPor) {
    await AuditService.log(null, {
      modulo: ModuloIntegracao,
      entidade: EntidadeEvento,
      entidadeId: evento.id,
      acao: AcaoAuditoria.CREATE,
      observacao: `Evento governamental criado: ${input.tipoEvento}`,
      instituicaoId: input.instituicaoId,
    });
  }

  return evento;
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
): Promise<any[]> {
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
}

/**
 * Buscar evento por ID
 */
export async function buscarEventoGovernamentalPorId(
  eventoId: string,
  instituicaoId: string
): Promise<any | null> {
  const evento = await prisma.eventoGovernamental.findFirst({
    where: {
      id: eventoId,
      instituicaoId,
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

  return evento;
}

/**
 * Marcar evento como enviado
 * Esta função será chamada quando a integração real for implementada
 * Por enquanto, apenas atualiza o status
 */
export async function marcarEventoComoEnviado(
  eventoId: string,
  instituicaoId: string,
  protocolo?: string,
  usuarioId?: string
): Promise<any> {
  const evento = await prisma.eventoGovernamental.update({
    where: {
      id: eventoId,
    },
    data: {
      status: StatusEventoGovernamental.ENVIADO,
      protocolo: protocolo || undefined,
      enviadoEm: new Date(),
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

  // Validar que evento pertence à instituição
  if (evento.instituicaoId !== instituicaoId) {
    throw new Error('Evento não pertence à instituição');
  }

  // Auditoria será feita no controller (precisa do Request)

  return evento;
}

/**
 * Marcar evento com erro
 */
export async function marcarEventoComErro(
  eventoId: string,
  instituicaoId: string,
  erro: string,
  usuarioId?: string
): Promise<any> {
  const evento = await prisma.eventoGovernamental.findFirst({
    where: {
      id: eventoId,
      instituicaoId,
    },
  });

  if (!evento) {
    throw new Error('Evento não encontrado');
  }

  const eventoAtualizado = await prisma.eventoGovernamental.update({
    where: {
      id: eventoId,
    },
    data: {
      status: StatusEventoGovernamental.ERRO,
      erro: erro.substring(0, 500), // Limitar tamanho do erro
      tentativas: evento.tentativas + 1,
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

  // Auditoria será feita no controller (precisa do Request)

  return eventoAtualizado;
}

/**
 * Cancelar evento
 */
export async function cancelarEvento(
  eventoId: string,
  instituicaoId: string,
  motivo: string,
  usuarioId: string
): Promise<any> {
  const evento = await prisma.eventoGovernamental.findFirst({
    where: {
      id: eventoId,
      instituicaoId,
      status: StatusEventoGovernamental.PENDENTE, // Só pode cancelar pendentes
    },
  });

  if (!evento) {
    throw new Error('Evento não encontrado ou não pode ser cancelado');
  }

  const eventoCancelado = await prisma.eventoGovernamental.update({
    where: {
      id: eventoId,
    },
    data: {
      status: StatusEventoGovernamental.CANCELADO,
      observacoes: evento.observacoes 
        ? `${evento.observacoes}\n[CANCELADO] ${motivo}`
        : `[CANCELADO] ${motivo}`,
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

  // Auditoria será feita no controller (precisa do Request)

  return eventoCancelado;
}

/**
 * Enviar evento para API governamental (chamada HTTP real)
 */
async function enviarParaAPIGoverno(
  payload: any,
  tipoEvento: TipoEventoGovernamental,
  instituicaoId: string
): Promise<{ protocolo: string; dadosRetorno?: any }> {
  // Obter configuração (instituição ou env)
  const config = await obterConfiguracaoAPI(instituicaoId);
  
  if (!config.url) {
    throw new Error('API_GOVERNO_URL não configurada');
  }

  if (!config.token) {
    throw new Error('API_GOVERNO_TOKEN não configurado');
  }

  // Preparar headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Event-Type': tipoEvento,
  };

  // Preparar payload para envio
  const payloadEnvio = {
    ...payload,
    timestamp: new Date().toISOString(),
    tipoEvento,
  };

  // Fazer chamada HTTP
  const response = await axios.post(
    config.url,
    payloadEnvio,
    {
      headers: {
        ...headers,
        'Authorization': `Bearer ${config.token}`,
      },
      timeout: API_GOVERNO_TIMEOUT,
      validateStatus: (status) => status >= 200 && status < 300,
    }
  );

  // Extrair protocolo da resposta
  const protocolo = response.data?.protocolo || response.data?.id || response.data?.numeroProtocolo;
  
  if (!protocolo) {
    throw new Error('API governamental não retornou protocolo');
  }

  return {
    protocolo: String(protocolo),
    dadosRetorno: response.data,
  };
}

/**
 * Tentar enviar evento (implementação real com chamada HTTP)
 */
export async function tentarEnviarEvento(
  input: EnviarEventoInput
): Promise<{ sucesso: boolean; protocolo?: string; erro?: string }> {
  const evento = await prisma.eventoGovernamental.findFirst({
    where: {
      id: input.eventoId,
      instituicaoId: input.instituicaoId,
    },
  });

  if (!evento) {
    throw new Error('Evento não encontrado');
  }

  // Verificar feature flag
  if (!input.forcarEnvio && !(await isIntegracaoGovernamentalAtiva(input.instituicaoId))) {
    return {
      sucesso: false,
      erro: 'Integração governamental não está ativa para esta instituição',
    };
  }

  // Verificar se já foi enviado
  if (evento.status === StatusEventoGovernamental.ENVIADO) {
    return {
      sucesso: true,
      protocolo: evento.protocolo || undefined,
    };
  }

  // Verificar se está cancelado
  if (evento.status === StatusEventoGovernamental.CANCELADO) {
    return {
      sucesso: false,
      erro: 'Evento foi cancelado e não pode ser enviado',
    };
  }

  // Verificar número máximo de tentativas
  if (evento.tentativas >= MAX_TENTATIVAS_ENVIO) {
    await marcarEventoComErro(
      input.eventoId,
      input.instituicaoId,
      `Número máximo de tentativas (${MAX_TENTATIVAS_ENVIO}) atingido`
    );
    return {
      sucesso: false,
      erro: `Número máximo de tentativas (${MAX_TENTATIVAS_ENVIO}) atingido`,
    };
  }

  try {
    // Chamada HTTP real para API governamental
    const resultado = await enviarParaAPIGoverno(evento.payloadJson, evento.tipoEvento, input.instituicaoId);
    
    // Marcar como enviado com sucesso
    await marcarEventoComoEnviado(
      input.eventoId,
      input.instituicaoId,
      resultado.protocolo
    );

    // Log de sucesso
    console.log(`[Integração Governamental] Evento ${input.eventoId} enviado com sucesso. Protocolo: ${resultado.protocolo}`);

    return {
      sucesso: true,
      protocolo: resultado.protocolo,
    };
  } catch (error: any) {
    // Tratar diferentes tipos de erro
    let mensagemErro = 'Erro ao enviar evento';
    
    if (error instanceof AxiosError) {
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        mensagemErro = `Timeout ao conectar com API governamental (${API_GOVERNO_TIMEOUT}ms)`;
      } else if (error.response) {
        // Erro da API (4xx, 5xx)
        const status = error.response.status;
        const dados = error.response.data;
        mensagemErro = `Erro HTTP ${status}: ${dados?.message || dados?.erro || error.message}`;
      } else if (error.request) {
        mensagemErro = 'Não foi possível conectar com API governamental';
      } else {
        mensagemErro = error.message || 'Erro desconhecido na requisição';
      }
    } else if (error instanceof Error) {
      mensagemErro = error.message;
    }

    // Marcar evento com erro
    await marcarEventoComErro(
      input.eventoId,
      input.instituicaoId,
      mensagemErro
    );

    // Log de erro
    console.error(`[Integração Governamental] Erro ao enviar evento ${input.eventoId}:`, mensagemErro);

    return {
      sucesso: false,
      erro: mensagemErro,
    };
  }
}

/**
 * Estatísticas de eventos governamentais
 */
export async function obterEstatisticasEventos(
  instituicaoId: string
): Promise<{
  total: number;
  pendentes: number;
  enviados: number;
  erros: number;
  cancelados: number;
  porTipo: Record<TipoEventoGovernamental, number>;
}> {
  const eventos = await prisma.eventoGovernamental.findMany({
    where: {
      instituicaoId,
    },
    select: {
      tipoEvento: true,
      status: true,
    },
  });

  const estatisticas = {
    total: eventos.length,
    pendentes: eventos.filter(e => e.status === StatusEventoGovernamental.PENDENTE).length,
    enviados: eventos.filter(e => e.status === StatusEventoGovernamental.ENVIADO).length,
    erros: eventos.filter(e => e.status === StatusEventoGovernamental.ERRO).length,
    cancelados: eventos.filter(e => e.status === StatusEventoGovernamental.CANCELADO).length,
    porTipo: {
      MATRICULA: 0,
      CONCLUSAO: 0,
      DIPLOMA: 0,
      TRANSFERENCIA: 0,
      CANCELAMENTO_MATRICULA: 0,
    } as Record<TipoEventoGovernamental, number>,
  };

  eventos.forEach(evento => {
    estatisticas.porTipo[evento.tipoEvento]++;
  });

  return estatisticas;
}

/**
 * Processar eventos pendentes automaticamente (chamado pelo scheduler)
 * Processa eventos com status PENDENTE que ainda não atingiram o limite de tentativas
 */
export async function processarEventosPendentes(): Promise<{
  processados: number;
  sucessos: number;
  erros: number;
}> {
  const eventosPendentes = await prisma.eventoGovernamental.findMany({
    where: {
      status: StatusEventoGovernamental.PENDENTE,
      tentativas: { lt: MAX_TENTATIVAS_ENVIO },
    },
    take: 50, // Processar até 50 eventos por vez para não sobrecarregar
    orderBy: {
      createdAt: 'asc', // Processar os mais antigos primeiro
    },
  });

  let processados = 0;
  let sucessos = 0;
  let erros = 0;

  for (const evento of eventosPendentes) {
    try {
      // Verificar se integração está ativa para esta instituição
      const integracaoAtiva = await isIntegracaoGovernamentalAtiva(evento.instituicaoId);
      
      if (!integracaoAtiva) {
        // Pular eventos de instituições com integração desativada
        continue;
      }

      processados++;

      const resultado = await tentarEnviarEvento({
        eventoId: evento.id,
        instituicaoId: evento.instituicaoId,
        forcarEnvio: false,
      });

      if (resultado.sucesso) {
        sucessos++;
      } else {
        erros++;
      }

      // Pequeno delay entre processamentos para não sobrecarregar a API
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error: any) {
      erros++;
      console.error(`[Integração Governamental] Erro ao processar evento ${evento.id}:`, error);
    }
  }

  return { processados, sucessos, erros };
}

/**
 * Processar eventos com erro automaticamente (retry automático)
 * Processa eventos com status ERRO que ainda não atingiram o limite de tentativas
 * Respeita o delay mínimo entre tentativas (RETRY_DELAY_MS)
 */
export async function processarEventosPendentesComErro(): Promise<{
  processados: number;
  sucessos: number;
  erros: number;
}> {
  const agora = new Date();
  const tempoMinimoRetry = new Date(agora.getTime() - RETRY_DELAY_MS);

  const eventosComErro = await prisma.eventoGovernamental.findMany({
    where: {
      status: StatusEventoGovernamental.ERRO,
      tentativas: { lt: MAX_TENTATIVAS_ENVIO },
      updatedAt: { lte: tempoMinimoRetry }, // Apenas eventos que já esperaram o tempo mínimo
    },
    take: 30, // Processar menos eventos com erro por vez
    orderBy: {
      updatedAt: 'asc', // Processar os que esperaram mais tempo primeiro
    },
  });

  let processados = 0;
  let sucessos = 0;
  let erros = 0;

  for (const evento of eventosComErro) {
    try {
      // Verificar se integração está ativa para esta instituição
      const integracaoAtiva = await isIntegracaoGovernamentalAtiva(evento.instituicaoId);
      
      if (!integracaoAtiva) {
        // Pular eventos de instituições com integração desativada
        continue;
      }

      processados++;

      const resultado = await tentarEnviarEvento({
        eventoId: evento.id,
        instituicaoId: evento.instituicaoId,
        forcarEnvio: false,
      });

      if (resultado.sucesso) {
        sucessos++;
      } else {
        erros++;
      }

      // Delay maior entre retries para não sobrecarregar a API
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error: any) {
      erros++;
      console.error(`[Integração Governamental] Erro ao reprocessar evento ${evento.id}:`, error);
    }
  }

  return { processados, sucessos, erros };
}
