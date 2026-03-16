/**
 * Exporta Pauta de Conclusão do Curso (modelo Saúde) para Excel.
 * Formato compatível com Excel, editável, colunas alinhadas.
 */
import * as XLSX from 'xlsx';

export interface PautaConclusaoSaudeDados {
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
}

export function exportarPautaConclusaoSaudeExcel(dados: PautaConclusaoSaudeDados, filename?: string): void {
  const wb = XLSX.utils.book_new();

  // Linha 1-4: Cabeçalho
  const headerRows: (string | number)[][] = [
    [dados.instituicaoNome],
    ['PAUTA DE CONCLUSÃO DO CURSO'],
    [dados.turma],
    [`ESPECIALIDADE - ${dados.especialidade}`],
    [`ANO LECTIVO ${dados.anoLetivo}`],
    [],
  ];

  // Linha de colunas: # | Nº REC | NOME | [DISC CA CFD]... | EST. | C.F. | PAP | CLASS.F | OBS
  const discCols: string[] = [];
  dados.disciplinas.forEach((d) => {
    discCols.push(`${d} CA`, `${d} CFD`);
  });
  const colHeaders = ['#', 'Nº REC', 'NOME COMPLETO', ...discCols, 'ESTÁGIO', 'C.F. PLANO', 'PAP', 'CLASS. FINAL', 'OBSERVAÇÃO'];
  headerRows.push(colHeaders);

  // Linhas de dados
  dados.alunos.forEach((a) => {
    const row: (string | number)[] = [a.n, a.nrec, a.nome];
    dados.disciplinas.forEach((d) => {
      const n = a.notas[d] ?? { ca: 0, cfd: 0 };
      row.push(n.ca, n.cfd);
    });
    row.push(a.estagio, a.cfPlano, a.pap, a.classFinal, a.obs);
    headerRows.push(row);
  });

  const ws = XLSX.utils.aoa_to_sheet(headerRows);

  // Larguras das colunas (alinhadas para edição no Excel)
  const colWidths: XLSX.ColInfo[] = [
    { wch: 4 },  // #
    { wch: 12 }, // Nº REC
    { wch: 35 }, // NOME
  ];
  dados.disciplinas.forEach(() => {
    colWidths.push({ wch: 6 }, { wch: 6 }); // CA, CFD por disciplina
  });
  colWidths.push({ wch: 8 }, { wch: 10 }, { wch: 6 }, { wch: 10 }, { wch: 12 }); // EST, C.F., PAP, CLASS, OBS
  ws['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, 'Pauta Conclusão');
  const fname = filename || `pauta-conclusao-saude-${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fname);
}
