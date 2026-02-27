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
    numeroId?: string | null; // Nº público (obrigatório em recibos)
    numeroIdentificacaoPublica?: string | null;
    numero_identificacao_publica?: string | null;
    bi?: string | null; // Bilhete de Identidade
    email?: string | null;
    curso?: string | null;
    turma?: string | null;
    anoLetivo?: number | null;
    /** Ensino Superior: ex. "1º Ano", "2º Ano" */
    anoFrequencia?: string | null;
    /** Ensino Secundário: ex. "10ª Classe" */
    classeFrequencia?: string | null;
    turno?: string | null; // Manhã, Tarde, Noite
    semestre?: string | null; // 1º, 2º
    tipoAcademico?: 'SUPERIOR' | 'SECUNDARIO' | null;
  };
  pagamento: {
    valor: number;
    valorDesconto?: number;
    valorMulta?: number;
    valorJuros?: number;
    /** IVA opcional (ex: 14%) - quando presente mostra linha IVA */
    valorIVA?: number;
    mesReferencia: number;
    anoReferencia: number;
    dataPagamento: string;
    formaPagamento: string;
    reciboNumero: string;
    /** Série do recibo (ex: 2026-A) - Ensino Superior */
    serie?: string | null;
    operador?: string | null;
    descricao?: string | null;
    observacoes?: string | null;
    totalPago?: number;
    totalPagoPorExtenso?: string;
  };
}

/** Dados da instituição para recibos (contexto: config + instituicao). Tudo dinâmico, sem texto fixo. */
export function getInstituicaoForRecibo(context: {
  config?: { nome_instituicao?: string; logo_url?: string | null; email?: string | null; telefone?: string | null; endereco?: string | null; nif?: string; tipo_academico?: string | null } | null;
  instituicao?: { nome?: string; logo_url?: string | null; email_contato?: string | null; telefone?: string | null; endereco?: string | null; tipo_academico?: string | null } | null;
  tipoAcademico?: string | null;
}): ReciboData['instituicao'] {
  const c = context.config;
  const i = context.instituicao;
  const nome = (i?.nome ?? c?.nome_instituicao ?? '').trim();
  return {
    nome: nome || '',
    logoUrl: i?.logo_url ?? c?.logo_url ?? null,
    email: i?.email_contato ?? c?.email ?? null,
    telefone: i?.telefone ?? c?.telefone ?? null,
    endereco: (i?.endereco ?? c?.endereco ?? '').trim() || null,
    nif: (c as { nif?: string })?.nif ?? null,
    tipoAcademico: (context.tipoAcademico ?? i?.tipo_academico ?? (c as { tipo_academico?: string })?.tipo_academico ?? null) as 'SUPERIOR' | 'SECUNDARIO' | null,
  };
}

/** TURMA no recibo: mostrar só o nome (ex: "Turma A"), não "10ª Classe - Turma A" */
export function extrairNomeTurmaRecibo(nome: string | null | undefined): string | null {
  if (!nome || !String(nome).trim()) return null;
  const s = String(nome).trim();
  const match = s.match(/^\d+ª\s*Classe\s*[-–—]\s*(.+)$/i);
  return match ? match[1].trim() : s;
}

/**
 * Ano de frequência no Ensino Superior: "1º Ano", "2º Ano", etc.
 * turma.ano 1-7 = ano curricular. turma.ano 2020+ = ano civil (ignorar).
 */
export function formatAnoFrequenciaSuperior(
  turma?: { ano?: number | null; classe?: { nome?: string } } | null,
  matriculaAnual?: { classeOuAnoCurso?: string | null; classe_ou_ano_curso?: string | null } | null
): string | null {
  const ta = turma?.ano;
  if (ta != null && ta >= 1 && ta <= 7) return `${ta}º Ano`;
  const cn = turma?.classe?.nome?.trim();
  if (cn && /^\dº\s*Ano$/i.test(cn)) return cn;
  const mao = matriculaAnual?.classeOuAnoCurso ?? matriculaAnual?.classe_ou_ano_curso;
  if (mao && /^\dº\s*Ano$/i.test(String(mao).trim())) return String(mao).trim();
  return null;
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

/** Data curta para recibos: dd/mm/aaaa */
const formatDateShort = (dateString: string | null | undefined) => {
  const d = dateString ? new Date(dateString) : new Date();
  if (Number.isNaN(d.getTime())) return new Date().toLocaleDateString('pt-AO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return d.toLocaleDateString('pt-AO', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

/** Formata valor numérico para tabela (ex: 25.000,00 sem símbolo) */
const formatValorAO = (value: number) => {
  return new Intl.NumberFormat('pt-AO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

/** Rejeita ano civil (2026) no campo ANO - Ensino Superior usa ano de frequência (1º Ano, 2º Ano) */
const sanitizeAnoFrequencia = (v: string | null | undefined): string | null => {
  if (v == null || !String(v).trim()) return null;
  if (/\d{4}º\s*Ano/.test(String(v))) return null; // ano civil inválido
  return String(v).trim();
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
  const resultado = dec > 0 ? `${extenso}${moeda} e ${dec}/100` : `${extenso}${moeda}`;
  // Primeira letra em maiúscula (ex: "cinquenta mil Kwanzas" → "Cinquenta mil Kwanzas")
  return resultado.charAt(0).toUpperCase() + resultado.slice(1);
};

/** Formata forma de pagamento para texto completo no recibo (ex: TRANSFERENCIA → Transferência Bancária) */
const formatarFormaPagamentoRecibo = (forma: string | null | undefined): string => {
  if (!forma || !String(forma).trim()) return '-';
  const f = String(forma).trim().toUpperCase();
  const map: Record<string, string> = {
    TRANSFERENCIA: 'Transferência Bancária',
    TRANSFERÊNCIA: 'Transferência Bancária',
    DEPOSITO: 'Depósito',
    MULTICAIXA: 'Multicaixa',
    CASH: 'Dinheiro',
    DINHEIRO: 'Dinheiro',
    MOBILE_MONEY: 'Mobile Money',
    CHEQUE: 'Cheque',
    REFERENCIA: 'Referência Bancária',
    REFERÊNCIA: 'Referência Bancária',
  };
  return map[f] ?? forma;
};

/** Extrai número público para recibos (estudante/funcionário – obrigatório) */
const getNumeroPublicoRecibo = (aluno: ReciboData['aluno'] & Record<string, unknown>): string => {
  const v = (aluno?.numeroId ?? aluno?.numeroIdentificacaoPublica ?? (aluno as { numero_identificacao_publica?: string })?.numero_identificacao_publica) as string | null | undefined;
  if (v == null || String(v).trim() === '') return '-';
  const inv = ['', 'n/d', 'n/a', 'nao informado', 'null', 'undefined'];
  return inv.includes(String(v).trim().toLowerCase()) ? '-' : String(v).trim();
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

// Helper: linha com descrição, pontos e valor à direita
const drawReciboLinha = (
  doc: jsPDF,
  desc: string,
  valorStr: string,
  yPos: number,
  margin: number,
  pageWidth: number,
  valRight = true
) => {
  const valWidth = doc.getTextWidth(valorStr);
  const valX = valRight ? pageWidth - margin - valWidth : margin + 80;
  doc.text(desc, margin, yPos);
  const descWidth = doc.getTextWidth(desc);
  const dotStart = margin + descWidth + 3;
  const dotEnd = valX - 5;
  if (dotEnd > dotStart) {
    const dotCount = Math.floor((dotEnd - dotStart) / 2);
    doc.text('.'.repeat(Math.min(dotCount, 80)), dotStart, yPos);
  }
  doc.text(valorStr, valX, yPos, { align: valRight ? 'right' : 'left' });
};

// A4 Format Receipt - Layout Colégio Exemplo de Angola
export const gerarReciboA4PDF = async (
  data: ReciboData,
  tipoDocumento: TipoDocumentoFiscal = 'RECIBO'
): Promise<Blob> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 25;
  let yPos = 20;

  // Logo (opcional)
  if (data.instituicao.logoUrl) {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = data.instituicao.logoUrl;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
      });
      doc.addImage(img, 'PNG', pageWidth / 2 - 20, yPos, 40, 40);
      yPos += 45;
    } catch {
      yPos += 2;
    }
  }

  // Nome da instituição (centrado)
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(data.instituicao.nome, pageWidth / 2, yPos, { align: 'center' });
  yPos += 7;

  const isSec = data.instituicao?.tipoAcademico === 'SECUNDARIO';
  const numeroPublico = getNumeroPublicoRecibo(data.aluno);
  const anoRef = data.pagamento.anoReferencia ?? new Date().getFullYear();

  // Endereço e contacto
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  const endereco = data.instituicao.endereco || '';
  doc.text(endereco || ' ', pageWidth / 2, yPos, { align: 'center' });
  yPos += 5;
  if (data.instituicao.telefone || data.instituicao.email) {
    const tel = data.instituicao.telefone ? `Tel: ${data.instituicao.telefone}` : '';
    const email = data.instituicao.email ? `Email: ${data.instituicao.email}` : '';
    const contacto = [tel, email].filter(Boolean).join(' | ');
    doc.text(contacto, pageWidth / 2, yPos, { align: 'center' });
    yPos += 5;
  }
  yPos += 9;

  // Título: RECIBO DE PAGAMENTO (Secundário) ou RECIBO DE PAGAMENTO DE MENSALIDADE (Superior)
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(
    isSec ? 'RECIBO DE PAGAMENTO' : 'RECIBO DE PAGAMENTO DE MENSALIDADE',
    pageWidth / 2,
    yPos,
    { align: 'center' }
  );
  yPos += 12;

  // Recibo Nº, Série (Superior), Data, Ano Letivo, Semestre (Superior)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Recibo Nº: ${data.pagamento.reciboNumero}`, margin, yPos);
  const serie = (data.pagamento as { serie?: string | null }).serie;
  if (!isSec && serie) doc.text(`Série: ${serie}`, margin + 55, yPos);
  doc.text(`Data: ${formatDateShort(data.pagamento.dataPagamento)}`, margin + (isSec ? 55 : 95), yPos);
  const anoLetivoStr = isSec ? String(anoRef) : `${anoRef}/${anoRef + 1}`;
  doc.text(`Ano Letivo: ${anoLetivoStr}`, pageWidth - margin, yPos, { align: 'right' });
  yPos += 7;
  if (!isSec && data.aluno.semestre) {
    doc.text(`Semestre: ${data.aluno.semestre}`, margin, yPos);
    yPos += 7;
  }
  yPos += 7;

  // Dados do estudante
  const classeOuAno = isSec
    ? (data.aluno.classeFrequencia ?? '-')
    : (sanitizeAnoFrequencia(data.aluno.anoFrequencia) ?? '-');
  const mesRef = getMesNome(data.pagamento.mesReferencia) || String(data.pagamento.mesReferencia);
  const mesRefCompleto = isSec ? mesRef : `${mesRef} ${anoRef}`;
  const curso = data.aluno.curso ?? '-';
  const turma = data.aluno.turma ?? '-';
  const turno = data.aluno.turno ?? '-';

  if (isSec) {
    doc.text(`Aluno: ${data.aluno.nome}, Nº: ${numeroPublico}`, margin, yPos);
    yPos += 7;
    doc.text(`Classe: ${classeOuAno}`, margin, yPos);
    yPos += 7;
    doc.text(`Turma: ${turma}`, margin, yPos);
  } else {
    doc.text(`Estudante: ${data.aluno.nome}`, margin, yPos);
    yPos += 7;
    doc.text(`Nº Estudante: ${numeroPublico}`, margin, yPos);
    yPos += 7;
    doc.text(`Curso: ${curso}`, margin, yPos);
    yPos += 7;
    doc.text(`Ano Curricular: ${classeOuAno}`, margin, yPos);
    yPos += 7;
    doc.text(`Turno: ${turno}`, margin, yPos);
    yPos += 7;
    doc.text(`Turma: ${turma}`, margin, yPos);
  }
  yPos += 7;
  doc.text(`Mês Referente: ${mesRefCompleto}`, margin, yPos);
  yPos += 12;

  // Descrição
  doc.setFont('helvetica', 'bold');
  doc.text('Descrição:', margin, yPos);
  yPos += 8;

  const valorBase = data.pagamento.valor - (data.pagamento.valorDesconto || 0);
  const valorIVA = (data.pagamento as { valorIVA?: number }).valorIVA ?? 0;
  const valorMulta = data.pagamento.valorMulta ?? 0;
  const valorJuros = data.pagamento.valorJuros ?? 0;
  const totalPagoBackend = (data.pagamento as any).totalPago as number | undefined;
  const totalValue = typeof totalPagoBackend === 'number'
    ? totalPagoBackend
    : valorBase + valorIVA + valorMulta + valorJuros;

  doc.setFont('helvetica', 'normal');
  drawReciboLinha(doc, 'Mensalidade (Base)', `${formatValorAO(valorBase)} AOA`, yPos, margin, pageWidth);
  yPos += 7;

  if (valorIVA > 0) {
    drawReciboLinha(doc, 'IVA se tiver 14%', `${formatValorAO(valorIVA)} AOA`, yPos, margin, pageWidth);
    yPos += 7;
  }
  if (valorMulta > 0) {
    drawReciboLinha(doc, 'Multa por Atraso', `${formatValorAO(valorMulta)} AOA`, yPos, margin, pageWidth);
    yPos += 7;
  }
  if (valorJuros > 0) {
    drawReciboLinha(doc, 'Juros por Atraso', `${formatValorAO(valorJuros)} AOA`, yPos, margin, pageWidth);
    yPos += 7;
  }

  doc.setFont('helvetica', 'bold');
  drawReciboLinha(doc, 'Total Pago', `${formatValorAO(totalValue)} AOA`, yPos, margin, pageWidth);
  yPos += 14;

  // Forma de Pagamento (texto completo: Transferência Bancária, etc.)
  doc.setFont('helvetica', 'normal');
  doc.text(`Forma de Pagamento: ${formatarFormaPagamentoRecibo(data.pagamento.formaPagamento)}`, margin, yPos);
  yPos += 12;

  // Declaração (texto diferente por tipo)
  doc.setFontSize(10);
  if (isSec) {
    doc.text('Declara-se que o valor acima foi recebido referente à mensalidade do mês indicado.', margin, yPos);
  } else {
    doc.text('Declara-se que o estudante encontra-se com a mensalidade do mês acima regularizada.', margin, yPos);
  }
  yPos += 16;

  // Assinatura e Carimbo
  doc.setDrawColor(0, 0, 0);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 8;
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(
    isSec ? 'Assinatura e Carimbo' : 'Assinatura e Carimbo Oficial',
    pageWidth / 2,
    yPos,
    { align: 'center' }
  );
  yPos += 12;

  // Rodapé
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

  // ESTUDANTE, Nº, Secundário: CLASSE+TURMA | Superior: CURSO+ANO+TURMA
  const numeroPublico = getNumeroPublicoRecibo(data.aluno);
  const isSec = data.instituicao?.tipoAcademico === 'SECUNDARIO';
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  const nome = data.aluno.nome.length > 30 ? data.aluno.nome.substring(0, 30) + '...' : data.aluno.nome;
  doc.text(`ESTUDANTE: ${nome}`, margin, yPos);
  yPos += 4;
  doc.text(`Nº: ${String(numeroPublico).substring(0, 20)}`, margin, yPos);
  yPos += 4;
  if (isSec) {
    doc.text(`CLASSE: ${(data.aluno.classeFrequencia ?? '-').substring(0, 28)}`, margin, yPos);
    yPos += 4;
    doc.text(`TURMA: ${(data.aluno.turma ?? '-').substring(0, 28)}`, margin, yPos);
  } else {
    doc.text(`CURSO: ${(data.aluno.curso ?? '-').substring(0, 28)}`, margin, yPos);
    yPos += 4;
    doc.text(`ANO: ${String(sanitizeAnoFrequencia(data.aluno.anoFrequencia) ?? '-').substring(0, 28)}`, margin, yPos);
    yPos += 4;
    doc.text(`TURMA: ${(data.aluno.turma ?? '-').substring(0, 28)}`, margin, yPos);
  }
  yPos += 6;

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

  const totalPagoBackendTermico = (data.pagamento as any).totalPago as number | undefined;
  const totalValue = typeof totalPagoBackendTermico === 'number'
    ? totalPagoBackendTermico
    : valorBase
      + (data.pagamento.valorMulta || 0)
      + (data.pagamento.valorJuros || 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Total', margin, yPos);
  doc.text(formatValorAO(totalValue), pageWidth - margin, yPos, { align: 'right' });
  yPos += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  const extensoBackend = (data.pagamento as any).totalPagoPorExtenso as string | undefined;
  const extenso = extensoBackend && extensoBackend.trim().length > 0
    ? extensoBackend.trim()
    : valorPorExtenso(totalValue);
  const extLines = extenso.length > 42 ? [extenso.substring(0, 42), extenso.substring(42)] : [extenso];
  extLines.forEach((l) => {
    const t = l.trim();
    const linha = t ? t.charAt(0).toUpperCase() + t.slice(1) : l;
    doc.text(linha, pageWidth / 2, yPos, { align: 'center' });
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
  instituicao: { nome: string; logoUrl?: string | null; endereco?: string | null; telefone?: string | null; email?: string | null; nif?: string | null };
  funcionario: { nome: string; numeroId?: string | null; cargo?: string; email?: string; departamento?: string | null };
  folha: {
    mes: number;
    ano: number;
    dias_uteis?: number;
    valor_dia?: number;
    valor_hora?: number;
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
  dataFecho?: string;
  formaPagamento?: string;
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

/**
 * Recibo de folha: layout "Recibo de Vencimentos" (estilo Primavera), igual ao backend.
 */
async function drawReciboFolhaPage(doc: jsPDF, data: ReciboFolhaPagamentoData): Promise<void> {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 50;
  const contentW = pageWidth - margin * 2;
  let y = 28;

  const numFunc = data.funcionario.numeroId ?? (data.funcionario as { numeroIdentificacaoPublica?: string })?.numeroIdentificacaoPublica ?? (data.funcionario as { numero_identificacao_publica?: string })?.numero_identificacao_publica ?? '—';
  const diasUteis = data.folha.dias_uteis ?? 0;
  const valorDia = data.folha.valor_dia ?? 0;
  const valorHora = data.folha.valor_hora ?? 0;
  const lastDay = new Date(data.folha.ano, data.folha.mes, 0);
  const dataFecho = data.dataFecho ?? `${String(lastDay.getDate()).padStart(2, '0')}/${String(lastDay.getMonth() + 1).padStart(2, '0')}/${lastDay.getFullYear()}`;
  const formaPagamento = data.formaPagamento ?? 'Transferência';

  // 1. Nome da instituição + endereço
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(data.instituicao.nome.toUpperCase(), margin, y);
  y += 8;
  if (data.instituicao.endereco?.trim()) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(data.instituicao.endereco.trim(), margin, y);
    y += 8;
  }
  // 2. Título
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('Recibo de Vencimentos', margin, y);
  y += 8;
  // 3. NIF | NISS
  const nifNiss = `NIF ${data.instituicao.nif?.trim() || '—'} | NISS —`;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(nifNiss, margin, y);
  y += 8;
  // 4. Original + Nº recibo
  doc.setTextColor(80, 80, 80);
  doc.text('Original', margin, y);
  doc.setFont('helvetica', 'bold');
  doc.text(data.reciboNumero, margin + contentW - 90, y, { align: 'right', maxWidth: 90 });
  y += 14;

  // 5. Bloco funcionário
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('N.º Contrib.', margin, y);
  doc.text(String(numFunc), margin + 52, y);
  doc.text('N.º Benef.\tNome', margin + 120, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(data.funcionario.nome, margin + 185, y);
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('N.º Mecan.', margin, y);
  doc.text(String(numFunc), margin + 42, y);
  doc.text('N.º Dias Úteis', margin + 95, y);
  doc.text(formatValorAO(diasUteis), margin + 155, y);
  doc.text('Venc. / Hora', margin + 195, y);
  doc.text(formatValorAO(valorHora), margin + 255, y);
  doc.text('Vencimento', margin + 315, y);
  doc.text(formatValorAO(data.folha.salario_base), margin + 375, y);
  doc.text('Data Fecho', margin + 435, y);
  doc.text(dataFecho, margin + 495, y);
  y += 7;
  doc.text('Período', margin, y);
  doc.text(getMesNome(data.folha.mes), margin + 42, y);
  if (data.funcionario.departamento) {
    doc.text('Departamento', margin + 180, y);
    doc.text(data.funcionario.departamento, margin + 245, y);
  }
  if (data.funcionario.cargo) {
    doc.text('Categoria', margin + 380, y);
    doc.text(data.funcionario.cargo, margin + 425, y);
  }
  y += 14;

  // 6. Tabela Cód. | Remunerações | Descrição | Valor (AO)
  const colCod = 35;
  const colDesc = margin + colCod + 10;
  const colDescW = contentW - colCod - 10 - 85;
  const colValorX = margin + contentW - 82;
  const colValorW = 82;

  doc.setFillColor(242, 242, 250);
  doc.rect(margin, y, contentW, 9, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 50);
  doc.text('Cód.', margin + 4, y + 6);
  doc.text('Remunerações', colDesc, y + 6);
  doc.text('Descrição', colDesc + 120, y + 6);
  doc.text('Valor (AO)', colValorX, y + 6, { align: 'right', maxWidth: colValorW });
  y += 9;

  const f = data.folha;
  let totalRemun = 0;
  let totalDesc = 0;
  const addRemun = (desc: string, valor: number, cod: string) => {
    doc.setDrawColor(230, 230, 230);
    doc.line(margin, y, margin + contentW, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(cod, margin + 4, y + 5);
    doc.text(desc, colDesc, y + 5, { maxWidth: colDescW - 30 });
    doc.text(formatValorAO(valor), colValorX, y + 5, { align: 'right', maxWidth: colValorW });
    totalRemun += valor;
    y += 7;
  };
  const addDesc = (desc: string, valor: number, cod: string) => {
    doc.setDrawColor(230, 230, 230);
    doc.line(margin, y, margin + contentW, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(cod, margin + 4, y + 5);
    doc.text(desc, colDesc, y + 5, { maxWidth: colDescW - 30 });
    doc.text(formatValorAO(-valor), colValorX, y + 5, { align: 'right', maxWidth: colValorW });
    totalDesc += valor;
    y += 7;
  };

  if (f.salario_base > 0) addRemun('Vencimento', f.salario_base, 'R01');
  if (f.bonus > 0) addRemun('Bônus', f.bonus, 'R02');
  if (f.valor_horas_extras > 0) addRemun('Horas Extras', f.valor_horas_extras, 'R03');
  if (f.beneficio_transporte > 0) addRemun('Subsídio Transporte', f.beneficio_transporte, 'R14');
  if (f.beneficio_alimentacao > 0) addRemun('Subsídio Alimentação', f.beneficio_alimentacao, 'R15');
  if (f.outros_beneficios > 0) addRemun('Outros Benefícios', f.outros_beneficios, 'R99');
  if (f.descontos_faltas > 0) addDesc('Desconto por Faltas', f.descontos_faltas, 'D01');
  if (f.inss > 0) addDesc('Segurança Social (INSS)', f.inss, 'D02');
  if (f.irt > 0) addDesc('IRT', f.irt, 'D03');
  if (f.outros_descontos > 0) addDesc('Outros Descontos', f.outros_descontos, 'D99');

  doc.setDrawColor(128, 128, 128);
  doc.line(margin, y, margin + contentW, y);
  y += 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text('Total', margin + 4, y + 6);
  doc.text(formatValorAO(totalRemun), colValorX - 90, y + 6, { align: 'right', maxWidth: 85 });
  doc.text(formatValorAO(totalDesc), colValorX, y + 6, { align: 'right', maxWidth: colValorW });
  y += 10;
  doc.setFontSize(10);
  doc.text('Total Pago (AKZ)', margin + 4, y + 7);
  doc.text(formatValorAO(f.salario_liquido), colValorX, y + 7, { align: 'right', maxWidth: colValorW });
  y += 18;

  // 7. Forma de Pagamento
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text('Formas de Pagamento:', margin, y);
  y += 6;
  doc.text(`Remuneração  100,00 AKZ\t${formaPagamento}`, margin, y);
  y += 14;

  // 8. Declaração + valor por extenso
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  doc.text('Declaro que recebi a quantia constante neste recibo.', margin, y);
  y += 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(40, 40, 40);
  doc.text(valorPorExtenso(f.salario_liquido), margin, y);
  y += 14;

  // 9. Rodapé
  const footerY = pageHeight - 45;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, footerY - 4, margin + contentW, footerY - 4);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`© ${data.instituicao.nome} • ${data.reciboNumero}`, pageWidth / 2, footerY + 2, { align: 'center' });
  if (data.instituicao.endereco?.trim()) {
    doc.setFontSize(7);
    doc.setTextColor(115, 115, 115);
    doc.text(data.instituicao.endereco.trim(), pageWidth / 2, footerY + 10, { align: 'center' });
  }
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

  doc.save(`relatorio-${String(data.titulo ?? "").toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.pdf`);
};

// Extrato Financeiro do Aluno (Área Financeira)
export interface ExtratoFinanceiroData {
  instituicao: {
    nome: string;
    nif?: string | null;
    logoUrl?: string | null;
    endereco?: string | null;
    tipoAcademico?: 'SUPERIOR' | 'SECUNDARIO' | null;
  };
  aluno: {
    nome: string;
    numeroId?: string | null;
    numeroIdentificacaoPublica?: string | null;
    numero_identificacao_publica?: string | null;
    curso?: string | null;
    turma?: string | null;
    anoFrequencia?: string | null;
    classeFrequencia?: string | null;
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
    tituloDocumento: 'EXTRATO FINANCEIRO DO ESTUDANTE',
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
  const numExtrato = getNumeroPublicoRecibo(data.aluno as ReciboData['aluno'] & Record<string, unknown>);
  doc.text(`Nº: ${numExtrato}`, margin, yPos);
  yPos += 8;
  doc.text(`Curso: ${data.aluno.curso ?? '-'}`, margin, yPos);
  yPos += 8;
  doc.text(`Turma: ${data.aluno.turma ?? '-'}`, margin, yPos);
  yPos += 8;
  const isSecExt = data.instituicao?.tipoAcademico === 'SECUNDARIO';
  doc.text(isSecExt ? `Classe: ${data.aluno.classeFrequencia ?? '-'}` : `Ano: ${sanitizeAnoFrequencia(data.aluno.anoFrequencia) ?? '-'}`, margin, yPos);
  yPos += 10;
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
  const headers = ['Aluno', 'Nº', 'Mês/Ano', 'Vencimento', 'Valor', 'Multa', 'Dias Atraso'];
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
  link.download = `relatorio-receitas-${String(data.periodo ?? "").toLowerCase()}-${Date.now()}.pdf`;
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
    tipoAcademico?: 'SUPERIOR' | 'SECUNDARIO' | null;
  };
  aluno: {
    nome: string;
    numeroId?: string | null;
    numeroIdentificacaoPublica?: string | null;
    numero_identificacao_publica?: string | null;
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
    anoFrequencia?: string | null;
    classeFrequencia?: string | null;
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
    tituloDocumento: 'FICHA CADASTRAL DO ESTUDANTE',
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

  const numFicha = getNumeroPublicoRecibo({
    ...data.aluno,
    numeroId: data.aluno.numeroId ?? data.aluno.numeroIdentificacaoPublica ?? (data.aluno as { numero_identificacao_publica?: string }).numero_identificacao_publica,
  } as ReciboData['aluno'] & Record<string, unknown>);
  addLine('Nome completo', data.aluno.nome);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Nº identificação pública: ${numFicha}`, margin, yPos);
  yPos += 7;
  addLine('BI/Identificação', data.aluno.numeroIdentificacao ?? null);
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
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Curso: ${data.aluno.curso ?? '-'}`, margin, yPos);
  yPos += 7;
  doc.text(`Turma: ${data.aluno.turma ?? '-'}`, margin, yPos);
  yPos += 7;
  const isSecFicha = data.instituicao?.tipoAcademico === 'SECUNDARIO';
  doc.text(isSecFicha ? `Classe: ${data.aluno.classeFrequencia ?? '-'}` : `Ano: ${sanitizeAnoFrequencia(data.aluno.anoFrequencia) ?? '-'}`, margin, yPos);
  yPos += 7;
  if (data.aluno.statusAluno) {
    doc.text(`Status: ${data.aluno.statusAluno}`, margin, yPos);
    yPos += 7;
  }

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

// Matrícula Receipt Data Interface
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
    numeroId?: string | null; // Nº estudante (identidade única)
    bi?: string | null;
    email?: string | null;
  };
  matricula: {
    curso: string;
    turma: string;
    turno?: string | null; // Período: Manhã, Tarde ou Noite
    disciplina: string;
    disciplinas?: string[];
    ano: number;
    semestre: string;
    dataMatricula: string;
    reciboNumero: string;
    anoFrequencia?: string | null; // Superior: "1º Ano", "2º Ano"
    classeFrequencia?: string | null; // Secundário: "10ª Classe"
    anoLetivoNumero?: number | null;
    tipoAcademico?: 'SUPERIOR' | 'SECUNDARIO' | null;
  };
  /** Pagamento (opcional) - valores em AOA */
  pagamento?: {
    taxaMatricula?: number;
    mensalidade?: number;
    /** Seguro (opcional) - exibido na tabela de descrição */
    seguro?: number;
    /** Outros valores - exibido na tabela (mensalidade é mapeada aqui quando seguro não usado) */
    outros?: number;
    totalPago?: number;
    formaPagamento?: string;
    /** Nº da transação (se aplicável) */
    numeroTransacao?: string | null;
  } | null;
  /** Encarregado de educação (secundário) */
  encarregado?: string | null;
  operador?: string | null;
  /** Observações no recibo */
  observacoes?: string | null;
}

/** Extrai número público do aluno (obrigatório, único e imutável) */
export const getNumeroPublicoAluno = (aluno: Record<string, unknown> | null | undefined): string | null => {
  if (!aluno) return null;
  const v = (
    aluno.numeroId ??
    aluno.numeroIdentificacaoPublica ??
    aluno.numero_identificacao_publica ??
    (aluno as { numeroEstudante?: string })?.numeroEstudante
  ) as string | null | undefined;
  if (v == null || String(v).trim() === '') return null;
  const inv = ['', 'n/d', 'n/a', 'nao informado', 'null', 'undefined'];
  return inv.includes(String(v).trim().toLowerCase()) ? null : String(v).trim();
};

/** Extrai dados da instituição para recibo (multi-tenant, prioriza dados da matrícula) */
export const getInstituicaoRecibo = (
  source: { turma?: { instituicao?: any }; disciplina?: { curso?: { instituicao?: any } } } | null,
  fallback: { config?: any; instituicao?: any } | null
): { nome: string; logoUrl?: string | null; email?: string | null; telefone?: string | null; endereco?: string | null } => {
  const inst = source?.turma?.instituicao || source?.disciplina?.curso?.instituicao;
  const cfg = inst?.configuracao;
  const c = fallback?.config;
  const i = fallback?.instituicao;
  return {
    nome: (cfg?.nomeInstituicao || inst?.nome || c?.nome_instituicao || i?.nome || '').trim() || '',
    logoUrl: cfg?.logoUrl ?? inst?.logoUrl ?? c?.logo_url ?? i?.logo_url ?? null,
    email: cfg?.email ?? inst?.emailContato ?? c?.email ?? i?.email_contato ?? null,
    telefone: cfg?.telefone ?? inst?.telefone ?? c?.telefone ?? i?.telefone ?? null,
    endereco: cfg?.endereco ?? inst?.endereco ?? c?.endereco ?? i?.endereco ?? null,
  };
};

// Generate matrícula receipt code
export const gerarCodigoMatricula = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `MAT${year}${month}${day}-${random}`;
};

// Valores inválidos para Nº (não exibir – o Nº é único e imutável durante o curso)
const NUMERO_INVALIDO = ['', 'n/d', 'n/a', 'nao informado', 'null', 'undefined'];

// Helper para garantir valores seguros no PDF de matrícula
const safeMatriculaData = (data: MatriculaReciboData) => {
  // Recibos: nº público obrigatório (único e imutável por estudante/funcionário)
  const numeroExibir = getNumeroPublicoAluno(data?.aluno as Record<string, unknown>) ?? null;
  const pag = data?.pagamento;
  const taxa = pag?.taxaMatricula ?? 0;
  const mensalidade = pag?.mensalidade ?? pag?.outros ?? pag?.seguro ?? 0;
  const total = pag?.totalPago ?? (taxa + mensalidade);
  return {
    instituicao: {
      nome: (data?.instituicao?.nome ?? '').trim() || '',
      endereco: data?.instituicao?.endereco ?? null,
      telefone: data?.instituicao?.telefone ?? null,
      email: data?.instituicao?.email ?? null,
    },
    aluno: { nome: data?.aluno?.nome ?? 'N/A', numeroId: numeroExibir },
    matricula: {
      curso: data?.matricula?.curso ?? 'N/A',
      turma: data?.matricula?.turma ?? 'N/A',
      turno: data?.matricula?.turno ?? null,
      disciplina: data?.matricula?.disciplina ?? '',
      disciplinas: data?.matricula?.disciplinas ?? [],
      ano: data?.matricula?.ano ?? new Date().getFullYear(),
      semestre: data?.matricula?.semestre ?? '',
      dataMatricula: data?.matricula?.dataMatricula ?? new Date().toISOString(),
      reciboNumero: data?.matricula?.reciboNumero ?? gerarCodigoMatricula(),
      anoFrequencia: data?.matricula?.anoFrequencia ?? null,
      classeFrequencia: data?.matricula?.classeFrequencia ?? null,
      anoLetivoNumero: data?.matricula?.anoLetivoNumero ?? null,
      tipoAcademico: data?.matricula?.tipoAcademico ?? 'SUPERIOR',
    },
    pagamento: {
      taxaMatricula: taxa,
      mensalidade,
      seguro: pag?.seguro ?? 0,
      outros: pag?.outros ?? 0,
      totalPago: total,
      formaPagamento: pag?.formaPagamento ?? '-',
      numeroTransacao: pag?.numeroTransacao ?? null,
    },
    encarregado: data?.encarregado ?? null,
    operador: data?.operador ?? null,
    observacoes: data?.observacoes ?? null,
  };
};

// Formato de data/hora compatível com todos os browsers
const formatDateTime = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

// Formas de pagamento do modelo A4 (com checkboxes)
const FORMAS_PAGAMENTO_A4 = ['Dinheiro', 'Transferência Bancária', 'Multicaixa', 'Referência Bancária'] as const;

// A4 Format Matrícula Receipt PDF – Layout conforme especificação
export const gerarMatriculaReciboA4PDF = async (data: MatriculaReciboData): Promise<Blob> => {
  if (!data) throw new Error('Dados da matrícula não fornecidos');
  const safe = safeMatriculaData(data);
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 25;
  let yPos = 18;

  const isSec = safe.matricula.tipoAcademico === 'SECUNDARIO';
  const anoCalendario = safe.matricula.anoLetivoNumero != null && safe.matricula.anoLetivoNumero > 2000
    ? safe.matricula.anoLetivoNumero
    : new Date().getFullYear();
  const anoLetivoFormat = isSec ? String(anoCalendario) : `${anoCalendario}/${anoCalendario + 1}`;

  const drawLine = () => {
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 6;
  };

  // Logo (opcional)
  if (data.instituicao?.logoUrl) {
    try {
      const imgW = 40;
      const imgH = 25;
      doc.addImage(data.instituicao.logoUrl, 'PNG', pageWidth / 2 - imgW / 2, yPos, imgW, imgH);
      yPos += imgH + 4;
    } catch {
      yPos += 2;
    }
  }

  // Nome da instituição
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(safe.instituicao.nome || '', pageWidth / 2, yPos, { align: 'center' });
  yPos += 6;

  // Endereço, Tel, Email
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const endereco = safe.instituicao.endereco || data.instituicao?.endereco || '';
  const telefone = safe.instituicao.telefone || data.instituicao?.telefone || '';
  const email = safe.instituicao.email || data.instituicao?.email || '';
  doc.text(`Endereço: ${endereco || '________________________________________'}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 5;
  doc.text(`Tel: ${telefone || '___________________'}  Email: ${email || '____________________'}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 5;
  doc.text(`Ano Letivo: ${anoLetivoFormat}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 8;

  drawLine();

  // Título RECIBO DE MATRÍCULA
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('RECIBO DE MATRÍCULA', pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Recibo Nº: ${safe.matricula.reciboNumero}`, margin, yPos);
  yPos += 5;
  doc.text(`Data de Emissão: ${formatDateShort(safe.matricula.dataMatricula)}`, margin, yPos);
  doc.text(`Operador: ${safe.operador || '___________________________'}`, pageWidth - margin, yPos, { align: 'right' });
  yPos += 8;

  drawLine();

  // DADOS DO ESTUDANTE
  doc.setFont('helvetica', 'bold');
  doc.text('DADOS DO ESTUDANTE', margin, yPos);
  yPos += 8;

  doc.setFont('helvetica', 'normal');
  doc.text(`Nome Completo: ${safe.aluno.nome}`, margin, yPos);
  yPos += 6;
  doc.text(`Nº: ${safe.aluno.numeroId || '-'}`, margin, yPos);
  yPos += 6;

  doc.text(`Curso: ${safe.matricula.curso}`, margin, yPos);
  yPos += 6;
  // Secundário: Classe/Ano. Superior: Ano (sem Classe)
  if (isSec) {
    doc.text(`Classe/Ano: ${safe.matricula.classeFrequencia || '-'}`, margin, yPos);
  } else {
    doc.text(`Ano: ${sanitizeAnoFrequencia(safe.matricula.anoFrequencia) || '-'}`, margin, yPos);
  }
  yPos += 6;

  doc.text(`Turma: ${safe.matricula.turma}`, margin, yPos);
  yPos += 6;
  doc.text(`Turno: ${safe.matricula.turno || '-'}`, margin, yPos);
  yPos += 8;

  drawLine();

  // DESCRIÇÃO DO PAGAMENTO (tabela)
  doc.setFont('helvetica', 'bold');
  doc.text('DESCRIÇÃO DO PAGAMENTO', margin, yPos);
  yPos += 8;

  const taxa = safe.pagamento?.taxaMatricula ?? 0;
  const mensalidade = safe.pagamento?.mensalidade ?? safe.pagamento?.outros ?? safe.pagamento?.seguro ?? 0;
  const total = safe.pagamento?.totalPago ?? (taxa + mensalidade);
  const colDesc = margin + 8;
  const colVal = pageWidth - margin - 45;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('| Nº | Descrição', margin, yPos);
  doc.text('Valor (Kz)', colVal, yPos, { align: 'right' });
  yPos += 5;
  doc.text('|----|------------------------------|-------------------|', margin, yPos);
  yPos += 5;
  doc.text('| 01 | Taxa de Matrícula', colDesc, yPos);
  doc.text(formatValorAO(taxa), colVal, yPos, { align: 'right' });
  yPos += 6;
  doc.text('| 02 | Mensalidade', colDesc, yPos);
  doc.text(formatValorAO(mensalidade), colVal, yPos, { align: 'right' });
  yPos += 8;
  doc.setFont('helvetica', 'bold');
  doc.text('|    | TOTAL PAGO', colDesc, yPos);
  doc.text(formatValorAO(total), colVal, yPos, { align: 'right' });
  yPos += 10;

  drawLine();

  // FORMA DE PAGAMENTO (checkboxes)
  doc.setFont('helvetica', 'bold');
  doc.text('FORMA DE PAGAMENTO', margin, yPos);
  yPos += 7;

  const forma = (safe.pagamento?.formaPagamento ?? '').toLowerCase();
  const matchForma = (k: string) => forma.includes(k) || (k === 'transferência' && forma.includes('transferencia')) || (k === 'referência' && forma.includes('referencia'));
  doc.setFont('helvetica', 'normal');
  const boxX = margin;
  doc.text(matchForma('dinheiro') ? '( X )' : '(   )', boxX, yPos);
  doc.text('Dinheiro', boxX + 10, yPos);
  doc.text(matchForma('transferência') ? '( X )' : '(   )', boxX + 50, yPos);
  doc.text('Transferência Bancária', boxX + 60, yPos);
  yPos += 6;
  doc.text(matchForma('multicaixa') ? '( X )' : '(   )', boxX, yPos);
  doc.text('Multicaixa', boxX + 10, yPos);
  doc.text(matchForma('referência') ? '( X )' : '(   )', boxX + 50, yPos);
  doc.text('Referência Bancária', boxX + 60, yPos);
  yPos += 10;

  drawLine();

  // OBSERVAÇÕES
  doc.setFont('helvetica', 'bold');
  doc.text('OBSERVAÇÕES', margin, yPos);
  yPos += 7;
  doc.setFont('helvetica', 'normal');
  const obs = safe.observacoes || '';
  if (obs) {
    doc.text(obs, margin, yPos);
    yPos += 6;
  } else {
    doc.text('____________________________________________________________________________________', margin, yPos);
    yPos += 6;
  }
  doc.text('____________________________________________________________________________________', margin, yPos);
  yPos += 10;

  drawLine();

  // Assinatura e Carimbo
  doc.text('Assinatura do Operador: ____________________________', margin, yPos);
  yPos += 8;
  doc.setFont('helvetica', 'bold');
  doc.text('Carimbo da Instituição', pageWidth / 2, yPos, { align: 'center' });
  yPos += 12;

  drawLine();

  // Rodapé
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Este recibo confirma a matrícula do estudante para o ano letivo acima indicado.', pageWidth / 2, yPos, { align: 'center' });
  yPos += 5;
  doc.text('Documento emitido eletronicamente pelo sistema de gestão académica.', pageWidth / 2, yPos, { align: 'center' });

  return doc.output('blob');
};

// Thermal Printer Format Matrícula Receipt PDF (80mm width) – layout profissional
export const gerarMatriculaReciboTermicoPDF = async (data: MatriculaReciboData): Promise<Blob> => {
  if (!data) throw new Error('Dados da matrícula não fornecidos');
  const safe = safeMatriculaData(data);
  const pageWidth = 80;
  const margin = 4;
  const maxChars = Math.floor((pageWidth - margin * 2) / 1.5);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [80, 400] });
  let yPos = 6;

  const isSec = safe.matricula.tipoAcademico === 'SECUNDARIO';
  const anoCalendario = safe.matricula.anoLetivoNumero != null && safe.matricula.anoLetivoNumero > 2000
    ? safe.matricula.anoLetivoNumero
    : new Date().getFullYear();
  const anoLetivoFormat = isSec ? String(anoCalendario) : `${anoCalendario}/${anoCalendario + 1}`;
  const trunc = (s: string, n: number) => (s || '').substring(0, n);

  const sep = () => {
    doc.setDrawColor(0, 0, 0);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 4;
  };

  // Logo (se couber)
  if (data.instituicao?.logoUrl) {
    try {
      doc.addImage(data.instituicao.logoUrl, 'PNG', pageWidth / 2 - 12, yPos, 24, 15);
      yPos += 18;
    } catch {
      yPos += 2;
    }
  }

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  const instNome = doc.splitTextToSize(String(safe.instituicao.nome || ''), pageWidth - margin * 2);
  instNome.forEach((line: string) => {
    doc.text(line, pageWidth / 2, yPos, { align: 'center' });
    yPos += 4;
  });
  yPos += 2;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(`Ano Letivo: ${anoLetivoFormat}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 6;

  sep();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('RECIBO DE MATRÍCULA', pageWidth / 2, yPos, { align: 'center' });
  yPos += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(`Nº: ${safe.matricula.reciboNumero}`, margin, yPos);
  yPos += 4;
  doc.text(`Data: ${formatDateShort(safe.matricula.dataMatricula)}`, margin, yPos);
  doc.text(`Op: ${trunc(safe.operador || '-', 30)}`, margin, yPos + 4);
  yPos += 10;

  sep();

  doc.setFont('helvetica', 'bold');
  doc.text('DADOS DO ESTUDANTE', margin, yPos);
  yPos += 5;
  doc.setFont('helvetica', 'normal');
  doc.text(`Nome: ${trunc(safe.aluno.nome || '', 42)}`, margin, yPos);
  yPos += 4;
  doc.text(`Nº: ${trunc(safe.aluno.numeroId || '-', 28)}`, margin, yPos);
  yPos += 4;
  doc.text(`Curso: ${trunc(safe.matricula.curso || '', 42)}`, margin, yPos);
  yPos += 4;
  if (isSec) {
    doc.text(`Classe/Ano: ${trunc(safe.matricula.classeFrequencia || '-', 36)}`, margin, yPos);
  } else {
    doc.text(`Ano: ${trunc(sanitizeAnoFrequencia(safe.matricula.anoFrequencia) || '-', 36)}`, margin, yPos);
  }
  yPos += 4;
  doc.text(`Turma: ${trunc(safe.matricula.turma || '', 42)}`, margin, yPos);
  yPos += 4;
  doc.text(`Turno: ${trunc(safe.matricula.turno || '-', 36)}`, margin, yPos);
  yPos += 6;

  sep();

  doc.setFont('helvetica', 'bold');
  doc.text('PAGAMENTO (Kz)', margin, yPos);
  yPos += 5;
  const taxa = safe.pagamento?.taxaMatricula ?? 0;
  const mensalidade = safe.pagamento?.mensalidade ?? safe.pagamento?.outros ?? safe.pagamento?.seguro ?? 0;
  const total = safe.pagamento?.totalPago ?? (taxa + mensalidade);
  const fmt = (v: number) => formatValorAO(v);
  doc.setFont('helvetica', 'normal');
  doc.text(`01 Taxa Matr: ${fmt(taxa)}`, margin, yPos);
  yPos += 4;
  doc.text(`02 Mensalidade: ${fmt(mensalidade)}`, margin, yPos);
  yPos += 4;
  doc.setFont('helvetica', 'bold');
  doc.text(`TOTAL: ${fmt(total)}`, margin, yPos);
  yPos += 6;
  doc.setFont('helvetica', 'normal');
  doc.text(`Forma: ${trunc(safe.pagamento?.formaPagamento ?? '-', 42)}`, margin, yPos);
  yPos += 8;

  sep();

  if (safe.observacoes) {
    doc.text(`Obs: ${trunc(safe.observacoes, 42)}`, margin, yPos);
    yPos += 6;
  }

  sep();
  doc.setFontSize(6);
  doc.text('Assinatura e Carimbo', pageWidth / 2, yPos, { align: 'center' });
  yPos += 8;
  doc.setFontSize(5);
  doc.text('Documento emitido eletronicamente.', pageWidth / 2, yPos, { align: 'center' });

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
  link.download = `${String(data.tipo ?? "").toLowerCase()}-licenca-${data.numeroDocumento}.pdf`;
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
