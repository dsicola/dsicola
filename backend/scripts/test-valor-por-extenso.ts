#!/usr/bin/env npx tsx
/**
 * Teste do utilitário valorPorExtenso (moeda e locale dinâmicos)
 * Uso: npx tsx scripts/test-valor-por-extenso.ts
 */
import { valorPorExtenso } from '../src/utils/valorPorExtenso.js';

const casos: Array<{ valor: number; moeda?: string; locale?: string; esperado: string }> = [
  { valor: 0, esperado: 'Zero Kwanzas' },
  { valor: 1, esperado: 'Um Kwanza' },
  { valor: 1500, moeda: 'AOA', esperado: 'Mil e quinhentos Kwanzas' },
  { valor: 1100, moeda: 'AOA', esperado: 'Mil e cem Kwanzas' },
  { valor: 1101, moeda: 'AOA', esperado: 'Mil cento e um Kwanzas' },
  { valor: 1500, moeda: 'EUR', esperado: 'Mil e quinhentos Euros' },
  { valor: 1101, moeda: 'BRL', locale: 'pt-BR', esperado: 'Mil cento e um Reais' },
  { valor: 14.5, moeda: 'AOA', esperado: 'Catorze Kwanzas e 50/100' },
];

let ok = 0;
let fail = 0;

for (const c of casos) {
  const r = valorPorExtenso(c.valor, { moeda: c.moeda, locale: c.locale });
  const pass = r === c.esperado;
  if (pass) {
    ok++;
    console.log(`✓ ${c.valor} (${c.moeda ?? 'AOA'}, ${c.locale ?? 'pt-AO'}) → "${r}"`);
  } else {
    fail++;
    console.log(`✗ ${c.valor} (${c.moeda ?? 'AOA'}, ${c.locale ?? 'pt-AO'})`);
    console.log(`  Esperado: "${c.esperado}"`);
    console.log(`  Obtido:  "${r}"`);
  }
}

console.log(`\n${ok} passaram, ${fail} falharam`);
process.exit(fail > 0 ? 1 : 0);
