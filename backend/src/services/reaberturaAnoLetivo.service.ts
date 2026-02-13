import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';

/**
 * ========================================
 * SERVIÇO: REABERTURA EXCEPCIONAL DO ANO LETIVO
 * ========================================
 * 
 * REGRA INSTITUCIONAL (SIGA/SIGAE):
 * - Reabertura é EXCEÇÃO administrativa
 * - TEMPORÁRIA (com prazo)
 * - JUSTIFICADA (motivo obrigatório)
 * - TOTALMENTE AUDITADA
 */

export type EscopoReabertura = 'NOTAS' | 'PRESENCAS' | 'AVALIACOES' | 'MATRICULAS' | 'GERAL';

/**
 * Verificar se existe reabertura ATIVA para um ano letivo
 * Retorna a reabertura ativa ou null
 */
export const verificarReaberturaAtiva = async (
  anoLetivoId: string,
  instituicaoId: string,
  escopoRequerido?: EscopoReabertura
): Promise<{
  reaberturaAtiva: boolean;
  reabertura: any | null;
  escopoPermitido: EscopoReabertura[];
  dentroDoPrazo: boolean;
}> => {
  const agora = new Date();

  // Buscar reabertura ativa
  const reabertura = await prisma.reaberturaAnoLetivo.findFirst({
    where: {
      anoLetivoId,
      instituicaoId,
      ativo: true,
      dataInicio: { lte: agora },
      dataFim: { gte: agora },
    },
    include: {
      autorizador: {
        select: {
          id: true,
          nomeCompleto: true,
          email: true,
        },
      },
      anoLetivo: {
        select: {
          id: true,
          ano: true,
          status: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  if (!reabertura) {
    return {
      reaberturaAtiva: false,
      reabertura: null,
      escopoPermitido: [],
      dentroDoPrazo: false,
    };
  }

  // Verificar se está dentro do prazo
  const dentroDoPrazo = agora >= reabertura.dataInicio && agora <= reabertura.dataFim;

  // Determinar escopo permitido
  const escopoPermitido: EscopoReabertura[] = 
    reabertura.escopo === 'GERAL' 
      ? ['NOTAS', 'PRESENCAS', 'AVALIACOES', 'MATRICULAS', 'GERAL']
      : [reabertura.escopo];

  // Verificar se o escopo requerido está permitido
  const escopoValido = !escopoRequerido || escopoPermitido.includes(escopoRequerido) || reabertura.escopo === 'GERAL';

  return {
    reaberturaAtiva: dentroDoPrazo && escopoValido,
    reabertura,
    escopoPermitido,
    dentroDoPrazo,
  };
};

/**
 * Verificar se uma ação é permitida durante reabertura
 * Baseado no escopo e no tipo de rota
 * Melhorado para suportar validações por tipo de instituição
 */
export const verificarPermissaoReabertura = (
  rota: string,
  metodo: string,
  escopoPermitido: EscopoReabertura[],
  tipoInstituicao?: 'SUPERIOR' | 'SECUNDARIO'
): boolean => {
  // Se escopo é GERAL, tudo é permitido
  if (escopoPermitido.includes('GERAL')) {
    return true;
  }

  // Mapear rotas para escopos (compatível com ambos os tipos)
  const rotasNotas = ['/notas', '/avaliacoes'];
  const rotasPresencas = ['/presencas', '/aulas', '/aulas-lancadas'];
  const rotasAvaliacoes = ['/avaliacoes'];
  const rotasMatriculas = ['/matriculas', '/matriculas-anuais'];

  // Verificar se a rota corresponde ao escopo permitido
  if (escopoPermitido.includes('NOTAS') && rotasNotas.some(r => rota.includes(r))) {
    return true;
  }
  if (escopoPermitido.includes('PRESENCAS') && rotasPresencas.some(r => rota.includes(r))) {
    return true;
  }
  if (escopoPermitido.includes('AVALIACOES') && rotasAvaliacoes.some(r => rota.includes(r))) {
    return true;
  }
  if (escopoPermitido.includes('MATRICULAS') && rotasMatriculas.some(r => rota.includes(r))) {
    return true;
  }

  // Validações específicas por tipo de instituição
  if (tipoInstituicao === 'SUPERIOR') {
    // Ensino Superior: permitir reabertura focada em notas, exames, recursos
    if (escopoPermitido.includes('NOTAS') && (rota.includes('/notas') || rota.includes('/avaliacoes'))) {
      return true;
    }
  } else if (tipoInstituicao === 'SECUNDARIO') {
    // Ensino Secundário: permitir reabertura focada em avaliações por trimestre
    if (escopoPermitido.includes('AVALIACOES') && rota.includes('/avaliacoes')) {
      return true;
    }
  }

  return false;
};

/**
 * Encerrar reaberturas expiradas automaticamente
 * Deve ser chamado periodicamente (cron job ou scheduler)
 */
export const encerrarReaberturasExpiradas = async (instituicaoId?: string): Promise<number> => {
  const agora = new Date();

  const where: any = {
    ativo: true,
    dataFim: { lt: agora },
  };

  if (instituicaoId) {
    where.instituicaoId = instituicaoId;
  }

  const reaberturasExpiradas = await prisma.reaberturaAnoLetivo.findMany({
    where,
  });

  let encerradas = 0;

  for (const reabertura of reaberturasExpiradas) {
    await prisma.reaberturaAnoLetivo.update({
      where: { id: reabertura.id },
      data: {
        ativo: false,
        encerradoEm: agora,
        // encerradoPor será null (encerramento automático)
      },
    });

    encerradas++;
  }

  return encerradas;
};

