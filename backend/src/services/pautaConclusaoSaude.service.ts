/**
 * Pauta de Conclusão do Curso - Modelo Saúde (Ensino Secundário)
 * Formato: PAUTA DE CONCLUSÃO DO CURSO com disciplinas em colunas (CA | CFD)
 * Referência: modelo Angola para cursos de saúde (Enfermagem, etc.)
 */
import prisma from '../lib/prisma.js';
import PDFDocument from 'pdfkit';
import { AppError } from '../middlewares/errorHandler.js';

/** Disciplinas típicas de curso de Enfermagem (para preview e referência) */
const DISCIPLINAS_SAUDE_PREVIEW = [
  'Português', 'Inglês', 'Matemática', 'Biologia', 'Química',
  'Anatomia', 'Farmacologia', 'Psicologia', 'Ética', 'Enf. Mental',
  'Enf. Colectiva', 'Nutrição', 'Enf. Mulher', 'Enf. Criança', 'Prát. Enferm',
];

/** Dados fictícios para pré-visualização */
const ALUNOS_SAUDE_PREVIEW = [
  { nome: 'Adolfo Ngueve Custódio Zaguelo', nrec: '2021001', obs: 'APTO/A' as const },
  { nome: 'Alice Domingas Elombo Ngombe', nrec: '2021002', obs: 'APTO/A' as const },
  { nome: 'Ana Paula Ferreira Costa', nrec: '2021003', obs: 'N/APTO/A' as const },
  { nome: 'Pedro Manuel Santos Oliveira', nrec: '2021004', obs: 'APTO/A' as const },
  { nome: 'Luísa Maria João Silva', nrec: '2021005', obs: 'APTO/A' as const },
];

/** Gera notas fictícias CA/CFD por disciplina para preview (determinístico por índice) */
function gerarNotasPreview(idxAluno: number): Record<string, { ca: number; cfd: number }> {
  const out: Record<string, { ca: number; cfd: number }> = {};
  for (let i = 0; i < DISCIPLINAS_SAUDE_PREVIEW.length; i++) {
    const d = DISCIPLINAS_SAUDE_PREVIEW[i];
    const seed = (idxAluno * 7 + i * 11) % 10;
    const ca = 10 + (seed % 8);
    const cfd = Math.max(10, Math.min(20, ca + (seed % 3)));
    out[d] = { ca, cfd };
  }
  return out;
}

/**
 * Gera PDF de pré-visualização da Pauta de Conclusão (modelo Saúde).
 * Multi-tenant: instituicaoId do JWT.
 */
export async function gerarPDFPautaConclusaoSaudePreview(instituicaoId: string): Promise<Buffer> {
  const instituicao = await prisma.instituicao.findFirst({
    where: { id: instituicaoId },
    select: { nome: true, logoUrl: true, configuracao: { select: { nif: true } } },
  });

  if (!instituicao) {
    throw new AppError('Instituição não encontrada', 404);
  }

  const anoLetivo = '2021/2022';
  const turmaNome = 'TURMA - C';
  const especialidade = 'ENFERMAGEM GERAL';
  const nif = instituicao.configuracao?.nif ?? '';

  let logoBuf: Buffer | null = null;
  if (instituicao.logoUrl) {
    try {
      const axios = (await import('axios')).default;
      const imgRes = await axios.get(instituicao.logoUrl, { responseType: 'arraybuffer' });
      logoBuf = Buffer.from(imgRes.data);
    } catch {
      /* ignorar */
    }
  }

  // Landscape A4 para caber muitas colunas
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  const pageWidth = doc.page.width - 60;
  const startX = 30;

  await new Promise<void>((resolve, reject) => {
    doc.on('end', resolve);
    doc.on('error', reject);

    if (logoBuf) {
      doc.image(logoBuf, startX, 20, { width: 28, height: 28 });
    }
    doc.fontSize(14).font('Helvetica-Bold').text(instituicao.nome ?? 'Instituição', { align: 'center' });
    if (nif) doc.fontSize(9).font('Helvetica').text(`NIF: ${nif}`, { align: 'center' });
    doc.moveDown(1);

    doc.fontSize(12).font('Helvetica-Bold').text('PAUTA DE CONCLUSÃO DO CURSO', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(turmaNome, { align: 'center' });
    doc.text(`ESPECIALIDADE - ${especialidade}`, { align: 'center' });
    doc.text(`ANO LECTIVO ${anoLetivo}`, { align: 'center' });
    doc.moveDown(1);

    // Tabela: # | Nº REC | NOME | [DISC CA CFD]... | ESTÁGIO | C.F.PLANO | PAP | CLASS.FINAL | OBS
    const colNum = 18;
    const colNrec = 42;
    const colNome = 90;
    const colDisc = 28; // CA+CFD por disciplina (14+14)
    const numDisc = Math.min(10, DISCIPLINAS_SAUDE_PREVIEW.length); // 10 disciplinas para caber
    const disciplinasUsar = DISCIPLINAS_SAUDE_PREVIEW.slice(0, numDisc);

    let x = startX;
    doc.fontSize(7).font('Helvetica-Bold');
    doc.text('#', x, doc.y); x += colNum;
    doc.text('Nº REC', x, doc.y); x += colNrec;
    doc.text('NOME COMPLETO', x, doc.y); x += colNome;
    for (const d of disciplinasUsar) {
      const abrev = d.length > 8 ? d.slice(0, 8) : d;
      doc.text(abrev, x, doc.y); x += colDisc;
    }
    doc.text('EST.', x, doc.y); x += 22;
    doc.text('C.F.', x, doc.y); x += 22;
    doc.text('PAP', x, doc.y); x += 22;
    doc.text('CLASS.F', x, doc.y); x += 28;
    doc.text('OBS', x, doc.y);
    doc.moveDown(0.3);

    x = startX + colNum + colNrec + colNome;
    doc.fontSize(6).font('Helvetica');
    for (const d of disciplinasUsar) {
      doc.text('CA|CFD', x, doc.y); x += colDisc;
    }
    doc.moveDown(0.2);
    doc.moveTo(startX, doc.y).lineTo(pageWidth + 30, doc.y).stroke();
    doc.moveDown(0.2);

    doc.font('Helvetica').fontSize(7);
    ALUNOS_SAUDE_PREVIEW.forEach((aluno, i) => {
      if (doc.y > 520) {
        doc.addPage({ size: 'A4', layout: 'landscape', margin: 30 });
        doc.y = 30;
      }
      const notas = gerarNotasPreview(i);
      x = startX;
      doc.text(String(i + 1), x, doc.y); x += colNum;
      doc.text(aluno.nrec, x, doc.y, { width: colNrec }); x += colNrec;
      doc.text(aluno.nome.slice(0, 25), x, doc.y, { width: colNome }); x += colNome;
      for (const d of disciplinasUsar) {
        const n = notas[d] ?? { ca: 12, cfd: 13 };
        doc.text(`${n.ca}|${n.cfd}`, x, doc.y, { width: colDisc }); x += colDisc;
      }
      doc.text('14', x, doc.y); x += 22;
      doc.text('13', x, doc.y); x += 22;
      doc.text('14', x, doc.y); x += 22;
      doc.text('13', x, doc.y); x += 28;
      const isApto = aluno.obs === 'APTO/A';
      if (!isApto) doc.fillColor('red');
      doc.text(aluno.obs, x, doc.y);
      if (!isApto) doc.fillColor('black');
      doc.moveDown(0.35);
    });

    doc.moveDown(0.5);
    doc.moveTo(startX, doc.y).lineTo(pageWidth + 30, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(8).font('Helvetica-Bold').text(`Total: ${ALUNOS_SAUDE_PREVIEW.length} estudantes`, { align: 'right' });
    doc.moveDown(1);
    doc.fontSize(7).font('Helvetica');
    doc.text('CA = Classificação de Avaliação Contínua | CFD = Classificação Final da Disciplina', startX, doc.y);
    doc.text('EST. = Estágio Curricular | C.F. = C.F. Plano Curricular | PAP = Class. Prov. A Prof.', startX, doc.y + 10);
    doc.text('APTO/A = Aprovado(a) | N/APTO/A = Não Aprovado(a)', startX, doc.y + 20);
    doc.moveDown(1.5);
    doc.fontSize(8).text('Documento de pré-visualização - Modelo Ensino Secundário Saúde (dados fictícios)', { align: 'center' });

    doc.end();
  });

  return Buffer.concat(chunks);
}

/** Estrutura de dados para exportação Excel (compatível, editável) */
export interface PautaConclusaoSaudeDados {
  instituicaoNome: string;
  turma: string;
  especialidade: string;
  anoLetivo: string;
  disciplinas: string[];
  alunos: Array<{
    n: number;
    nrec: string;
    nome: string;
    notas: Record<string, { ca: number; cfd: number }>;
    estagio: number;
    cfPlano: number;
    pap: number;
    classFinal: number;
    obs: string;
  }>;
}

/**
 * Retorna dados da Pauta de Conclusão (modelo Saúde) para exportação Excel.
 * Se turmaId fornecido: dados reais. Senão: preview com dados fictícios.
 */
export async function getPautaConclusaoSaudeDados(
  instituicaoId: string,
  turmaId?: string | null
): Promise<PautaConclusaoSaudeDados> {
  if (turmaId) {
    return getPautaConclusaoSaudeDadosReais(instituicaoId, turmaId);
  }
  return getPautaConclusaoSaudeDadosPreview(instituicaoId);
}

/** Preview com dados fictícios */
async function getPautaConclusaoSaudeDadosPreview(instituicaoId: string): Promise<PautaConclusaoSaudeDados> {
  const instituicao = await prisma.instituicao.findFirst({
    where: { id: instituicaoId },
    select: { nome: true },
  });

  if (!instituicao) {
    throw new AppError('Instituição não encontrada', 404);
  }

  const disciplinas = [...DISCIPLINAS_SAUDE_PREVIEW];
  const alunos = ALUNOS_SAUDE_PREVIEW.map((a, i) => {
    const notas = gerarNotasPreview(i);
    return {
      n: i + 1,
      nrec: a.nrec,
      nome: a.nome,
      notas,
      estagio: 14,
      cfPlano: 13,
      pap: 14,
      classFinal: 13,
      obs: a.obs,
    };
  });

  return {
    instituicaoNome: instituicao.nome ?? 'Instituição',
    turma: 'TURMA - C',
    especialidade: 'ENFERMAGEM GERAL',
    anoLetivo: '2021/2022',
    disciplinas,
    alunos,
  };
}

/** Dados reais por turmaId */
async function getPautaConclusaoSaudeDadosReais(
  instituicaoId: string,
  turmaId: string
): Promise<PautaConclusaoSaudeDados> {
  const turma = await prisma.turma.findFirst({
    where: { id: turmaId, instituicaoId },
    include: {
      curso: { select: { nome: true, modeloPauta: true } },
      classe: { select: { nome: true } },
      anoLetivoRef: { select: { ano: true } },
      matriculas: {
        where: { status: 'Ativa' },
        include: {
          aluno: {
            select: { id: true, nomeCompleto: true, numeroIdentificacaoPublica: true },
          },
        },
      },
      instituicao: { select: { nome: true, tipoAcademico: true } },
    },
  });

  if (!turma) {
    throw new AppError('Turma não encontrada ou acesso negado', 404);
  }

  const cursoId = turma.cursoId;
  if (!cursoId) {
    throw new AppError('Turma sem curso vinculado', 400);
  }

  // Apenas cursos configurados com modelo de pauta CONCLUSAO (ou SAUDE legado) utilizam este formato.
  if (turma.curso && turma.curso.modeloPauta !== 'CONCLUSAO' && turma.curso.modeloPauta !== 'SAUDE') {
    throw new AppError(
      'Curso não está configurado com modelo de pauta Conclusão. Configure em Cursos > Modelo de Pauta = Conclusão.',
      400
    );
  }

  // Disciplinas do curso (CursoDisciplina) ordenadas por trimestre/semestre
  const cursoDisciplinas = await prisma.cursoDisciplina.findMany({
    where: { cursoId },
    include: { disciplina: { select: { id: true, nome: true } } },
    orderBy: [{ trimestre: 'asc' }, { semestre: 'asc' }],
  });

  const disciplinas = cursoDisciplinas.map((cd) => cd.disciplina.nome);
  const disciplinaIds = cursoDisciplinas.map((cd) => cd.disciplinaId);

  // Planos de ensino da turma (por disciplina)
  const planosEnsino = await prisma.planoEnsino.findMany({
    where: {
      turmaId,
      disciplinaId: { in: disciplinaIds },
      instituicaoId,
    },
    include: { disciplina: { select: { id: true, nome: true } } },
  });

  const planoPorDisciplina = new Map<string, string>();
  for (const p of planosEnsino) {
    planoPorDisciplina.set(p.disciplinaId, p.id);
  }

  const { consolidarPlanoEnsino } = await import('./frequencia.service.js');
  const tipoAcademico = turma.instituicao?.tipoAcademico ?? null;

  const alunos = turma.matriculas
    .map((m) => m.aluno)
    .filter(Boolean)
    .sort((a, b) => (a.nomeCompleto ?? '').localeCompare(b.nomeCompleto ?? ''));

  const alunosDados: PautaConclusaoSaudeDados['alunos'] = [];

  for (let i = 0; i < alunos.length; i++) {
    const aluno = alunos[i];
    const notas: Record<string, { ca: number; cfd: number }> = {};
    let somaCfd = 0;
    let countCfd = 0;
    let todosAprovados = true;

    for (const discNome of disciplinas) {
      const cd = cursoDisciplinas.find((c) => c.disciplina.nome === discNome);
      if (!cd) continue;
      const planoId = planoPorDisciplina.get(cd.disciplinaId);
      if (!planoId) {
        notas[discNome] = { ca: 0, cfd: 0 };
        continue;
      }

      try {
        const consolidacao = await consolidarPlanoEnsino(planoId, instituicaoId, tipoAcademico);
        const alunoCons = consolidacao.alunos.find((a) => a.alunoId === aluno.id);
        if (!alunoCons) {
          notas[discNome] = { ca: 0, cfd: 0 };
          continue;
        }

        const mediaFinal = alunoCons.notas?.mediaFinal ?? 0;
        const mediaParcial = (alunoCons.notas as any)?.mediaParcial ?? mediaFinal;
        const ca = Math.round(mediaParcial * 10) / 10;
        const cfd = Math.round(mediaFinal * 10) / 10;

        notas[discNome] = { ca, cfd };
        if (cfd >= 10) {
          somaCfd += cfd;
          countCfd++;
        } else {
          todosAprovados = false;
        }
      } catch {
        notas[discNome] = { ca: 0, cfd: 0 };
        todosAprovados = false;
      }
    }

    const classFinal = countCfd > 0 ? Math.round((somaCfd / countCfd) * 10) / 10 : 0;
    const obs = todosAprovados ? 'APTO/A' : 'N/APTO/A';

    alunosDados.push({
      n: i + 1,
      nrec: (aluno as { numeroIdentificacaoPublica?: string }).numeroIdentificacaoPublica ?? '-',
      nome: aluno.nomeCompleto ?? '-',
      notas,
      estagio: 0, // Não temos estágio no sistema - pode ser preenchido manualmente no Excel
      cfPlano: classFinal,
      pap: classFinal,
      classFinal,
      obs,
    });
  }

  const anoLetivo = turma.anoLetivoRef?.ano
    ? `${turma.anoLetivoRef.ano - 1}/${turma.anoLetivoRef.ano}`
    : new Date().getFullYear().toString();

  return {
    instituicaoNome: turma.instituicao?.nome ?? 'Instituição',
    turma: `TURMA - ${turma.nome}`,
    especialidade: (turma.curso?.nome ?? turma.classe?.nome ?? '—').toUpperCase(),
    anoLetivo,
    disciplinas,
    alunos: alunosDados,
  };
}
