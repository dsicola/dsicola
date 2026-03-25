/**
 * Rótulos configuráveis da pauta (ParametrosSistema).
 * Chaves estáveis — valores na BD/exames mantêm-se (ex.: "1º Trimestre - NPT"); só a UI muda.
 */

export const DEFAULT_PAUTA_LABELS_SUPERIOR: Record<string, string> = {
  prova1: '1ª Prova',
  prova2: '2ª Prova',
  prova3: '3ª Prova',
  trabalho: 'Trabalho',
  exameRecurso: 'Exame de Recurso',
  trimI: 'I Trimestre',
  trimII: 'II Trimestre',
  trimIII: 'III Trimestre',
};

export const DEFAULT_PAUTA_LABELS_SECUNDARIO: Record<string, string> = {
  mac: 'MAC',
  npp: 'NPP',
  npt: 'NPT',
  mt: 'MT',
  periodo1: '1º Trimestre',
  periodo2: '2º Trimestre',
  periodo3: '3º Trimestre',
  /** Cabeçalhos de coluna (Gestão de notas) — sincronizados com periodo1–3 por omissão */
  trimI: '1º Trimestre',
  trimII: '2º Trimestre',
  trimIII: '3º Trimestre',
  recuperacao: 'Recuperação',
  trabalho: 'Trabalho',
  provaFinal: 'Prova Final',
};

/** Rótulo só para cabeçalho (tipo canónico da BD). */
export function labelExtraSecundario(tipo: string, L: Record<string, string>): string {
  if (tipo === 'Recuperação') return L.recuperacao;
  if (tipo === 'Prova Final') return L.provaFinal;
  return tipo;
}

export function mergePautaLabelsSuperior(api: unknown): Record<string, string> {
  const base = { ...DEFAULT_PAUTA_LABELS_SUPERIOR };
  if (api && typeof api === 'object' && !Array.isArray(api)) {
    for (const k of Object.keys(base)) {
      const v = (api as Record<string, unknown>)[k];
      if (typeof v === 'string' && v.trim()) base[k] = v.trim().slice(0, 80);
    }
  }
  return base;
}

export function mergePautaLabelsSecundario(api: unknown): Record<string, string> {
  const base = { ...DEFAULT_PAUTA_LABELS_SECUNDARIO };
  if (api && typeof api === 'object' && !Array.isArray(api)) {
    const raw = api as Record<string, unknown>;
    for (const k of Object.keys(base)) {
      const v = raw[k];
      if (typeof v === 'string' && v.trim()) base[k] = v.trim().slice(0, 80);
    }
    // Compat: só periodo1–3 definidos na API — replicar para trimI–III se estes não vieram
    if (typeof raw.trimI !== 'string' || !String(raw.trimI).trim()) {
      if (base.periodo1) base.trimI = base.periodo1;
      if (base.periodo2) base.trimII = base.periodo2;
      if (base.periodo3) base.trimIII = base.periodo3;
    }
  }
  return base;
}

/** Cabeçalho de coluna no superior (tipo canónico → rótulo institucional). */
export function labelColunaSuperior(tipo: string, L: Record<string, string>): string {
  const t = String(tipo || '').trim();
  if (t === '1ª Prova') return L.prova1;
  if (t === '2ª Prova') return L.prova2;
  if (t === '3ª Prova') return L.prova3;
  if (t === 'Trabalho') return L.trabalho;
  if (t === 'Exame de Recurso') return L.exameRecurso;
  return t;
}

/**
 * Ex.: "1º Trimestre - NPT" + rótulos → "1º Trimestre · TMP" (periodo e componente configuráveis).
 */
export function labelColunaSecundarioTipoCompleto(tipo: string, L: Record<string, string>): string {
  const m = String(tipo || '').trim().match(/^(\d)º\s*Trimestre\s*-\s*(MAC|NPP|NPT)$/i);
  if (!m) return tipo;
  const trim = Number(m[1]);
  const comp = m[2].toUpperCase();
  const periodo =
    trim === 1 ? L.periodo1 : trim === 2 ? L.periodo2 : trim === 3 ? L.periodo3 : `${trim}º Trimestre`;
  const compLabel = comp === 'MAC' ? L.mac : comp === 'NPP' ? L.npp : L.npt;
  return `${periodo} · ${compLabel}`;
}

export type PesosMTSecundario = { mac: number; npp: number; npt: number };

/** Pesos normalizados a partir dos parâmetros (null = terços iguais). */
export function buildPesosMTSecundarioFromParametros(param: {
  secundarioPesoMac?: unknown;
  secundarioPesoNpp?: unknown;
  secundarioPesoNpt?: unknown;
} | null | undefined): PesosMTSecundario | null {
  if (!param) return null;
  const pm = param.secundarioPesoMac;
  const pn = param.secundarioPesoNpp;
  const pp = param.secundarioPesoNpt;
  if (pm == null && pn == null && pp == null) return null;
  const wM = pm != null && pm !== '' ? Number(pm) : 1;
  const wN = pn != null && pn !== '' ? Number(pn) : 1;
  const wP = pp != null && pp !== '' ? Number(pp) : 1;
  const s = wM + wN + wP;
  if (s <= 0) return null;
  return { mac: wM / s, npp: wN / s, npt: wP / s };
}
