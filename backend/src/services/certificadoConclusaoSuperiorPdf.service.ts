import PDFDocument from 'pdfkit';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import type { ConfiguracaoInstituicao, Instituicao } from '@prisma/client';
import { verificarRegistoAcademicoMinimo } from './conclusaoCurso.service.js';
import {
  fmtDataPt,
  fmtMedia,
  loadCarimboCertificadoSuperiorPdf,
  loadLogoBuffer,
} from './certificadoConclusaoPdfHelpers.js';

/**
 * PDF de certificado de conclusão — Ensino Superior (paridade com Secundário: logo, título, carimbo, assinaturas, textos da config).
 * Exige conclusão CONCLUIDA, registo de colação de grau e curso (não aplica a conclusões só por classe).
 */
export async function gerarCertificadoConclusaoSuperiorPdfPorConclusaoId(
  conclusaoCursoId: string,
  instituicaoId: string
): Promise<{ buffer: Buffer; refDocumento: string }> {
  const instituicao = await prisma.instituicao.findUnique({
    where: { id: instituicaoId },
    include: { configuracao: true },
  });

  if (!instituicao) {
    throw new AppError('Instituição não encontrada', 404);
  }

  if (instituicao.tipoAcademico === 'SECUNDARIO') {
    throw new AppError(
      'Este PDF destina-se ao Ensino Superior. Para Ensino Secundário utilize o certificado da conclusão por classe.',
      400
    );
  }

  const conclusao = await prisma.conclusaoCurso.findFirst({
    where: { id: conclusaoCursoId, instituicaoId, status: 'CONCLUIDO' },
    include: {
      aluno: { select: { nomeCompleto: true } },
      curso: { select: { nome: true, duracao: true, grau: true } },
      colacaoGrau: true,
    },
  });

  if (!conclusao) {
    throw new AppError('Conclusão não encontrada ou o curso ainda não foi concluído oficialmente.', 404);
  }

  if (!conclusao.cursoId || !conclusao.curso) {
    throw new AppError(
      'Certificado de Ensino Superior requer conclusão vinculada a um curso. Verifique o tipo de instituição e o registo.',
      400
    );
  }

  if (!conclusao.colacaoGrau) {
    throw new AppError(
      'Registe primeiro a colação de grau para gerar o certificado em PDF (Ensino Superior).',
      400
    );
  }

  const colacao = conclusao.colacaoGrau;

  const reg = await verificarRegistoAcademicoMinimo(conclusao.alunoId, instituicaoId);
  if (!reg.ok) {
    throw new AppError(reg.mensagem ?? 'Sem registo académico mínimo para o certificado.', 400);
  }

  const cfg = instituicao.configuracao;
  const nomeInstituicao =
    (cfg?.nomeInstituicao && cfg.nomeInstituicao.trim()) || instituicao.nome || 'Instituição';
  const titulo = (cfg?.tituloCertificadoSuperior?.trim() || 'CERTIFICADO DE CONCLUSÃO').toUpperCase();
  const labelMedia =
    (cfg?.labelMediaFinalCertificado?.trim() || 'Média final').toLowerCase();
  const labelValores = (cfg?.labelValoresCertificado?.trim() || 'valores').toLowerCase();

  const nomeAluno = (conclusao.aluno.nomeCompleto || '—').toUpperCase();
  const nomeCurso = conclusao.curso.nome || '—';
  const mediaTxt = fmtMedia(conclusao.mediaGeral);
  const dataConclusao = fmtDataPt(new Date(conclusao.dataConclusao));
  const dataColacao = fmtDataPt(new Date(colacao.dataColacao));

  const refDocumento =
    conclusao.numeroAto?.trim() ||
    colacao.numeroAta?.trim() ||
    `REF-${conclusao.id.replace(/-/g, '').slice(0, 12).toUpperCase()}`;

  const cargo1 = cfg?.cargoAssinatura1?.trim() || 'O CHEFE DO DAA';
  const nome1 = cfg?.nomeChefeDaa?.trim() || '_________________________';
  const cargo2 = cfg?.cargoAssinatura2?.trim() || 'O DIRECTOR GERAL';
  const nome2 = cfg?.nomeDirectorGeral?.trim() || '_________________________';

  const [logoBuf, carimboBuf] = await Promise.all([
    loadLogoBuffer(instituicao as Instituicao & { configuracao: ConfiguracaoInstituicao | null }),
    loadCarimboCertificadoSuperiorPdf(cfg),
  ]);

  if (!logoBuf?.length) {
    throw new AppError(
      'Logótipo obrigatório para emitir o certificado em PDF. Configure o logótipo em Configurações da instituição.',
      400
    );
  }
  if (!carimboBuf?.length) {
    throw new AppError(
      'Carimbo obrigatório: em Configurações, carregue o carimbo (Ensino Superior) ou a imagem de fundo dos documentos.',
      400
    );
  }

  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: 48,
    info: {
      Title: titulo,
      Author: nomeInstituicao,
      Creator: 'DSICOLA',
    },
  });

  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));

  const situacaoTxt =
    conclusao.status === 'CONCLUIDO'
      ? 'Concluído'
      : conclusao.status === 'VALIDADO'
        ? 'Validado'
        : String(conclusao.status).replace(/_/g, ' ');

  const fecho =
    cfg?.textoFechoCertificado?.trim() ||
    'E por ser verdade, e me ter sido solicitado, mando passar o presente certificado que assino e autentico com carimbo em uso nesta instituição de ensino superior.';

  await new Promise<void>((resolve, reject) => {
    doc.on('end', resolve);
    doc.on('error', reject);

    const W = doc.page.width;
    const H = doc.page.height;

    doc.lineWidth(2).strokeColor('#1a1a1a');
    doc.rect(24, 24, W - 48, H - 48).stroke();
    doc.lineWidth(0.6);
    doc.rect(30, 30, W - 60, H - 60).stroke();
    doc.strokeColor('#000000');

    const headerY = 32;
    try {
      doc.image(logoBuf, 48, headerY, { width: 80, height: 80, fit: [80, 80] });
    } catch {
      throw new AppError(
        'O ficheiro de logótipo não pôde ser usado no PDF. Utilize PNG ou JPG válidos nas Configurações.',
        400
      );
    }

    let yTop = headerY;
    doc.font('Helvetica').fontSize(8).fillColor('#444');
    if (cfg?.ministerioSuperior?.trim()) {
      doc.text(cfg.ministerioSuperior.trim(), 0, yTop, { align: 'center', width: W });
      yTop += 11;
    }
    if (cfg?.decretoCriacao?.trim()) {
      doc.text(cfg.decretoCriacao.trim(), 0, yTop, { align: 'center', width: W });
      yTop += 11;
    }
    doc.fillColor('#000');

    doc.font('Helvetica-Bold').fontSize(18);
    doc.text(nomeInstituicao.toUpperCase(), 0, Math.max(yTop, headerY + 22), { align: 'center', width: W });

    let y = 118;
    doc.fontSize(21).font('Helvetica-Bold');
    doc.text(titulo, 0, y, { align: 'center', width: W, underline: true });
    doc.font('Helvetica');

    y += 40;
    doc.fontSize(13).text('Certificamos que', 0, y, { align: 'center', width: W });
    y += 22;
    doc.fontSize(18).font('Helvetica-Bold').text(nomeAluno, 0, y, { align: 'center', width: W });
    doc.font('Helvetica');
    y += 26;
    doc.fontSize(13).text('concluiu com êxito o curso de', 0, y, { align: 'center', width: W });
    y += 22;
    doc.fontSize(15).font('Helvetica-Bold').text(nomeCurso, 0, y, { align: 'center', width: W });
    doc.font('Helvetica');
    y += 26;
    const grauC = conclusao.curso?.grau?.trim();
    const durC = conclusao.curso?.duracao?.trim();
    if (grauC || durC) {
      const partes: string[] = [];
      if (grauC) partes.push(`Grau: ${grauC}`);
      if (durC) partes.push(`Duração nominal: ${durC}`);
      doc.fontSize(11).text(partes.join('  |  '), 0, y, { align: 'center', width: W });
      y += 18;
    }
    doc
      .fontSize(13)
      .text(`${labelMedia.charAt(0).toUpperCase() + labelMedia.slice(1)}: ${mediaTxt} ${labelValores}`, 0, y, {
        align: 'center',
        width: W,
      });

    y += 22;
    doc.fontSize(12).fillColor('#222');
    doc.text(`Situação: ${situacaoTxt}`, 0, y, { align: 'center', width: W });
    y += 22;
    doc.fontSize(11).fillColor('#333');
    doc.text(`Data de conclusão: ${dataConclusao}`, 0, y, { align: 'center', width: W });
    y += 16;
    doc.text(`Colação de grau: ${dataColacao}`, 0, y, { align: 'center', width: W });
    if (colacao.localColacao?.trim()) {
      y += 14;
      doc.text(`Local: ${colacao.localColacao.trim()}`, 0, y, { align: 'center', width: W });
    }
    y += 16;
    doc.text(
      `Documento n.º ${refDocumento}  |  Emitido em: ${fmtDataPt(new Date())}`,
      0,
      y,
      { align: 'center', width: W }
    );

    if (conclusao.notaTfc != null || conclusao.notaDefesa != null) {
      y += 18;
      const tfc = conclusao.notaTfc != null ? `TFC: ${fmtMedia(conclusao.notaTfc)}` : null;
      const def = conclusao.notaDefesa != null ? `Defesa: ${fmtMedia(conclusao.notaDefesa)}` : null;
      doc.fontSize(10).text([tfc, def].filter(Boolean).join('   |   '), 0, y, { align: 'center', width: W });
    }

    doc.fillColor('#000');
    y += 28;
    doc.fontSize(9).text(fecho, 72, y, { align: 'center', width: W - 144 });

    const assY = H - 130;
    const colW = (W - 96) / 2;
    doc.fontSize(10);
    doc.text('_____________________________', 48, assY, { width: colW, align: 'center' });
    doc.font('Helvetica-Bold').text(nome1, 48, assY + 14, { width: colW, align: 'center' });
    doc.font('Helvetica').fontSize(9).text(cargo1, 48, assY + 28, { width: colW, align: 'center' });

    doc.fontSize(10);
    doc.text('_____________________________', 48 + colW, assY, { width: colW, align: 'center' });
    doc.font('Helvetica-Bold').text(nome2, 48 + colW, assY + 14, { width: colW, align: 'center' });
    doc.font('Helvetica').fontSize(9).text(cargo2, 48 + colW, assY + 28, { width: colW, align: 'center' });

    try {
      const cw = 110;
      const ch = 110;
      const cx = W - cw - 52;
      const cy = H - ch - 108;
      doc.save();
      doc.opacity(0.5);
      doc.image(carimboBuf, cx, cy, { width: cw, height: ch, fit: [cw, ch] });
      doc.restore();
    } catch {
      throw new AppError(
        'O ficheiro de carimbo não pôde ser incluído no PDF. Utilize PNG ou JPG válidos (Configurações — carimbo Superior).',
        400
      );
    }

    if (cfg?.textoRodapeCertificado?.trim()) {
      doc.fontSize(8).fillColor('#555');
      doc.text(cfg.textoRodapeCertificado.trim(), 48, H - 52, { align: 'center', width: W - 96 });
    }
    doc.fontSize(8).fillColor('#555');
    doc.text(
      `Emitido em ${new Date().toLocaleString('pt-AO')} — Documento gerado pelo DSICOLA (Ensino Superior)`,
      48,
      H - 36,
      { align: 'center', width: W - 96 }
    );

    doc.end();
  });

  return { buffer: Buffer.concat(chunks), refDocumento };
}