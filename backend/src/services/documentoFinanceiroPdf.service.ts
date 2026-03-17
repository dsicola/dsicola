/**
 * Geração de PDF para DocumentoFinanceiro (FT, NC, PF, GR)
 * Conformidade AGT: texto fiscal obrigatório [4 chars hash]-Processado por programa válido n31.1/AGT20
 */
import PDFDocument from 'pdfkit';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { valorPorExtenso } from '../utils/valorPorExtenso.js';

const TIPO_LABEL: Record<string, string> = {
  FT: 'FATURA',
  NC: 'NOTA DE CRÉDITO',
  PF: 'PRÓ-FORMA / ORÇAMENTO',
  GR: 'GUIA DE REMESSA',
  RC: 'RECIBO',
};

const PAGE_WIDTH = 595;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

// Colunas da tabela: x, largura
const COL = {
  DESCRICAO: { x: 50, width: 250 },
  QTD: { x: 305, width: 50 },
  PRECO: { x: 360, width: 95 },
  TOTAL: { x: 460, width: 85 },
};

function formatValor(val: number, moeda: string): string {
  return new Intl.NumberFormat('pt-AO', {
    style: 'currency',
    currency: moeda || 'AOA',
    minimumFractionDigits: 2,
  }).format(val);
}

/**
 * Gera PDF do DocumentoFinanceiro com texto fiscal AGT obrigatório
 */
export async function gerarPdfDocumentoFinanceiro(
  documentoId: string,
  instituicaoId: string
): Promise<Buffer> {
  const doc = await prisma.documentoFinanceiro.findFirst({
    where: { id: documentoId, instituicaoId },
    include: {
      linhas: true,
      instituicao: {
        select: { nome: true, endereco: true, emailContato: true, telefone: true },
      },
    },
  });

  if (!doc) {
    throw new AppError('Documento não encontrado', 404);
  }

  const config = await prisma.configuracaoInstituicao.findFirst({
    where: { instituicaoId },
    select: { nif: true, nomeFiscal: true, enderecoFiscal: true, cidadeFiscal: true, codigoPostalFiscal: true },
  });

  let entidade: { nomeCompleto?: string; email?: string; numeroIdentificacao?: string } | null = null;
  if (doc.entidadeId) {
    const user = await prisma.user.findUnique({
      where: { id: doc.entidadeId },
      select: { nomeCompleto: true, email: true, numeroIdentificacao: true },
    });
    entidade = user
      ? {
          nomeCompleto: user.nomeCompleto ?? undefined,
          email: user.email ?? undefined,
          numeroIdentificacao: user.numeroIdentificacao ?? undefined,
        }
      : null;
  }

  const moeda = (doc.moeda || 'AOA').trim().toUpperCase();
  const valorTotal = Number(doc.valorTotal);
  const valorDesconto = Number(doc.valorDesconto ?? 0);
  const isEstornado = doc.estado === 'ESTORNADO';

  const hashOuControl = (doc.hash || doc.hashControl || '').trim();
  const hash4 = hashOuControl.slice(0, 4).toUpperCase() || '0000';

  const pdfDoc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks: Buffer[] = [];
  pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk));

  await new Promise<void>((resolve, reject) => {
    pdfDoc.on('end', resolve);
    pdfDoc.on('error', reject);

    const nomeInst = config?.nomeFiscal || doc.instituicao?.nome || 'Instituição';
    const endereco = config?.enderecoFiscal || doc.instituicao?.endereco || '';
    const cidade = config?.cidadeFiscal || '';
    const codigoPostal = config?.codigoPostalFiscal || '';
    const nif = config?.nif || '';
    const emailInst = doc.instituicao?.emailContato || '';
    const telefoneInst = doc.instituicao?.telefone || '';

    // ─── Selo ANULADO se estornado ───
    if (isEstornado) {
      pdfDoc.save();
      pdfDoc.rect(0, 0, PAGE_WIDTH, 842).fillOpacity(0.08).fill('#ff0000');
      pdfDoc.restore();
      pdfDoc.fontSize(48)
        .font('Helvetica-Bold')
        .fillColor('#cc0000')
        .text('ANULADO', 0, 300, { width: PAGE_WIDTH, align: 'center' });
      pdfDoc.fillColor('#000000');
    }

    let y = 50;

    // ─── CABEÇALHO: Instituição ───
    pdfDoc.fontSize(18).font('Helvetica-Bold');
    pdfDoc.text(nomeInst.toUpperCase(), MARGIN, y, { width: CONTENT_WIDTH, align: 'center' });
    y += 28;

    pdfDoc.fontSize(9).font('Helvetica');
    const linhasCabecalho: string[] = [];
    if (nif) linhasCabecalho.push(`NIF: ${nif}`);
    if (endereco) linhasCabecalho.push(endereco);
    const cidadeLinha = [cidade, codigoPostal].filter(Boolean).join(cidade && codigoPostal ? ' - ' : '');
    if (cidadeLinha) linhasCabecalho.push(cidadeLinha);
    if (emailInst || telefoneInst) {
      linhasCabecalho.push([telefoneInst, emailInst].filter(Boolean).join(' | '));
    }
    for (const linha of linhasCabecalho) {
      pdfDoc.text(linha, MARGIN, y, { width: CONTENT_WIDTH, align: 'center' });
      y += 14;
    }

    // Linha separadora
    y += 8;
    pdfDoc.strokeColor('#333333');
    pdfDoc.lineWidth(0.5);
    pdfDoc.moveTo(MARGIN, y).lineTo(PAGE_WIDTH - MARGIN, y).stroke();
    y += 20;

    // ─── TIPO E Nº DO DOCUMENTO ───
    const tipoDoc = TIPO_LABEL[doc.tipoDocumento] || doc.tipoDocumento;
    pdfDoc.fontSize(16).font('Helvetica-Bold');
    pdfDoc.text(tipoDoc, MARGIN, y, { width: CONTENT_WIDTH, align: 'center' });
    y += 22;

    pdfDoc.fontSize(11).font('Helvetica');
    const dataStr = new Date(doc.dataDocumento).toLocaleDateString('pt-AO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    pdfDoc.text(`Nº ${doc.numeroDocumento}`, MARGIN, y);
    pdfDoc.text(`Data: ${dataStr}`, MARGIN, y, { width: CONTENT_WIDTH, align: 'right' });
    y += 28;

    // ─── DADOS DO CLIENTE ───
    if (entidade) {
      pdfDoc.fontSize(10).font('Helvetica-Bold');
      pdfDoc.text('DADOS DO CLIENTE', MARGIN, y);
      y += 16;

      pdfDoc.font('Helvetica').fontSize(10);
      pdfDoc.text(`Nome: ${entidade.nomeCompleto || '-'}`, MARGIN, y);
      y += 14;
      if (entidade.numeroIdentificacao) {
        pdfDoc.text(`NIF/BI: ${entidade.numeroIdentificacao}`, MARGIN, y);
        y += 14;
      }
      if (entidade.email) {
        pdfDoc.text(`Email: ${entidade.email}`, MARGIN, y);
        y += 14;
      }
      y += 12;
    }

    // ─── TABELA DE LINHAS ───
    const tableTop = y;

    // Linha superior da tabela
    pdfDoc.strokeColor('#333333');
    pdfDoc.moveTo(MARGIN, tableTop).lineTo(PAGE_WIDTH - MARGIN, tableTop).stroke();
    y += 12;

    // Cabeçalho da tabela
    pdfDoc.fontSize(10).font('Helvetica-Bold');
    pdfDoc.text('Descrição', COL.DESCRICAO.x, y);
    pdfDoc.text('Qtd', COL.QTD.x, y, { width: COL.QTD.width, align: 'right' });
    pdfDoc.text('Preço Unit.', COL.PRECO.x, y, { width: COL.PRECO.width, align: 'right' });
    pdfDoc.text('Total', COL.TOTAL.x, y, { width: COL.TOTAL.width, align: 'right' });
    y += 16;

    // Linha sob o cabeçalho
    pdfDoc.strokeColor('#333333');
    pdfDoc.moveTo(MARGIN, y).lineTo(PAGE_WIDTH - MARGIN, y).stroke();
    y += 12;

    pdfDoc.font('Helvetica').fontSize(10);
    const ROW_HEIGHT = 20;

    for (const linha of doc.linhas) {
      const desc = String(linha.descricao || 'Item').slice(0, 60);
      const qtd = Number(linha.quantidade);
      const preco = Number(linha.precoUnitario);
      const total = Number(linha.valorTotal);

      const descHeight = Math.max(ROW_HEIGHT, pdfDoc.heightOfString(desc, { width: COL.DESCRICAO.width }));
      pdfDoc.text(desc, COL.DESCRICAO.x, y, { width: COL.DESCRICAO.width });
      pdfDoc.text(qtd.toFixed(2), COL.QTD.x, y, { width: COL.QTD.width, align: 'right' });
      pdfDoc.text(formatValor(preco, moeda), COL.PRECO.x, y, { width: COL.PRECO.width, align: 'right' });
      pdfDoc.text(formatValor(total, moeda), COL.TOTAL.x, y, { width: COL.TOTAL.width, align: 'right' });

      y += descHeight + 4;
    }

    const tableBottom = y;

    // Bordas da tabela: inferior + verticais
    pdfDoc.moveTo(MARGIN, tableBottom).lineTo(PAGE_WIDTH - MARGIN, tableBottom).stroke();
    const colX = [MARGIN, COL.QTD.x, COL.PRECO.x, COL.TOTAL.x, PAGE_WIDTH - MARGIN];
    for (const x of colX) {
      pdfDoc.moveTo(x, tableTop).lineTo(x, tableBottom).stroke();
    }
    y += 16;

    // ─── TOTAIS ───
    if (valorDesconto > 0) {
      pdfDoc.font('Helvetica').fontSize(10);
      pdfDoc.text(`Desconto: ${formatValor(-valorDesconto, moeda)}`, MARGIN, y, { width: CONTENT_WIDTH, align: 'right' });
      y += 16;
    }
    pdfDoc.font('Helvetica-Bold').fontSize(12);
    pdfDoc.text(`TOTAL: ${formatValor(valorTotal, moeda)}`, MARGIN, y, { width: CONTENT_WIDTH, align: 'right' });
    y += 24;

    // ─── VALOR POR EXTENSO ───
    const extenso = valorPorExtenso(Math.abs(valorTotal), { moeda, locale: 'pt-AO' });
    pdfDoc.fontSize(9).font('Helvetica');
    pdfDoc.text('Valor por extenso:', MARGIN, y);
    y += 12;
    pdfDoc.text(extenso, MARGIN, y, { width: CONTENT_WIDTH });
    y += 30;

    // ─── RODAPÉ ───
    const pageH = (pdfDoc as { page?: { height?: number } }).page?.height ?? 842;
    pdfDoc.strokeColor('#cccccc');
    pdfDoc.moveTo(MARGIN, pageH - 90).lineTo(PAGE_WIDTH - MARGIN, pageH - 90).stroke();
    pdfDoc.fontSize(8).fillColor('rgb(80, 80, 80)');
    pdfDoc.y = pageH - 72;
    pdfDoc.text(`${hash4}-Processado por programa válido n31.1/AGT20`, { width: PAGE_WIDTH, align: 'center' });
    pdfDoc.fontSize(7).text(`Documento gerado em ${new Date().toLocaleString('pt-AO')}`, { width: PAGE_WIDTH, align: 'center' });
    pdfDoc.fillColor('#000000');

    pdfDoc.end();
  });

  return Buffer.concat(chunks);
}
