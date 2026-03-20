/**
 * Importação simples de estudantes via Excel (exceljs).
 * Multi-tenant: sempre filtrado por instituicaoId.
 * Secundário vs Superior: resolução de turma usa Classe ou Curso conforme tipoAcademico.
 */

import ExcelJS from 'exceljs';
import prisma from '../lib/prisma.js';
import { buscarAnoLetivoAtivo } from './validacaoAcademica.service.js';
import { validarNomeCompleto } from './user.service.js';
import type { TipoAcademico } from '@prisma/client';
import {
  verificarPeriodoMatriculaLetivo,
  avaliarRegrasMatriculaImportacaoSemAluno,
} from './importacaoEstudantesMatricula.service.js';
import { resolveModoImportacao } from '../utils/importacaoEstudantesModo.js';
import { marcarDuplicadosDocumentoETelefoneNoPreview } from './importacaoEstudantesDuplicadosPreview.service.js';

export type CampoImportacao = 'nomeCompleto' | 'bi' | 'classe' | 'turma' | 'telefone' | 'email';

export type ColumnHints = Partial<Record<CampoImportacao, string>>;

export interface LinhaImportacaoPreview {
  linha: number;
  nomeCompleto: string;
  bi?: string;
  classe: string;
  turma?: string;
  telefone?: string;
  email?: string;
  valido: boolean;
  erro?: string;
  turmaResolvidaNome?: string | null;
  turmaId?: string | null;
  /** Preenchido no modo seguro quando há turma: avisos que podem fazer falhar a matrícula na confirmação. */
  avisosMatriculaSeguro?: string[];
}

const MAX_ROWS = 2000;
const MAX_COLS = 60;

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '');
}

function normHeader(s: string): string {
  return stripAccents(String(s || '').trim())
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function cellToString(val: unknown): string {
  if (val == null || val === '') return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number' && Number.isFinite(val)) {
    if (Number.isInteger(val)) return String(val);
    return String(val).trim();
  }
  if (val instanceof Date) return val.toISOString().split('T')[0];
  if (typeof val === 'object' && val !== null) {
    const o = val as Record<string, unknown>;
    if (typeof o.text === 'string') return o.text.trim();
    if (typeof o.richText === 'object' && Array.isArray((o.richText as { text?: string }[]) )) {
      return (o.richText as { text?: string }[])
        .map((x) => x.text || '')
        .join('')
        .trim();
    }
    if (typeof o.result !== 'undefined') return cellToString(o.result);
    if (typeof o.formula === 'string' && o.sharedFormula == null) return '';
  }
  return String(val).trim();
}

function isPlausibleNomeHeader(h: string): boolean {
  const n = normHeader(h);
  if (!n) return false;
  if (/(pai|mae|mãe|encarregad|responsavel|professor|docente)/i.test(n)) return false;
  return true;
}

function scoreNomeHeader(h: string): number {
  const n = normHeader(h);
  if (!isPlausibleNomeHeader(h)) return 0;
  if (/\bnome\b/.test(n) && /\bcompleto\b/.test(n)) return 100;
  if (/\baluno\b/.test(n) || /\bestudante\b/.test(n)) return 90;
  if (n === 'nome' || n.startsWith('nome ')) return 80;
  if (/\bnome\b/.test(n)) return 50;
  return 0;
}

function scoreBiHeader(h: string): number {
  const n = normHeader(h);
  if (/\bbilhete\b/.test(n)) return 95;
  if (/\bbi\b/.test(n) || /\bnif\b/.test(n) || /\bdocumento\b/.test(n)) return 85;
  return 0;
}

function scoreClasseHeader(h: string): number {
  const n = normHeader(h);
  if (/\bano\s*letivo\b/.test(n)) return 0;
  if (/\bcurso\b/.test(n)) return 88;
  if (/\bclasse\b/.test(n)) return 95;
  if (/\bano\b/.test(n)) return 70;
  return 0;
}

function scoreTurmaHeader(h: string): number {
  const n = normHeader(h);
  if (/\bsala\b/.test(n)) return 85;
  if (/\bturma\b/.test(n)) return 95;
  return 0;
}

function scoreTelHeader(h: string): number {
  const n = normHeader(h);
  if (/\btelefone\b/.test(n) || /\btelemovel\b/.test(n) || /\bcelular\b/.test(n)) return 95;
  if (/\btel\b/.test(n) || /\bmobile\b/.test(n)) return 80;
  return 0;
}

function scoreEmailHeader(h: string): number {
  const n = normHeader(h);
  if (/\be-mail\b/.test(n) || /\bemail\b/.test(n) || /\bmail\b/.test(n)) return 95;
  return 0;
}

type ScoreFn = (h: string) => number;

function bestColumn(headers: string[], score: ScoreFn): number | null {
  let bestI = -1;
  let bestS = 0;
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i] || '';
    const s = score(h);
    if (s > bestS) {
      bestS = s;
      bestI = i;
    }
  }
  return bestS > 0 ? bestI : null;
}

export function detectColumnMap(headers: string[], hints?: ColumnHints | null): Record<CampoImportacao, number | null> {
  const map: Record<CampoImportacao, number | null> = {
    nomeCompleto: null,
    bi: null,
    classe: null,
    turma: null,
    telefone: null,
    email: null,
  };

  const resolveHint = (field: CampoImportacao): number | null => {
    const wanted = hints?.[field];
    if (!wanted || !wanted.trim()) return null;
    const w = wanted.trim();
    const idx = headers.findIndex((h) => String(h).trim() === w);
    return idx >= 0 ? idx : null;
  };

  (['nomeCompleto', 'bi', 'classe', 'turma', 'telefone', 'email'] as CampoImportacao[]).forEach((field) => {
    const hinted = resolveHint(field);
    if (hinted !== null) map[field] = hinted;
  });

  if (map.nomeCompleto === null) map.nomeCompleto = bestColumn(headers, scoreNomeHeader);
  if (map.bi === null) map.bi = bestColumn(headers, scoreBiHeader);
  if (map.classe === null) map.classe = bestColumn(headers, scoreClasseHeader);
  if (map.turma === null) map.turma = bestColumn(headers, scoreTurmaHeader);
  if (map.telefone === null) map.telefone = bestColumn(headers, scoreTelHeader);
  if (map.email === null) map.email = bestColumn(headers, scoreEmailHeader);

  return map;
}

function mapeamentoLegivel(headers: string[], colMap: Record<CampoImportacao, number | null>): Record<CampoImportacao, string | null> {
  const out: Record<CampoImportacao, string | null> = {
    nomeCompleto: null,
    bi: null,
    classe: null,
    turma: null,
    telefone: null,
    email: null,
  };
  (Object.keys(colMap) as CampoImportacao[]).forEach((k) => {
    const idx = colMap[k];
    out[k] = idx != null && headers[idx] != null ? String(headers[idx]) : null;
  });
  return out;
}

function normMatch(s: string): string {
  return normHeader(s).replace(/[ºª°]/g, '').replace(/\s+/g, ' ').trim();
}

function looseContains(a: string, b: string): boolean {
  if (!a || !b) return false;
  const na = normMatch(a);
  const nb = normMatch(b);
  return na.includes(nb) || nb.includes(na) || na === nb;
}

export type TurmaImportacaoRow = {
  id: string;
  nome: string;
  sala: string | null;
  cursoId: string | null;
  classeId: string | null;
  capacidade: number;
  matriculasCount: number;
  anoLetivoId: string | null;
  curso: { id: string; nome: string; codigo: string } | null;
  classe: { id: string; nome: string; codigo: string } | null;
};

export async function loadTurmasAnoAtivo(instituicaoId: string): Promise<TurmaImportacaoRow[]> {
  const ano = await buscarAnoLetivoAtivo(instituicaoId);
  if (!ano) return [];
  const rows = await prisma.turma.findMany({
    where: { instituicaoId, anoLetivoId: ano.id },
    select: {
      id: true,
      nome: true,
      sala: true,
      cursoId: true,
      classeId: true,
      capacidade: true,
      anoLetivoId: true,
      curso: { select: { id: true, nome: true, codigo: true } },
      classe: { select: { id: true, nome: true, codigo: true } },
      _count: { select: { matriculas: true } },
    },
  });
  return rows.map(({ _count, ...t }) => ({
    ...t,
    matriculasCount: _count.matriculas,
  }));
}

export function resolveTurmaFromList(
  turmas: TurmaImportacaoRow[],
  tipoAcademico: TipoAcademico | null,
  classeRaw: string,
  turmaRaw: string | undefined
): { turmaId: string | null; turmaNome: string | null } {
  const trimmedClasse = classeRaw?.trim();
  if (!trimmedClasse || turmas.length === 0) return { turmaId: null, turmaNome: null };

  let candidatas = turmas;

  if (tipoAcademico === 'SECUNDARIO') {
    candidatas = turmas.filter((t) => {
      const c = t.classe;
      if (!c) return false;
      return (
        looseContains(c.nome, trimmedClasse) ||
        looseContains(trimmedClasse, c.nome) ||
        looseContains(c.codigo, trimmedClasse) ||
        normMatch(c.codigo) === normMatch(trimmedClasse)
      );
    });
  } else if (tipoAcademico === 'SUPERIOR') {
    candidatas = turmas.filter((t) => {
      const c = t.curso;
      if (!c) return false;
      return (
        looseContains(c.nome, trimmedClasse) ||
        looseContains(trimmedClasse, c.nome) ||
        looseContains(c.codigo, trimmedClasse) ||
        normMatch(c.codigo) === normMatch(trimmedClasse)
      );
    });
  } else {
    candidatas = turmas.filter((t) => {
      const cl = t.classe;
      const cr = t.curso;
      const matchClasse =
        cl &&
        (looseContains(cl.nome, trimmedClasse) ||
          looseContains(cl.codigo, trimmedClasse) ||
          normMatch(cl.codigo) === normMatch(trimmedClasse));
      const matchCurso =
        cr &&
        (looseContains(cr.nome, trimmedClasse) ||
          looseContains(cr.codigo, trimmedClasse) ||
          normMatch(cr.codigo) === normMatch(trimmedClasse));
      return !!(matchClasse || matchCurso);
    });
  }

  const tr = turmaRaw?.trim();
  if (tr && candidatas.length > 0) {
    const narrowed = candidatas.filter(
      (t) => looseContains(t.nome, tr) || (t.sala && looseContains(t.sala, tr)) || normMatch(t.nome) === normMatch(tr)
    );
    if (narrowed.length > 0) candidatas = narrowed;
  }

  if (candidatas.length === 1) {
    return { turmaId: candidatas[0].id, turmaNome: candidatas[0].nome };
  }
  if (candidatas.length > 1) {
    candidatas.sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
    return { turmaId: candidatas[0].id, turmaNome: candidatas[0].nome };
  }

  return { turmaId: null, turmaNome: null };
}

function simpleEmailOk(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
}

export async function parseEstudantesExcelBuffer(
  buffer: ArrayBuffer | Uint8Array | Buffer,
  instituicaoId: string,
  tipoAcademico: TipoAcademico | null,
  hints?: ColumnHints | null,
  opts?: { modoImportacao?: string; importarMesmoSeMatriculaFalharLegacy?: boolean }
): Promise<{
  total: number;
  validos: number;
  erros: number;
  dados: LinhaImportacaoPreview[];
  cabecalhos: string[];
  mapeamentoColunas: Record<CampoImportacao, string | null>;
  modoImportacao: 'seguro' | 'flexivel';
  resumoMatriculaSeguro?: {
    foraDoPeriodoLetivo: boolean;
    linhasComAvisoMatricula: number;
    mensagemPeriodo?: string;
  };
}> {
  const wb = new ExcelJS.Workbook();
  const buf = Buffer.isBuffer(buffer)
    ? buffer
    : Buffer.from(buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : (buffer as Uint8Array));
  // exceljs typings vs Node Buffer — runtime OK
  await wb.xlsx.load(buf as never);
  const ws = wb.worksheets[0];
  if (!ws) {
    throw new Error('Ficheiro sem folhas de cálculo.');
  }

  const headerRow = ws.getRow(1);
  let maxCol = 0;
  headerRow.eachCell({ includeEmpty: false }, (_cell, colNumber) => {
    maxCol = Math.max(maxCol, colNumber);
  });
  if (maxCol > MAX_COLS) maxCol = MAX_COLS;
  if (maxCol < 1) {
    throw new Error('Cabeçalhos não encontrados na primeira linha.');
  }

  const headers: string[] = [];
  for (let c = 1; c <= maxCol; c++) {
    headers.push(cellToString(headerRow.getCell(c).value));
  }

  const colMap = detectColumnMap(headers, hints);
  const mapeamentoColunas = mapeamentoLegivel(headers, colMap);

  if (colMap.nomeCompleto == null) {
    throw new Error('Não foi possível detetar a coluna de nome. Use "Ajustar colunas" ou inclua um cabeçalho como "Nome" ou "Aluno".');
  }
  if (colMap.classe == null) {
    throw new Error('Não foi possível detetar a coluna de classe/curso. Use "Ajustar colunas" ou inclua "Classe", "Ano" ou "Curso".');
  }

  const modoImportacao = resolveModoImportacao(opts?.modoImportacao, opts?.importarMesmoSeMatriculaFalharLegacy);
  const turmasCache = await loadTurmasAnoAtivo(instituicaoId);

  let periodoLetivoOk = true;
  let mensagemPeriodoLetivo: string | undefined;
  if (modoImportacao === 'seguro' && turmasCache.length > 0 && turmasCache[0].anoLetivoId) {
    const pv = await verificarPeriodoMatriculaLetivo(
      prisma,
      instituicaoId,
      turmasCache[0].anoLetivoId
    );
    periodoLetivoOk = pv.ok;
    if (!pv.ok) mensagemPeriodoLetivo = pv.message;
  }

  const dados: LinhaImportacaoPreview[] = [];

  const lastRow = Math.min(ws.rowCount || 2, MAX_ROWS + 1);

  for (let r = 2; r <= lastRow; r++) {
    const row = ws.getRow(r);
    const nomeCompleto =
      colMap.nomeCompleto != null ? cellToString(row.getCell(colMap.nomeCompleto + 1).value) : '';
    const classe = colMap.classe != null ? cellToString(row.getCell(colMap.classe + 1).value) : '';
    const turma = colMap.turma != null ? cellToString(row.getCell(colMap.turma + 1).value) : '';
    const bi = colMap.bi != null ? cellToString(row.getCell(colMap.bi + 1).value) : '';
    const telefone = colMap.telefone != null ? cellToString(row.getCell(colMap.telefone + 1).value) : '';
    let email = colMap.email != null ? cellToString(row.getCell(colMap.email + 1).value) : '';

    const rowEmpty = !nomeCompleto && !classe && !turma && !bi && !telefone && !email;
    if (rowEmpty) continue;

    let erro: string | undefined;
    try {
      if (!nomeCompleto) erro = 'Nome em falta';
      else validarNomeCompleto(nomeCompleto);
    } catch (e: unknown) {
      erro = e instanceof Error ? e.message : 'Nome inválido';
    }
    if (!classe?.trim()) {
      erro = erro ? `${erro}; Classe/curso em falta` : 'Classe/curso em falta';
    }
    if (email && !simpleEmailOk(email)) {
      email = '';
    }

    const valido = !erro;

    let turmaId: string | null = null;
    let turmaResolvidaNome: string | null = null;
    let avisosMatriculaSeguro: string[] | undefined;
    if (valido && classe.trim()) {
      const res = resolveTurmaFromList(turmasCache, tipoAcademico, classe, turma || undefined);
      turmaId = res.turmaId;
      turmaResolvidaNome = res.turmaNome;

      if (modoImportacao === 'seguro' && turmaId) {
        const trow = turmasCache.find((t) => t.id === turmaId);
        if (trow) {
          avisosMatriculaSeguro = avaliarRegrasMatriculaImportacaoSemAluno({
            tipoAcademicoInstituicao: tipoAcademico,
            classeRawExcel: classe,
            turma: {
              id: trow.id,
              nome: trow.nome,
              cursoId: trow.cursoId,
              classeId: trow.classeId,
              capacidade: trow.capacidade,
              matriculasCount: trow.matriculasCount,
              classe: trow.classe ? { nome: trow.classe.nome } : null,
              curso: trow.curso ? { nome: trow.curso.nome } : null,
            },
            periodoLetivoOk,
            mensagemPeriodoLetivo,
          });
        }
      }
    }

    dados.push({
      linha: r,
      nomeCompleto: nomeCompleto || '',
      bi: bi || undefined,
      classe: classe || '',
      turma: turma || undefined,
      telefone: telefone || undefined,
      email: email || undefined,
      valido: !!valido,
      erro,
      turmaId,
      turmaResolvidaNome,
      avisosMatriculaSeguro,
    });
  }

  const { validos, erros } = marcarDuplicadosDocumentoETelefoneNoPreview(dados);
  const linhasComAvisoMatricula = dados.filter(
    (d) => d.valido && d.avisosMatriculaSeguro && d.avisosMatriculaSeguro.length > 0
  ).length;

  const resumoMatriculaSeguro =
    modoImportacao === 'seguro'
      ? {
          foraDoPeriodoLetivo: !periodoLetivoOk,
          linhasComAvisoMatricula,
          mensagemPeriodo: mensagemPeriodoLetivo,
        }
      : undefined;

  return {
    total: dados.length,
    validos,
    erros,
    dados,
    cabecalhos: headers,
    mapeamentoColunas,
    modoImportacao,
    resumoMatriculaSeguro,
  };
}

export interface LinhaConfirmarInput {
  linha: number;
  nomeCompleto: string;
  classe: string;
  turma?: string;
  bi?: string;
  telefone?: string;
  email?: string;
}

export function normalizeConfirmRow(raw: unknown): LinhaConfirmarInput | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const linha = typeof o.linha === 'number' ? o.linha : Number(o.linha);
  const nomeCompleto = typeof o.nomeCompleto === 'string' ? o.nomeCompleto : String(o.nomeCompleto || '');
  const classe = typeof o.classe === 'string' ? o.classe : String(o.classe || '');
  if (!Number.isFinite(linha)) return null;
  return {
    linha,
    nomeCompleto,
    classe,
    turma: typeof o.turma === 'string' ? o.turma : o.turma != null ? String(o.turma) : undefined,
    bi: typeof o.bi === 'string' ? o.bi : o.bi != null ? String(o.bi) : undefined,
    telefone: typeof o.telefone === 'string' ? o.telefone : o.telefone != null ? String(o.telefone) : undefined,
    email: typeof o.email === 'string' ? o.email : o.email != null ? String(o.email) : undefined,
  };
}
