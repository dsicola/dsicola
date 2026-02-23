/**
 * Utilitário para duração da hora-aula conforme tipo de ensino
 * Padrão profissional: Secundário = 45 min (hora-aula), Superior = 60 min (hora-relógio)
 */

import prisma from '../lib/prisma.js';

/** Valores padrão por tipo acadêmico (minutos) */
export const DURACAO_PADRAO = {
  SECUNDARIO: 45, // Hora-aula no ensino secundário
  SUPERIOR: 60,   // Hora-relógio no ensino superior
} as const;

export type TipoAcademico = 'SECUNDARIO' | 'SUPERIOR';

/**
 * Obtém a duração efetiva da hora-aula em minutos para uma instituição.
 * Se ParametrosSistema.duracaoHoraAulaMinutos estiver definido, usa esse valor;
 * caso contrário, retorna o padrão conforme tipoAcademico.
 */
export async function getDuracaoHoraAulaMinutos(
  instituicaoId: string,
  tipoAcademico: TipoAcademico | null
): Promise<number> {
  const params = await prisma.parametrosSistema.findUnique({
    where: { instituicaoId },
    select: { duracaoHoraAulaMinutos: true },
  });

  if (params?.duracaoHoraAulaMinutos != null && [45, 50, 60].includes(params.duracaoHoraAulaMinutos)) {
    return params.duracaoHoraAulaMinutos;
  }

  // Fallback: padrão por tipo acadêmico
  if (tipoAcademico === 'SECUNDARIO') return DURACAO_PADRAO.SECUNDARIO;
  if (tipoAcademico === 'SUPERIOR') return DURACAO_PADRAO.SUPERIOR;
  return DURACAO_PADRAO.SUPERIOR; // Fallback neutro
}

/**
 * Formata a unidade da hora-aula para exibição (ex: "45 min", "60 min")
 */
export function formatarUnidadeHoraAula(minutos: number): string {
  return `${minutos} min`;
}

/**
 * Converte horas-aula para minutos totais
 */
export function horasAulaParaMinutos(horasAula: number, duracaoMinutos: number): number {
  return horasAula * duracaoMinutos;
}

/**
 * Gera blocos de horário padrão (ex: 08:00-08:45, 08:45-09:30 para 45 min)
 * turno: 'manha' | 'tarde' | 'noite'
 */
export function gerarBlocosPadrao(
  duracaoMinutos: number,
  turno: 'manha' | 'tarde' | 'noite' = 'manha'
): Array<{ inicio: string; fim: string }> {
  let hIni: number;
  let hFim: number;

  switch (turno) {
    case 'manha':
      hIni = 8;
      hFim = 12;
      break;
    case 'tarde':
      hIni = 14;
      hFim = 18;
      break;
    case 'noite':
      hIni = 18;
      hFim = 22;
      break;
    default:
      hIni = 8;
      hFim = 12;
  }

  const result: Array<{ inicio: string; fim: string }> = [];
  let minutoAtual = hIni * 60;
  const fimMinutos = hFim * 60;

  while (minutoAtual + duracaoMinutos <= fimMinutos) {
    const hI = Math.floor(minutoAtual / 60);
    const mI = minutoAtual % 60;
    const minutoFim = minutoAtual + duracaoMinutos;
    const hF = Math.floor(minutoFim / 60);
    const mF = minutoFim % 60;
    result.push({
      inicio: `${String(hI).padStart(2, '0')}:${String(mI).padStart(2, '0')}`,
      fim: `${String(hF).padStart(2, '0')}:${String(mF).padStart(2, '0')}`,
    });
    minutoAtual += duracaoMinutos;
  }
  return result;
}

/**
 * Valida se um bloco (horaInicio, horaFim) tem duração exata compatível com instituição SECUNDÁRIA.
 * SECUNDARIO: blocos devem ter duração fixa (ex: 45 min) conforme duracaoHoraAulaMinutos.
 * SUPERIOR: não valida (blocos livres).
 *
 * @returns true se válido
 * @throws nunca - retorna { valido: boolean; mensagem?: string } para facilitar uso
 */
export function validarBlocoHorarioSecundario(
  horaInicio: string,
  horaFim: string,
  duracaoMinutos: number
): { valido: boolean; mensagem?: string } {
  const parseHora = (h: string): number | null => {
    const m = h?.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const hh = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
    return hh * 60 + mm;
  };

  const minInicio = parseHora(horaInicio);
  const minFim = parseHora(horaFim);
  if (minInicio == null || minFim == null) {
    return { valido: false, mensagem: 'Formato de hora inválido. Use HH:mm (ex: 08:00)' };
  }
  if (minFim <= minInicio) {
    return { valido: false, mensagem: 'Hora fim deve ser posterior à hora início' };
  }

  const duracaoAtual = minFim - minInicio;
  if (duracaoAtual !== duracaoMinutos) {
    return {
      valido: false,
      mensagem: `No ensino secundário os blocos devem ter duração fixa de ${duracaoMinutos} min. O intervalo informado tem ${duracaoAtual} min.`,
    };
  }
  return { valido: true };
}
