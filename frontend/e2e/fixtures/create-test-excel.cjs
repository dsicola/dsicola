#!/usr/bin/env node
/**
 * Gera ficheiro Excel mínimo para testes E2E (modelos e mapeamento).
 * Estrutura compatível com Pauta de Conclusão: cabeçalhos + linhas de alunos.
 */
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const outDir = path.join(__dirname);
const outPath = path.join(outDir, 'test-pauta-conclusao.xlsx');

const wsData = [
  ['Instituição de Teste E2E', '', '', ''],  // A1
  ['Turma', '10º A', 'Ano', '2024/2025'],    // A2
  [],                                         // linha vazia
  ['Nº', 'Nome', 'Matemática', 'Português'],  // A5 - header lista alunos
  [1, 'Aluno Teste 1', 14, 16],              // A6
  [2, 'Aluno Teste 2', 12, 15],              // A7
];

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet(wsData);
XLSX.utils.book_append_sheet(wb, ws, 'Pauta');
XLSX.writeFile(wb, outPath);

console.log('Fixture criado:', outPath);
