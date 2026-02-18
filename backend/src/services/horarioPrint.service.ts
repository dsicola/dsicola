/**
 * Impressão de Horário - PDF A4 profissional (padrão SIGAE)
 * Suporta: Grade da Turma e Grade do Professor
 * Modelo: Horario com instituicaoId, disciplinaId, professorId
 */
import prisma from '../lib/prisma.js';
import PDFDocument from 'pdfkit';
import { createHash } from 'crypto';
import { AppError } from '../middlewares/errorHandler.js';

const DIAS_SEMANA = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

interface DadosPDFHorario {
  tipo: 'TURMA' | 'PROFESSOR';
  instituicaoNome: string;
  instituicaoNif: string | null;
  anoLetivo: string;
  pessoaNome: string;
  cargo: string;
  linhas: { dia: string; inicio: string; fim: string; turma: string; disciplina: string; sala: string; professor?: string }[];
  turmaId?: string;
  professorId?: string;
  instituicaoId: string;
  operadorNome?: string;
}

/**
 * Gera PDF da Grade Horária da Turma
 * Usa Horario direto (turmaId, disciplinaId, professorId)
 */
export async function gerarPDFHorarioTurma(
  turmaId: string,
  instituicaoId: string,
  operadorNome?: string
): Promise<Buffer> {
  const turma = await prisma.turma.findFirst({
    where: { id: turmaId, instituicaoId },
    include: {
      curso: true,
      classe: true,
      anoLetivoRef: true,
    },
  });

  if (!turma) {
    throw new AppError('Turma não encontrada ou acesso negado', 404);
  }

  const horarios = await prisma.horario.findMany({
    where: { turmaId, instituicaoId, status: { not: 'INATIVO' } },
    orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }],
    include: {
      disciplina: true,
      professor: { include: { user: { select: { nomeCompleto: true } } } },
    },
  });

  const anoLetivo = turma.anoLetivoRef?.ano?.toString() ?? '-';
  const turmaNome = turma.nome;
  const cursoNome = turma.curso?.nome ?? '-';

  const linhas = horarios.map((h) => ({
    dia: DIAS_SEMANA[h.diaSemana] ?? `Dia ${h.diaSemana}`,
    inicio: (h.horaInicio || '').slice(0, 5),
    fim: (h.horaFim || '').slice(0, 5),
    turma: turmaNome,
    disciplina: h.disciplina?.nome ?? '-',
    sala: h.sala ?? '-',
    professor: h.professor?.user?.nomeCompleto ?? '-',
  }));

  const { instituicaoNome, instituicaoNif } = await obterDadosInstituicao(instituicaoId);

  return gerarPDFHorario({
    tipo: 'TURMA',
    instituicaoNome,
    instituicaoNif,
    anoLetivo,
    pessoaNome: turmaNome,
    cargo: `Curso: ${cursoNome}`,
    linhas,
    turmaId,
    instituicaoId,
    operadorNome,
  });
}

/**
 * Gera PDF da Grade Horária do Professor
 * Usa Horario direto (professorId)
 */
export async function gerarPDFHorarioProfessor(
  professorId: string,
  instituicaoId: string,
  operadorNome?: string
): Promise<Buffer> {
  const professor = await prisma.professor.findFirst({
    where: { id: professorId, instituicaoId },
    include: {
      user: { select: { nomeCompleto: true } },
    },
  });

  if (!professor) {
    throw new AppError('Professor não encontrado ou acesso negado', 404);
  }

  const horarios = await prisma.horario.findMany({
    where: { professorId, instituicaoId, status: { not: 'INATIVO' } },
    orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }],
    include: {
      disciplina: true,
      turma: true,
    },
  });

  const pessoaNome = professor.user?.nomeCompleto || 'Professor';
  const anoLetivo = horarios[0]
    ? (
        await prisma.anoLetivo.findUnique({
          where: { id: horarios[0].anoLetivoId },
          select: { ano: true },
        })
      )?.ano?.toString() ?? '-'
    : '-';

  const linhas = horarios.map((h) => ({
    dia: DIAS_SEMANA[h.diaSemana] ?? `Dia ${h.diaSemana}`,
    inicio: (h.horaInicio || '').slice(0, 5),
    fim: (h.horaFim || '').slice(0, 5),
    turma: h.turma?.nome ?? '-',
    disciplina: h.disciplina?.nome ?? '-',
    sala: h.sala ?? '-',
  }));

  linhas.sort((a, b) => {
    const diaA = DIAS_SEMANA.indexOf(a.dia);
    const diaB = DIAS_SEMANA.indexOf(b.dia);
    if (diaA !== diaB) return diaA - diaB;
    return a.inicio.localeCompare(b.inicio);
  });

  const { instituicaoNome, instituicaoNif } = await obterDadosInstituicao(instituicaoId);

  return gerarPDFHorario({
    tipo: 'PROFESSOR',
    instituicaoNome,
    instituicaoNif,
    anoLetivo,
    pessoaNome,
    cargo: 'Professor',
    linhas,
    professorId,
    instituicaoId,
    operadorNome,
  });
}

async function obterDadosInstituicao(instituicaoId: string): Promise<{ instituicaoNome: string; instituicaoNif: string | null }> {
  const inst = await prisma.instituicao.findUnique({
    where: { id: instituicaoId },
    include: {
      configuracao: { select: { nif: true } },
    },
  });
  return {
    instituicaoNome: inst?.nome ?? 'Instituição de Ensino',
    instituicaoNif: inst?.configuracao?.nif ?? null,
  };
}

async function gerarPDFHorario(dados: DadosPDFHorario): Promise<Buffer> {
  const dataEmissao = new Date();
  const codigoVerificacao = createHash('sha256')
    .update(`${dados.instituicaoId}-${dados.tipo}-${dados.turmaId || dados.professorId}-${dataEmissao.toISOString()}`)
    .digest('hex')
    .slice(0, 12)
    .toUpperCase();

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  await new Promise<void>((resolve, reject) => {
    doc.on('end', resolve);
    doc.on('error', reject);

    // Cabeçalho: Nome da Instituição, NIF, Ano Letivo, Tipo
    doc.fontSize(18).font('Helvetica-Bold').text(dados.instituicaoNome, { align: 'center' });
    if (dados.instituicaoNif) {
      doc.fontSize(10).font('Helvetica').text(`NIF: ${dados.instituicaoNif}`, { align: 'center' });
    }
    doc.moveDown(0.5);
    doc.fontSize(14).font('Helvetica-Bold').text(`Horário ${dados.tipo === 'TURMA' ? 'da Turma' : 'do Professor'}`, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica');
    doc.text(`Nome: ${dados.pessoaNome}`);
    doc.text(`Cargo: ${dados.cargo}`);
    doc.text(`Ano Letivo: ${dados.anoLetivo}`);
    doc.moveDown(2);

    if (dados.linhas.length === 0) {
      doc.text('Nenhum horário cadastrado.', { align: 'center' });
    } else {
      const colW = { dia: 95, inicio: 45, fim: 45, turma: 75, disciplina: 115, sala: 45 };
      const startX = 50;
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Dia', startX, doc.y);
      doc.text('Início', startX + colW.dia, doc.y);
      doc.text('Fim', startX + colW.dia + colW.inicio, doc.y);
      doc.text('Turma', startX + colW.dia + colW.inicio + colW.fim, doc.y);
      doc.text('Disciplina', startX + colW.dia + colW.inicio + colW.fim + colW.turma, doc.y);
      doc.text('Sala', startX + colW.dia + colW.inicio + colW.fim + colW.turma + colW.disciplina, doc.y);
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.3);
      doc.font('Helvetica').fontSize(8);
      for (const row of dados.linhas) {
        if (doc.y > 720) {
          doc.addPage();
          doc.y = 50;
        }
        doc.text((row.dia || '').slice(0, 14), startX, doc.y);
        doc.text(row.inicio, startX + colW.dia, doc.y);
        doc.text(row.fim, startX + colW.dia + colW.inicio, doc.y);
        doc.text((row.turma || '').slice(0, 12), startX + colW.dia + colW.inicio + colW.fim, doc.y);
        doc.text((row.disciplina || '').slice(0, 18), startX + colW.dia + colW.inicio + colW.fim + colW.turma, doc.y);
        doc.text((row.sala || '').slice(0, 8), startX + colW.dia + colW.inicio + colW.fim + colW.turma + colW.disciplina, doc.y);
        doc.moveDown(0.35);
      }
    }

    doc.moveDown(2);
    // Rodapé: Data de emissão, Operador, Código de verificação
    doc.fontSize(9).font('Helvetica');
    doc.text(`Data de emissão: ${dataEmissao.toLocaleDateString('pt-AO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`);
    if (dados.operadorNome) {
      doc.text(`Operador: ${dados.operadorNome}`);
    }
    doc.text(`Código de verificação: ${codigoVerificacao}`);

    doc.end();
  });

  return Buffer.concat(chunks);
}
