/**
 * Lista de Estudantes Admitidos - Impressão PDF A4
 * GET /relatorios/admitidos/imprimir
 * Filtros: anoLetivoId, cursoId ou classeId, turmaId
 */
import prisma from '../lib/prisma.js';
import PDFDocument from 'pdfkit';
import { AppError } from '../middlewares/errorHandler.js';
import crypto from 'crypto';

export async function gerarPDFListaAdmitidos(
  instituicaoId: string,
  anoLetivoId: string,
  turmaId: string,
  operadorNome: string,
  cursoId?: string,
  classeId?: string
): Promise<Buffer> {
  const where: any = { id: turmaId, instituicaoId };
  if (cursoId) where.cursoId = cursoId;
  if (classeId) where.classeId = classeId;
  // Validação multi-tenant: turma deve pertencer à instituição do JWT
  const turma = await prisma.turma.findFirst({
    where,
    include: {
      curso: true,
      classe: true,
      anoLetivoRef: true,
    },
  });

  if (!turma) {
    throw new AppError('Turma não encontrada ou acesso negado', 404);
  }

  if (turma.anoLetivoId !== anoLetivoId) {
    throw new AppError('Turma não pertence ao ano letivo informado', 400);
  }

  const matriculas = await prisma.matricula.findMany({
    where: {
      turmaId,
      anoLetivoId,
      status: 'Ativa',
      turma: { instituicaoId },
    },
    include: {
      aluno: {
        select: {
          id: true,
          nomeCompleto: true,
          numeroIdentificacao: true,
          numeroIdentificacaoPublica: true,
          genero: true,
        },
      },
    },
    orderBy: { aluno: { nomeCompleto: 'asc' } },
  });

  const instituicao = await prisma.instituicao.findUnique({
    where: { id: instituicaoId },
    select: { nome: true, tipoAcademico: true, configuracao: { select: { nif: true } } },
  });

  const anoLetivo = turma.anoLetivoRef?.ano?.toString() ?? '-';
  // Superior: só Curso. Secundário: só Classe. Inferir de turma.classeId se tipoAcademico não definido.
  const isSecundario = instituicao?.tipoAcademico === 'SECUNDARIO' || (!!turma.classeId && instituicao?.tipoAcademico !== 'SUPERIOR');
  const labelCursoClasse = isSecundario ? 'Classe' : 'Curso';
  const valorCursoClasse = isSecundario ? (turma.classe?.nome ?? '-') : (turma.curso?.nome ?? '-');
  const nif = instituicao?.configuracao?.nif ?? '';
  const dataEmissao = new Date().toLocaleDateString('pt-AO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const codigoVerificacao = crypto.randomBytes(4).toString('hex').toUpperCase();

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  await new Promise<void>((resolve, reject) => {
    doc.on('end', resolve);
    doc.on('error', reject);

    doc.fontSize(18).font('Helvetica-Bold').text(instituicao?.nome ?? 'Instituição', { align: 'center' });
    if (nif) doc.fontSize(10).font('Helvetica').text(`NIF: ${nif}`, { align: 'center' });
    doc.moveDown(2);

    doc.fontSize(16).font('Helvetica-Bold').text('LISTA DE ESTUDANTES ADMITIDOS', { align: 'center' });
    doc.moveDown(1);

    doc.fontSize(10).font('Helvetica');
    doc.text(`Ano Letivo: ${anoLetivo}`);
    doc.text(`${labelCursoClasse}: ${valorCursoClasse}`);
    doc.text(`Turma: ${turma.nome}`);
    doc.text(`Data de emissão: ${dataEmissao}`);
    doc.text(`Operador: ${operadorNome}`);
    doc.text(`Código de verificação: ${codigoVerificacao}`);
    doc.moveDown(2);

    const colW = { num: 30, nome: 180, processo: 90, sexo: 50, situacao: 80 };
    const startX = 50;
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('Nº', startX, doc.y);
    doc.text('Nome Completo', startX + colW.num, doc.y);
    doc.text('Nº Processo', startX + colW.num + colW.nome, doc.y);
    doc.text('Sexo', startX + colW.num + colW.nome + colW.processo, doc.y);
    doc.text('Situação', startX + colW.num + colW.nome + colW.processo + colW.sexo, doc.y);
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.3);

    doc.font('Helvetica').fontSize(9);
    matriculas.forEach((m, i) => {
      if (doc.y > 720) {
        doc.addPage();
        doc.y = 50;
      }
      const numProc = m.aluno.numeroIdentificacaoPublica ?? m.aluno.numeroIdentificacao ?? '-';
      const sexo = m.aluno.genero ?? '-';
      doc.text(String(i + 1), startX, doc.y);
      doc.text((m.aluno.nomeCompleto ?? '').slice(0, 38), startX + colW.num, doc.y);
      doc.text(String(numProc).slice(0, 14), startX + colW.num + colW.nome, doc.y);
      doc.text(String(sexo).slice(0, 8), startX + colW.num + colW.nome + colW.processo, doc.y);
      doc.text('Admitido', startX + colW.num + colW.nome + colW.processo + colW.sexo, doc.y);
      doc.moveDown(0.4);
    });

    doc.moveDown(1);
    doc.fontSize(10).font('Helvetica-Bold').text(`Total de estudantes: ${matriculas.length}`, { align: 'right' });
    doc.moveDown(1);
    doc.fontSize(8).font('Helvetica').text(`Documento gerado em ${new Date().toLocaleString('pt-AO')} - Código: ${codigoVerificacao}`, { align: 'center' });

    doc.end();
  });

  return Buffer.concat(chunks);
}
