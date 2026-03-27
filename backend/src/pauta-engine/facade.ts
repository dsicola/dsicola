import { avaliarPautaTemplate } from './engine.js';
import { angolaSecundarioV1Template } from './templates/angolaSecundarioV1.js';
import type { ResultadoPautaEngine } from './types.js';

/** Monta mapa tipo canónico → valor a partir de notas individuais (último valor vence). */
export function valoresPorTipoNotasIndividuais(
  notas: ReadonlyArray<{ tipo: string; valor: number | null | undefined }>,
  normalizarTipo: (t: string) => string,
): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const n of notas) {
    const k = normalizarTipo(n.tipo);
    const v = n.valor;
    if (v != null && Number.isFinite(Number(v)) && out[k] === undefined) {
      out[k] = Number(v);
    }
  }
  return out;
}

/** Motor mini-pauta secundário — template Angola v121 (único builtin por agora). */
export function avaliarMiniPautaSecundarioAngolaV1(
  valoresPorTipoCanonico: Record<string, number | null | undefined>,
): ResultadoPautaEngine {
  return avaliarPautaTemplate(angolaSecundarioV1Template, { valoresPorTipoCanonico });
}

export function getTemplateAngolaSecundarioV1() {
  return angolaSecundarioV1Template;
}
