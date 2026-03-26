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
    minute: '2-digit',
  });
};

/** Larguras em mm: 1ª coluna (nome) mais larga; demais repartem o resto com mínimo por nota. */
function computeColumnWidths(tableWidth: number, colCount: number): number[] {
  if (colCount <= 0) return [];
  if (colCount === 1) return [tableWidth];
  const MIN_FIRST = 36;
  const MIN_OTHER = 11;
  const otherCount = colCount - 1;
  let otherW = (tableWidth - MIN_FIRST) / otherCount;
  if (otherW >= MIN_OTHER) {
    const firstW = Math.max(MIN_FIRST, tableWidth - otherW * otherCount);
    return [firstW, ...Array(otherCount).fill(otherW)];
  }
  otherW = MIN_OTHER;
  const firstW = tableWidth - otherW * otherCount;
  if (firstW < MIN_FIRST) {
    const w = tableWidth / colCount;
    return Array(colCount).fill(w);
  }
  return [firstW, ...Array(otherCount).fill(otherW)];
}

const PAD_X = 1.8;

function lineHeightMm(fontSize: number): number {
  return (fontSize * 0.352) * 1.2;
}

function cellLines(doc: jsPDF, text: string, colWidth: number, fontSize: number): string[] {
  doc.setFontSize(fontSize);
  const inner = Math.max(4, colWidth - PAD_X * 2);
  return doc.splitTextToSize((text ?? '').trim() || '—', inner);
}

/** Altura útil da área de tabela (até o rodapé reservado). */
function tableBottomY(pageHeight: number): number {
  return pageHeight - 22;
}

/** 1ª coluna (aluno) e última (situação) à esquerda; notas/componentes ao centro. */
function colAlign(i: number, colCount: number): 'left' | 'center' {
  if (i === 0 || i === colCount - 1) return 'left';
  return 'center';
}

/**
 * Exporta PDF em landscape com colunas dimensionadas e texto contido na célula
 * (evita sobreposição em pautas com muitos trimestres / componentes).
 */
export const exportarRelatorioPDF = async (config: ExportConfig): Promise<void> => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
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

  doc.setFontSize(11);
  const tituloLines = doc.splitTextToSize(config.titulo, pageWidth - margin * 2 - 75);
  doc.text(tituloLines, margin, 20);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Exportado em: ${formatDate()}`, pageWidth - margin, 12, { align: 'right' });

  yPos = 38;

  const colCount = config.colunas.length;
  const tableWidth = pageWidth - margin * 2;
  const widths = computeColumnWidths(tableWidth, colCount);
  let xAcc = margin;
  const colX: number[] = widths.map((w) => {
    const x = xAcc;
    xAcc += w;
    return x;
  });

  const headerFont = colCount > 14 ? 6.5 : colCount > 10 ? 7.5 : 9;
  const bodyFont = colCount > 14 ? 6.5 : colCount > 10 ? 7.5 : 8;
  const headerLh = lineHeightMm(headerFont);
  const bodyLh = lineHeightMm(bodyFont);

  const drawHeaderBlock = (startY: number): number => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(headerFont);
    doc.setTextColor(0, 0, 0);
    const headerLineArrays = config.colunas.map((col, i) => cellLines(doc, col, widths[i], headerFont));
    const maxHeaderLines = Math.max(1, ...headerLineArrays.map((l) => l.length));
    const headerRowH = maxHeaderLines * headerLh + 6;

    doc.setFillColor(240, 240, 240);
    doc.rect(margin, startY, tableWidth, headerRowH, 'F');
    doc.setDrawColor(180, 180, 180);
    doc.rect(margin, startY, tableWidth, headerRowH);

    headerLineArrays.forEach((lines, i) => {
      const x = colX[i];
      const w = widths[i];
      let yy = startY + 4 + headerLh * 0.85;
      const align = colAlign(i, colCount);
      lines.forEach((line) => {
        if (align === 'center') {
          const tw = doc.getTextWidth(line);
          doc.text(line, x + (w - tw) / 2, yy);
        } else {
          doc.text(line, x + PAD_X, yy);
        }
        yy += headerLh;
      });
      doc.setDrawColor(220, 220, 220);
      if (i < colCount - 1) {
        doc.line(x + w, startY, x + w, startY + headerRowH);
      }
    });

    doc.setFont('helvetica', 'normal');
    return startY + headerRowH;
  };

  yPos = drawHeaderBlock(yPos);

  const drawDataRow = (row: any[], startY: number): number => {
    doc.setFontSize(bodyFont);
    doc.setTextColor(0, 0, 0);
    const lineArrays = row.map((cell, i) => cellLines(doc, String(cell ?? ''), widths[i], bodyFont));
    const maxLines = Math.max(1, ...lineArrays.map((l) => l.length));
    const rowH = maxLines * bodyLh + 5;

    doc.setDrawColor(200, 200, 200);
    doc.rect(margin, startY, tableWidth, rowH);

    lineArrays.forEach((lines, i) => {
      const x = colX[i];
      const w = widths[i];
      let yy = startY + 3.5 + bodyLh * 0.85;
      const align = colAlign(i, colCount);
      lines.forEach((line) => {
        if (align === 'center') {
          const tw = doc.getTextWidth(line);
          doc.text(line, x + (w - tw) / 2, yy);
        } else {
          doc.text(line, x + PAD_X, yy);
        }
        yy += bodyLh;
      });
      if (i < colCount - 1) {
        doc.setDrawColor(230, 230, 230);
        doc.line(x + w, startY, x + w, startY + rowH);
      }
    });

    return startY + rowH;
  };

  config.dados.forEach((row, rowIndex) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(bodyFont);
    const lineArraysPreview = row.map((cell, i) => cellLines(doc, String(cell ?? ''), widths[i], bodyFont));
    const maxLines = Math.max(1, ...lineArraysPreview.map((l) => l.length));
    const rowH = maxLines * bodyLh + 5;

    if (yPos + rowH > tableBottomY(pageHeight)) {
      doc.addPage();
      yPos = 20;
      yPos = drawHeaderBlock(yPos);
    }

    if (rowIndex % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, yPos, tableWidth, rowH, 'F');
    }

    yPos = drawDataRow(row, yPos);
  });

  const footerY = pageHeight - 12;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, footerY - 6, pageWidth - margin, footerY - 6);

  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);

  if (config.emitidoPor) {
    doc.text(`Emitido por: ${config.emitidoPor}`, margin, footerY);
  }

  doc.text(
    `Sistema ${config.instituicao.nome} - Relatório gerado automaticamente`,
    pageWidth / 2,
    footerY,
    { align: 'center' }
  );
  doc.text(`Total de registros: ${config.dados.length}`, pageWidth - margin, footerY, { align: 'right' });

  doc.save(`relatorio-${config.titulo.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.pdf`);
};

export const exportarRelatorioExcel = (config: ExportConfig): void => {
  const wb = XLSX.utils.book_new();

  const wsData = [
    [config.instituicao.nome],
    [config.titulo],
    [`Exportado em: ${formatDate()}`],
    [],
    config.colunas,
    ...config.dados,
  ];

  wsData.push([]);
  wsData.push([`Total de registros: ${config.dados.length}`]);
  if (config.emitidoPor) {
    wsData.push([`Emitido por: ${config.emitidoPor}`]);
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  ws['!cols'] = config.colunas.map(() => ({ wch: 20 }));

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: config.colunas.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: config.colunas.length - 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: config.colunas.length - 1 } },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Relatório');

  XLSX.writeFile(wb, `relatorio-${config.titulo.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.xlsx`);
};
