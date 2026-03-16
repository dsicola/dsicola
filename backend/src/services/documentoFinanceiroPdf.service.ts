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

  // Hash para texto fiscal AGT: [4 primeiros chars do hash ou hashControl]
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
    const nif = config?.nif || '';

    // Selo ANULADO se estornado
    if (isEstornado) {
      pdfDoc.save();
      pdfDoc.rect(0, 0, 595, 842).fillOpacity(0.08).fill('#ff0000');
      pdfDoc.restore();
      pdfDoc.fontSize(48)
        .font('Helvetica-Bold')
        .fillColor('#cc0000')
        .text('ANULADO', 0, 300, { width: 595, align: 'center' });
      pdfDoc.fillColor('#000000');
    }

    // Cabeçalho
    pdfDoc.fontSize(16).font('Helvetica-Bold').text(nomeInst, { align: 'center' });
    if (nif) pdfDoc.fontSize(9).font('Helvetica').text(`NIF: ${nif}`, { align: 'center' });
    if (endereco) pdfDoc.fontSize(9).text(endereco, { align: 'center' });
    if (cidade || config?.codigoPostalFiscal) {
      pdfDoc.text([cidade, config?.codigoPostalFiscal].filter(Boolean).join(' - '), { align: 'center' });
    }
    pdfDoc.moveDown(2);

    // Tipo e número
    pdfDoc.fontSize(14).font('Helvetica-Bold').text(TIPO_LABEL[doc.tipoDocumento] || doc.tipoDocumento, { align: 'center' });
    pdfDoc.fontSize(11).font('Helvetica').text(`Nº ${doc.numeroDocumento}`, { align: 'center' });
    pdfDoc.moveDown(1);

    const dataStr = new Date(doc.dataDocumento).toLocaleDateString('pt-AO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    pdfDoc.text(`Data: ${dataStr}`, { align: 'right' });
    pdfDoc.moveDown(1);

    // Cliente
    if (entidade) {
      pdfDoc.fontSize(10).font('Helvetica-Bold').text('Cliente:', { continued: false });
      pdfDoc.font('Helvetica').text(entidade.nomeCompleto || '-');
      if (entidade.numeroIdentificacao) pdfDoc.text(`NIF/BI: ${entidade.numeroIdentificacao}`);
      if (entidade.email) pdfDoc.text(`Email: ${entidade.email}`);
      pdfDoc.moveDown(1);
    }

    // Tabela de linhas
    pdfDoc.fontSize(10).font('Helvetica-Bold');
    const tableTop = pdfDoc.y;
    pdfDoc.text('Descrição', 50, tableTop);
    pdfDoc.text('Qtd', 320, tableTop);
    pdfDoc.text('Preço Unit.', 370, tableTop);
    pdfDoc.text('Total', 470, tableTop);
    pdfDoc.moveDown(0.5);

    let y = pdfDoc.y;
    pdfDoc.font('Helvetica');

    for (const linha of doc.linhas) {
      const desc = String(linha.descricao || 'Item').slice(0, 50);
      const qtd = Number(linha.quantidade);
      const preco = Number(linha.precoUnitario);
      const total = Number(linha.valorTotal);
      pdfDoc.text(desc, 50, y);
      pdfDoc.text(qtd.toFixed(2), 320, y);
      pdfDoc.text(formatValor(preco, moeda), 370, y);
      pdfDoc.text(formatValor(total, moeda), 470, y);
      y += 18;
    }

    pdfDoc.y = y + 10;

    // Totais
    if (valorDesconto > 0) {
      pdfDoc.text(`Desconto: ${formatValor(-valorDesconto, moeda)}`, { align: 'right' });
      pdfDoc.moveDown(0.5);
    }
    pdfDoc.font('Helvetica-Bold').text(`Total: ${formatValor(valorTotal, moeda)}`, { align: 'right' });
    pdfDoc.font('Helvetica');
    pdfDoc.moveDown(2);

    // Valor por extenso
    const extenso = valorPorExtenso(Math.abs(valorTotal), { moeda, locale: 'pt-AO' });
    pdfDoc.fontSize(9).text(`Valor por extenso: ${extenso}`, { align: 'left', width: 495 });
    pdfDoc.moveDown(2);

    // Rodapé - texto fiscal AGT obrigatório
    const pageH = (pdfDoc as { page?: { height?: number } }).page?.height ?? 842;
    pdfDoc.strokeColor('#cccccc');
    pdfDoc.moveTo(50, pageH - 80).lineTo(545, pageH - 80).stroke();
    pdfDoc.fontSize(8).fillColor(80, 80, 80);
    pdfDoc.y = pageH - 65;
    pdfDoc.text(`${hash4}-Processado por programa válido n31.1/AGT20`, { width: 595, align: 'center' });
    pdfDoc.fillColor('#000000');
    pdfDoc.fontSize(7).text(`Documento gerado em ${new Date().toLocaleString('pt-AO')}`, { width: 595, align: 'center' });

    pdfDoc.end();
  });

  return Buffer.concat(chunks);
}
