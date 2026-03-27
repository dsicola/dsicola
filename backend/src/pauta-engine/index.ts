/**
 * Motor de pautas (cálculo dinâmico por template versionado).
 * Uso: construir `valoresPorTipoCanonico` → `avaliarPautaTemplate` ou `avaliarMiniPautaSecundarioAngolaV1`.
 */
export type * from './types.js';
export { avaliarPautaTemplate } from './engine.js';
export { angolaSecundarioV1Template } from './templates/angolaSecundarioV1.js';
export {
  valoresPorTipoNotasIndividuais,
  avaliarMiniPautaSecundarioAngolaV1,
  getTemplateAngolaSecundarioV1,
} from './facade.js';
