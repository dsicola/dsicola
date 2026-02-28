/**
 * Impressão de Pauta (Provisória e Definitiva) - PDF A4
 * GET /pautas/:planoEnsinoId/imprimir
 */
import prisma from '../lib/prisma.js';
import PDFDocument from 'pdfkit';
import { AppError } from '../middlewares/errorHandler.js';
import { consolidarPlanoEnsino } from './frequencia.service.js';
import crypto from 'crypto';

export type TipoPauta = 'PROVISORIA' | 'DEFINITIVA';

export async function gerarPDFPauta(
  planoEnsinoId: string,
  instituicaoId: string,
  tipoPauta: TipoPauta,
  operadorNome: string,
  professorNome: string,
  secretariaNome?: string
): Promise<Buffer> {
  const planoEnsino = await prisma.planoEnsino.findFirst({
    where: { id: planoEnsinoId, instituicaoId },
    include: {
      disciplina: true,
      turma: { include: { curso: true, classe: true, anoLetivoRef: true } },
      professor: { include: { user: { select: { nomeCompleto: true } } } },
      instituicao: { select: { nome: true, logoUrl: true, tipoAcademico: true, configuracao: { select: { nif: true } } } },
    },
  });

  if (!planoEnsino) {
    throw new AppError('Plano de ensino não encontrado ou acesso negado', 404);
  }

  const pautaStatusAtual = planoEnsino.pautaStatus ?? 'RASCUNHO';
  if (tipoPauta === 'DEFINITIVA' && pautaStatusAtual !== 'FECHADA') {
    throw new AppError('Impressão Definitiva permitida apenas quando a pauta está fechada (status FECHADA)', 400);
  }

  const consolidacao = await consolidarPlanoEnsino(
    planoEnsinoId,
    instituicaoId,
    planoEnsino.instituicao?.tipoAcademico ?? null
  );

  const anoLetivo = planoEnsino.turma?.anoLetivoRef?.ano?.toString() ?? '-';
  // Superior: só Curso. Secundário: só Classe. Inferir de turma.classeId se tipoAcademico não definido.
  const t = planoEnsino.turma;
  const inst = planoEnsino.instituicao;
  const isSecundario = inst?.tipoAcademico === 'SECUNDARIO' || (!!t?.classeId && inst?.tipoAcademico !== 'SUPERIOR');
  const labelCursoClasse = isSecundario ? 'Classe' : 'Curso';
  const valorCursoClasse = isSecundario ? (t?.classe?.nome ?? '-') : (t?.curso?.nome ?? '-');
  const turmaNome = planoEnsino.turma?.nome ?? '-';
  const disciplinaNome = planoEnsino.disciplina?.nome ?? '-';
  const profNome = professorNome || planoEnsino.professor?.user?.nomeCompleto || '-';
  const nif = planoEnsino.instituicao?.configuracao?.nif ?? '';
  const dataEmissao = new Date().toLocaleDateString('pt-AO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const codigoVerificacao = crypto.randomBytes(4).toString('hex').toUpperCase();

  let logoBuf: Buffer | null = null;
  if (planoEnsino.instituicao?.logoUrl) {
    try {
      const axios = (await import('axios')).default;
      const imgRes = await axios.get(planoEnsino.instituicao.logoUrl, { responseType: 'arraybuffer' });
      logoBuf = Buffer.from(imgRes.data);
    } catch {
      /* ignorar */
    }
  }

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  await new Promise<void>((resolve, reject) => {
    doc.on('end', resolve);
    doc.on('error', reject);

    if (logoBuf) {
      doc.image(logoBuf, 50, 50, { width: 36, height: 36 });
    }
    doc.fontSize(18).font('Helvetica-Bold').text(planoEnsino.instituicao?.nome ?? 'Instituição', { align: 'center' });
    if (nif) doc.fontSize(10).font('Helvetica').text(`NIF: ${nif}`, { align: 'center' });
    doc.moveDown(2);

    doc.fontSize(14).font('Helvetica-Bold').text(`PAUTA - ${tipoPauta === 'DEFINITIVA' ? 'DEFINITIVA' : 'PROVISÓRIA'}`, { align: 'center' });
    doc.moveDown(1);

    doc.fontSize(10).font('Helvetica');
    doc.text(`Ano Letivo: ${anoLetivo}`);
    doc.text(`${labelCursoClasse}: ${valorCursoClasse}`);
    doc.text(`Turma: ${turmaNome}`);
    doc.text(`Disciplina: ${disciplinaNome}`);
    doc.text(`Professor: ${profNome}`);
    doc.text(`Data de emissão: ${dataEmissao}`);
    doc.text(`Código de verificação: ${codigoVerificacao}`);
    doc.moveDown(2);

    const colW = { num: 20, numProc: 50, nome: 110, aval: 90, exame: 42, media: 42, resultado: 65 };
    const startX = 50;
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('Nº', startX, doc.y);
    doc.text('Nº Proc.', startX + colW.num, doc.y);
    doc.text('Nome', startX + colW.num + colW.numProc, doc.y);
    doc.text('Avaliações', startX + colW.num + colW.numProc + colW.nome, doc.y);
    doc.text('Exame', startX + colW.num + colW.numProc + colW.nome + colW.aval, doc.y);
    doc.text('Média', startX + colW.num + colW.numProc + colW.nome + colW.aval + colW.exame, doc.y);
    doc.text('Resultado', startX + colW.num + colW.numProc + colW.nome + colW.aval + colW.exame + colW.media, doc.y);
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.3);

    doc.font('Helvetica').fontSize(9);
    consolidacao.alunos.forEach((a, i) => {
      if (doc.y > 720) {
        doc.addPage();
        doc.y = 50;
      }
      const numProc = (a.numeroIdentificacaoPublica ?? '-').toString().slice(0, 10);
      const avalStr = (a.notas as any)?.notasPorAvaliacao
        ? (a.notas as any).notasPorAvaliacao.map((n: any) => n.nota != null ? Number(n.nota).toFixed(1) : '-').join(' | ')
        : '-';
      const exameVal = (a.notas as any)?.detalhes?.notas_utilizadas?.find((n: any) =>
        String(n.tipo ?? '').toLowerCase().includes('exame') || String(n.tipo ?? '').toLowerCase().includes('recurso')
      );
      const exameStr = exameVal != null ? Number(exameVal.valor).toFixed(1) : '-';
      const mediaStr = (a.notas as any)?.mediaFinal != null ? Number((a.notas as any).mediaFinal).toFixed(1) : '-';
      const resultado = a.situacaoAcademica === 'APROVADO' ? 'Aprovado' : a.situacaoAcademica === 'REPROVADO' ? 'Reprovado' : a.situacaoAcademica === 'REPROVADO_FALTA' ? 'Rep. Falta' : 'Em curso';

      doc.text(String(i + 1), startX, doc.y);
      doc.text(numProc, startX + colW.num, doc.y, { width: colW.numProc });
      doc.text((a.nomeCompleto ?? '').slice(0, 22), startX + colW.num + colW.numProc, doc.y, { width: colW.nome });
      doc.text((avalStr ?? '-').slice(0, 16), startX + colW.num + colW.numProc + colW.nome, doc.y, { width: colW.aval });
      doc.text(exameStr, startX + colW.num + colW.numProc + colW.nome + colW.aval, doc.y);
      doc.text(mediaStr, startX + colW.num + colW.numProc + colW.nome + colW.aval + colW.exame, doc.y);
      doc.text(resultado, startX + colW.num + colW.numProc + colW.nome + colW.aval + colW.exame + colW.media, doc.y);
      doc.moveDown(0.4);
    });

    doc.moveDown(1);
    doc.fontSize(10).font('Helvetica-Bold').text(`Total de estudantes: ${consolidacao.alunos.length}`, { align: 'right' });
    doc.moveDown(2);

    doc.fontSize(9).font('Helvetica');
    doc.text('_________________________________', 50, doc.y);
    doc.text('Assinatura do Professor', 50, doc.y + 15);
    doc.moveDown(2);
    doc.text('_________________________________', 50, doc.y);
    doc.text('Assinatura da Secretaria', 50, doc.y + 15);
    doc.moveDown(2);

    doc.fontSize(8).text(`Documento gerado em ${new Date().toLocaleString('pt-AO')} - Código: ${codigoVerificacao}`, { align: 'center' });

    doc.end();
  });

  return Buffer.concat(chunks);
}
