import PDFDocument from 'pdfkit';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import type { ConfiguracaoInstituicao, Instituicao } from '@prisma/client';
import {
  fmtDataPt,
  fmtMedia,
  loadCarimboCertificadoSecundarioPdf,
  loadLogoBuffer,
} from './certificadoConclusaoPdfHelpers.js';
import { verificarRegistoAcademicoMinimo } from './conclusaoCurso.service.js';

/**
 * PDF institucional: certificado de conclusão (Ensino Secundário), após registo em `Certificado`.
 * Checklist institucional: nome, logótipo (obrigatório), título, aluno, curso/classe, média (valores),
 * data de conclusão, situação, n.º do certificado, assinaturas (Director / Secretário na config), carimbo (obrigatório).
 */
export async function gerarCertificadoConclusaoPdfPorConclusaoId(
  conclusaoCursoId: string,
  instituicaoId: string
): Promise<{ buffer: Buffer; numeroCertificado: string }> {
  const instituicao = await prisma.instituicao.findUnique({
    where: { id: instituicaoId },
    include: { configuracao: true },
  });

  if (!instituicao) {
    throw new AppError('Instituição não encontrada', 404);
  }

  if (instituicao.tipoAcademico === 'SUPERIOR') {
    throw new AppError(
      'Para Ensino Superior utilize o PDF de certificado vinculado à colação de grau (rota própria).',
      400
    );
  }

  const certificado = await prisma.certificado.findFirst({
    where: { conclusaoCursoId, instituicaoId },
    include: {
      conclusaoCurso: {
        include: {
          aluno: { select: { nomeCompleto: true } },
          curso: { select: { nome: true } },
          classe: { select: { nome: true } },
        },
      },
    },
  });

  if (!certificado) {
    throw new AppError(
      'Certificado não encontrado. Registre o certificado (número oficial, livro/folha) antes de gerar o PDF.',
      404
    );
  }

  const concl = certificado.conclusaoCurso;

  const regPdf = await verificarRegistoAcademicoMinimo(concl.alunoId, instituicaoId);
  if (!regPdf.ok) {
    throw new AppError(regPdf.mensagem ?? 'Sem registo académico mínimo para emitir o PDF.', 400);
  }

  if (!concl.classeId) {
    throw new AppError(
      'Este certificado secundário exige conclusão vinculada a uma classe.',
      400
    );
  }

  const { garantirCodigoVerificacaoCertificadoPorId } = await import(
    './certificadoConclusaoVerificacao.service.js'
  );
  const codigoVerif = await garantirCodigoVerificacaoCertificadoPorId(certificado.id);

  const cfg = instituicao.configuracao;
  const nomeInstituicao =
    (cfg?.nomeInstituicao && cfg.nomeInstituicao.trim()) || instituicao.nome || 'Instituição';
  const tituloRaw = cfg?.tituloCertificadoSecundario?.trim() || 'CERTIFICADO DE CONCLUSÃO';
  const titulo = tituloRaw.toUpperCase();
  const labelValores = (cfg?.labelValoresCertificado?.trim() || 'valores').toLowerCase();

  const nomeAluno = (concl.aluno.nomeCompleto || '—').toUpperCase();
  const cursoOuClasse = concl.curso?.nome || concl.classe?.nome || '—';
  const mediaTxt = fmtMedia(concl.mediaGeral);
  const dataConclusao = fmtDataPt(new Date(concl.dataConclusao));

  const cargo1 = cfg?.cargoAssinatura1Secundario?.trim() || 'O Director';
  const nome1 = cfg?.nomeAssinatura1Secundario?.trim() || '_________________________';
  const cargo2 = cfg?.cargoAssinatura2Secundario?.trim() || 'O Secretário';
  const nome2 = cfg?.nomeAssinatura2Secundario?.trim() || '_________________________';

  const [logoBuf, carimboBuf] = await Promise.all([
    loadLogoBuffer(instituicao as Instituicao & { configuracao: ConfiguracaoInstituicao | null }),
    loadCarimboCertificadoSecundarioPdf(cfg),
  ]);

  if (!logoBuf?.length) {
    throw new AppError(
      'Logótipo obrigatório para emitir o certificado em PDF. Configure o logótipo em Configurações da instituição (imagem institucional).',
      400
    );
  }
  if (!carimboBuf?.length) {
    throw new AppError(
      'Carimbo obrigatório para o PDF: em Configurações, carregue o carimbo do certificado (Ensino Secundário) ou a imagem de fundo dos documentos (compatível com selo).',
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

    const headerY = 36;
    try {
      doc.image(logoBuf, 48, headerY, { width: 80, height: 80, fit: [80, 80] });
    } catch {
      throw new AppError(
        'O ficheiro de logótipo não pôde ser usado no PDF. Utilize PNG ou JPG válidos nas Configurações.',
        400
      );
    }

    doc.font('Helvetica-Bold').fontSize(18);
    doc.text(nomeInstituicao.toUpperCase(), 0, headerY + 22, { align: 'center', width: W });

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
    doc.fontSize(15).font('Helvetica-Bold').text(cursoOuClasse, 0, y, { align: 'center', width: W });
    doc.font('Helvetica');
    y += 26;
    doc.fontSize(13).text(`com a média final de ${mediaTxt} ${labelValores}`, 0, y, { align: 'center', width: W });

    y += 22;
    doc.fontSize(12).fillColor('#222');
    const situacaoTxt =
      concl.status === 'CONCLUIDO'
        ? 'Concluído'
        : concl.status === 'VALIDADO'
          ? 'Validado'
          : String(concl.status).replace(/_/g, ' ');
    doc.text(`Situação: ${situacaoTxt}`, 0, y, { align: 'center', width: W });

    y += 24;
    doc.fontSize(11).fillColor('#333');
    doc.text(`Data de conclusão: ${dataConclusao}`, 0, y, { align: 'center', width: W });
    y += 16;
    doc.text(
      `Certificado n.º ${certificado.numeroCertificado}  |  Emitido em: ${fmtDataPt(new Date(certificado.dataEmissao))}`,
      0,
      y,
      { align: 'center', width: W }
    );
    if (certificado.livro || certificado.folha) {
      y += 16;
      doc.text(
        [certificado.livro ? `Livro: ${certificado.livro}` : null, certificado.folha ? `Folha: ${certificado.folha}` : null]
          .filter(Boolean)
          .join('   |   '),
        0,
        y,
        { align: 'center', width: W }
      );
    }
    doc.fillColor('#000');

    const fecho =
      cfg?.textoFechoCertificadoSecundario?.trim() ||
      'Por ser verdade e me ter sido pedido, passa o presente certificado que vai devidamente assinado e autenticado com o carimbo em uso nesta instituição.';
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
        'O ficheiro de carimbo não pôde ser incluído no PDF. Utilize PNG ou JPG válidos (Configurações — carimbo Secundário ou fundo de documento).',
        400
      );
    }

    const baseUrl = (process.env.FRONTEND_URL || process.env.PUBLIC_APP_URL || '').replace(/\/$/, '');
    const verifCodeLabel = `Código de verificação institucional: ${codigoVerif}`;
    doc.fontSize(7).fillColor('#444');
    doc.text(verifCodeLabel, 48, H - 54, { align: 'center', width: W - 96 });
    if (baseUrl) {
      const verifUrl = `${baseUrl}/verificar-certificado-conclusao?codigo=${encodeURIComponent(codigoVerif)}`;
      doc.fontSize(6.5).fillColor('#3366cc');
      doc.text(`Consulta pública de autenticidade: ${verifUrl}`, 48, H - 44, {
        align: 'center',
        width: W - 96,
        link: verifUrl,
        underline: true,
      });
    }
    doc.fontSize(8).fillColor('#555');
    doc.text(
      `Emitido em ${new Date().toLocaleString('pt-AO')} — Documento gerado pelo DSICOLA`,
      48,
      H - 28,
      { align: 'center', width: W - 96 }
    );

    doc.end();
  });

  return { buffer: Buffer.concat(chunks), numeroCertificado: certificado.numeroCertificado };
}
