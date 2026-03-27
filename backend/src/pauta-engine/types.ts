/**
 * Motor de pautas (DSICOLA) — tipos declarativos para templates versionáveis.
 * Fórmulas em AST fechado (sem eval); condições explícitas para ramos legado.
 */

export type ConditionAst =
  | { op: 'notNull'; key: string }
  | { op: 'anyNotNull'; keys: string[] };

export type FormulaAst =
  | { op: 'ref'; key: string }
  | { op: 'const'; value: number }
  /** Soma com valores ausentes tratados como 0 (paridade com mini-pauta Angola). */
  | { op: 'sumZero'; keys: string[] }
  | { op: 'div'; num: FormulaAst; den: number }
  | { op: 'if'; condition: ConditionAst; then: FormulaAst; else: FormulaAst };

export interface PautaResolver {
  id: string;
  op: 'coalesceFirst';
  keys: string[];
}

/**
 * Template de cálculo (persistível na BD no futuro; hoje builtin + JSON espelho).
 */
export interface PautaCalculoTemplate {
  id: string;
  version: number;
  /** Chave lógica → tipo canónico na BD (ex.: "1º Trimestre - MAC"). */
  bindings: Record<string, string>;
  resolvers: PautaResolver[];
  /**
   * Quando a fórmula principal não aplica (nenhum componente mini-pauta), usa nota legada única por trimestre.
   * Chave lógica (ex.: FALLBACK.MT1) → tipo canónico (ex.: "1º Trimestre").
   */
  fallbacks: Record<string, string>;
  /** Saídas calculadas (MT1, MT2, MT3, …). Ordem de declaração = ordem de avaliação. */
  computed: Record<string, FormulaAst>;
}

export interface PautaEngineValoresInput {
  /** Tipo canónico normalizado (º, trim) → valor. */
  valoresPorTipoCanonico: Record<string, number | null | undefined>;
}

export interface ResultadoPautaEngine {
  templateId: string;
  templateVersion: number;
  /** Valores calculados (chaves do mapa `computed` do template). */
  saidas: Record<string, number | null>;
}
