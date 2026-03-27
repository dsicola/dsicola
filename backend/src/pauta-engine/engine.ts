import type {
  ConditionAst,
  FormulaAst,
  PautaCalculoTemplate,
  PautaEngineValoresInput,
  ResultadoPautaEngine,
} from './types.js';

function isFiniteNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function evalCondition(c: ConditionAst, ctx: Record<string, number | null>): boolean {
  if (c.op === 'notNull') {
    const v = ctx[c.key];
    return v != null && isFiniteNum(v);
  }
  return c.keys.some((k) => {
    const v = ctx[k];
    return v != null && isFiniteNum(v);
  });
}

function evalFormula(f: FormulaAst, ctx: Record<string, number | null>): number | null {
  switch (f.op) {
    case 'ref': {
      const v = ctx[f.key];
      return v != null && isFiniteNum(v) ? v : null;
    }
    case 'const':
      return f.value;
    case 'sumZero': {
      let s = 0;
      for (const k of f.keys) {
        const v = ctx[k];
        if (v != null && isFiniteNum(v)) s += v;
      }
      return s;
    }
    case 'div': {
      const num = evalFormula(f.num, ctx);
      if (num == null || !isFiniteNum(num) || f.den === 0) return null;
      return num / f.den;
    }
    case 'if':
      return evalCondition(f.condition, ctx) ? evalFormula(f.then, ctx) : evalFormula(f.else, ctx);
    default: {
      const _exhaustive: never = f;
      return _exhaustive;
    }
  }
}

function aplicarResolvers(
  tpl: PautaCalculoTemplate,
  ctx: Record<string, number | null>,
): void {
  for (const r of tpl.resolvers) {
    if (r.op !== 'coalesceFirst') continue;
    let v: number | null = null;
    for (const k of r.keys) {
      const x = ctx[k];
      if (x != null && isFiniteNum(x)) {
        v = x;
        break;
      }
    }
    ctx[r.id] = v;
  }
}

function montarContextoBase(
  tpl: PautaCalculoTemplate,
  input: PautaEngineValoresInput,
): Record<string, number | null> {
  const raw = input.valoresPorTipoCanonico;
  const ctx: Record<string, number | null> = {};
  for (const [logical, canon] of Object.entries(tpl.bindings)) {
    const v = raw[canon];
    ctx[logical] = v != null && isFiniteNum(Number(v)) ? Number(v) : null;
  }
  aplicarResolvers(tpl, ctx);
  for (const [logical, canon] of Object.entries(tpl.fallbacks)) {
    const v = raw[canon];
    ctx[logical] = v != null && isFiniteNum(Number(v)) ? Number(v) : null;
  }
  return ctx;
}

/**
 * Avalia todas as entradas de `template.computed` sobre o contexto (bindings + resolvers + fallbacks).
 */
export function avaliarPautaTemplate(
  template: PautaCalculoTemplate,
  input: PautaEngineValoresInput,
): ResultadoPautaEngine {
  const ctx = montarContextoBase(template, input);
  const saidas: Record<string, number | null> = {};
  for (const [nome, formula] of Object.entries(template.computed)) {
    const v = evalFormula(formula, ctx);
    saidas[nome] = v != null && isFiniteNum(v) ? Number(Number(v).toFixed(10)) : null;
    ctx[nome] = saidas[nome];
  }
  return {
    templateId: template.id,
    templateVersion: template.version,
    saidas,
  };
}
