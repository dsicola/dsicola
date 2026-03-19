/**
 * Biblioteca de presets de mapeamento Excel para modelos oficiais do governo.
 * Permite "Aplicar formato oficial" ao sugerir mapeamento com estrutura conhecida.
 */
import type {
  TipoExcelModelo,
  ExcelAnalyzeResult,
  ExcelCellMapping,
  ExcelCellMappingListaColumn,
} from './excelTemplate.service.js';

export interface PresetMappingInfo {
  id: string;
  label: string;
  description: string;
}

/** Presets disponíveis por tipo — ordem padrão de colunas para modelo oficial */
const PRESET_COLUMNS: Record<TipoExcelModelo, Array<{ index: number; campo: string }>> = {
  PAUTA_CONCLUSAO: [
    { index: 0, campo: 'student.n' },
    { index: 1, campo: 'student.fullName' },
    { index: 2, campo: 'student.numeroEstudante' },
    { index: 3, campo: 'nota.MAC' },
    { index: 4, campo: 'nota.NPP' },
    { index: 5, campo: 'nota.MT1' },
    { index: 6, campo: 'nota.MT2' },
    { index: 7, campo: 'nota.MT3' },
    { index: 8, campo: 'nota.EX' },
    { index: 9, campo: 'nota.MFD' },
    { index: 10, campo: 'nota.CA' },
    { index: 11, campo: 'student.obs' },
  ],
  BOLETIM: [
    { index: 0, campo: 'disciplina.disciplinaNome' },
    { index: 1, campo: 'disciplina.notaFinal' },
    { index: 2, campo: 'disciplina.situacaoAcademica' },
    { index: 3, campo: 'disciplina.professorNome' },
    { index: 4, campo: 'disciplina.cargaHoraria' },
  ],
  MINI_PAUTA: [
    { index: 0, campo: 'student.n' },
    { index: 1, campo: 'student.fullName' },
    { index: 2, campo: 'student.numeroEstudante' },
    { index: 3, campo: 'student.avaliacoes' },
    { index: 4, campo: 'student.exame' },
    { index: 5, campo: 'student.mediaFinal' },
    { index: 6, campo: 'student.situacao' },
  ],
};

function colIndexToLetter(n: number): string {
  let s = '';
  n++;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/**
 * Retorna lista de presets disponíveis para o tipo.
 */
export function getPresetMappings(tipo: TipoExcelModelo): PresetMappingInfo[] {
  const presets: PresetMappingInfo[] = [
    {
      id: 'oficial',
      label: 'Formato oficial',
      description:
        tipo === 'BOLETIM'
          ? 'Ordem padrão: Disciplina, Nota Final, Situação, Professor, C.H.'
          : tipo === 'MINI_PAUTA'
            ? 'Ordem padrão: Nº, Nome, N.º Estudante, Avaliações, Exame, Média Final, Situação'
            : 'Ordem padrão: Nº, Nome, N.º Estudante, MAC, NPP, MT1–3, Exame, MFD, CA, Obs',
    },
  ];
  return presets;
}

/**
 * Retorna colunas do preset por índice (0-based).
 */
export function getPresetColumnsByIndex(
  tipo: TipoExcelModelo,
  presetId: string
): Array<{ index: number; campo: string }> {
  if (presetId !== 'oficial') return [];
  return [...(PRESET_COLUMNS[tipo] ?? [])];
}

/**
 * Aplica o preset ao resultado do analyze: mapeia colunas detetadas por índice
 * aos campos do preset. Se o preset tem mais colunas que as detetadas, usa
 * as letras de coluna do resultado; se tem menos, limita ao tamanho do preset.
 */
export function applyPresetToAnalyzeResult(
  result: ExcelAnalyzeResult,
  presetId: string,
  tipo: TipoExcelModelo
): ExcelCellMapping {
  const items: ExcelCellMapping['items'] = [];
  const presetCols = getPresetColumnsByIndex(tipo, presetId);
  if (presetCols.length === 0) {
    // Fallback: retornar o suggestedMapping como está
    if (result.suggestedMapping?.singles?.length) {
      items.push(...result.suggestedMapping.singles);
    }
    if (result.suggestedMapping?.lista) {
      const { startRow, columns, listSource } = result.suggestedMapping.lista;
      const listSourceVal = listSource ?? (tipo === 'BOLETIM' ? 'disciplinas' : 'alunos');
      items.push({
        tipo: 'LISTA',
        startRow,
        listSource: listSourceVal,
        columns: Array.isArray(columns) ? columns : (Object.entries(columns) as [string, string][]).map(([coluna, campo]) => ({ coluna, campo })),
      });
    }
    return { items };
  }

  if (result.suggestedMapping?.singles?.length) {
    items.push(...result.suggestedMapping.singles);
  }

  const lista = result.suggestedMapping?.lista;
  const startRow = lista?.startRow ?? 2;
  const listSource = lista?.listSource ?? (tipo === 'BOLETIM' ? 'disciplinas' : 'alunos');

  // Colunas detetadas (por índice) — headers do resultado
  const detectedCols = result.headers ?? result.detectedHeaders ?? [];
  const columns: ExcelCellMappingListaColumn[] = [];

  for (let i = 0; i < presetCols.length; i++) {
    const { campo } = presetCols[i];
    const detected = detectedCols[i];
    const colLetter = detected?.col ?? colIndexToLetter(i);
    columns.push({ coluna: colLetter, campo });
  }

  if (columns.length > 0) {
    items.push({
      tipo: 'LISTA',
      startRow,
      listSource,
      columns,
    });
  }

  return { items };
}
