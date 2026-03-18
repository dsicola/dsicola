/**
 * Preenchimento de modelos Excel (.xlsx) com dados do sistema.
 * Placeholders no formato {{CHAVE}} nas células são substituídos pelos valores.
 * Usado para Boletim e Pauta de Conclusão quando há modelo oficial do governo.
 */
import * as XLSX from 'xlsx';
import { AppError } from '../middlewares/errorHandler.js';

import type { BoletimAluno } from './relatoriosOficiais.service.js';

/** Dados mínimos do boletim para preenchimento Excel (compatível com BoletimAluno) */
type BoletimParaExcel = Pick<BoletimAluno, 'instituicao' | 'aluno' | 'anoLetivo' | 'disciplinas'>;

const PLACEHOLDER_REGEX = /\{\{([^{}]+)\}\}/g;

/**
 * Extrai placeholders {{CHAVE}} de um modelo Excel.
 * Varre todas as células e retorna lista única de chaves (ex: NOME_ALUNO, DISCIPLINA_1).
 */
export function extractPlaceholdersFromExcel(excelTemplateBase64: string): string[] {
  if (!excelTemplateBase64?.trim()) return [];
  let buffer: Buffer;
  try {
    buffer = Buffer.from(excelTemplateBase64, 'base64');
  } catch {
    return [];
  }
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const seen = new Set<string>();
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet || !sheet['!ref']) continue;
    const range = XLSX.utils.decode_range(sheet['!ref']);
    for (let R = range.s.r; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = sheet[addr];
        if (!cell || cell.t === 'e') continue;
        const v = cell.v;
        const str = typeof v === 'string' ? v : typeof v === 'number' && !Number.isNaN(v) ? String(v) : '';
        if (str.includes('{{')) {
          const matches = str.matchAll(PLACEHOLDER_REGEX);
          for (const m of matches) {
            const key = (m[1] || '').trim();
            if (key) seen.add(key);
          }
        }
      }
    }
  }
  return Array.from(seen).sort();
}

/**
 * Converte objeto aninhado em chaves planas para placeholders.
 * Ex: { student: { fullName: 'João' } } → { 'student.fullName': 'João', 'NOME_ALUNO': 'João' }
 */
function flattenForPlaceholders(
  obj: Record<string, unknown>,
  prefix = ''
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value != null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      Object.assign(result, flattenForPlaceholders(value as Record<string, unknown>, path));
    } else if (value !== undefined && value !== null) {
      result[path] = String(value);
      result[key.toUpperCase().replace(/\./g, '_')] = String(value);
    }
  }
  return result;
}

/**
 * Substitui placeholders {{CHAVE}} num texto pelo valor correspondente em data.
 */
function replacePlaceholders(text: string, data: Record<string, string>): string {
  return text.replace(PLACEHOLDER_REGEX, (_, key) => {
    const k = key.trim();
    return data[k] ?? data[k.toUpperCase()] ?? '';
  });
}

/**
 * Preenche modelo Excel com dados. Substitui {{PLACEHOLDER}} em todas as células.
 * @param excelTemplateBase64 - Modelo Excel em base64
 * @param data - Dados para preencher (chaves = nomes dos placeholders)
 * @returns Buffer do Excel preenchido
 */
export function fillExcelTemplate(
  excelTemplateBase64: string,
  data: Record<string, string | number | null | undefined>
): Buffer {
  if (!excelTemplateBase64?.trim()) {
    throw new AppError('Modelo Excel não fornecido', 400);
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(excelTemplateBase64, 'base64');
  } catch {
    throw new AppError('Modelo Excel inválido (base64)', 400);
  }

  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const flatData: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined && v !== null) flatData[k] = String(v);
  }

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet || !sheet['!ref']) continue;

    const range = XLSX.utils.decode_range(sheet['!ref']);
    for (let R = range.s.r; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = sheet[addr];
        if (!cell || cell.t === 'e') continue;

        const v = cell.v;
        if (typeof v === 'string' && v.includes('{{')) {
          cell.v = replacePlaceholders(v, flatData);
        } else if (typeof v === 'number' && !Number.isNaN(v)) {
          const str = String(v);
          if (str.includes('{{')) {
            cell.v = replacePlaceholders(str, flatData);
          }
        }
      }
    }
  }

  const out = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return Buffer.from(out);
}

/**
 * Converte a primeira folha do Excel em HTML com substituição de placeholders.
 * Usado para preview da mini pauta quando o modelo é importado em Excel.
 * @param excelTemplateBase64 - Modelo Excel em base64
 * @param data - Variáveis para substituir {{CHAVE}} (ex: TABELA_ALUNOS, NOME_INSTITUICAO)
 * @returns HTML da tabela pronta para gerar PDF
 */
export function excelSheetToHtmlWithPlaceholders(
  excelTemplateBase64: string,
  data: Record<string, string>
): string {
  if (!excelTemplateBase64?.trim()) return '';
  let buffer: Buffer;
  try {
    buffer = Buffer.from(excelTemplateBase64, 'base64');
  } catch {
    return '';
  }
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet || !sheet['!ref']) return '';

  const range = XLSX.utils.decode_range(sheet['!ref']);
  const flatData: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined && v !== null) flatData[k] = String(v);
  }

  let html = '';
  for (let R = range.s.r; R <= range.e.r; R++) {
    let rowHtml = '';
    let hasTabelaAlunos = false;
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = sheet[addr];
      let val = '';
      if (cell && cell.t !== 'e') {
        const v = cell.v;
        if (typeof v === 'string') val = v;
        else if (typeof v === 'number' && !Number.isNaN(v)) val = String(v);
      }
      const replaced = replacePlaceholders(val, flatData);
      if (replaced.includes('<tr>')) {
        hasTabelaAlunos = true;
        rowHtml = replaced;
        break;
      }
      rowHtml += `<td>${escapeHtmlForTd(replaced)}</td>`;
    }
    if (hasTabelaAlunos) {
      html += rowHtml;
    } else {
      html += `<tr>${rowHtml}</tr>`;
    }
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
table{border-collapse:collapse;width:100%;font-size:10pt;font-family:Helvetica,Arial,sans-serif}
th,td{border:1px solid #333;padding:4px 6px;text-align:left}
th{background:#f0f0f0;font-weight:bold}
</style></head><body><table>${html}</table></body></html>`;
}

function escapeHtmlForTd(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Monta dados planos para Boletim do Aluno (compatível com placeholders Excel).
 */
export function boletimToExcelData(boletim: BoletimParaExcel): Record<string, string> {
  const disciplinasRows = boletim.disciplinas.map((d, i) => ({
    [`DISCIPLINA_${i + 1}`]: d.disciplinaNome,
    [`NOTA_${i + 1}`]: d.notaFinal != null ? String(d.notaFinal) : '-',
    [`SITUACAO_${i + 1}`]: d.situacaoAcademica,
    [`TURMA_${i + 1}`]: d.turmaNome || '',
    [`PROFESSOR_${i + 1}`]: d.professorNome,
  }));
  const discFlat = Object.assign({}, ...disciplinasRows);

  return {
    NOME_ALUNO: boletim.aluno.nomeCompleto || '',
    NUMERO_ESTUDANTE: boletim.aluno.numeroIdentificacaoPublica || boletim.aluno.numeroIdentificacao || '',
    ANO_LETIVO: String(boletim.anoLetivo?.ano ?? ''),
    INSTITUICAO_NOME: boletim.instituicao?.nome || '',
    ...discFlat,
  };
}

/**
 * Converte a primeira folha do Excel em HTML (tabela) e substitui placeholders.
 * Usado para pré-visualização da mini pauta quando o modelo é Excel.
 * @param excelTemplateBase64 - Modelo Excel em base64
 * @param data - Dados para placeholders (ex: montarVarsPauta)
 * @returns HTML completo para conversão em PDF
 */
export function excelSheetToHtml(
  excelTemplateBase64: string,
  data: Record<string, string>
): string {
  if (!excelTemplateBase64?.trim()) return '';
  let buffer: Buffer;
  try {
    buffer = Buffer.from(excelTemplateBase64, 'base64');
  } catch {
    return '';
  }
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet || !sheet['!ref']) return '';

  const range = XLSX.utils.decode_range(sheet['!ref']);
  const flatData: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined && v !== null && typeof v === 'string') flatData[k] = v;
  }

  const escapeHtmlCell = (s: string): string =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  let html = '<table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:10pt;">';
  for (let R = range.s.r; R <= range.e.r; R++) {
    html += '<tr>';
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = sheet[addr];
      let val = '';
      if (cell && cell.v !== undefined && cell.v !== null) {
        const v = cell.v;
        val = typeof v === 'string' ? v : typeof v === 'number' ? String(v) : String(v);
      }
      // Substituir placeholders
      const replaced = replacePlaceholders(val, flatData);
      // Se o valor é HTML (ex: TABELA_ALUNOS com <tr>), inserir sem escape
      const isHtmlContent = replaced.includes('<tr>') || replaced.includes('<td>');
      const content = isHtmlContent ? replaced : escapeHtmlCell(replaced);
      const rowspan = (cell as { [key: string]: number })?.rowspan;
      const colspan = (cell as { [key: string]: number })?.colspan;
      let attrs = '';
      if (rowspan && rowspan > 1) attrs += ` rowspan="${rowspan}"`;
      if (colspan && colspan > 1) attrs += ` colspan="${colspan}"`;
      html += `<td${attrs}>${content}</td>`;
    }
    html += '</tr>';
  }
  html += '</table>';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;padding:20px;} table{width:100%;}</style></head><body>${html}</body></html>`;
}

/**
 * Monta dados planos para Pauta de Conclusão (modelo Saúde).
 */
export function pautaConclusaoToExcelData(dados: {
  instituicaoNome: string;
  turma: string;
  especialidade: string;
  anoLetivo: string;
  disciplinas: string[];
  alunos: Array<{
    n: number;
    nrec: string;
    nome: string;
    notas: Record<string, { ca: number; cfd: number }>;
    estagio: number;
    cfPlano: number;
    pap: number;
    classFinal: number;
    obs: string;
  }>;
}): Record<string, string> {
  const rows: string[] = [];
  for (const a of dados.alunos) {
    const notaStr = dados.disciplinas.map((d) => {
      const n = a.notas[d] ?? { ca: 0, cfd: 0 };
      return `${n.ca}|${n.cfd}`;
    }).join(' | ');
    rows.push(`${a.n};${a.nrec};${a.nome};${notaStr};${a.estagio};${a.cfPlano};${a.pap};${a.classFinal};${a.obs}`);
  }
  return {
    INSTITUICAO_NOME: dados.instituicaoNome,
    TURMA: dados.turma,
    ESPECIALIDADE: dados.especialidade,
    ANO_LETIVO: dados.anoLetivo,
    TABELA_ALUNOS: rows.join('\n'),
    DISCIPLINAS: dados.disciplinas.join(', '),
  };
}

/**
 * Converte a primeira folha do Excel em HTML (tabela) e substitui placeholders {{CHAVE}}.
 * Usado para preview da mini pauta quando o modelo é Excel em vez de HTML.
 */
export function excelToHtmlWithPlaceholders(
  excelTemplateBase64: string,
  data: Record<string, string>
): string {
  if (!excelTemplateBase64?.trim()) return '';
  let buffer: Buffer;
  try {
    buffer = Buffer.from(excelTemplateBase64, 'base64');
  } catch {
    return '';
  }
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet || !sheet['!ref']) return '';

  const range = XLSX.utils.decode_range(sheet['!ref']);
  const flatData: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined && v !== null && typeof v === 'string') flatData[k] = v;
  }

  const escapeHtml = (s: string) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const cellValue = (r: number, c: number): string => {
    const addr = XLSX.utils.encode_cell({ r, c });
    const cell = sheet[addr];
    if (!cell || cell.t === 'e') return '';
    const v = cell.v;
    let str = typeof v === 'string' ? v : typeof v === 'number' && !Number.isNaN(v) ? String(v) : '';
    if (str.includes('{{')) str = replacePlaceholders(str, flatData);
    return escapeHtml(str);
  };

  const hasTabelaAlunos = (r: number): boolean => {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[addr];
      if (cell?.v && String(cell.v).includes('{{TABELA_ALUNOS}}')) return true;
    }
    return false;
  };

  let html = '<table border="1" cellpadding="4" cellspacing="0" style="border-collapse: collapse; width: 100%; font-size: 10pt;">';
  for (let R = range.s.r; R <= range.e.r; R++) {
    if (hasTabelaAlunos(R)) {
      const tabella = flatData['TABELA_ALUNOS'] ?? '';
      if (tabella) html += tabella;
      continue;
    }
    html += '<tr>';
    for (let C = range.s.c; C <= range.e.c; C++) {
      const val = cellValue(R, C);
      html += `<td>${val}</td>`;
    }
    html += '</tr>';
  }
  html += '</table>';
  return html;
}
