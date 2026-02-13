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
    month: '2-digit',
    year: 'numeric'
  });
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

// A4 Format Receipt PDF
export const gerarReciboA4PDF = async (data: ReciboData): Promise<Blob> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPos = 20;

  // Header background
  doc.setFillColor(30, 64, 175); // Primary blue
  doc.rect(0, 0, pageWidth, 55, 'F');

  // Nome da instituição
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(data.instituicao.nome, pageWidth / 2, 25, { align: 'center' });
  let headerY = 32;
  if (data.instituicao.nif) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`NIF: ${data.instituicao.nif}`, pageWidth / 2, headerY, { align: 'center' });
    headerY += 8;
  }
  doc.setFontSize(12);
  doc.text('RECIBO DE PAGAMENTO DE MENSALIDADE', pageWidth / 2, headerY, { align: 'center' });
  headerY += 10;
  doc.setFontSize(10);
  doc.text(`Nº ${data.pagamento.reciboNumero}`, pageWidth / 2, headerY, { align: 'center' });

  yPos = headerY + 20;

  // Reset text color
  doc.setTextColor(0, 0, 0);

  // Divider line
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 15;

  // Student info section
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text('DADOS DO ALUNO', margin, yPos);
  yPos += 12;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);

  doc.text(`Nome: ${data.aluno.nome}`, margin, yPos);
  yPos += 8;

  if (data.aluno.numeroId) {
    doc.text(`Nº ID: ${data.aluno.numeroId}`, margin, yPos);
    yPos += 8;
  }

  // Contexto acadêmico SIGAE: Ensino Superior vs Secundário
  const tipo = data.aluno.tipoAcademico ?? data.instituicao.tipoAcademico;
  if (tipo === 'SUPERIOR') {
    if (data.aluno.curso) {
      doc.text(`Curso: ${data.aluno.curso}`, margin, yPos);
      yPos += 8;
    }
    if (data.aluno.anoFrequencia) {
      doc.text(`Ano de Frequência: ${data.aluno.anoFrequencia}`, margin, yPos);
      yPos += 8;
    }
    if (data.aluno.turma) {
      doc.text(`Turma: ${data.aluno.turma}`, margin, yPos);
      yPos += 8;
    }
    if (data.aluno.anoLetivo != null) {
      doc.text(`Ano Letivo: ${data.aluno.anoLetivo}`, margin, yPos);
      yPos += 8;
    }
  } else {
    if (data.aluno.curso) {
      doc.text(`Curso: ${data.aluno.curso}`, margin, yPos);
      yPos += 8;
    }
    if (data.aluno.classeFrequencia) {
      doc.text(`Classe de Frequência: ${data.aluno.classeFrequencia}`, margin, yPos);
      yPos += 8;
    }
    if (data.aluno.turma) {
      doc.text(`Turma: ${data.aluno.turma}`, margin, yPos);
      yPos += 8;
    }
    if (data.aluno.anoLetivo != null) {
      doc.text(`Ano Letivo: ${data.aluno.anoLetivo}`, margin, yPos);
      yPos += 8;
    }
  }

  if (data.aluno.email) {
    doc.text(`Email: ${data.aluno.email}`, margin, yPos);
    yPos += 8;
  }

  yPos += 10;

  // Payment details section
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text('DETALHES DO PAGAMENTO', margin, yPos);
  yPos += 12;

  // Payment info box
  const boxStartY = yPos;
  const boxHeight = 70 + (data.pagamento.operador ? 14 : 0);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, yPos, pageWidth - (margin * 2), boxHeight, 3, 3, 'F');
  yPos += 12;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);

  const leftCol = margin + 10;
  const rightCol = pageWidth / 2 + 10;

  const descricao = data.pagamento.descricao || `Mensalidade de ${getMesNome(data.pagamento.mesReferencia)}/${data.pagamento.anoReferencia}`;
  doc.text(`Descrição:`, leftCol, yPos);
  doc.setFont('helvetica', 'bold');
  doc.text(descricao, leftCol + 40, yPos);

  doc.setFont('helvetica', 'normal');
  doc.text(`Data:`, rightCol, yPos);
  doc.setFont('helvetica', 'bold');
  doc.text(formatDate(data.pagamento.dataPagamento), rightCol + 55, yPos);
  yPos += 14;

  doc.setFont('helvetica', 'normal');
  doc.text(`Valor Base:`, leftCol, yPos);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(data.pagamento.valor), leftCol + 40, yPos);

  doc.setFont('helvetica', 'normal');
  doc.text(`Forma de Pagamento:`, rightCol, yPos);
  doc.setFont('helvetica', 'bold');
  doc.text(data.pagamento.formaPagamento, rightCol + 55, yPos);
  yPos += 14;

  if (data.pagamento.operador) {
    doc.setFont('helvetica', 'normal');
    doc.text(`Operador:`, leftCol, yPos);
    doc.setFont('helvetica', 'bold');
    doc.text(data.pagamento.operador, leftCol + 40, yPos);
    yPos += 14;
  }

  if (data.pagamento.valorDesconto && data.pagamento.valorDesconto > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(34, 197, 94);
    doc.text(`Desconto:`, leftCol, yPos);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(data.pagamento.valorDesconto), leftCol + 40, yPos);
    doc.setTextColor(0, 0, 0);
    yPos += 14;
  }

  if (data.pagamento.valorMulta && data.pagamento.valorMulta > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(220, 38, 38);
    doc.text(`Multa por Atraso:`, leftCol, yPos);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(data.pagamento.valorMulta), leftCol + 50, yPos);
    doc.setTextColor(0, 0, 0);
    yPos += 14;
  }

  if (data.pagamento.valorJuros && data.pagamento.valorJuros > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(220, 38, 38);
    doc.text(`Juros por Atraso:`, leftCol, yPos);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(data.pagamento.valorJuros), leftCol + 50, yPos);
    doc.setTextColor(0, 0, 0);
    yPos += 14;
  }

  yPos = boxStartY + boxHeight + 10;

  // Total box
  const totalValue = data.pagamento.valor 
    - (data.pagamento.valorDesconto || 0)
    + (data.pagamento.valorMulta || 0)
    + (data.pagamento.valorJuros || 0);
  doc.setFillColor(30, 64, 175);
  doc.roundedRect(margin, yPos, pageWidth - (margin * 2), 30, 3, 3, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL PAGO:', margin + 15, yPos + 20);
  doc.text(formatCurrency(totalValue), pageWidth - margin - 15, yPos + 20, { align: 'right' });

  yPos += 50;

  // Footer with institution contact (SIGAE: Nome, NIF, Morada, Contacto)
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  
  if (data.instituicao.nif) {
    doc.text(`NIF: ${data.instituicao.nif}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 6;
  }
  const contactInfo: string[] = [];
  if (data.instituicao.telefone) contactInfo.push(`Tel: ${data.instituicao.telefone}`);
  if (data.instituicao.email) contactInfo.push(data.instituicao.email);
  if (contactInfo.length > 0) {
    doc.text(contactInfo.join(' | '), pageWidth / 2, yPos, { align: 'center' });
    yPos += 6;
  }
  if (data.instituicao.endereco) {
    doc.text(data.instituicao.endereco, pageWidth / 2, yPos, { align: 'center' });
    yPos += 12;
  }

  // Verification code
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 12;
  
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(`Código de Controle: ${data.pagamento.reciboNumero}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 6;
  doc.text(`Documento gerado automaticamente pelo sistema ${data.instituicao.nome}.`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 5;
  doc.text(`Data de emissão: ${new Date().toLocaleString('pt-AO')}`, pageWidth / 2, yPos, { align: 'center' });

  return doc.output('blob');
};

// Thermal Printer Format Receipt PDF (80mm width)
export const gerarReciboTermicoPDF = async (data: ReciboData): Promise<Blob> => {
  // 80mm = ~226 points width, using custom page size
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, 200] // 80mm width, 200mm height (will be trimmed)
  });

  const pageWidth = 80;
  const margin = 4;
  let yPos = 8;

  // Nome da instituição
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(data.instituicao.nome, pageWidth / 2, yPos, { align: 'center' });
  yPos += 4;
  if (data.instituicao.nif) {
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.text(`NIF: ${data.instituicao.nif}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 4;
  }

  // Title
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('RECIBO DE PAGAMENTO', pageWidth / 2, yPos, { align: 'center' });
  yPos += 5;

  // Dashed line
  doc.setDrawColor(0, 0, 0);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 5;

  // Receipt number
  doc.setFontSize(7);
  doc.text(`Nº: ${data.pagamento.reciboNumero}`, margin, yPos);
  yPos += 4;
  doc.text(`Data: ${formatDate(data.pagamento.dataPagamento)}`, margin, yPos);
  yPos += 4;
  if (data.pagamento.operador) {
    doc.text(`Operador: ${data.pagamento.operador}`, margin, yPos);
    yPos += 4;
  }
  yPos += 2;

  // Dashed line
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 5;

  // Student info
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('ALUNO', margin, yPos);
  yPos += 4;
  doc.setFont('helvetica', 'normal');
  
  const alunoNome = data.aluno.nome.length > 28 ? data.aluno.nome.substring(0, 28) + '...' : data.aluno.nome;
  doc.text(alunoNome, margin, yPos);
  yPos += 4;

  if (data.aluno.numeroId) {
    doc.text(`Nº ID: ${data.aluno.numeroId}`, margin, yPos);
    yPos += 4;
  }

  const tipo = data.aluno.tipoAcademico ?? data.instituicao.tipoAcademico;
  if (tipo === 'SUPERIOR') {
    if (data.aluno.curso) {
      const cursoNome = data.aluno.curso.length > 26 ? data.aluno.curso.substring(0, 26) + '...' : data.aluno.curso;
      doc.text(`Curso: ${cursoNome}`, margin, yPos);
      yPos += 4;
    }
    if (data.aluno.anoFrequencia) {
      doc.text(`Ano: ${data.aluno.anoFrequencia}`, margin, yPos);
      yPos += 4;
    }
  } else {
    if (data.aluno.curso) {
      const cursoNome = data.aluno.curso.length > 26 ? data.aluno.curso.substring(0, 26) + '...' : data.aluno.curso;
      doc.text(`Curso: ${cursoNome}`, margin, yPos);
      yPos += 4;
    }
    if (data.aluno.classeFrequencia) {
      doc.text(`Classe: ${data.aluno.classeFrequencia}`, margin, yPos);
      yPos += 4;
    }
  }
  if (data.aluno.turma) {
    doc.text(`Turma: ${data.aluno.turma}`, margin, yPos);
    yPos += 4;
  }
  if (data.aluno.anoLetivo != null) {
    doc.text(`Ano Letivo: ${data.aluno.anoLetivo}`, margin, yPos);
    yPos += 4;
  }

  yPos += 2;
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 5;

  // Payment details
  doc.setFont('helvetica', 'bold');
  doc.text('PAGAMENTO', margin, yPos);
  yPos += 4;
  doc.setFont('helvetica', 'normal');

  doc.text(`Ref: ${getMesNome(data.pagamento.mesReferencia)}/${data.pagamento.anoReferencia}`, margin, yPos);
  yPos += 4;

  doc.text(`Forma: ${data.pagamento.formaPagamento}`, margin, yPos);
  yPos += 4;

  doc.text(`Valor: ${formatCurrency(data.pagamento.valor)}`, margin, yPos);
  yPos += 4;

  if (data.pagamento.valorDesconto && data.pagamento.valorDesconto > 0) {
    doc.text(`Desconto: -${formatCurrency(data.pagamento.valorDesconto)}`, margin, yPos);
    yPos += 4;
  }

  if (data.pagamento.valorMulta && data.pagamento.valorMulta > 0) {
    doc.text(`Multa: +${formatCurrency(data.pagamento.valorMulta)}`, margin, yPos);
    yPos += 4;
  }

  if (data.pagamento.valorJuros && data.pagamento.valorJuros > 0) {
    doc.text(`Juros: +${formatCurrency(data.pagamento.valorJuros)}`, margin, yPos);
    yPos += 4;
  }

  yPos += 2;
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 5;

  // Total
  const totalValue = data.pagamento.valor 
    - (data.pagamento.valorDesconto || 0)
    + (data.pagamento.valorMulta || 0)
    + (data.pagamento.valorJuros || 0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL', margin, yPos);
  doc.text(formatCurrency(totalValue), pageWidth - margin, yPos, { align: 'right' });
  yPos += 8;

  doc.setLineDashPattern([1, 1], 0);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 6;

  // Footer
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.text(`Documento gerado pelo sistema ${data.instituicao.nome}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 4;
  doc.text(`${new Date().toLocaleString('pt-AO')}`, pageWidth / 2, yPos, { align: 'center' });

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
  const blob = await gerarReciboA4PDF(data);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `recibo-a4-${data.pagamento.reciboNumero}.pdf`;
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
  let yPos = 20;

  // Header
  doc.setFillColor(30, 64, 175);
  doc.rect(0, 0, pageWidth, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(data.instituicao.nome, pageWidth / 2, 20, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(data.titulo, pageWidth / 2, 30, { align: 'center' });

  yPos = 55;

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

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text(
    `Relatório gerado pelo sistema ${data.instituicao.nome} em ${new Date().toLocaleString('pt-AO')}`,
    pageWidth / 2,
    footerY,
    { align: 'center' }
  );

  doc.save(`relatorio-${data.titulo.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.pdf`);
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

// A4 Format Matrícula Receipt PDF
export const gerarMatriculaReciboA4PDF = async (data: MatriculaReciboData): Promise<Blob> => {
  if (!data) throw new Error('Dados da matrícula não fornecidos');
  const safe = safeMatriculaData(data);
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPos = 20;

  // Header background
  doc.setFillColor(34, 197, 94); // Green for matricula
  doc.rect(0, 0, pageWidth, 55, 'F');

  // Nome da instituição no topo
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(safe.instituicao.nome, pageWidth / 2, 26, { align: 'center' });

  doc.setFontSize(11);
  doc.text('COMPROVANTE DE MATRÍCULA', pageWidth / 2, 42, { align: 'center' });
  doc.setFontSize(10);
  doc.text(`Nº: ${safe.matricula.reciboNumero}`, pageWidth / 2, 50, { align: 'center' });

  yPos = 72;

  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 15;

  const isSuperior = safe.matricula.tipoAcademico !== 'SECUNDARIO';

  // ESTUDANTE
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(34, 197, 94);
  doc.text('ESTUDANTE', margin, yPos);
  yPos += 10;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.text(`Nome: ${safe.aluno.nome}`, margin, yPos);
  yPos += 8;
  doc.text(`Nº Estudante: ${safe.aluno.numeroId || '-'}`, margin, yPos);
  yPos += 12;

  // CONTEXTO ACADÊMICO
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(34, 197, 94);
  doc.text('CONTEXTO ACADÊMICO', margin, yPos);
  yPos += 10;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(`Curso: ${safe.matricula.curso}`, margin, yPos);
  yPos += 8;

  if (isSuperior && safe.matricula.anoFrequencia) {
    doc.text(`Ano de Frequência: ${safe.matricula.anoFrequencia}`, margin, yPos);
    yPos += 8;
  }
  if (!isSuperior && safe.matricula.classeFrequencia) {
    doc.text(`Classe: ${safe.matricula.classeFrequencia}`, margin, yPos);
    yPos += 8;
  }

  doc.text(`Turma: ${safe.matricula.turma}`, margin, yPos);
  yPos += 8;

  if (isSuperior) {
    const sem = String(safe.matricula.semestre || '').trim();
    const formatSem = (s: string): string => {
      const nums = s.split(/[,;]/).map(x => x.trim()).filter(Boolean).map(x => parseInt(x, 10)).filter(n => !isNaN(n)).sort((a, b) => a - b);
      if (nums.length === 0) return '-';
      if (nums.length === 1) return `${nums[0]}º`;
      return nums.map(n => `${n}º`).join(' e ');
    };
    doc.text(`Semestre: ${sem ? formatSem(sem) : '-'}`, margin, yPos);
    yPos += 8;
  }

  doc.text(`Ano Letivo: ${safe.matricula.ano}`, margin, yPos);
  yPos += 12;

  // DISCIPLINAS
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(34, 197, 94);
  doc.text('DISCIPLINAS:', margin, yPos);
  yPos += 10;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  const disciplinas = (safe.matricula.disciplinas && safe.matricula.disciplinas.length > 0)
    ? safe.matricula.disciplinas
    : (safe.matricula.disciplina && safe.matricula.disciplina !== 'Matrícula em Turma'
        ? [safe.matricula.disciplina]
        : []);
  if (disciplinas.length > 0) {
    disciplinas.forEach((d: string) => {
      doc.text(`- ${d || '-'}`, margin, yPos);
      yPos += 4;
    });
  } else {
    doc.text('-', margin, yPos);
    yPos += 4;
  }

  yPos += 12;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 12;

  doc.setFontSize(10);
  if (safe.operador) {
    doc.text(`Operador: ${safe.operador}`, margin, yPos);
    yPos += 8;
  }
  doc.text(`Emitido em: ${formatDateTime()}`, margin, yPos);
  yPos += 8;

  doc.setFont('helvetica', 'bold');
  doc.text('Status: CONFIRMADO', margin, yPos);
  yPos += 15;

  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 12;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text('Documento gerado automaticamente', pageWidth / 2, yPos, { align: 'center' });
  yPos += 6;
  doc.text(`Sistema ${safe.instituicao.nome}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 6;
  doc.text(`Código de Verificação: ${safe.matricula.reciboNumero}`, pageWidth / 2, yPos, { align: 'center' });

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

  // COMPROVANTE DE MATRÍCULA
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('COMPROVANTE DE MATRÍCULA', pageWidth / 2, yPos, { align: 'center' });
  yPos += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(`Nº: ${safe.matricula.reciboNumero}`, margin, yPos);
  yPos += 4;
  doc.text(`Data: ${formatDate(safe.matricula.dataMatricula)}`, margin, yPos);
  yPos += 6;

  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 5;

  // ESTUDANTE
  doc.setFont('helvetica', 'bold');
  doc.text('ESTUDANTE', margin, yPos);
  yPos += 5;

  doc.setFont('helvetica', 'normal');
  doc.text(`Nome: ${safe.aluno.nome}`, margin, yPos);
  yPos += 4;
  doc.text(`Nº Estudante: ${safe.aluno.numeroId || '-'}`, margin, yPos);
  yPos += 6;

  // CONTEXTO ACADÊMICO
  const isSuperior = safe.matricula.tipoAcademico !== 'SECUNDARIO';
  doc.setFont('helvetica', 'bold');
  doc.text('CONTEXTO ACADÊMICO', margin, yPos);
  yPos += 5;

  doc.setFont('helvetica', 'normal');
  doc.text(`Curso: ${safe.matricula.curso}`, margin, yPos);
  yPos += 4;

  if (isSuperior && safe.matricula.anoFrequencia) {
    doc.text(`Ano de Frequência: ${safe.matricula.anoFrequencia}`, margin, yPos);
    yPos += 4;
  }
  if (!isSuperior && safe.matricula.classeFrequencia) {
    doc.text(`Classe: ${safe.matricula.classeFrequencia}`, margin, yPos);
    yPos += 4;
  }

  doc.text(`Turma: ${safe.matricula.turma}`, margin, yPos);
  yPos += 4;

  if (isSuperior) {
    const sem = String(safe.matricula.semestre || '').trim();
    const formatSem = (s: string): string => {
      const nums = s.split(/[,;]/).map(x => x.trim()).filter(Boolean).map(x => parseInt(x, 10)).filter(n => !isNaN(n)).sort((a, b) => a - b);
      if (nums.length === 0) return '-';
      if (nums.length === 1) return `${nums[0]}º`;
      return nums.map(n => `${n}º`).join(' e ');
    };
    doc.text(`Semestre: ${sem ? formatSem(sem) : '-'}`, margin, yPos);
    yPos += 4;
  }

  doc.text(`Ano Letivo: ${safe.matricula.ano}`, margin, yPos);
  yPos += 6;

  // DISCIPLINAS
  doc.setFont('helvetica', 'bold');
  doc.text('DISCIPLINAS:', margin, yPos);
  yPos += 4;

  doc.setFont('helvetica', 'normal');
  const disciplinas = (safe.matricula.disciplinas && safe.matricula.disciplinas.length > 0)
    ? safe.matricula.disciplinas
    : (safe.matricula.disciplina && safe.matricula.disciplina !== 'Matrícula em Turma'
        ? [safe.matricula.disciplina]
        : []);
  if (disciplinas.length > 0) {
    disciplinas.forEach((d: string) => {
      doc.text(`- ${d || '-'}`, margin, yPos);
      yPos += 4;
    });
  } else {
    doc.text('-', margin, yPos);
    yPos += 4;
  }

  yPos += 4;
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 5;

  if (safe.operador) {
    doc.text(`Operador: ${safe.operador}`, margin, yPos);
    yPos += 4;
  }
  doc.text(`Emitido em: ${formatDateTime()}`, margin, yPos);
  yPos += 4;

  doc.setFont('helvetica', 'bold');
  doc.text('Status: CONFIRMADO', margin, yPos);
  yPos += 6;

  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.text('Documento gerado automaticamente', pageWidth / 2, yPos, { align: 'center' });
  yPos += 4;
  doc.text(`Sistema ${safe.instituicao.nome}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 4;
  doc.text(`Código de Verificação: ${safe.matricula.reciboNumero}`, pageWidth / 2, yPos, { align: 'center' });

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

// Gerar PDF de recibo/fatura de licença
export const gerarDocumentoFiscalLicencaPDF = async (
  data: DocumentoFiscalLicencaData
): Promise<Blob> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPos = 20;

  // Header background
  doc.setFillColor(30, 64, 175); // Primary blue
  doc.rect(0, 0, pageWidth, 60, 'F');

  // Nome da instituição
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(data.instituicao.nome, pageWidth / 2, 30, { align: 'center' });

  // Document type
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text(
    data.tipo === 'RECIBO' ? 'RECIBO DE PAGAMENTO DE LICENÇA' : 'FATURA DE LICENÇA',
    pageWidth / 2,
    45,
    { align: 'center' }
  );

  // Document number
  doc.setFontSize(11);
  doc.text(`Nº ${data.numeroDocumento}`, pageWidth / 2, 55, { align: 'center' });

  yPos = 75;

  // Reset text color
  doc.setTextColor(0, 0, 0);

  // Divider
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 15;

  // Institution info
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  if (data.instituicao.nif) {
    doc.text(`NIF: ${data.instituicao.nif}`, margin, yPos);
    yPos += 10;
  }
  if (data.instituicao.endereco) {
    doc.text(`Endereço: ${data.instituicao.endereco}`, margin, yPos);
    yPos += 10;
  }
  if (data.instituicao.email || data.instituicao.telefone) {
    const contato = [data.instituicao.email, data.instituicao.telefone].filter(Boolean).join(' | ');
    doc.text(`Contacto: ${contato}`, margin, yPos);
    yPos += 15;
  }

  // Divider
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 20;

  // Payment details section
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text('DETALHES DO PAGAMENTO', margin, yPos);
  yPos += 15;

  // Payment info box
  const boxStartY = yPos;
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(margin, boxStartY, pageWidth - (margin * 2), 130, 3, 3, 'F');

  yPos += 12;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);

  doc.setFont('helvetica', 'bold');
  doc.text('Plano:', margin + 10, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(data.plano.nome, margin + 50, yPos);
  yPos += 15;

  doc.setFont('helvetica', 'bold');
  doc.text('Período:', margin + 10, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(data.periodo === 'MENSAL' ? 'Mensal' : 'Anual', margin + 50, yPos);
  yPos += 15;

  doc.setFont('helvetica', 'bold');
  doc.text('Método de Pagamento:', margin + 10, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(formatarMetodoPagamento(data.metodo), margin + 70, yPos);
  yPos += 15;

  if (data.referencia) {
    doc.setFont('helvetica', 'bold');
    doc.text('Referência:', margin + 10, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(data.referencia, margin + 50, yPos);
    yPos += 15;
  }

  doc.setFont('helvetica', 'bold');
  doc.text('Data de Pagamento:', margin + 10, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(formatDate(data.dataPagamento), margin + 70, yPos);
  yPos += 15;

  doc.setFont('helvetica', 'bold');
  doc.text('Data de Emissão:', margin + 10, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(formatDate(data.dataEmissao), margin + 70, yPos);

  // Total box
  yPos = boxStartY + 145;
  doc.setFillColor(30, 64, 175);
  doc.roundedRect(margin, yPos, pageWidth - (margin * 2), 35, 3, 3, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('VALOR TOTAL:', margin + 15, yPos + 20);
  doc.text(
    formatCurrency(data.valor),
    pageWidth - margin - 15,
    yPos + 20,
    { align: 'right' }
  );

  yPos += 55;

  // Footer
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Este documento foi gerado automaticamente pelo sistema ${data.instituicao.nome}.`,
    pageWidth / 2,
    yPos,
    { align: 'center' }
  );
  yPos += 8;
  doc.text(
    `Código de Controle: ${data.numeroDocumento}`,
    pageWidth / 2,
    yPos,
    { align: 'center' }
  );

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
  };
  return metodos[metodo] || metodo;
}
