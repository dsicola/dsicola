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

/** Intervalo padrão entre disciplinas (minutos) - usado na sugestão de horários */
export const INTERVALO_PADRAO_ENTRE_DISCIPLINAS = 15;

export type TipoAcademico = 'SECUNDARIO' | 'SUPERIOR';

/**
 * Obtém o intervalo entre disciplinas (minutos) para uma instituição.
 * Usado na sugestão de horários: se aula termina 08:45, próxima começa 08:45 + intervalo.
 * Ex: intervalo 15 → 08:00-08:45, 09:00-09:45.
 */
export async function getIntervaloEntreDisciplinasMinutos(instituicaoId: string): Promise<number> {
  const params = await prisma.parametrosSistema.findUnique({
    where: { instituicaoId },
    select: { intervaloEntreDisciplinasMinutos: true },
  });

  if (params?.intervaloEntreDisciplinasMinutos != null && params.intervaloEntreDisciplinasMinutos >= 0 && params.intervaloEntreDisciplinasMinutos <= 60) {
    return params.intervaloEntreDisciplinasMinutos;
  }

  return INTERVALO_PADRAO_ENTRE_DISCIPLINAS;
}

/** Config do intervalo longo (recreio/almoço): { minutos, aposBloco } ou null se desativado */
export interface IntervaloLongoConfig {
  minutos: number;    // 15-120 (configurável pelo admin)
  aposBloco: number;  // após qual aula (1, 2, 3...)
}

/**
 * Obtém a configuração do intervalo longo (recreio/almoço) para uma instituição.
 * Retorna null se desativado (intervaloLongoMinutos = 0).
 * Aceita 15-120 minutos (configurável pelo admin nas configurações).
 */
export async function getIntervaloLongoConfig(instituicaoId: string): Promise<IntervaloLongoConfig | null> {
  const params = await prisma.parametrosSistema.findUnique({
    where: { instituicaoId },
    select: { intervaloLongoMinutos: true, intervaloLongoAposBloco: true },
  });

  const minutos = params?.intervaloLongoMinutos ?? 0;
  if (minutos === 0 || minutos < 15 || minutos > 120) return null;

  const aposBloco = Math.min(6, Math.max(1, params?.intervaloLongoAposBloco ?? 2));

  return { minutos, aposBloco };
}

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
 * Gera blocos de horário padrão com intervalo entre disciplinas e intervalo longo (recreio/almoço).
 * Ex: duracao 45 min, intervalo 15 min → 08:00-08:45, 09:00-09:45, 10:00-10:45...
 * Com intervalo longo 45 min após bloco 2: 08:00-08:45, 09:00-09:45, [PAUSA], 10:45-11:30, 11:45-12:30...
 *
 * @param intervaloLongo - { minutos: 45|90, aposBloco: 2 } ou null se desativado
 */
export function gerarBlocosPadrao(
  duracaoMinutos: number,
  turno: 'manha' | 'tarde' | 'noite' = 'manha',
  intervaloMinutos: number = INTERVALO_PADRAO_ENTRE_DISCIPLINAS,
  intervaloLongo: IntervaloLongoConfig | null = null
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
  let blocoCount = 0;

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
    blocoCount++;

    // Após este bloco: intervalo curto ou intervalo longo (recreio/almoço)?
    if (intervaloLongo && blocoCount === intervaloLongo.aposBloco) {
      minutoAtual += duracaoMinutos + intervaloLongo.minutos; // pausa longa sem aulas
    } else {
      minutoAtual += duracaoMinutos + intervaloMinutos;
    }
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
