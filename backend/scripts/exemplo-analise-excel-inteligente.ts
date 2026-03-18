/**
 * Exemplo: Análise inteligente de Excel (modelo do governo) → sugestão de mapeamento
 *
 * Simula um ficheiro Excel típico do governo e mostra o resultado da análise.
 * Execute: npx tsx scripts/exemplo-analise-excel-inteligente.ts
 */
import * as XLSX from 'xlsx';
import { analyzeExcelAndSuggestMapping } from '../src/services/excelTemplate.service.js';

// Cria Excel que simula modelo MINED / governo (sem placeholders)
function createExemploModeloGoverno(): string {
  const wb = XLSX.utils.book_new();
  const data = [
    ['Ministério da Educação - Modelo Oficial'],
    ['Instituição de Ensino', 'Escola Secundária XYZ'],
    ['Turma', '12ª Classe - Turno A'],
    ['Especialidade', 'Ciências Físico-Químicas'],
    ['Ano Letivo', '2024/2025'],
    [],
    ['Nº', 'Nome do Estudante', 'Nº de Matrícula', 'MAC', 'NPP', 'MT1', 'MT2', 'EX', 'MFD', 'CA'],
    [1, 'Maria João Silva', '202401234', 14, 13, 15, 14, 14, 14, 'Aprovado'],
    [2, 'João Pedro Santos', '202401235', 12, 11, 12, 13, 12, 12, 'Aprovado'],
    [3, 'Ana Cristina Costa', '202401236', 16, 17, 15, 16, 16, 16, 'Aprovado'],
    [4, 'Carlos Manuel Dias', '202401237', 9, 8, 10, 9, 9, 9, 'Reprovado'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Pauta Final');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return buf.toString('base64');
}

const base64 = createExemploModeloGoverno();
const result = analyzeExcelAndSuggestMapping(base64);

console.log('\n=== Análise inteligente de Excel (modelo do governo) ===\n');
console.log('Folhas:', result.sheetNames.join(', '));
console.log('Dimensões:', result.maxRows, 'linhas x', result.maxCols, 'colunas');
console.log('Confiança:', result.confidence != null ? `${(result.confidence * 100).toFixed(0)}%` : 'N/A');
console.log('Linha de cabeçalhos detetada (0-indexed):', result.detectedHeaderRow ?? 'N/A');
console.log('\nCabeçalhos detetados:');
(result.detectedHeaders ?? []).forEach((h) => console.log(`  ${h.col}: "${h.label}"`));

console.log('\n--- Sugestão de mapeamento ---');
if (result.suggestedMapping?.singles?.length) {
  console.log('\nCélulas únicas (cabeçalho):');
  result.suggestedMapping.singles.forEach((s) => console.log(`  ${s.cell} → ${s.campo}`));
}
if (result.suggestedMapping?.lista) {
  const { startRow, columns } = result.suggestedMapping.lista;
  console.log('\nLista (dados dos alunos):');
  console.log(`  startRow: ${startRow}`);
  console.log('  Colunas:');
  columns.forEach((c) => console.log(`    ${c.coluna} → ${c.campo}${c.disciplina ? ` [${c.disciplina}]` : ''}`));
}

console.log('\n--- Exemplo de estrutura de resposta (POST /modelos-documento/analyze-excel-template) ---');
console.log(JSON.stringify({
  suggestedMapping: result.suggestedMapping,
  confidence: result.confidence,
  detectedHeaders: result.detectedHeaders,
  startRow: result.suggestedMapping?.lista?.startRow,
  maxRows: result.maxRows,
  maxCols: result.maxCols,
}, null, 2));

console.log('\n--- Duas opções na UI ---');
console.log('1. MANUAL: Utilizador adiciona células/colunas manualmente no CellMappingEditor');
console.log('2. AUTOMÁTICA: Clicar "Sugerir mapeamento" → análise inteligente preenche o editor');
console.log('   → Utilizador pode revisar e ajustar antes de guardar.\n');
