import jsPDF from 'jspdf';

export interface ReciboData {
  instituicao: {
    nome: string;
    nif?: string | null;
    logoUrl?: string | null;
    email?: string | null;
    telefone?: string | null;
    endereco?: string | null;
    tipoAcademico?: 'SUPERIOR' | 'SECUNDARIO' | null;
  };
  aluno: {
    nome: string;
    numeroId?: string | null; // Número de identificação pública (ex: ALU0007)
    bi?: string | null; // Bilhete de Identidade
    email?: string | null;
    curso?: string | null;
    turma?: string | null;
    anoLetivo?: number | null;
    /** Ensino Superior: ex. "1º Ano", "2º Ano" */
    anoFrequencia?: string | null;
    /** Ensino Secundário: ex. "10ª Classe" */
    classeFrequencia?: string | null;
    tipoAcademico?: 'SUPERIOR' | 'SECUNDARIO' | null;
  };
  pagamento: {
    valor: number;
    valorDesconto?: number;
    valorMulta?: number;
    valorJuros?: number;
    mesReferencia: number;
    anoReferencia: number;
    dataPagamento: string;
    formaPagamento: string;
    reciboNumero: string;
    operador?: string | null;
    descricao?: string | null;
    observacoes?: string | null;
  };
}

const getMesNome = (mes: number) => {
  const meses = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  return meses[mes - 1] || "";
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-AO", {
    style: "currency",
    currency: "AOA",
  }).format(value);
};

const formatDate = (dateString: string | null | undefined) => {
  if (dateString == null || String(dateString).trim() === '') {
    return new Date().toLocaleDateString('pt-AO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return new Date().toLocaleDateString('pt-AO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }
  return date.toLocaleDateString('pt-AO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
};

/** Formata valor numérico para tabela (ex: 25.000,00 sem símbolo) */
const formatValorAO = (value: number) => {
  return new Intl.NumberFormat('pt-AO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

/** Valor por extenso em português (Kwanzas) - simplificado para recibos */
const valorPorExtenso = (valor: number): string => {
  const partes: string[] = [];
  const unidade = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
  const dezena1 = ['dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezasseis', 'dezassete', 'dezoito', 'dezanove'];
  const dezena2 = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const centena = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

  const int = Math.floor(valor);
  const dec = Math.round((valor - int) * 100);
  let n = int;

  if (n === 0) partes.push('zero');
  else {
    if (n >= 1000000) {
      const m = Math.floor(n / 1000000);
      partes.push(m === 1 ? 'um milhão' : `${valorPorExtenso(m)} milhões`);
      n %= 1000000;
      if (n > 0) partes.push('e');
    }
    if (n >= 1000) {
      const mil = Math.floor(n / 1000);
      if (mil === 1) partes.push('mil');
      else partes.push(`${valorPorExtenso(mil)} mil`);
      n %= 1000;
      if (n > 0) partes.push('e');
    }
    if (n >= 100) {
      const c = Math.floor(n / 100);
      partes.push(c === 1 && n % 100 === 0 ? 'cem' : centena[c]);
      n %= 100;
      if (n > 0) partes.push('e');
    }
    if (n >= 20) {
      const d = Math.floor(n / 10);
      partes.push(dezena2[d]);
      n %= 10;
      if (n > 0) partes.push('e');
    }
    if (n >= 10) {
      partes.push(dezena1[n - 10]);
      n = 0;
    }
    if (n > 0) partes.push(unidade[n]);
  }
  const extenso = partes.join(' ').replace(/\s+/g, ' ').trim();
  const moeda = ' Kwanzas';
  return dec > 0 ? `${extenso}${moeda} e ${dec}/100` : `${extenso}${moeda}`;
};

// Generate unique receipt code
export const gerarCodigoRecibo = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `RCB${year}${month}${day}-${random}`;
};

/** Tipo de documento fiscal: Recibo ou Fatura */
export type TipoDocumentoFiscal = 'RECIBO' | 'FATURA';

/** Parâmetros para cabeçalho profissional unificado */
interface ProfessionalHeaderOptions {
  doc: jsPDF;
  instituicao: {
    nome: string;
    logoUrl?: string | null;
    endereco?: string | null;
    telefone?: string | null;
    email?: string | null;
  };
  tituloDocumento: string;
  numeroDocumento: string;
  dataDocumento: string;
  margin?: number;
}

/**
 * Desenha cabeçalho profissional (logo, instituição, N° e data em caixa)
 * Retorna yPos após o cabeçalho para continuar o conteúdo
 */
const drawProfessionalHeader = async (opts: ProfessionalHeaderOptions): Promise<number> => {
  const { doc, instituicao, tituloDocumento, numeroDocumento, dataDocumento } = opts;
  const margin = opts.margin ?? 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 18;

  if (instituicao.logoUrl) {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = instituicao.logoUrl;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
      });
      doc.addImage(img, 'PNG', margin, 8, 24, 24);
    } catch {
      /* skip logo */
    }
  }

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text(instituicao.nome, instituicao.logoUrl ? margin + 30 : margin, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  const contactLines: string[] = [];
  if (instituicao.endereco) contactLines.push(instituicao.endereco);
  if (instituicao.telefone) contactLines.push(`Telefone: ${instituicao.telefone}`);
  if (instituicao.email) contactLines.push(`Email: ${instituicao.email}`);
  contactLines.forEach((line, i) => {
    doc.text(line, instituicao.logoUrl ? margin + 30 : margin, 22 + i * 5);
  });
  yPos = instituicao.logoUrl ? 40 : Math.max(40, 22 + contactLines.length * 5 + 8);

  const boxWidth = 50;
  const boxX = pageWidth - margin - boxWidth;
  doc.setDrawColor(200, 200, 200);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(boxX, 8, boxWidth, 28, 2, 2, 'FD');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text(`Nº ${numeroDocumento}`, boxX + boxWidth / 2, 20, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(dataDocumento, boxX + boxWidth / 2, 28, { align: 'center' });

  doc.setDrawColor(220, 220, 220);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  return yPos + 12;
};

/** Rodapé profissional padrão */
const drawProfessionalFooter = (
  doc: jsPDF,
  instituicaoNome: string,
  codigoVerificacao: string,
  margin = 20
) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = doc.internal.pageSize.getHeight() - 25;

  doc.setDrawColor(220, 220, 220);
  doc.line(margin, yPos - 5, pageWidth - margin, yPos - 5);
  yPos += 5;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Documento gerado por sistema', margin, yPos);
  doc.text('Válido apenas com assinatura', pageWidth - margin, yPos, { align: 'right' });
  yPos += 6;
  doc.text(`Código de Verificação: ${codigoVerificacao}`, pageWidth / 2, yPos, { align: 'center' });
};

// A4 Format Receipt - Layout similar to receipt reference (Recebemos de, tabela, valor por extenso)
export const gerarReciboA4PDF = async (
  data: ReciboData,
  tipoDocumento: TipoDocumentoFiscal = 'RECIBO'
): Promise<Blob> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPos = 18;

  // Header: logo area (left) + N° box (right)
  if (data.instituicao.logoUrl) {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = data.instituicao.logoUrl;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
      });
      doc.addImage(img, 'PNG', margin, 8, 24, 24);
    } catch {
      // Skip logo on error
    }
  }

  // Institution name and contact (left/center)
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text(data.instituicao.nome, data.instituicao.logoUrl ? margin + 30 : margin, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  const contactLines: string[] = [];
  if (data.instituicao.endereco) contactLines.push(data.instituicao.endereco);
  if (data.instituicao.telefone) contactLines.push(`Telefone: ${data.instituicao.telefone}`);
  if (data.instituicao.email) contactLines.push(`Email: ${data.instituicao.email}`);
  contactLines.forEach((line, i) => {
    doc.text(line, data.instituicao.logoUrl ? margin + 30 : margin, 22 + i * 5);
  });
  yPos = data.instituicao.logoUrl ? 40 : 22 + contactLines.length * 5 + 8;

  // N° and date box (top right)
  const boxWidth = 50;
  const boxX = pageWidth - margin - boxWidth;
  doc.setDrawColor(200, 200, 200);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(boxX, 8, boxWidth, 28, 2, 2, 'FD');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text(`Nº ${data.pagamento.reciboNumero}`, boxX + boxWidth / 2, 20, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(formatDate(data.pagamento.dataPagamento), boxX + boxWidth / 2, 28, { align: 'center' });

  // Divider
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 18;

  // "Recebemos de" section
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text('Recebemos de', margin, yPos);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(formatDate(data.pagamento.dataPagamento), pageWidth - margin, yPos, { align: 'right' });
  yPos += 12;

  // Student info (ALUNO, BILHETE, TURMA, ANO)
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(`ALUNO: ${data.aluno.nome}`, margin, yPos);
  yPos += 7;
  const bilhete = data.aluno.bi || data.aluno.numeroId;
  if (bilhete) {
    doc.text(`BILHETE: ${bilhete}`, margin, yPos);
    yPos += 7;
  }
  const turma = data.aluno.turma || data.aluno.curso;
  if (turma) {
    doc.text(`TURMA: ${turma}`, margin, yPos);
    yPos += 7;
  }
  const ano = data.aluno.anoFrequencia || data.aluno.classeFrequencia || data.aluno.anoLetivo;
  if (ano) {
    doc.text(`ANO: ${ano}`, margin, yPos);
    yPos += 7;
  }
  if (data.aluno.anoLetivo && !data.aluno.anoFrequencia && !data.aluno.classeFrequencia) {
    doc.text(`ANO LETIVO: ${data.aluno.anoLetivo}`, margin, yPos);
    yPos += 7;
  }
  yPos += 8;

  // Payment table (Descrição | Referência | Valor | Valor (AO))
  const tableCols = [90, 55, 25, 55];
  const tableX = margin;
  const tableWidth = pageWidth - margin * 2;

  // Table header (light blue/grey background)
  doc.setFillColor(230, 240, 255);
  doc.rect(tableX, yPos, tableWidth, 10, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175);
  let colX = tableX + 4;
  doc.text('Descrição', colX, yPos + 7);
  colX += tableCols[0];
  doc.text('Referência', colX, yPos + 7);
  colX += tableCols[1];
  doc.text('Valor', colX, yPos + 7);
  colX += tableCols[2];
  doc.text('Valor (AO)', colX, yPos + 7);
  yPos += 10;

  const valorBase = data.pagamento.valor - (data.pagamento.valorDesconto || 0);
  const refBase = `REF-${String(data.pagamento.mesReferencia).padStart(2, '0')}${data.pagamento.anoReferencia}`;

  // Rows: Propina Mensal, Taxa Matrícula (optional), Multa, Juros
  const rows: Array<{ desc: string; ref: string; valor: number }> = [
    {
      desc: 'Propina Mensal',
      ref: refBase,
      valor: valorBase,
    },
  ];
  if (data.pagamento.valorMulta && data.pagamento.valorMulta > 0) {
    rows.push({
      desc: 'Multa por Atraso',
      ref: `${refBase}-M`,
      valor: data.pagamento.valorMulta,
    });
  }
  if (data.pagamento.valorJuros && data.pagamento.valorJuros > 0) {
    rows.push({
      desc: 'Juros por Atraso',
      ref: `${refBase}-J`,
      valor: data.pagamento.valorJuros,
    });
  }

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  rows.forEach((r) => {
    doc.setDrawColor(230, 230, 230);
    doc.line(tableX, yPos, tableX + tableWidth, yPos);
    colX = tableX + 4;
    doc.text(r.desc, colX, yPos + 6);
    colX += tableCols[0];
    doc.text(r.ref, colX, yPos + 6);
    colX += tableCols[1];
    doc.text('1', colX, yPos + 6);
    colX += tableCols[2];
    doc.text(formatValorAO(r.valor), colX, yPos + 6);
    yPos += 8;
  });

  // Total row
  const totalValue = data.pagamento.valor
    - (data.pagamento.valorDesconto || 0)
    + (data.pagamento.valorMulta || 0)
    + (data.pagamento.valorJuros || 0);
  doc.setDrawColor(200, 200, 200);
  doc.line(tableX, yPos, tableX + tableWidth, yPos);
  yPos += 2;
  doc.setFont('helvetica', 'bold');
  doc.text('Total', tableX + 4, yPos + 7);
  doc.text('Valor:', tableX + 4 + tableCols[0] + tableCols[1] + 4, yPos + 7);
  doc.setFontSize(11);
  doc.text(formatValorAO(totalValue), tableX + tableWidth - 4, yPos + 7, { align: 'right' });
  doc.setFontSize(9);
  yPos += 18;

  // Valor por extenso
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  const extenso = valorPorExtenso(totalValue);
  doc.text(extenso, margin, yPos);
  yPos += 14;

  // Footer: Verificar Autenticidade + Responsável
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 12;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('Verificar autenticidade:', margin, yPos);
  doc.setFontSize(7);
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  doc.text(`${baseUrl}/verificar/${data.pagamento.reciboNumero}`, margin, yPos + 5);
  yPos += 14;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  if (data.pagamento.operador) {
    doc.text(data.pagamento.operador, pageWidth - margin, yPos, { align: 'right' });
    yPos += 5;
  }
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text('Responsável Administrativo', pageWidth - margin, yPos, { align: 'right' });
  yPos += 14;

  doc.setDrawColor(220, 220, 220);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 10;
  doc.setFontSize(7);
  doc.text('Documento gerado por sistema', margin, yPos);
  doc.text('Válido apenas com assinatura', pageWidth - margin, yPos, { align: 'right' });

  return doc.output('blob');
};

// Thermal Printer Format Receipt PDF (80mm width) - Similar layout to A4
export const gerarReciboTermicoPDF = async (data: ReciboData): Promise<Blob> => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, 200],
  });

  const pageWidth = 80;
  const margin = 4;
  let yPos = 6;

  // Header
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(data.instituicao.nome.substring(0, 32), pageWidth / 2, yPos, { align: 'center' });
  yPos += 5;

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nº ${data.pagamento.reciboNumero}`, pageWidth / 2, yPos, { align: 'center' });
  doc.text(formatDate(data.pagamento.dataPagamento), pageWidth / 2, yPos + 4, { align: 'center' });
  yPos += 10;

  doc.setDrawColor(0, 0, 0);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 6;

  // Recebemos de
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Recebemos de', margin, yPos);
  yPos += 5;

  // ALUNO, BILHETE, TURMA, ANO
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  const nome = data.aluno.nome.length > 30 ? data.aluno.nome.substring(0, 30) + '...' : data.aluno.nome;
  doc.text(`ALUNO: ${nome}`, margin, yPos);
  yPos += 4;
  const bilhete = data.aluno.bi || data.aluno.numeroId;
  if (bilhete) {
    doc.text(`BILHETE: ${String(bilhete).substring(0, 20)}`, margin, yPos);
    yPos += 4;
  }
  const turma = (data.aluno.turma || data.aluno.curso || '').substring(0, 28);
  if (turma) {
    doc.text(`TURMA: ${turma}`, margin, yPos);
    yPos += 4;
  }
  const ano = data.aluno.anoFrequencia || data.aluno.classeFrequencia || data.aluno.anoLetivo;
  if (ano) {
    doc.text(`ANO: ${ano}`, margin, yPos);
    yPos += 4;
  }
  yPos += 4;

  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 5;

  // Table (compact)
  const valorBase = data.pagamento.valor - (data.pagamento.valorDesconto || 0);
  const refBase = `REF-${String(data.pagamento.mesReferencia).padStart(2, '0')}${data.pagamento.anoReferencia}`;

  doc.setFontSize(6);
  doc.text('Descrição', margin, yPos);
  doc.text('Valor(AO)', pageWidth - margin, yPos, { align: 'right' });
  yPos += 4;

  doc.text(`Propina Mensal`, margin, yPos);
  doc.text(formatValorAO(valorBase), pageWidth - margin, yPos, { align: 'right' });
  yPos += 4;

  if (data.pagamento.valorMulta && data.pagamento.valorMulta > 0) {
    doc.text('Multa por Atraso', margin, yPos);
    doc.text(formatValorAO(data.pagamento.valorMulta), pageWidth - margin, yPos, { align: 'right' });
    yPos += 4;
  }
  if (data.pagamento.valorJuros && data.pagamento.valorJuros > 0) {
    doc.text('Juros', margin, yPos);
    doc.text(formatValorAO(data.pagamento.valorJuros), pageWidth - margin, yPos, { align: 'right' });
    yPos += 4;
  }

  yPos += 2;
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 5;

  const totalValue = valorBase
    + (data.pagamento.valorMulta || 0)
    + (data.pagamento.valorJuros || 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Total', margin, yPos);
  doc.text(formatValorAO(totalValue), pageWidth - margin, yPos, { align: 'right' });
  yPos += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  const extenso = valorPorExtenso(totalValue);
  const extLines = extenso.length > 42 ? [extenso.substring(0, 42), extenso.substring(42)] : [extenso];
  extLines.forEach((l) => {
    doc.text(l, pageWidth / 2, yPos, { align: 'center' });
    yPos += 4;
  });
  yPos += 4;

  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 5;
  doc.setFontSize(5);
  doc.text('Documento gerado por sistema. Válido com assinatura.', pageWidth / 2, yPos, { align: 'center' });

  return doc.output('blob');
};

// Legacy function - generates and downloads A4 receipt
export const gerarReciboPDF = async (data: ReciboData): Promise<void> => {
  const blob = await gerarReciboA4PDF(data);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `recibo-a4-${data.pagamento.reciboNumero}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
};

// Download A4 Receipt
export const downloadReciboA4 = async (data: ReciboData): Promise<void> => {
  const blob = await gerarReciboA4PDF(data, 'RECIBO');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `recibo-a4-${data.pagamento.reciboNumero}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
};

// Download A4 Invoice (Fatura)
export const downloadFaturaA4 = async (data: ReciboData): Promise<void> => {
  const blob = await gerarReciboA4PDF(data, 'FATURA');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `fatura-${data.pagamento.reciboNumero}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
};

// Download Thermal Receipt
export const downloadReciboTermico = async (data: ReciboData): Promise<void> => {
  const blob = await gerarReciboTermicoPDF(data);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `recibo-termico-${data.pagamento.reciboNumero}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
};

// Download both formats
export const downloadAmbosRecibos = async (data: ReciboData): Promise<void> => {
  await downloadReciboA4(data);
  setTimeout(async () => {
    await downloadReciboTermico(data);
  }, 500);
};

// ============================================
// RECIBO DE PAGAMENTO (FOLHA) - RH
// ============================================

export interface ReciboFolhaPagamentoData {
  instituicao: { nome: string; logoUrl?: string | null; endereco?: string | null; telefone?: string | null; email?: string | null };
  funcionario: { nome: string; cargo?: string; email?: string };
  folha: {
    mes: number;
    ano: number;
    salario_base: number;
    bonus: number;
    valor_horas_extras: number;
    beneficio_transporte: number;
    beneficio_alimentacao: number;
    outros_beneficios: number;
    descontos_faltas: number;
    inss: number;
    irt: number;
    outros_descontos: number;
    salario_liquido: number;
  };
  reciboNumero: string;
}

export const gerarReciboFolhaPagamentoPDF = async (data: ReciboFolhaPagamentoData): Promise<Blob> => {
  const doc = new jsPDF();
  await drawReciboFolhaPage(doc, data);
  return doc.output('blob');
};

/** Gera múltiplos recibos de folha em um único PDF */
export const gerarMultiplosRecibosFolhaPDF = async (dataArray: ReciboFolhaPagamentoData[]): Promise<Blob> => {
  if (dataArray.length === 0) throw new Error('Nenhum recibo para gerar');
  const doc = new jsPDF();
  for (let i = 0; i < dataArray.length; i++) {
    if (i > 0) doc.addPage();
    await drawReciboFolhaPage(doc, dataArray[i]);
  }
  return doc.output('blob');
};

async function drawReciboFolhaPage(doc: jsPDF, data: ReciboFolhaPagamentoData): Promise<void> {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;

  let yPos = await drawProfessionalHeader({
    doc,
    instituicao: data.instituicao,
    tituloDocumento: 'RECIBO DE PAGAMENTO',
    numeroDocumento: data.reciboNumero,
    dataDocumento: `${getMesNome(data.folha.mes)} / ${data.folha.ano}`,
    margin,
  });

  yPos += 6;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text('Pagamento efetuado a', margin, yPos);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`${getMesNome(data.folha.mes)}/${data.folha.ano}`, pageWidth - margin, yPos, { align: 'right' });
  yPos += 14;

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(`FUNCIONÁRIO: ${data.funcionario.nome}`, margin, yPos);
  yPos += 7;
  if (data.funcionario.cargo) {
    doc.text(`CARGO: ${data.funcionario.cargo}`, margin, yPos);
    yPos += 7;
  }
  if (data.funcionario.email) {
    doc.text(`EMAIL: ${data.funcionario.email}`, margin, yPos);
    yPos += 7;
  }
  yPos += 8;

  // Tabela Descrição | Referência | Valor | Valor (AO)
  const tableCols = [100, 45, 20, 50];
  const tableX = margin;
  const tableWidth = pageWidth - margin * 2;

  doc.setFillColor(230, 240, 255);
  doc.rect(tableX, yPos, tableWidth, 10, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175);
  let colX = tableX + 4;
  doc.text('Descrição', colX, yPos + 7);
  colX += tableCols[0];
  doc.text('Ref.', colX, yPos + 7);
  colX += tableCols[1];
  doc.text('Qtd', colX, yPos + 7);
  colX += tableCols[2];
  doc.text('Valor (AO)', colX, yPos + 7);
  yPos += 10;

  const f = data.folha;
  const addRow = (desc: string, valor: number) => {
    doc.setDrawColor(230, 230, 230);
    doc.line(tableX, yPos, tableX + tableWidth, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(desc, tableX + 4, yPos + 6);
    doc.text('-', tableX + 4 + tableCols[0], yPos + 6);
    doc.text('1', tableX + 4 + tableCols[0] + tableCols[1], yPos + 6);
    doc.text(formatValorAO(valor), tableX + tableWidth - 4, yPos + 6, { align: 'right' });
    yPos += 8;
  };

  if (f.salario_base > 0) addRow('Salário Base', f.salario_base);
  if (f.bonus > 0) addRow('Bônus', f.bonus);
  if (f.valor_horas_extras > 0) addRow('Horas Extras', f.valor_horas_extras);
  if (f.beneficio_transporte > 0) addRow('Benefício Transporte', f.beneficio_transporte);
  if (f.beneficio_alimentacao > 0) addRow('Benefício Alimentação', f.beneficio_alimentacao);
  if (f.outros_beneficios > 0) addRow('Outros Benefícios', f.outros_beneficios);
  if (f.descontos_faltas > 0) addRow('Desconto por Faltas', -f.descontos_faltas);
  if (f.inss > 0) addRow('INSS', -f.inss);
  if (f.irt > 0) addRow('IRT', -f.irt);
  if (f.outros_descontos > 0) addRow('Outros Descontos', -f.outros_descontos);

  doc.setDrawColor(200, 200, 200);
  doc.line(tableX, yPos, tableX + tableWidth, yPos);
  yPos += 2;
  doc.setFont('helvetica', 'bold');
  doc.text('Líquido a receber', tableX + 4, yPos + 7);
  doc.setFontSize(11);
  doc.text(formatValorAO(f.salario_liquido), tableX + tableWidth - 4, yPos + 7, { align: 'right' });
  doc.setFontSize(9);
  yPos += 18;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  doc.text(valorPorExtenso(f.salario_liquido), margin, yPos);
  yPos += 15;

  drawProfessionalFooter(doc, data.instituicao.nome, data.reciboNumero, margin);
}

interface RelatorioData {
  instituicao: {
    nome: string;
  };
  titulo: string;
  periodo: string;
  dados: Array<{
    label: string;
    valor: string | number;
  }>;
  tabela?: {
    headers: string[];
    rows: Array<(string | number)[]>;
  };
}

export const gerarRelatorioPDF = async (data: RelatorioData): Promise<void> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;

  const inst = data.instituicao as { nome: string; logoUrl?: string | null; endereco?: string | null; telefone?: string | null; email?: string | null };
  let yPos = await drawProfessionalHeader({
    doc,
    instituicao: { nome: inst.nome, logoUrl: inst.logoUrl, endereco: inst.endereco, telefone: inst.telefone, email: inst.email },
    tituloDocumento: data.titulo,
    numeroDocumento: `REL-${Date.now()}`,
    dataDocumento: new Date().toLocaleDateString('pt-AO', { day: '2-digit', month: 'long', year: 'numeric' }),
    margin,
  });

  yPos += 8;

  // Period
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(10);
  doc.text(`Período: ${data.periodo}`, margin, yPos);
  yPos += 15;

  // Summary data
  doc.setTextColor(0, 0, 0);
  data.dados.forEach((item) => {
    doc.setFont('helvetica', 'normal');
    doc.text(`${item.label}:`, margin, yPos);
    doc.setFont('helvetica', 'bold');
    doc.text(String(item.valor), margin + 60, yPos);
    yPos += 8;
  });

  yPos += 10;

  // Table if provided
  if (data.tabela) {
    const colWidth = (pageWidth - margin * 2) / data.tabela.headers.length;
    
    // Header row
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPos, pageWidth - margin * 2, 10, 'F');
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    data.tabela.headers.forEach((header, i) => {
      doc.text(header, margin + (i * colWidth) + 2, yPos + 7);
    });
    yPos += 12;

    // Data rows
    doc.setFont('helvetica', 'normal');
    data.tabela.rows.forEach((row) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      row.forEach((cell, i) => {
        doc.text(String(cell), margin + (i * colWidth) + 2, yPos);
      });
      yPos += 7;
    });
  }

  drawProfessionalFooter(doc, data.instituicao.nome, `REL-${Date.now()}`, margin);

  doc.save(`relatorio-${data.titulo.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.pdf`);
};

// Extrato Financeiro do Aluno (Área Financeira)
export interface ExtratoFinanceiroData {
  instituicao: {
    nome: string;
    nif?: string | null;
    logoUrl?: string | null;
    endereco?: string | null;
  };
  aluno: {
    nome: string;
    numeroId?: string | null;
    curso?: string | null;
    turma?: string | null;
  };
  mensalidades: Array<{
    mesReferencia: number;
    anoReferencia: number;
    valor: number;
    status: string;
    dataVencimento: string;
    dataPagamento?: string | null;
    valorPago?: number;
    reciboNumero?: string | null;
  }>;
}

export const downloadExtratoFinanceiro = async (data: ExtratoFinanceiroData): Promise<void> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;

  const inst = data.instituicao as { nome: string; logoUrl?: string | null; endereco?: string | null; telefone?: string | null };
  let yPos = await drawProfessionalHeader({
    doc,
    instituicao: { nome: inst.nome, logoUrl: inst.logoUrl, endereco: inst.endereco, telefone: inst.telefone },
    tituloDocumento: 'EXTRATO FINANCEIRO DO ALUNO',
    numeroDocumento: data.aluno.numeroId ? `EXT-${data.aluno.numeroId}` : `EXT-${Date.now()}`,
    dataDocumento: new Date().toLocaleDateString('pt-AO', { day: '2-digit', month: 'long', year: 'numeric' }),
    margin,
  });

  yPos += 4;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Aluno:', margin, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(data.aluno.nome, margin + 25, yPos);
  yPos += 8;
  if (data.aluno.numeroId) {
    doc.text(`Nº ID: ${data.aluno.numeroId}`, margin, yPos);
    yPos += 8;
  }
  if (data.aluno.curso) {
    doc.text(`Curso: ${data.aluno.curso}`, margin, yPos);
    yPos += 8;
  }
  if (data.aluno.turma) {
    doc.text(`Turma: ${data.aluno.turma}`, margin, yPos);
    yPos += 8;
  }
  doc.text(`Emitido em: ${new Date().toLocaleDateString('pt-AO')}`, margin, yPos);
  yPos += 15;

  // Table
  const headers = ['Mês/Ano', 'Vencimento', 'Valor', 'Status', 'Pagamento', 'Nº Recibo'];
  const colWidths = [28, 35, 28, 28, 35, 35];
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPos, pageWidth - margin * 2, 10, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  let x = margin + 2;
  headers.forEach((h, i) => {
    doc.text(h, x, yPos + 7);
    x += colWidths[i];
  });
  yPos += 12;

  doc.setFont('helvetica', 'normal');
  data.mensalidades.forEach((m) => {
    if (yPos > 270) {
      doc.addPage();
      yPos = 20;
    }
    const mesAno = `${getMesNome(m.mesReferencia)}/${m.anoReferencia}`;
    const venc = formatDate(m.dataVencimento);
    const valor = formatCurrency(m.valor);
    const status = m.status || '-';
    const pagto = m.dataPagamento ? formatDate(m.dataPagamento) : '-';
    const recibo = m.reciboNumero || '-';
    x = margin + 2;
    [mesAno, venc, valor, status, pagto, recibo].forEach((cell, i) => {
      doc.text(String(cell).substring(0, 18), x, yPos);
      x += colWidths[i];
    });
    yPos += 7;
  });

  yPos += 10;
  const totalPago = data.mensalidades
    .filter((m) => m.status === 'Pago')
    .reduce((s, m) => s + (m.valorPago ?? m.valor), 0);
  const totalPendente = data.mensalidades
    .filter((m) => m.status !== 'Pago')
    .reduce((s, m) => s + m.valor, 0);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total pago: ${formatCurrency(totalPago)}`, margin, yPos);
  yPos += 8;
  doc.text(`Total pendente: ${formatCurrency(totalPendente)}`, margin, yPos);

  drawProfessionalFooter(doc, data.instituicao.nome, `EXT-${data.aluno.numeroId || Date.now()}`, margin);

  const url = URL.createObjectURL(doc.output('blob'));
  const link = document.createElement('a');
  link.href = url;
  link.download = `extrato-financeiro-${data.aluno.numeroId || 'aluno'}-${Date.now()}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
};

// Mapa de Propinas em Atraso (Área Financeira - ADMIN/FINANCEIRO)
export interface MapaAtrasosData {
  instituicao: { nome: string; nif?: string | null };
  mensalidades: Array<{
    alunoNome: string;
    numeroId?: string | null;
    mesReferencia: number;
    anoReferencia: number;
    valor: number;
    valorMulta?: number;
    dataVencimento: string;
    diasAtraso?: number;
  }>;
}

export const downloadMapaAtrasos = async (data: MapaAtrasosData): Promise<void> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;

  const inst = data.instituicao as { nome: string; logoUrl?: string | null; endereco?: string | null };
  let yPos = await drawProfessionalHeader({
    doc,
    instituicao: { nome: inst.nome, logoUrl: inst.logoUrl, endereco: inst.endereco },
    tituloDocumento: 'MAPA DE PROPINAS EM ATRASO',
    numeroDocumento: `MAPA-${Date.now()}`,
    dataDocumento: new Date().toLocaleDateString('pt-AO', { day: '2-digit', month: 'long', year: 'numeric' }),
    margin,
  });

  yPos += 8;
  const headers = ['Aluno', 'Nº ID', 'Mês/Ano', 'Vencimento', 'Valor', 'Multa', 'Dias Atraso'];
  const colWidths = [45, 22, 20, 28, 28, 25, 25];
  doc.setTextColor(0, 0, 0);
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPos, pageWidth - margin * 2, 10, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  let x = margin + 2;
  headers.forEach((h, i) => {
    doc.text(h, x, yPos + 7);
    x += colWidths[i];
  });
  yPos += 12;

  doc.setFont('helvetica', 'normal');
  data.mensalidades.forEach((m) => {
    if (yPos > 270) {
      doc.addPage();
      yPos = 20;
    }
    const vals = [
      (m.alunoNome || '').substring(0, 22),
      (m.numeroId || '-').substring(0, 10),
      `${getMesNome(m.mesReferencia).substring(0, 3)}/${m.anoReferencia}`,
      formatDate(m.dataVencimento),
      formatCurrency(m.valor),
      formatCurrency(m.valorMulta || 0),
      String(m.diasAtraso ?? '-'),
    ];
    x = margin + 2;
    vals.forEach((cell, i) => {
      doc.text(String(cell), x, yPos);
      x += colWidths[i];
    });
    yPos += 7;
  });

  yPos += 10;
  const totalValor = data.mensalidades.reduce((s, m) => s + m.valor, 0);
  const totalMulta = data.mensalidades.reduce((s, m) => s + (m.valorMulta || 0), 0);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total em atraso: ${formatCurrency(totalValor + totalMulta)} (${data.mensalidades.length} mensalidade(s))`, margin, yPos);

  yPos += 15;
  drawProfessionalFooter(doc, data.instituicao.nome, `MAPA-${Date.now()}`, margin);

  const url = URL.createObjectURL(doc.output('blob'));
  const link = document.createElement('a');
  link.href = url;
  link.download = `mapa-propinas-atraso-${Date.now()}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
};

// Relatório de Receitas (mensal ou anual)
export interface RelatorioReceitasData {
  instituicao: { nome: string; nif?: string | null };
  periodo: 'MENSAL' | 'ANUAL';
  mesAno?: string; // ex: "Janeiro/2025"
  ano?: number; // para relatório anual
  resumo: {
    totalEsperado: number;
    totalRecebido: number;
    totalPendente: number;
    totalAtrasado: number;
    quantidadePagos: number;
    quantidadePendentes: number;
    quantidadeAtrasados: number;
  };
  detalhesPorMes?: Array<{
    mesAno: string;
    esperado: number;
    recebido: number;
    pendente: number;
    atrasado: number;
  }>;
}

export const downloadRelatorioReceitas = async (data: RelatorioReceitasData): Promise<void> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;

  const titulo = data.periodo === 'MENSAL'
    ? `RELATÓRIO MENSAL DE RECEITAS - ${data.mesAno || ''}`
    : `RELATÓRIO ANUAL DE RECEITAS - ${data.ano || new Date().getFullYear()}`;
  const inst = data.instituicao as { nome: string; logoUrl?: string | null; endereco?: string | null };
  let yPos = await drawProfessionalHeader({
    doc,
    instituicao: { nome: inst.nome, logoUrl: inst.logoUrl, endereco: inst.endereco },
    tituloDocumento: titulo,
    numeroDocumento: `REC-${Date.now()}`,
    dataDocumento: new Date().toLocaleDateString('pt-AO', { day: '2-digit', month: 'long', year: 'numeric' }),
    margin,
  });

  yPos += 4;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumo', margin, yPos);
  yPos += 10;

  const r = data.resumo;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Total esperado: ${formatCurrency(r.totalEsperado)}`, margin, yPos);
  yPos += 8;
  doc.text(`Total recebido: ${formatCurrency(r.totalRecebido)}`, margin, yPos);
  yPos += 8;
  doc.text(`Total pendente: ${formatCurrency(r.totalPendente)}`, margin, yPos);
  yPos += 8;
  doc.text(`Total em atraso: ${formatCurrency(r.totalAtrasado)}`, margin, yPos);
  yPos += 8;
  doc.text(`Quantidade de pagamentos: ${r.quantidadePagos} pagos, ${r.quantidadePendentes} pendentes, ${r.quantidadeAtrasados} em atraso`, margin, yPos);
  yPos += 15;

  if (data.detalhesPorMes && data.detalhesPorMes.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text('Detalhe por período', margin, yPos);
    yPos += 10;
    const headers = ['Período', 'Esperado', 'Recebido', 'Pendente', 'Atrasado'];
    const cw = [40, 35, 35, 35, 35];
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPos, pageWidth - margin * 2, 8, 'F');
    doc.setFontSize(8);
    let x = margin + 2;
    headers.forEach((h, i) => {
      doc.text(h, x, yPos + 6);
      x += cw[i];
    });
    yPos += 10;
    doc.setFont('helvetica', 'normal');
    data.detalhesPorMes.forEach((d) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      x = margin + 2;
      [d.mesAno, formatCurrency(d.esperado), formatCurrency(d.recebido), formatCurrency(d.pendente), formatCurrency(d.atrasado)].forEach((cell, i) => {
        doc.text(String(cell), x, yPos);
        x += cw[i];
      });
      yPos += 7;
    });
  }

  drawProfessionalFooter(doc, data.instituicao.nome, `REC-${Date.now()}`, margin);

  const url = URL.createObjectURL(doc.output('blob'));
  const link = document.createElement('a');
  link.href = url;
  link.download = `relatorio-receitas-${data.periodo.toLowerCase()}-${Date.now()}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
};

// Gera código para ficha cadastral e declarações
const gerarCodigoDocumento = (prefixo: string): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const r = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefixo}${y}${m}${d}-${r}`;
};

// Ficha cadastral do aluno
export interface FichaCadastralAlunoData {
  instituicao: {
    nome: string;
    nif?: string | null;
    endereco?: string | null;
    logoUrl?: string | null;
    telefone?: string | null;
    email?: string | null;
  };
  aluno: {
    nome: string;
    numeroId?: string | null;
    numeroIdentificacao?: string | null;
    dataNascimento?: string | null;
    genero?: string | null;
    email?: string | null;
    telefone?: string | null;
    morada?: string | null;
    cidade?: string | null;
    pais?: string | null;
    codigoPostal?: string | null;
    nomePai?: string | null;
    nomeMae?: string | null;
    tipoSanguineo?: string | null;
    curso?: string | null;
    turma?: string | null;
    statusAluno?: string | null;
  };
}

export const downloadFichaCadastralAluno = async (data: FichaCadastralAlunoData): Promise<void> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const codigoDoc = gerarCodigoDocumento('FICHA-');
  const dataDoc = new Date().toLocaleDateString('pt-AO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  let yPos = await drawProfessionalHeader({
    doc,
    instituicao: {
      nome: data.instituicao.nome,
      logoUrl: data.instituicao.logoUrl ?? null,
      endereco: data.instituicao.endereco ?? null,
      telefone: data.instituicao.telefone ?? null,
      email: data.instituicao.email ?? null,
    },
    tituloDocumento: 'FICHA CADASTRAL DO ALUNO',
    numeroDocumento: codigoDoc,
    dataDocumento: dataDoc,
    margin,
  });

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Dados Pessoais', margin, yPos);
  yPos += 10;

  const addLine = (label: string, value: string | null | undefined) => {
    if (value) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`${label}: ${value}`, margin, yPos);
      yPos += 7;
    }
  };

  addLine('Nome completo', data.aluno.nome);
  addLine('Nº identificação pública', data.aluno.numeroId ?? data.aluno.numeroIdentificacao);
  addLine('BI/Identificação', data.aluno.numeroIdentificacao);
  addLine('Data de nascimento', data.aluno.dataNascimento ? formatDate(data.aluno.dataNascimento) : undefined);
  addLine('Género', data.aluno.genero);
  addLine('Tipo sanguíneo', data.aluno.tipoSanguineo);
  addLine('Email', data.aluno.email);
  addLine('Telefone', data.aluno.telefone);
  addLine('Morada', data.aluno.morada);
  addLine('Cidade', data.aluno.cidade);
  addLine('País', data.aluno.pais);
  addLine('Código postal', data.aluno.codigoPostal);
  addLine('Nome do pai', data.aluno.nomePai);
  addLine('Nome da mãe', data.aluno.nomeMae);
  yPos += 5;

  doc.setFont('helvetica', 'bold');
  doc.text('Dados Académicos', margin, yPos);
  yPos += 10;
  addLine('Curso', data.aluno.curso);
  addLine('Turma', data.aluno.turma);
  addLine('Status', data.aluno.statusAluno);

  drawProfessionalFooter(doc, data.instituicao.nome, codigoDoc, margin);

  const url = URL.createObjectURL(doc.output('blob'));
  const link = document.createElement('a');
  link.href = url;
  link.download = `ficha-cadastral-${data.aluno.numeroId || data.aluno.nome || 'aluno'}-${codigoDoc}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
};

// Declaração personalizada (texto livre + cabeçalho da instituição)
export interface DeclaracaoPersonalizadaData {
  instituicao: {
    nome: string;
    nif?: string | null;
    endereco?: string | null;
    logoUrl?: string | null;
    telefone?: string | null;
    email?: string | null;
  };
  alunoNome?: string | null;
  titulo?: string; // ex: "Declaração de cursar"
  texto: string; // conteúdo livre
}

export const downloadDeclaracaoPersonalizada = async (data: DeclaracaoPersonalizadaData): Promise<void> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const codigoDoc = gerarCodigoDocumento('DECL-');
  const dataDoc = new Date().toLocaleDateString('pt-AO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  let yPos = await drawProfessionalHeader({
    doc,
    instituicao: {
      nome: data.instituicao.nome,
      logoUrl: data.instituicao.logoUrl ?? null,
      endereco: data.instituicao.endereco ?? null,
      telefone: data.instituicao.telefone ?? null,
      email: data.instituicao.email ?? null,
    },
    tituloDocumento: data.titulo || 'DECLARAÇÃO',
    numeroDocumento: codigoDoc,
    dataDocumento: dataDoc,
    margin,
  });

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  const maxWidth = pageWidth - margin * 2;
  const lines = doc.splitTextToSize(data.texto, maxWidth);
  lines.forEach((line: string) => {
    if (yPos > 265) {
      doc.addPage();
      yPos = 25;
    }
    doc.text(line, margin, yPos);
    yPos += 6;
  });

  if (data.alunoNome) {
    yPos += 15;
    doc.setFont('helvetica', 'bold');
    doc.text(`Declarante: ${data.alunoNome}`, margin, yPos);
    yPos += 8;
  }

  drawProfessionalFooter(doc, data.instituicao.nome, codigoDoc, margin);

  const url = URL.createObjectURL(doc.output('blob'));
  const link = document.createElement('a');
  link.href = url;
  link.download = `declaracao-${codigoDoc}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
};

// Matrícula Receipt Data Interface (SIGAE: comprovante, não recibo - matrícula gera débito)
export interface MatriculaReciboData {
  instituicao: {
    nome: string;
    nif?: string | null;
    logoUrl?: string | null;
    email?: string | null;
    telefone?: string | null;
    endereco?: string | null;
  };
  aluno: {
    nome: string;
    numeroId?: string | null; // Número de identificação pública (ex: ALU0007)
    bi?: string | null; // Bilhete de Identidade
    email?: string | null;
  };
  matricula: {
    curso: string;
    turma: string;
    disciplina: string; // Pode ser uma disciplina ou lista separada por vírgula
    disciplinas?: string[]; // Lista de disciplinas (para múltiplas)
    ano: number;
    semestre: string;
    dataMatricula: string;
    reciboNumero: string;
    /** Ensino Superior: ano de matrícula (ex: "1º Ano", "2º Ano") */
    anoFrequencia?: string | null;
    /** Ensino Secundário: classe de matrícula (ex: "10ª Classe") */
    classeFrequencia?: string | null;
    tipoAcademico?: 'SUPERIOR' | 'SECUNDARIO' | null;
  };
  /** Nome do operador que efetuou a matrícula */
  operador?: string | null;
}

// Generate matrícula receipt code
export const gerarCodigoMatricula = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `MAT${year}${month}${day}-${random}`;
};

// Helper para garantir valores seguros no PDF de matrícula
const safeMatriculaData = (data: MatriculaReciboData) => ({
  instituicao: { nome: data?.instituicao?.nome ?? 'Instituição' },
  aluno: { nome: data?.aluno?.nome ?? 'N/A', numeroId: data?.aluno?.numeroId ?? null },
  matricula: {
    curso: data?.matricula?.curso ?? 'N/A',
    turma: data?.matricula?.turma ?? 'N/A',
    disciplina: data?.matricula?.disciplina ?? '',
    disciplinas: data?.matricula?.disciplinas ?? [],
    ano: data?.matricula?.ano ?? new Date().getFullYear(),
    semestre: data?.matricula?.semestre ?? '',
    dataMatricula: data?.matricula?.dataMatricula ?? new Date().toISOString(),
    reciboNumero: data?.matricula?.reciboNumero ?? gerarCodigoMatricula(),
    anoFrequencia: data?.matricula?.anoFrequencia ?? null,
    classeFrequencia: data?.matricula?.classeFrequencia ?? null,
    tipoAcademico: data?.matricula?.tipoAcademico ?? 'SUPERIOR',
  },
  operador: data?.operador ?? null,
});

// Formato de data/hora compatível com todos os browsers
const formatDateTime = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

// A4 Format Matrícula Receipt PDF - Layout profissional
export const gerarMatriculaReciboA4PDF = async (data: MatriculaReciboData): Promise<Blob> => {
  if (!data) throw new Error('Dados da matrícula não fornecidos');
  const safe = safeMatriculaData(data);
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;

  let yPos = await drawProfessionalHeader({
    doc,
    instituicao: {
      nome: safe.instituicao.nome,
      logoUrl: data.instituicao?.logoUrl,
      endereco: data.instituicao?.endereco,
      telefone: data.instituicao?.telefone,
      email: data.instituicao?.email,
    },
    tituloDocumento: 'COMPROVANTE DE MATRÍCULA',
    numeroDocumento: safe.matricula.reciboNumero,
    dataDocumento: formatDate(safe.matricula.dataMatricula),
    margin,
  });

  yPos += 6;

  // "Registamos a matrícula de" (similar a Recebemos de)
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text('Registamos a matrícula de', margin, yPos);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(formatDate(safe.matricula.dataMatricula), pageWidth - margin, yPos, { align: 'right' });
  yPos += 14;

  // ALUNO, BILHETE, TURMA, ANO
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(`ALUNO: ${safe.aluno.nome}`, margin, yPos);
  yPos += 7;
  if (safe.aluno.numeroId) {
    doc.text(`BILHETE: ${safe.aluno.numeroId}`, margin, yPos);
    yPos += 7;
  }
  doc.text(`TURMA: ${safe.matricula.turma}`, margin, yPos);
  yPos += 7;
  doc.text(`CURSO: ${safe.matricula.curso}`, margin, yPos);
  yPos += 7;
  const ano = safe.matricula.anoFrequencia || safe.matricula.classeFrequencia || safe.matricula.ano;
  doc.text(`ANO: ${ano}`, margin, yPos);
  yPos += 7;
  if (safe.matricula.semestre) {
    doc.text(`SEMESTRE: ${safe.matricula.semestre}`, margin, yPos);
    yPos += 7;
  }
  doc.text(`ANO LETIVO: ${safe.matricula.ano}`, margin, yPos);
  yPos += 12;

  // Tabela de disciplinas
  const disciplinas = (safe.matricula.disciplinas?.length ?? 0) > 0
    ? safe.matricula.disciplinas
    : (safe.matricula.disciplina && safe.matricula.disciplina !== 'Matrícula em Turma'
        ? [safe.matricula.disciplina]
        : []);
  if (disciplinas.length > 0) {
    const tableCols = [pageWidth - margin * 2];
    doc.setFillColor(230, 240, 255);
    doc.rect(margin, yPos, pageWidth - margin * 2, 10, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 64, 175);
    doc.text('Disciplinas', margin + 6, yPos + 7);
    yPos += 12;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    disciplinas.forEach((d: string) => {
      doc.text(`• ${d || '-'}`, margin + 4, yPos + 5);
      yPos += 6;
    });
    yPos += 6;
  }
  yPos += 8;

  if (safe.operador) {
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Operador: ${safe.operador}`, margin, yPos);
    yPos += 8;
  }
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(34, 197, 94);
  doc.text('Status: CONFIRMADO', margin, yPos);
  yPos += 15;

  drawProfessionalFooter(doc, safe.instituicao.nome, safe.matricula.reciboNumero, margin);

  return doc.output('blob');
};

// Thermal Printer Format Matrícula Receipt PDF (80mm width)
export const gerarMatriculaReciboTermicoPDF = async (data: MatriculaReciboData): Promise<Blob> => {
  if (!data) throw new Error('Dados da matrícula não fornecidos');
  const safe = safeMatriculaData(data);
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, 300]
  });

  const pageWidth = 80;
  const margin = 4;
  let yPos = 8;

  // Nome da instituição no topo
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  const instNome = doc.splitTextToSize(String(safe.instituicao.nome), pageWidth - margin * 2);
  instNome.forEach((line: string) => {
    doc.text(line, pageWidth / 2, yPos, { align: 'center' });
    yPos += 5;
  });
  yPos += 2;

  // Linha separadora
  doc.setDrawColor(0, 0, 0);
  doc.setLineDashPattern([], 0);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 5;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('COMPROVANTE DE MATRÍCULA', pageWidth / 2, yPos, { align: 'center' });
  doc.text(`Nº ${safe.matricula.reciboNumero}`, pageWidth / 2, yPos + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text(formatDate(safe.matricula.dataMatricula), pageWidth / 2, yPos + 8, { align: 'center' });
  yPos += 14;

  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 5;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Registamos a matrícula de', margin, yPos);
  yPos += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(`ALUNO: ${(safe.aluno.nome || '').substring(0, 30)}`, margin, yPos);
  yPos += 4;
  if (safe.aluno.numeroId) {
    doc.text(`BILHETE: ${String(safe.aluno.numeroId).substring(0, 18)}`, margin, yPos);
    yPos += 4;
  }
  doc.text(`TURMA: ${(safe.matricula.turma || '').substring(0, 28)}`, margin, yPos);
  yPos += 4;
  doc.text(`CURSO: ${(safe.matricula.curso || '').substring(0, 28)}`, margin, yPos);
  yPos += 4;
  const ano = safe.matricula.anoFrequencia || safe.matricula.classeFrequencia || safe.matricula.ano;
  doc.text(`ANO: ${ano}`, margin, yPos);
  yPos += 6;

  const disciplinas = (safe.matricula.disciplinas?.length ?? 0) > 0
    ? safe.matricula.disciplinas
    : (safe.matricula.disciplina && safe.matricula.disciplina !== 'Matrícula em Turma'
        ? [safe.matricula.disciplina]
        : []);
  if (disciplinas.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text('DISCIPLINAS:', margin, yPos);
    yPos += 4;
    doc.setFont('helvetica', 'normal');
    disciplinas.slice(0, 5).forEach((d: string) => {
      doc.text(`• ${(d || '-').substring(0, 28)}`, margin, yPos);
      yPos += 4;
    });
    if (disciplinas.length > 5) doc.text(`... +${disciplinas.length - 5}`, margin, yPos);
    yPos += 4;
  }

  yPos += 2;
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 5;

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(34, 197, 94);
  doc.text('Status: CONFIRMADO', margin, yPos);
  doc.setTextColor(0, 0, 0);
  yPos += 8;

  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.text('Documento gerado por sistema. Válido com assinatura.', pageWidth / 2, yPos, { align: 'center' });

  return doc.output('blob');
};

// Download A4 Matrícula Receipt
export const downloadMatriculaReciboA4 = async (data: MatriculaReciboData): Promise<void> => {
  const blob = await gerarMatriculaReciboA4PDF(data);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `comprovante-matricula-a4-${data.matricula.reciboNumero}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
};

// Download Thermal Matrícula Receipt
export const downloadMatriculaReciboTermico = async (data: MatriculaReciboData): Promise<void> => {
  const blob = await gerarMatriculaReciboTermicoPDF(data);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `comprovante-matricula-termico-${data.matricula.reciboNumero}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
};

// Download both matrícula formats
export const downloadAmbosMatriculaRecibos = async (data: MatriculaReciboData): Promise<void> => {
  await downloadMatriculaReciboA4(data);
  setTimeout(async () => {
    await downloadMatriculaReciboTermico(data);
  }, 500);
};

// ============================================
// RECIBO/FATURA DE LICENÇA
// ============================================

export interface DocumentoFiscalLicencaData {
  tipo: 'RECIBO' | 'FATURA';
  numeroDocumento: string;
  instituicao: {
    nome: string;
    logoUrl?: string | null;
    email?: string | null;
    telefone?: string | null;
    endereco?: string | null;
    nif?: string | null;
  };
  plano: {
    nome: string;
  };
  valor: number;
  moeda: string;
  periodo: string;
  metodo: string;
  referencia?: string | null;
  dataEmissao: string;
  dataPagamento: string;
}

// Gerar PDF de recibo/fatura de licença - Layout profissional
export const gerarDocumentoFiscalLicencaPDF = async (
  data: DocumentoFiscalLicencaData
): Promise<Blob> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;

  let yPos = await drawProfessionalHeader({
    doc,
    instituicao: data.instituicao,
    tituloDocumento: data.tipo === 'RECIBO' ? 'RECIBO DE LICENÇA' : 'FATURA DE LICENÇA',
    numeroDocumento: data.numeroDocumento,
    dataDocumento: formatDate(data.dataPagamento),
    margin,
  });

  yPos += 6;

  // Recebemos de (instituição como cliente no caso de licença - ou "Dados do pagamento")
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text('Recebemos de', margin, yPos);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(formatDate(data.dataPagamento), pageWidth - margin, yPos, { align: 'right' });
  yPos += 14;

  // Tabela: Descrição | Referência | Valor | Valor (AO)
  const tableCols = [90, 55, 25, 55];
  const tableX = margin;
  const tableWidth = pageWidth - margin * 2;

  doc.setFillColor(230, 240, 255);
  doc.rect(tableX, yPos, tableWidth, 10, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175);
  let colX = tableX + 4;
  doc.text('Descrição', colX, yPos + 7);
  colX += tableCols[0];
  doc.text('Referência', colX, yPos + 7);
  colX += tableCols[1];
  doc.text('Valor', colX, yPos + 7);
  colX += tableCols[2];
  doc.text('Valor (AO)', colX, yPos + 7);
  yPos += 10;

  doc.setDrawColor(230, 230, 230);
  doc.line(tableX, yPos, tableX + tableWidth, yPos);
  colX = tableX + 4;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  const desc = data.tipo === 'RECIBO'
    ? `Licença ${data.plano.nome} (${data.periodo === 'MENSAL' ? 'Mensal' : 'Anual'})`
    : `Fatura - ${data.plano.nome}`;
  doc.text(desc, colX, yPos + 6);
  colX += tableCols[0];
  doc.text(data.referencia || data.numeroDocumento, colX, yPos + 6);
  colX += tableCols[1];
  doc.text('1', colX, yPos + 6);
  colX += tableCols[2];
  doc.text(formatValorAO(data.valor), colX, yPos + 6);
  yPos += 8;

  doc.setDrawColor(200, 200, 200);
  doc.line(tableX, yPos, tableX + tableWidth, yPos);
  yPos += 2;
  doc.setFont('helvetica', 'bold');
  doc.text('Total', tableX + 4, yPos + 7);
  doc.text('Valor:', tableX + 4 + tableCols[0] + tableCols[1] + 4, yPos + 7);
  doc.setFontSize(11);
  doc.text(formatValorAO(data.valor), tableX + tableWidth - 4, yPos + 7, { align: 'right' });
  doc.setFontSize(9);
  yPos += 18;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  doc.text(valorPorExtenso(data.valor), margin, yPos);
  yPos += 14;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Plano: ${data.plano.nome}`, margin, yPos);
  yPos += 6;
  doc.text(`Período: ${data.periodo === 'MENSAL' ? 'Mensal' : 'Anual'}`, margin, yPos);
  yPos += 6;
  doc.text(`Forma de Pagamento: ${formatarMetodoPagamento(data.metodo)}`, margin, yPos);
  yPos += 12;

  drawProfessionalFooter(doc, data.instituicao.nome, data.numeroDocumento, margin);

  return doc.output('blob');
};

// Download recibo/fatura de licença
export const downloadDocumentoFiscalLicenca = async (
  data: DocumentoFiscalLicencaData
): Promise<void> => {
  const blob = await gerarDocumentoFiscalLicencaPDF(data);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${data.tipo.toLowerCase()}-licenca-${data.numeroDocumento}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
};

function formatarMetodoPagamento(metodo: string): string {
  const metodos: { [key: string]: string } = {
    TRANSFERENCIA: 'Transferência Bancária',
    DEPOSITO: 'Depósito',
    MULTICAIXA: 'Multicaixa',
    AIRTM: 'Airtm',
    RODETPAY: 'RodetPay',
    CASH: 'Dinheiro',
    MOBILE_MONEY: 'Mobile Money',
    ONLINE: 'Pagamento Online',
    CAIXA: 'Caixa',
    CHEQUE: 'Cheque',
  };
  return metodos[metodo] || metodo;
}
