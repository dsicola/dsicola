import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

interface ExportConfig {
  instituicao: {
    nome: string;
    logoUrl?: string | null;
  };
  titulo: string;
  colunas: string[];
  dados: any[][];
  emitidoPor?: string;
}

const formatDate = () => {
  return new Date().toLocaleDateString('pt-AO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const exportarRelatorioPDF = async (config: ExportConfig): Promise<void> => {
  const doc = new jsPDF({ orientation: 'landscape' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let yPos = 15;

  // Header
  doc.setFillColor(30, 64, 175);
  doc.rect(0, 0, pageWidth, 30, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(config.instituicao.nome, margin, 12);

  doc.setFontSize(12);
  doc.text(config.titulo, margin, 22);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Exportado em: ${formatDate()}`, pageWidth - margin, 12, { align: 'right' });

  yPos = 40;

  // Table
  const colCount = config.colunas.length;
  const tableWidth = pageWidth - margin * 2;
  const colWidth = tableWidth / colCount;

  // Header row
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPos, tableWidth, 10, 'F');

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');

  config.colunas.forEach((col, i) => {
    doc.text(col, margin + i * colWidth + 3, yPos + 7);
  });

  yPos += 12;

  // Data rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  config.dados.forEach((row, rowIndex) => {
    if (yPos > pageHeight - 25) {
      doc.addPage();
      yPos = 20;
      
      // Re-draw header on new page
      doc.setFillColor(240, 240, 240);
      doc.rect(margin, yPos, tableWidth, 10, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      config.colunas.forEach((col, i) => {
        doc.text(col, margin + i * colWidth + 3, yPos + 7);
      });
      yPos += 12;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
    }

    // Alternate row color
    if (rowIndex % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, yPos - 2, tableWidth, 8, 'F');
    }

    row.forEach((cell, i) => {
      const text = String(cell ?? '').substring(0, 30);
      doc.text(text, margin + i * colWidth + 3, yPos + 4);
    });

    yPos += 8;
  });

  // Footer
  yPos = pageHeight - 15;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPos - 5, pageWidth - margin, yPos - 5);

  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  
  if (config.emitidoPor) {
    doc.text(`Emitido por: ${config.emitidoPor}`, margin, yPos);
  }
  
  doc.text(`Sistema ${config.instituicao.nome} - Relatório gerado automaticamente`, pageWidth / 2, yPos, { align: 'center' });
  doc.text(`Total de registros: ${config.dados.length}`, pageWidth - margin, yPos, { align: 'right' });

  // Save
  doc.save(`relatorio-${config.titulo.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.pdf`);
};

export const exportarRelatorioExcel = (config: ExportConfig): void => {
  // Create workbook
  const wb = XLSX.utils.book_new();

  // Prepare data with header
  const wsData = [
    [config.instituicao.nome],
    [config.titulo],
    [`Exportado em: ${formatDate()}`],
    [],
    config.colunas,
    ...config.dados
  ];

  // Add footer
  wsData.push([]);
  wsData.push([`Total de registros: ${config.dados.length}`]);
  if (config.emitidoPor) {
    wsData.push([`Emitido por: ${config.emitidoPor}`]);
  }

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws['!cols'] = config.colunas.map(() => ({ wch: 20 }));

  // Merge header cells
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: config.colunas.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: config.colunas.length - 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: config.colunas.length - 1 } },
  ];

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Relatório');

  // Save file
  XLSX.writeFile(wb, `relatorio-${config.titulo.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.xlsx`);
};
