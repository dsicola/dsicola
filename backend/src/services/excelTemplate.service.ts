/**
 * Preenchimento de modelos Excel (.xlsx) com dados do sistema.
 * Placeholders no formato {{CHAVE}} nas células são substituídos pelos valores.
 * Usado para Boletim e Pauta de Conclusão quando há modelo oficial do governo.
 */
import * as XLSX from 'xlsx';
import { AppError } from '../middlewares/errorHandler.js';
import type { BoletimAluno } from './relatoriosOficiais.service.js';

const PLACEHOLDER_REGEX = /\{\{([^{}]+)\}\}/g;

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
 * Monta dados planos para Boletim do Aluno (compatível com placeholders Excel).
 */
export function boletimToExcelData(boletim: BoletimAluno): Record<string, string> {
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
