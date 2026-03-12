/**
 * Valor por extenso em português - dinâmico por moeda e locale.
 * Usado em recibos, faturas e folha de pagamento.
 */

/** Nomes das moedas por extenso (singular para 1, plural para outros) */
const MOEDAS: Record<string, { singular: string; plural: string }> = {
  AOA: { singular: 'Kwanza', plural: 'Kwanzas' },
  EUR: { singular: 'Euro', plural: 'Euros' },
  BRL: { singular: 'Real', plural: 'Reais' },
  MZN: { singular: 'Metical', plural: 'Meticais' },
  CVE: { singular: 'Escudo', plural: 'Escudos' },
  XOF: { singular: 'Franco CFA', plural: 'Francos CFA' },
  STN: { singular: 'Dobra', plural: 'Dobras' },
  USD: { singular: 'Dólar', plural: 'Dólares' },
};

/** pt-AO, pt-PT: europeu (dezasseis, catorze). pt-BR: brasileiro (dezesseis, quatorze) */
const LOCALE_WORDS: Record<string, { dezena1: string[] }> = {
  'pt-AO': {
    dezena1: ['dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezasseis', 'dezassete', 'dezoito', 'dezanove'],
  },
  'pt-PT': {
    dezena1: ['dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezasseis', 'dezassete', 'dezoito', 'dezanove'],
  },
  'pt-BR': {
    dezena1: ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'],
  },
  pt: {
    dezena1: ['dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezasseis', 'dezassete', 'dezoito', 'dezanove'],
  },
};

export interface OpcoesValorPorExtenso {
  /** Código ISO da moeda (AOA, EUR, BRL, etc.). Default: AOA */
  moeda?: string;
  /** Locale para variante do português (pt-AO, pt-BR, pt-PT). Default: pt-AO */
  locale?: string;
}

/** Converte apenas o número para extenso (sem moeda). Usado internamente em "mil" e "milhões". */
function numeroPorExtenso(num: number, localeKey: string): string {
  const { dezena1 } = LOCALE_WORDS[localeKey];
  const unidade = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
  const dezena2 = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const centena = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
  const partes: string[] = [];
  const deveUsarE = (resto: number) => resto > 0 && (resto < 100 || resto % 100 === 0);

  const aux = (n: number): void => {
    if (n >= 1000000) {
      const m = Math.floor(n / 1000000);
      partes.push(m === 1 ? 'um milhão' : `${numeroPorExtenso(m, localeKey)} milhões`);
      n %= 1000000;
      if (deveUsarE(n)) partes.push('e');
      aux(n);
      return;
    }
    if (n >= 1000) {
      const mil = Math.floor(n / 1000);
      partes.push(mil === 1 ? 'mil' : `${numeroPorExtenso(mil, localeKey)} mil`);
      n %= 1000;
      if (deveUsarE(n)) partes.push('e');
      aux(n);
      return;
    }
    if (n >= 100) {
      const c = Math.floor(n / 100);
      partes.push(c === 1 && n % 100 === 0 ? 'cem' : centena[c]);
      n %= 100;
      if (n > 0) partes.push('e');
    }
    if (n >= 20) {
      const d = Math.floor(n / 10);
      partes.push(dezena2[d]);
      n %= 10;
      if (n > 0) partes.push('e');
    }
    if (n >= 10) {
      partes.push(dezena1[n - 10]);
      return;
    }
    if (n > 0) partes.push(unidade[n]);
  };
  if (num === 0) partes.push('zero');
  else aux(num);
  return partes.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Converte valor numérico para extenso em português.
 * Regras: 1101 = "mil cento e um" (não "mil e cento e um"); 1100 = "mil e cem".
 */
export function valorPorExtenso(
  valor: number,
  opcoes: OpcoesValorPorExtenso = {}
): string {
  const moedaCod = (opcoes.moeda ?? 'AOA').trim().toUpperCase();
  const locale = opcoes.locale ?? 'pt-AO';
  const localeKey = locale in LOCALE_WORDS ? locale : 'pt-AO';
  const { dezena1 } = LOCALE_WORDS[localeKey];

  const moedaInfo = MOEDAS[moedaCod] ?? MOEDAS.AOA;
  const unidade = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
  const dezena2 = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const centena = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

  const v = Math.round(Number(valor) * 100) / 100;
  const int = Math.floor(v);
  const dec = Math.round((v - int) * 100);
  const partes: string[] = [];

  const deveUsarE = (resto: number) => resto > 0 && (resto < 100 || resto % 100 === 0);

  const aux = (num: number): void => {
    if (num >= 1000000) {
      const m = Math.floor(num / 1000000);
      partes.push(m === 1 ? 'um milhão' : `${numeroPorExtenso(m, localeKey)} milhões`);
      num %= 1000000;
      if (deveUsarE(num)) partes.push('e');
      aux(num);
      return;
    }
    if (num >= 1000) {
      const mil = Math.floor(num / 1000);
      partes.push(mil === 1 ? 'mil' : `${numeroPorExtenso(mil, localeKey)} mil`);
      num %= 1000;
      if (deveUsarE(num)) partes.push('e');
      aux(num);
      return;
    }
    if (num >= 100) {
      const c = Math.floor(num / 100);
      partes.push(c === 1 && num % 100 === 0 ? 'cem' : centena[c]);
      num %= 100;
      if (num > 0) partes.push('e');
    }
    if (num >= 20) {
      const d = Math.floor(num / 10);
      partes.push(dezena2[d]);
      num %= 10;
      if (num > 0) partes.push('e');
    }
    if (num >= 10) {
      partes.push(dezena1[num - 10]);
      return;
    }
    if (num > 0) partes.push(unidade[num]);
  };

  if (int === 0) partes.push('zero');
  else aux(int);

  const extenso = partes.join(' ').replace(/\s+/g, ' ').trim();
  const moedaNome = int === 1 && dec === 0 ? moedaInfo.singular : moedaInfo.plural;
  const moedaStr = ` ${moedaNome}`;
  const resultado = dec > 0 ? `${extenso}${moedaStr} e ${dec}/100` : `${extenso}${moedaStr}`;
  return resultado.charAt(0).toUpperCase() + resultado.slice(1);
}
