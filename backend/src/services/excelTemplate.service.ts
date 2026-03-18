/**
 * Preenchimento de modelos Excel (.xlsx) com dados do sistema.
 * Placeholders no formato {{CHAVE}} nas células são substituídos pelos valores.
 * Usado para Boletim e Pauta de Conclusão quando há modelo oficial do governo.
 *
 * Modos:
 * - PLACEHOLDER: células têm {{CHAVE}}; substituímos pelo valor em data
 * - CELL_MAPPING: ficheiro oficial sem placeholders; preenchemos por coordenadas
 */
import * as XLSX from 'xlsx';
import { AppError } from '../middlewares/errorHandler.js';

/** Converte letra de coluna (ex: "A", "AA") em índice 0-based. */
function decodeCol(col: string): number {
  let n = 0;
  for (let i = 0; i < col.length; i++) {
    n = n * 26 + (col.toUpperCase().charCodeAt(i) - 64);
  }
  return n - 1;
}

/** Converte índice 0-based em letra de coluna (ex: 0 -> "A", 26 -> "AA"). */
function encodeCol(n: number): string {
  let s = '';
  n++;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

import type { BoletimAluno } from './relatoriosOficiais.service.js';

/** Dados mínimos do boletim para preenchimento Excel (compatível com BoletimAluno) */
type BoletimParaExcel = Pick<BoletimAluno, 'instituicao' | 'aluno' | 'anoLetivo' | 'disciplinas'>;

const PLACEHOLDER_REGEX = /\{\{([^{}]+)\}\}/g;

/** Modo de preenchimento Excel: PLACEHOLDER ({{CHAVE}}) ou CELL_MAPPING (coordenadas) */
export type ExcelTemplateMode = 'PLACEHOLDER' | 'CELL_MAPPING';

/** Mapeamento de célula única: ex: { cell: "B5", campo: "instituicao.nome" } */
export interface ExcelCellMappingSingle {
  cell: string;
  campo: string;
}

/** Coluna na LISTA (formato evoluído): permite disciplina por nome */
export interface ExcelCellMappingListaColumn {
  coluna: string;
  campo: string;
  disciplina?: string; // ex: "Matemática" → nota["Matemática"].MAC
}

/** Mapeamento de lista. listSource: alunos (Pauta) | disciplinas (Boletim) */
export interface ExcelCellMappingLista {
  tipo: 'LISTA';
  startRow: number;
  listSource?: 'alunos' | 'disciplinas'; // default: alunos (Pauta Conclusão)
  disciplinaMode?: 'POR_INDICE' | 'POR_NOME';
  columns: Record<string, string> | ExcelCellMappingListaColumn[];
}

export type ExcelCellMappingItem = ExcelCellMappingSingle | ExcelCellMappingLista;

/** Estrutura completa do mapeamento célula-a-célula (modo CELL_MAPPING) */
export interface ExcelCellMapping {
  sheetIndex?: number;
  items: ExcelCellMappingItem[];
}

/** Resultado da análise automática do Excel para sugestão de mapeamento */
export interface ExcelAnalyzeResult {
  sheetNames: string[];
  headers: Array<{ col: string; label: string; sampleValues: string[] }>;
  suggestedMapping: {
    singles?: Array<{ cell: string; campo: string }>;
    lista?: { startRow: number; columns: ExcelCellMappingListaColumn[] };
  };
  maxRows: number;
  maxCols: number;
  /** Score 0–1 de confiança na sugestão automática */
  confidence?: number;
  /** Linha onde foram detetados os cabeçalhos da tabela (0-indexed) */
  detectedHeaderRow?: number;
  /** Labels dos cabeçalhos detetados (col → label) */
  detectedHeaders?: Array<{ col: string; label: string }>;
}

/** Resultado da validação do mapeamento */
export interface ExcelMappingValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

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
 * Extrai placeholders {{CHAVE}} com referência das células (ex: B5, C10).
 * Usado na UI para mostrar mapeamento célula-a-célula, como edição real no Excel.
 */
export function extractPlaceholdersFromExcelWithCellRefs(excelTemplateBase64: string): Array<{ placeholder: string; cells: string[] }> {
  if (!excelTemplateBase64?.trim()) return [];
  let buffer: Buffer;
  try {
    buffer = Buffer.from(excelTemplateBase64, 'base64');
  } catch {
    return [];
  }
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const map = new Map<string, Set<string>>();
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
            if (key) {
              if (!map.has(key)) map.set(key, new Set());
              map.get(key)!.add(addr);
            }
          }
        }
      }
    }
  }
  return Array.from(map.entries())
    .map(([placeholder, cells]) => ({ placeholder, cells: Array.from(cells).sort() }))
    .sort((a, b) => a.placeholder.localeCompare(b.placeholder));
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

  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    cellDates: false,
    cellStyles: true,
    cellNF: true,
  });
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

/** Dados estruturados para Boletim em modo CELL_MAPPING (um aluno, lista de disciplinas) */
export interface BoletimCellMappingData {
  instituicao?: { nome?: string };
  aluno: { nomeCompleto?: string; numeroIdentificacao?: string | null; numeroIdentificacaoPublica?: string | null };
  anoLetivo?: { ano?: number };
  disciplinas: Array<{
    disciplinaNome: string;
    notaFinal: number | null;
    situacaoAcademica?: string;
    professorNome?: string;
    cargaHoraria?: number;
  }>;
}

/** Dados estruturados para preenchimento em modo CELL_MAPPING (Pauta de Conclusão) */
export interface PautaConclusaoCellMappingData {
  instituicaoNome: string;
  turma: string;
  especialidade: string;
  anoLetivo: string;
  classe?: string;
  disciplinas: string[];
  alunos: Array<{
    n: number;
    nrec: string;
    nome: string;
    notas: Record<string, { ca?: number; cfd?: number; mac?: number; npp?: number; npg?: number; mt1?: number; mt2?: number; mt3?: number; ha?: number; ex?: number; mfd?: number }>;
    estagio?: number;
    cfPlano?: number;
    pap?: number;
    classFinal?: number;
    obs: string;
  }>;
}

function fmtNum(v: number | null | undefined): string {
  return v != null && !Number.isNaN(v) ? String(Math.round(v * 10) / 10) : '';
}

/** Resolve valor em path. disciplinaOverride: quando coluna tem disciplina, usa nota[disciplina].campo */
function getValueByPath(
  global: PautaConclusaoCellMappingData,
  row: (typeof global.alunos)[0] | null,
  path: string,
  disciplinaOverride?: string
): string {
  const parts = path.split('.');
  if (parts[0] === 'instituicao') {
    if (parts[1] === 'nome') return global.instituicaoNome ?? '';
  }
  if (parts[0] === 'turma') return global.turma ?? '';
  if (parts[0] === 'especialidade') return global.especialidade ?? '';
  if (parts[0] === 'anoLetivo') return global.anoLetivo ?? '';
  if (parts[0] === 'classe') return global.classe ?? '';
  if (parts[0] === 'disciplinas') return global.disciplinas?.join(', ') ?? '';

  if (row && parts[0] === 'student') {
    if (parts[1] === 'fullName') return row.nome ?? '';
    if (parts[1] === 'numeroEstudante') return row.nrec ?? '';
    if (parts[1] === 'n') return String(row.n ?? '');
    if (parts[1] === 'obs') return row.obs ?? '';
    if (parts[1] === 'estagio') return fmtNum(row.estagio);
    if (parts[1] === 'cfPlano') return fmtNum(row.cfPlano);
    if (parts[1] === 'pap') return fmtNum(row.pap);
    if (parts[1] === 'classFinal') return fmtNum(row.classFinal);
  }

  if (row && (parts[0] === 'nota' || (disciplinaOverride && /^(MAC|CA|NPP|NPG|MT1|MT2|MT3|HA|EX|MFD|CFD)$/i.test(parts[0])))) {
    let discNome: string | undefined;
    let campoPart: string;
    if (disciplinaOverride) {
      discNome = disciplinaOverride;
      campoPart = parts[0] === 'nota' ? (parts[1] ?? parts[0]) : parts[0];
    } else if (parts[0] === 'nota' && parts.length >= 3) {
      const p1 = parts[1];
      const idx = parseInt(p1, 10);
      discNome = Number.isNaN(idx) ? p1 : (global.disciplinas?.[idx] ?? global.disciplinas?.[0]);
      campoPart = parts[2];
    } else if (parts[0] === 'nota') {
      discNome = global.disciplinas?.[0];
      campoPart = parts[1] ?? '';
    } else {
      return '';
    }
    const nota = discNome ? row.notas?.[discNome] : undefined;
    if (!nota) return '';
    const campo = (campoPart ?? '').toUpperCase();
    if (campo === 'MAC') return fmtNum(nota.mac ?? nota.ca);
    if (campo === 'CA') return fmtNum(nota.ca);
    if (campo === 'NPP') return fmtNum(nota.npp);
    if (campo === 'NPG') return fmtNum(nota.npg);
    if (campo === 'MT1') return fmtNum(nota.mt1);
    if (campo === 'MT2') return fmtNum(nota.mt2);
    if (campo === 'MT3') return fmtNum(nota.mt3);
    if (campo === 'HA') return fmtNum(nota.ha);
    if (campo === 'EX') return fmtNum(nota.ex);
    if (campo === 'MFD') return fmtNum(nota.mfd ?? nota.cfd);
    if (campo === 'CFD') return fmtNum(nota.cfd);
  }

  return '';
}

/** Resolve valor para Boletim (single cells + lista de disciplinas) */
function getValueByPathBoletim(
  boletim: BoletimCellMappingData,
  discRow: (typeof boletim.disciplinas)[0] | null,
  path: string
): string {
  const parts = path.split('.');
  if (parts[0] === 'instituicao' && parts[1] === 'nome') return boletim.instituicao?.nome ?? '';
  if (parts[0] === 'aluno') {
    if (parts[1] === 'nomeCompleto') return boletim.aluno?.nomeCompleto ?? '';
    if (parts[1] === 'numeroIdentificacao' || parts[1] === 'numeroEstudante')
      return boletim.aluno?.numeroIdentificacaoPublica ?? boletim.aluno?.numeroIdentificacao ?? '';
  }
  if (parts[0] === 'anoLetivo' && parts[1] === 'ano') return String(boletim.anoLetivo?.ano ?? '');

  if (discRow && (parts[0] === 'disciplina' || parts[0] === 'disciplinaNome')) {
    if (parts[1] === 'nome' || parts[1] === 'disciplinaNome' || parts[0] === 'disciplinaNome') return discRow.disciplinaNome ?? '';
    if (parts[1] === 'notaFinal') return discRow.notaFinal != null ? String(Math.round(discRow.notaFinal * 10) / 10) : '';
    if (parts[1] === 'situacaoAcademica') return discRow.situacaoAcademica ?? '';
    if (parts[1] === 'professorNome') return discRow.professorNome ?? '';
    if (parts[1] === 'cargaHoraria') return String(discRow.cargaHoraria ?? '');
  }
  return '';
}

/**
 * Preenche modelo Excel em modo CELL_MAPPING: sem placeholders, apenas coordenadas.
 * Não altera estilos, bordas ou merges. Apenas escreve valores nas células.
 */
export function fillExcelTemplateWithCellMapping(
  excelTemplateBase64: string,
  data: PautaConclusaoCellMappingData,
  cellMapping: ExcelCellMapping
): Buffer {
  if (!excelTemplateBase64?.trim()) {
    throw new AppError('Modelo Excel não fornecido', 400);
  }
  if (!cellMapping?.items?.length) {
    throw new AppError('Mapeamento de células (excelCellMappingJson) obrigatório em modo CELL_MAPPING', 400);
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(excelTemplateBase64, 'base64');
  } catch {
    throw new AppError('Modelo Excel inválido (base64)', 400);
  }

  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    cellDates: false,
    cellStyles: true,
    cellNF: true,
  });
  const sheetIdx = cellMapping.sheetIndex ?? 0;
  const sheetName = workbook.SheetNames[sheetIdx];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new AppError(`Folha Excel não encontrada (índice ${sheetIdx})`, 400);
  }

  const colLetterToIndex = (col: string): number => decodeCol(col);

  const parseCell = (addr: string): { r: number; c: number } | null => {
    const m = addr.match(/^([A-Z]+)([0-9]+)$/i);
    if (!m) return null;
    const c = decodeCol(m[1]);
    const r = parseInt(m[2], 10) - 1;
    return { r, c };
  };

  const normalizeListaColumns = (
    columns: Record<string, string> | ExcelCellMappingListaColumn[]
  ): ExcelCellMappingListaColumn[] => {
    if (Array.isArray(columns)) return columns;
    return Object.entries(columns).map(([coluna, campo]) => ({ coluna, campo }));
  };

  for (const item of cellMapping.items) {
    if ('cell' in item && 'campo' in item && !('tipo' in item)) {
      const single = item as ExcelCellMappingSingle;
      const parsed = parseCell(single.cell);
      if (!parsed) continue;
      const val = getValueByPath(data, null, single.campo);
      ensureCell(sheet, parsed.r, parsed.c).v = val;
    } else if ('tipo' in item && item.tipo === 'LISTA' && 'columns' in item) {
      const lista = item as ExcelCellMappingLista;
      const { startRow, listSource } = lista;
      const cols = normalizeListaColumns(lista.columns);
      const src = listSource ?? 'alunos';
      if (src === 'alunos') {
        for (let i = 0; i < data.alunos.length; i++) {
          const excelRow1Based = startRow + i;
          const r = excelRow1Based - 1;
          const aluno = data.alunos[i];
          for (const colSpec of cols) {
            const c = colLetterToIndex(colSpec.coluna);
            const val = getValueByPath(data, aluno, colSpec.campo, colSpec.disciplina);
            ensureCell(sheet, r, c).v = val;
          }
        }
      }
    }
  }

  const out = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return Buffer.from(out);
}

/**
 * Preenche modelo Excel em modo CELL_MAPPING para Boletim (um aluno, lista de disciplinas opcional).
 */
export function fillExcelTemplateWithCellMappingBoletim(
  excelTemplateBase64: string,
  boletim: BoletimCellMappingData,
  cellMapping: ExcelCellMapping
): Buffer {
  if (!excelTemplateBase64?.trim()) throw new AppError('Modelo Excel não fornecido', 400);
  if (!cellMapping?.items?.length) throw new AppError('Mapeamento de células obrigatório em modo CELL_MAPPING', 400);

  let buffer: Buffer;
  try {
    buffer = Buffer.from(excelTemplateBase64, 'base64');
  } catch {
    throw new AppError('Modelo Excel inválido (base64)', 400);
  }

  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    cellDates: false,
    cellStyles: true,
    cellNF: true,
  });
  const sheetIdx = cellMapping.sheetIndex ?? 0;
  const sheetName = workbook.SheetNames[sheetIdx];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new AppError(`Folha Excel não encontrada (índice ${sheetIdx})`, 400);

  const colLetterToIndex = (col: string) => decodeCol(col);
  const parseCell = (addr: string): { r: number; c: number } | null => {
    const m = addr.match(/^([A-Z]+)([0-9]+)$/i);
    if (!m) return null;
    return { r: parseInt(m[2], 10) - 1, c: colLetterToIndex(m[1]) };
  };

  const normalizeListaColumns = (
    columns: Record<string, string> | ExcelCellMappingListaColumn[]
  ): ExcelCellMappingListaColumn[] =>
    Array.isArray(columns) ? columns : Object.entries(columns).map(([coluna, campo]) => ({ coluna, campo }));

  for (const item of cellMapping.items) {
    if ('cell' in item && 'campo' in item && !('tipo' in item)) {
      const single = item as ExcelCellMappingSingle;
      const parsed = parseCell(single.cell);
      if (!parsed) continue;
      const val = getValueByPathBoletim(boletim, null, single.campo);
      ensureCell(sheet, parsed.r, parsed.c).v = val;
    } else if ('tipo' in item && item.tipo === 'LISTA' && 'columns' in item && item.listSource === 'disciplinas') {
      const listaItem = item as ExcelCellMappingLista;
      const { startRow } = listaItem;
      const cols = normalizeListaColumns(listaItem.columns);
      for (let i = 0; i < boletim.disciplinas.length; i++) {
        const r = startRow + i - 1;
        const disc = boletim.disciplinas[i];
        for (const colSpec of cols) {
          const c = colLetterToIndex(colSpec.coluna);
          const val = getValueByPathBoletim(boletim, disc, colSpec.campo);
          ensureCell(sheet, r, c).v = val;
        }
      }
    }
  }

  const out = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return Buffer.from(out);
}

/** Em merges, escrever apenas na célula superior-esquerda para não quebrar a formatação. */
function getMergeOrigin(sheet: { [key: string]: unknown }, r: number, c: number): { r: number; c: number } {
  const merges = (sheet['!merges'] || []) as Array<{ s: { r: number; c: number }; e: { r: number; c: number } }>;
  for (const m of merges) {
    if (r >= m.s.r && r <= m.e.r && c >= m.s.c && c <= m.e.c) {
      return { r: m.s.r, c: m.s.c };
    }
  }
  return { r, c };
}

function ensureCell(sheet: Record<string, unknown>, r: number, c: number): { t?: string; v?: unknown } {
  const origin = getMergeOrigin(sheet, r, c);
  const addr = XLSX.utils.encode_cell({ r: origin.r, c: origin.c });
  let cell = sheet[addr] as { t?: string; v?: unknown } | undefined;
  if (!cell) {
    cell = { t: 's', v: '' };
    (sheet as Record<string, { t?: string; v?: unknown }>)[addr] = cell;
  }
  return cell;
}

/**
 * Escolhe fillExcelTemplate ou fillExcelTemplateWithCellMapping conforme o modo do modelo.
 */
export function fillExcelTemplateByMode(
  excelTemplateBase64: string,
  mode: ExcelTemplateMode | string | null | undefined,
  cellMappingJson: string | null | undefined,
  placeholderData: Record<string, string | number | null | undefined>,
  cellMappingData: PautaConclusaoCellMappingData | null
): Buffer {
  const m = (mode ?? 'PLACEHOLDER') as ExcelTemplateMode;
  if (m === 'CELL_MAPPING' && cellMappingJson?.trim()) {
    let mapping: ExcelCellMapping;
    try {
      mapping = JSON.parse(cellMappingJson) as ExcelCellMapping;
    } catch {
      throw new AppError('excelCellMappingJson inválido. Deve ser JSON com items (cell/campo ou tipo LISTA).', 400);
    }
    if (!cellMappingData) {
      throw new AppError('Dados estruturados necessários para modo CELL_MAPPING', 400);
    }
    return fillExcelTemplateWithCellMapping(excelTemplateBase64, cellMappingData, mapping);
  }
  return fillExcelTemplate(excelTemplateBase64, placeholderData);
}

/** Palavras-chave de cabeçalhos para deteção automática (modelos do governo) */
const HEADER_KEYWORDS = [
  'NOME',
  'ALUNO',
  'ESTUDANTE',
  'DISCIPLINA',
  'MAC',
  'NPP',
  'MT1',
  'MT2',
  'MT3',
  'EX',
  'MFD',
  'CA',
  'NPG',
  'HA',
  'CFD',
  'Nº',
  'NÚMERO',
  'NR',
  'ORDEM',
  'MATRÍCULA',
  'CODIGO',
  'CÓDIGO',
] as const;

/** Padrões para mapear cabeçalho/label → campo do sistema */
const HEADER_TO_CAMPO: Array<{ patterns: RegExp[]; campo: string }> = [
  { patterns: [/^n[º°]?\s*$|^n[úu]mero\s*$|^nr\.?$|^ordem$/i], campo: 'student.n' },
  { patterns: [/^nome\b|^aluno\b|^estudante\b|^nome\s*completo$/i], campo: 'student.fullName' },
  { patterns: [/n[º°]?\s*estudante|matr[íi]cula|c[óo]digo\s*estudante|numero\s*estudante/i], campo: 'student.numeroEstudante' },
  { patterns: [/^mac\b|m[ée]dia\s*de\s*aproveitamento/i], campo: 'nota.MAC' },
  { patterns: [/^mfd\b|m[ée]dia\s*final/i], campo: 'nota.MFD' },
  { patterns: [/^ca\b|classifica[çc][ãa]o\s*final/i], campo: 'nota.CA' },
  { patterns: [/^npp\b|nota\s*pr[áa]tico/i], campo: 'nota.NPP' },
  { patterns: [/^npg\b|nota\s*te[óo]rico/i], campo: 'nota.NPG' },
  { patterns: [/^mt1\b|1\s*trimestre|nota\s*1/i], campo: 'nota.MT1' },
  { patterns: [/^mt2\b|2\s*trimestre|nota\s*2/i], campo: 'nota.MT2' },
  { patterns: [/^mt3\b|3\s*trimestre|nota\s*3/i], campo: 'nota.MT3' },
  { patterns: [/^ex\b|^exame\b/i], campo: 'nota.EX' },
  { patterns: [/^ha\b|habilita[çc][ãa]o/i], campo: 'nota.HA' },
  { patterns: [/^cfd\b/i], campo: 'nota.CFD' },
  { patterns: [/^obs\.?$|observa[çc][ãa]o/i], campo: 'student.obs' },
  { patterns: [/institui[çc][ãa]o|estabelecimento/i], campo: 'instituicao.nome' },
  { patterns: [/^turma\b/i], campo: 'turma' },
  { patterns: [/especialidade|^curso\b/i], campo: 'especialidade' },
  { patterns: [/ano\s*letivo|^ano\b(?!\s*curso)/i], campo: 'anoLetivo' },
];

/**
 * Analisa o Excel e sugere mapeamento (análise inteligente baseada em palavras-chave e tipos).
 * Usa heurísticas para reduzir configuração manual em mini pautas / modelos do governo.
 */
export function analyzeExcelAndSuggestMapping(excelTemplateBase64: string): ExcelAnalyzeResult {
  const empty: ExcelAnalyzeResult = {
    sheetNames: [],
    headers: [],
    suggestedMapping: {},
    maxRows: 0,
    maxCols: 0,
    confidence: 0,
  };
  if (!excelTemplateBase64?.trim()) return empty;

  let buffer: Buffer;
  try {
    buffer = Buffer.from(excelTemplateBase64, 'base64');
  } catch {
    return empty;
  }
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet || !sheet['!ref']) {
    return {
      sheetNames: workbook.SheetNames,
      headers: [],
      suggestedMapping: {},
      maxRows: 0,
      maxCols: 0,
      confidence: 0,
    };
  }
  const range = XLSX.utils.decode_range(sheet['!ref']);
  const maxRows = range.e.r + 1;
  const maxCols = range.e.c + 1;

  const getCellStr = (r: number, c: number): string => {
    const addr = XLSX.utils.encode_cell({ r, c });
    const cell = sheet[addr];
    if (!cell?.v) return '';
    return String(cell.v).trim();
  };
  const colToLetter = (c: number) => encodeCol(c);

  // --- PASSO 1: Ler primeiras 10 linhas ---
  const scanRows = Math.min(10, maxRows);

  // --- PASSO 2: Detetar linha de cabeçalho ---
  let detectedHeaderRow = -1;
  let bestKeywordCount = 0;
  for (let r = 0; r < scanRows; r++) {
    let keywordMatches = 0;
    const cells: string[] = [];
    for (let c = 0; c <= Math.min(range.e.c, 30); c++) {
      const v = getCellStr(r, c);
      if (v) cells.push(v);
      const upper = v.toUpperCase();
      for (const kw of HEADER_KEYWORDS) {
        if (upper.includes(kw) || upper === kw || new RegExp(`\\b${kw}\\b`, 'i').test(v)) {
          keywordMatches++;
          break;
        }
      }
    }
    const hasMultipleCols = cells.length >= 2;
    const textCount = cells.filter((c) => c.length > 1 && c.length < 80).length;
    const score = keywordMatches * 2 + (hasMultipleCols ? 1 : 0) + (textCount >= 2 ? 1 : 0);
    if (score > bestKeywordCount) {
      bestKeywordCount = score;
      detectedHeaderRow = r;
    }
  }

  // Fallback: se não encontrou keywords, usar linha com mais células não-vazias
  if (detectedHeaderRow < 0) {
    let maxCells = 0;
    for (let r = 0; r < scanRows; r++) {
      let count = 0;
      for (let c = 0; c <= Math.min(range.e.c, 30); c++) {
        if (getCellStr(r, c)) count++;
      }
      if (count > maxCells) {
        maxCells = count;
        detectedHeaderRow = r;
      }
    }
    if (detectedHeaderRow < 0) detectedHeaderRow = 0;
  }

  // --- PASSO 3 e 4: Classificar colunas + Detetar startRow ---
  const startRow = detectedHeaderRow + 1;
  const detectedHeaders: Array<{ col: string; label: string }> = [];
  const columns: ExcelCellMappingListaColumn[] = [];
  const usedCampos = new Set<string>();

  const matchLabelToCampo = (label: string): string | null => {
    const norm = label.trim();
    for (const { patterns, campo } of HEADER_TO_CAMPO) {
      for (const p of patterns) {
        if (p.test(norm)) return campo;
      }
    }
    return null;
  };

  for (let c = 0; c <= Math.min(range.e.c, 25); c++) {
    const colLetter = colToLetter(c);
    const headerLabel = getCellStr(detectedHeaderRow, c) || colLetter;
    detectedHeaders.push({ col: colLetter, label: headerLabel });

    const samples: string[] = [];
    for (let r = startRow; r <= Math.min(startRow + 4, range.e.r); r++) {
      const v = getCellStr(r, c);
      if (v) samples.push(v);
    }

    let campo = matchLabelToCampo(headerLabel);

    if (!campo) {
      const mostlyText = samples.filter((s) => s.length > 2 && !/^-?\d+(\.\d+)?$/.test(s)).length >= 2;
      const mostlyNum = samples.some((s) => /^-?\d+(\.\d+)?$/.test(s));
      const notaRange = samples.some((s) => {
        const n = parseFloat(s);
        return !Number.isNaN(n) && n >= 0 && n <= 20;
      });
      if (mostlyNum && notaRange) {
        campo = 'nota.MAC';
      } else if (c === 0 && (samples.some((s) => /^\d+$/.test(s)) || samples.filter(Boolean).length >= 1)) {
        campo = 'student.n';
      } else if (c === 1 && mostlyText) {
        campo = 'student.fullName';
      } else if (c === 2 && samples.some((s) => /^\d{4,}/.test(s) || s.length >= 5)) {
        campo = 'student.numeroEstudante';
      } else if (mostlyNum) {
        campo = 'nota.MFD';
      } else if (mostlyText && samples.some((s) => s.length > 5)) {
        campo = 'student.fullName';
      } else {
        continue;
      }
    }

    if (campo && !usedCampos.has(`${colLetter}:${campo}`)) {
      usedCampos.add(`${colLetter}:${campo}`);
      columns.push({ coluna: colLetter, campo });
    }
  }

  // --- PASSO 5: Singles (zona cabeçalho antes da tabela) ---
  // Em templates do governo: label à esquerda (A), valor à direita (B). Mapeamos a célula do valor.
  const singles: Array<{ cell: string; campo: string }> = [];
  const singleRowLimit = Math.min(detectedHeaderRow, 5);
  const usedSingleCampos = new Set<string>();
  for (let r = 0; r < singleRowLimit; r++) {
    for (let c = 0; c <= Math.min(5, range.e.c); c++) {
      const v = getCellStr(r, c);
      if (v && v.length > 2 && v.length < 60 && !/^\d+$/.test(v)) {
        const campo = matchLabelToCampo(v) ||
          (r === 0 && c <= 1 ? 'instituicao.nome' : r === 1 && c <= 1 ? 'turma' : r === 2 && c <= 1 ? 'especialidade' : 'anoLetivo');
        if (usedSingleCampos.has(campo)) break;
        usedSingleCampos.add(campo);
        const valueCol = c + 1 <= range.e.c ? c + 1 : c;
        const valueCell = `${colToLetter(valueCol)}${r + 1}`;
        singles.push({ cell: valueCell, campo });
        break;
      }
    }
  }

  // --- PASSO 6: Score de confiança ---
  let confidence = 0;
  if (bestKeywordCount > 0) confidence += 0.4;
  if (columns.length >= 2) confidence += 0.3;
  const nomeCol = columns.find((col) => col.campo === 'student.fullName');
  if (nomeCol) confidence += 0.2;
  const notaCol = columns.find((col) => col.campo.startsWith('nota.'));
  if (notaCol) confidence += 0.2;
  confidence = Math.min(1, Math.round(confidence * 100) / 100);

  // --- Headers para compatibilidade ---
  const headers: Array<{ col: string; label: string; sampleValues: string[] }> = [];
  for (let c = 0; c <= Math.min(range.e.c, 25); c++) {
    const label = getCellStr(detectedHeaderRow, c) || colToLetter(c);
    const samples: string[] = [];
    for (let r = startRow; r <= Math.min(startRow + 3, range.e.r); r++) {
      const v = getCellStr(r, c);
      if (v) samples.push(v);
    }
    headers.push({ col: colToLetter(c), label, sampleValues: samples });
  }

  return {
    sheetNames: workbook.SheetNames,
    headers,
    suggestedMapping: {
      singles: singles.length ? singles : undefined,
      lista: columns.length ? { startRow, columns } : undefined,
    },
    maxRows,
    maxCols,
    confidence,
    detectedHeaderRow,
    detectedHeaders,
  };
}

/**
 * Analisa o Excel e sugere mapeamento. Alias de analyzeExcelAndSuggestMapping.
 */
export function analyzeExcelTemplate(excelTemplateBase64: string): ExcelAnalyzeResult {
  return analyzeExcelAndSuggestMapping(excelTemplateBase64);
}

/**
 * Valida mapeamento: células duplicadas, colunas fora do range, campos inexistentes.
 */
export function validateCellMapping(
  cellMapping: ExcelCellMapping,
  excelTemplateBase64?: string | null,
  disciplinas?: string[]
): ExcelMappingValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  let maxRows = 0;
  let maxCols = 0;

  if (excelTemplateBase64?.trim()) {
    try {
      const buf = Buffer.from(excelTemplateBase64, 'base64');
      const wb = XLSX.read(buf, { type: 'buffer', cellDates: false });
      const sheet = wb.Sheets[wb.SheetNames[cellMapping.sheetIndex ?? 0]];
      if (sheet?.['!ref']) {
        const r = XLSX.utils.decode_range(sheet['!ref']);
        maxRows = r.e.r + 1;
        maxCols = r.e.c + 1;
      }
    } catch {
      /* ignora */
    }
  }

  const validCampos = new Set([
    'instituicao.nome', 'turma', 'especialidade', 'anoLetivo', 'classe', 'disciplinas',
    'student.fullName', 'student.numeroEstudante', 'student.n', 'student.obs',
    'student.estagio', 'student.cfPlano', 'student.pap', 'student.classFinal',
    'nota.MAC', 'nota.CA', 'nota.NPP', 'nota.NPG', 'nota.MT1', 'nota.MT2', 'nota.MT3',
    'nota.HA', 'nota.EX', 'nota.MFD', 'nota.CFD',
    'MAC', 'CA', 'NPP', 'NPG', 'MT1', 'MT2', 'MT3', 'HA', 'EX', 'MFD', 'CFD',
  ]);

  const seenCells = new Set<string>();
  const colToIdx = (col: string) => decodeCol(col);

  for (const item of cellMapping.items) {
    if ('cell' in item && 'campo' in item && !('tipo' in item)) {
      const s = item as ExcelCellMappingSingle;
      if (seenCells.has(s.cell)) errors.push(`Célula duplicada: ${s.cell}`);
      seenCells.add(s.cell);
      if (!validCampos.has(s.campo) && !s.campo.startsWith('nota.') && !/^nota\.\d+\./.test(s.campo)) {
        warnings.push(`Campo possivelmente inexistente: ${s.campo}`);
      }
    } else if ('tipo' in item && item.tipo === 'LISTA' && 'columns' in item) {
      const listaItem = item as ExcelCellMappingLista;
      if (typeof listaItem.startRow !== 'number' || listaItem.startRow < 1 || !Number.isFinite(listaItem.startRow)) {
        errors.push('LISTA: startRow obrigatório e deve ser um número >= 1');
      }
      const cols: ExcelCellMappingListaColumn[] = Array.isArray(listaItem.columns) ? listaItem.columns : Object.entries(listaItem.columns).map(([coluna, campo]) => ({ coluna, campo }));
      const seenCols = new Set<string>();
      for (const colSpec of cols) {
        const col = colSpec.coluna;
        const key = `${listaItem.startRow}:${col}`;
        if (seenCols.has(col)) errors.push(`Coluna duplicada na LISTA: ${col}`);
        seenCols.add(col);
        if (maxCols > 0 && colToIdx(col) >= maxCols) {
          errors.push(`Coluna ${col} fora do range (máx. ${maxCols} colunas)`);
        }
        const campo = colSpec.campo;
        if (!validCampos.has(campo) && !campo.startsWith('student.') && !campo.startsWith('nota.') && !colSpec.disciplina) {
          warnings.push(`Campo possivelmente inexistente: ${campo} (coluna ${col})`);
        }
        if (colSpec.disciplina && disciplinas?.length && !disciplinas.includes(colSpec.disciplina)) {
          warnings.push(`Disciplina "${colSpec.disciplina}" pode não existir nos dados`);
        }
      }
      if (maxRows > 0 && listaItem.startRow + 100 > maxRows) {
        warnings.push(`Lista pode ultrapassar limite do Excel (startRow=${listaItem.startRow}, maxRows=${maxRows})`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Converte a primeira folha do Excel em HTML com substituição de placeholders.
 * Preserva células mescladas via sheet['!merges'].
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
      const span = getCellMergeSpan(sheet, R, C);
      if (span === null) continue;
      const val = getCellValueInMerge(sheet, R, C);
      const replaced = replacePlaceholders(val, flatData);
      if (replaced.includes('<tr>')) {
        hasTabelaAlunos = true;
        rowHtml = replaced;
        break;
      }
      let attrs = '';
      if (span.rowspan > 1) attrs += ` rowspan="${span.rowspan}"`;
      if (span.colspan > 1) attrs += ` colspan="${span.colspan}"`;
      rowHtml += `<td${attrs}>${escapeHtmlForTd(replaced)}</td>`;
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

/** Retorna rowspan/colspan a partir de sheet['!merges']. null = célula coberta por merge (não renderizar). */
function getCellMergeSpan(
  sheet: { [key: string]: unknown },
  r: number,
  c: number
): { rowspan: number; colspan: number } | null {
  const merges = (sheet['!merges'] || []) as Array<{ s: { r: number; c: number }; e: { r: number; c: number } }>;
  for (const m of merges) {
    if (r >= m.s.r && r <= m.e.r && c >= m.s.c && c <= m.e.c) {
      if (r === m.s.r && c === m.s.c) {
        return { rowspan: m.e.r - m.s.r + 1, colspan: m.e.c - m.s.c + 1 };
      }
      return null; // dentro do merge, não é célula principal — omitir
    }
  }
  return { rowspan: 1, colspan: 1 };
}

/** Obtém o valor da célula; em merges, o valor está só na célula superior-esquerda. */
function getCellValueInMerge(sheet: { [key: string]: unknown }, r: number, c: number): string {
  const merges = (sheet['!merges'] || []) as Array<{ s: { r: number; c: number }; e: { r: number; c: number } }>;
  for (const m of merges) {
    if (r >= m.s.r && r <= m.e.r && c >= m.s.c && c <= m.e.c) {
      const addr = XLSX.utils.encode_cell({ r: m.s.r, c: m.s.c });
      const cell = (sheet as Record<string, { t?: string; v?: unknown }>)[addr];
      if (!cell || cell.t === 'e') return '';
      const v = cell.v;
      return typeof v === 'string' ? v : typeof v === 'number' && !Number.isNaN(v) ? String(v) : '';
    }
  }
  const addr = XLSX.utils.encode_cell({ r, c });
  const cell = (sheet as Record<string, { t?: string; v?: unknown }>)[addr];
  if (!cell || cell.t === 'e' || cell.v == null) return '';
  const v = cell.v;
  return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : String(v);
}

/**
 * Converte buffer Excel (já preenchido) em HTML fiel ao layout.
 * Preserva merges (rowspan/colspan), larguras de coluna e conteúdo (incluindo HTML embutido como TABELA_ALUNOS).
 * Usado para preview Excel → PDF (fica idêntico ao ficheiro gerado).
 */
export function excelBufferToHtml(excelBuffer: Buffer): string {
  const workbook = XLSX.read(excelBuffer, { type: 'buffer', cellDates: false });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet || !sheet['!ref']) return '';

  const range = XLSX.utils.decode_range(sheet['!ref']);
  const cols = (sheet['!cols'] || []) as Array<{ wch?: number } | undefined>;
  const escapeHtml = (s: string): string =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const numCols = range.e.c - range.s.c + 1;
  let colgroup = '';
  if (cols.length > 0) {
    const totalWch = cols.slice(0, numCols).reduce((s, c) => s + (c?.wch ?? 8), 0) || 1;
    colgroup = '<colgroup>';
    for (let i = 0; i < numCols; i++) {
      const w = ((cols[i]?.wch ?? 8) / totalWch) * 100;
      colgroup += `<col style="width:${w}%" />`;
    }
    colgroup += '</colgroup>';
  }

  let html = `<table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:10pt;table-layout:fixed;">${colgroup}`;
  for (let R = range.s.r; R <= range.e.r; R++) {
    let injectedHtml = '';
    for (let C = range.s.c; C <= range.e.c; C++) {
      const span = getCellMergeSpan(sheet, R, C);
      if (span === null) continue;
      const val = getCellValueInMerge(sheet, R, C);
      if ((val.includes('<tr>') || val.includes('<td>')) && val.trim().startsWith('<')) {
        injectedHtml = val;
        break;
      }
    }
    if (injectedHtml) {
      html += injectedHtml;
      continue;
    }
    html += '<tr>';
    for (let C = range.s.c; C <= range.e.c; C++) {
      const span = getCellMergeSpan(sheet, R, C);
      if (span === null) continue;
      const val = getCellValueInMerge(sheet, R, C);
      const content = escapeHtml(val);
      let attrs = '';
      if (span.rowspan > 1) attrs += ` rowspan="${span.rowspan}"`;
      if (span.colspan > 1) attrs += ` colspan="${span.colspan}"`;
      html += `<td${attrs}>${content}</td>`;
    }
    html += '</tr>';
  }
  html += '</table>';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;padding:20px;} table{width:100%;}</style></head><body>${html}</body></html>`;
}

/**
 * Converte a primeira folha do Excel em HTML (tabela) e substitui placeholders.
 * Preserva células mescladas (rowspan/colspan) a partir de sheet['!merges'].
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
      const span = getCellMergeSpan(sheet, R, C);
      if (span === null) continue;
      const val = getCellValueInMerge(sheet, R, C);
      const replaced = replacePlaceholders(val, flatData);
      const isHtmlContent = replaced.includes('<tr>') || replaced.includes('<td>');
      const content = isHtmlContent ? replaced : escapeHtmlCell(replaced);
      let attrs = '';
      if (span.rowspan > 1) attrs += ` rowspan="${span.rowspan}"`;
      if (span.colspan > 1) attrs += ` colspan="${span.colspan}"`;
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
    notas: Record<string, { ca: number; cfd: number } & Partial<PautaFinalNotaCampos>>;
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
  const base: Record<string, string> = {
    INSTITUICAO_NOME: dados.instituicaoNome,
    TURMA: dados.turma,
    ESPECIALIDADE: dados.especialidade,
    ANO_LETIVO: dados.anoLetivo,
    TABELA_ALUNOS: rows.join('\n'),
    DISCIPLINAS: dados.disciplinas.join(', '),
  };
  Object.assign(base, pautaFinalToExcelData(dados));
  return base;
}

/** Campos de nota por disciplina no modelo Pauta Final do governo (MAC, NPP, MT1, EX, MFD, etc.) */
export interface PautaFinalNotaCampos {
  mac: number;   // Média Avaliação Contínua
  npp: number;   // Nota Provas Parciais
  npg: number;   // Nota Prova Global (opcional)
  mt1: number;   // Média Trimestre 1
  mt2: number;   // Média Trimestre 2
  mt3: number;   // Média Trimestre 3
  ha: number;    // Horas de Assiduidade / outro (opcional)
  ex: number;    // Exame
  mfd: number;   // Média Final da Disciplina
}

/**
 * Monta placeholders célula-a-célula para Pauta Final (modelo governo Angola).
 * Cada célula do Excel pode ter {{ALUNO_1_NOME}}, {{ALUNO_1_DISC_1_MAC}}, etc.
 * O modelo importado do governo já tem a estrutura; preenchemos célula a célula.
 */
export function pautaFinalToExcelData(dados: {
  instituicaoNome: string;
  turma: string;
  especialidade: string;
  anoLetivo: string;
  classe?: string;
  disciplinas: string[];
  alunos: Array<{
    n: number;
    nrec: string;
    nome: string;
    notas: Record<string, { ca: number; cfd: number } & Partial<PautaFinalNotaCampos>>;
    estagio: number;
    cfPlano: number;
    pap: number;
    classFinal: number;
    obs: string;
  }>;
}): Record<string, string> {
  const out: Record<string, string> = {};
  const fmt = (v: number | null | undefined) => (v != null && !Number.isNaN(v) ? String(Math.round(v * 10) / 10) : '');

  out.INSTITUICAO_NOME = dados.instituicaoNome ?? '';
  out.TURMA = dados.turma ?? '';
  out.ESPECIALIDADE = dados.especialidade ?? '';
  out.ANO_LETIVO = dados.anoLetivo ?? '';
  out.CLASSE = dados.classe ?? '';
  out.CURSO = dados.especialidade ?? '';

  const discKeys = dados.disciplinas.map((d, i) => ({ nome: d, key: `DISC_${i + 1}` }));

  for (let i = 0; i < dados.alunos.length; i++) {
    const a = dados.alunos[i];
    const n = i + 1;
    out[`ALUNO_${n}_NOME`] = a.nome ?? '';
    out[`ALUNO_${n}_NREC`] = a.nrec ?? '';
    out[`ALUNO_${n}_N`] = String(a.n);
    out[`ALUNO_${n}_OBS`] = a.obs ?? '';
    out[`ALUNO_${n}_ESTAGIO`] = fmt(a.estagio);
    out[`ALUNO_${n}_CF_PLANO`] = fmt(a.cfPlano);
    out[`ALUNO_${n}_PAP`] = fmt(a.pap);
    out[`ALUNO_${n}_CLASS_FINAL`] = fmt(a.classFinal);

    for (let j = 0; j < discKeys.length; j++) {
      const { key } = discKeys[j];
      const discNome = discKeys[j].nome;
      const nota = a.notas[discNome] ?? { ca: 0, cfd: 0 };
      const ext = nota as Record<string, number | undefined>;
      out[`ALUNO_${n}_${key}_MAC`] = fmt(ext.mac ?? ext.ca ?? nota.ca);
      out[`ALUNO_${n}_${key}_NPP`] = fmt(ext.npp);
      out[`ALUNO_${n}_${key}_NPG`] = fmt(ext.npg);
      out[`ALUNO_${n}_${key}_MT1`] = fmt(ext.mt1);
      out[`ALUNO_${n}_${key}_MT2`] = fmt(ext.mt2);
      out[`ALUNO_${n}_${key}_MT3`] = fmt(ext.mt3);
      out[`ALUNO_${n}_${key}_HA`] = fmt(ext.ha);
      out[`ALUNO_${n}_${key}_EX`] = fmt(ext.ex);
      out[`ALUNO_${n}_${key}_MFD`] = fmt(ext.mfd ?? ext.cfd ?? nota.cfd);
      out[`ALUNO_${n}_${key}_CA`] = fmt(nota.ca);
      out[`ALUNO_${n}_${key}_CFD`] = fmt(nota.cfd);
    }
  }

  return out;
}

/**
 * Converte a primeira folha do Excel em HTML (tabela) e substitui placeholders {{CHAVE}}.
 * Preserva células mescladas via sheet['!merges'].
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
    let val = getCellValueInMerge(sheet, r, c);
    if (val.includes('{{')) val = replacePlaceholders(val, flatData);
    return escapeHtml(val);
  };

  const hasTabelaAlunos = (r: number): boolean => {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const val = getCellValueInMerge(sheet, r, c);
      if (val.includes('{{TABELA_ALUNOS}}')) return true;
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
      const span = getCellMergeSpan(sheet, R, C);
      if (span === null) continue;
      const val = cellValue(R, C);
      let attrs = '';
      if (span.rowspan > 1) attrs += ` rowspan="${span.rowspan}"`;
      if (span.colspan > 1) attrs += ` colspan="${span.colspan}"`;
      html += `<td${attrs}>${val}</td>`;
    }
    html += '</tr>';
  }
  html += '</table>';
  return html;
}
