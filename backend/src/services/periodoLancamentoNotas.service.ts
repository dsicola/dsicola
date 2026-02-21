import prisma from '../lib/prisma.js';
import { StatusPeriodoLancamentoNotas } from '@prisma/client';

/**
 * Serviço de validação da janela de lançamento de notas.
 * COMPATIBILIDADE: Se a instituição não tem períodos configurados, a operação é permitida.
 * Quando há períodos: exige pelo menos um ABERTO com data atual entre data_inicio e data_fim.
 * EXPIRADO: computado automaticamente quando now > data_fim (não persiste).
 */

export type ResultadoValidacao = {
  permitido: boolean;
  motivo?: string;
  periodoAtivo?: { id: string; anoLetivoId: string; tipoPeriodo: string; numeroPeriodo: number };
};

/**
 * Valida se existe janela de lançamento de notas ativa para a instituição.
 * Retorna permitido=true se:
 * - A instituição NÃO possui períodos configurados (backward compat)
 * - Existe período com status=ABERTO e data atual entre data_inicio e data_fim
 */
export async function validarJanelaLancamentoNotas(instituicaoId: string): Promise<ResultadoValidacao> {
  const now = new Date();

  const periodos = await prisma.periodoLancamentoNotas.findMany({
    where: { instituicaoId },
    include: {
      anoLetivo: { select: { ano: true, id: true } },
    },
  });

  // Backward compat: se não há períodos, permitir (não quebrar fluxos existentes)
  if (!periodos || periodos.length === 0) {
    return { permitido: true };
  }

  // Verificar se existe período ativo: status ABERTO, now entre data_inicio e data_fim
  for (const p of periodos) {
    const dataInicio = new Date(p.dataInicio);
    const dataFim = new Date(p.dataFim);
    const dentroDoPeriodo = now >= dataInicio && now <= dataFim;

    // Status EXPIRADO: automático quando data_fim ultrapassada
    const statusComputado =
      now > dataFim ? StatusPeriodoLancamentoNotas.EXPIRADO : (p.status as StatusPeriodoLancamentoNotas);

    if (statusComputado === StatusPeriodoLancamentoNotas.ABERTO && dentroDoPeriodo) {
      return {
        permitido: true,
        periodoAtivo: {
          id: p.id,
          anoLetivoId: p.anoLetivoId,
          tipoPeriodo: p.tipoPeriodo,
          numeroPeriodo: p.numeroPeriodo,
        },
      };
    }
  }

  // Há períodos mas nenhum ativo
  const proximo = periodos.find((p) => new Date(p.dataInicio) > now);
  const expirado = periodos.find((p) => new Date(p.dataFim) < now);

  let motivo =
    'Período de lançamento de notas não está aberto. A data atual não está dentro de nenhuma janela ativa.';
  if (proximo) {
    motivo += ` Próximo período: ${proximo.tipoPeriodo} ${proximo.numeroPeriodo} a partir de ${new Date(proximo.dataInicio).toLocaleDateString('pt-BR')}.`;
  } else if (expirado) {
    motivo += ' O(s) período(s) configurado(s) já expirou(aram).';
  }

  return { permitido: false, motivo };
}

/**
 * Retorna o status computado do período (EXPIRADO automático quando data_fim ultrapassada).
 */
export function computarStatusPeriodo(
  dataFim: Date,
  statusPersistido: StatusPeriodoLancamentoNotas
): StatusPeriodoLancamentoNotas {
  const now = new Date();
  if (now > dataFim) return StatusPeriodoLancamentoNotas.EXPIRADO;
  return statusPersistido;
}
