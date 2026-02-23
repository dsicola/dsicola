/**
 * Módulo Completo de Horários - DSICOLA
 * Validação de conflitos, multi-tenant rigoroso, vínculo com Plano de Ensino
 */
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { Prisma } from '@prisma/client';
import type { StatusHorario } from '@prisma/client';

export interface CreateHorarioInput {
  planoEnsinoId: string;
  diaSemana: number;
  horaInicio: string;
  horaFim: string;
  sala?: string | null;
}

export interface UpdateHorarioInput {
  diaSemana?: number;
  horaInicio?: string;
  horaFim?: string;
  sala?: string | null;
}

export interface HorarioListFilters {
  anoLetivoId?: string;
  turmaId?: string;
  professorId?: string;
  diaSemana?: number;
  status?: StatusHorario;
  page?: number;
  pageSize?: number;
}

/**
 * Valida conflitos antes de criar/atualizar horário
 * Bloqueia se existir:
 * - Mesmo professor no mesmo dia e horário
 * - Mesma turma no mesmo dia e horário
 * - Mesma sala no mesmo dia e horário (quando sala informada)
 */
export async function validarConflitos(
  instituicaoId: string,
  data: { professorId: string; turmaId: string; diaSemana: number; horaInicio: string; horaFim: string; sala?: string | null },
  excluirHorarioId?: string
): Promise<void> {
  const { professorId, turmaId, diaSemana, horaInicio, horaFim, sala } = data;

  const baseWhere: Prisma.HorarioWhereInput = {
    instituicaoId,
    diaSemana,
    status: { not: 'INATIVO' },
    horaInicio: { lt: horaFim },
    horaFim: { gt: horaInicio },
    ...(excluirHorarioId ? { id: { not: excluirHorarioId } } : {}),
  };

  // Conflito 1: Mesmo professor no mesmo dia e horário
  const conflitoProfessor = await prisma.horario.findFirst({
    where: {
      ...baseWhere,
      professorId,
    },
    select: { id: true },
  });
  if (conflitoProfessor) {
    throw new AppError(
      'Não é possível atribuir este horário. O professor já possui outra aula neste dia e período.',
      400
    );
  }

  // Conflito 2: Mesma turma no mesmo dia e horário
  const conflitoTurma = await prisma.horario.findFirst({
    where: {
      ...baseWhere,
      turmaId,
    },
    select: { id: true },
  });
  if (conflitoTurma) {
    throw new AppError(
      'Não é possível atribuir este horário. A turma já possui outra aula neste dia e período.',
      400
    );
  }

  // Conflito 3: Mesma sala no mesmo dia e horário (quando sala informada)
  if (sala && sala.trim()) {
    const conflitoSala = await prisma.horario.findFirst({
      where: {
        ...baseWhere,
        sala: { equals: sala.trim() },
      },
      select: { id: true },
    });
    if (conflitoSala) {
      throw new AppError(
        'Não é possível atribuir este horário. A sala indicada já está ocupada neste dia e período.',
        400
      );
    }
  }
}

/**
 * Busca PlanoEnsino e valida ano letivo ativo
 */
export async function obterPlanoEnsinoParaHorario(
  planoEnsinoId: string,
  instituicaoId: string
) {
  const plano = await prisma.planoEnsino.findFirst({
    where: {
      id: planoEnsinoId,
      instituicaoId,
    },
    include: {
      turma: true,
      disciplina: true,
      professor: true,
      anoLetivoRef: true,
    },
  });

  if (!plano) {
    throw new AppError('Plano de Ensino não encontrado ou acesso negado', 404);
  }

  if (!plano.turmaId || !plano.turma) {
    throw new AppError('O Plano de Ensino deve estar vinculado a uma turma para criar horário', 400);
  }

  // Verificar ano letivo ativo (não permitir horário sem ano ativo)
  const anoLetivoAtivo = await prisma.anoLetivo.findFirst({
    where: {
      instituicaoId,
      status: 'ATIVO',
    },
  });

  if (!anoLetivoAtivo) {
    throw new AppError('Não existe Ano Letivo ativo. Ative um ano letivo antes de criar horários', 400);
  }

  if (plano.anoLetivoId !== anoLetivoAtivo.id) {
    throw new AppError(
      'O Plano de Ensino não pertence ao Ano Letivo ativo. Crie horários apenas para o ano letivo ativo',
      400
    );
  }

  return plano;
}

/**
 * Valida bloco de horário conforme tipo de instituição.
 * SECUNDARIO: blocos fixos (ex: 45 min).
 * SUPERIOR: blocos livres (sem validação de duração).
 */
async function validarBlocoPorTipoInstituicao(
  instituicaoId: string,
  tipoAcademico: 'SECUNDARIO' | 'SUPERIOR' | null,
  horaInicio: string,
  horaFim: string
): Promise<void> {
  if (tipoAcademico !== 'SECUNDARIO') return;

  const { getDuracaoHoraAulaMinutos, validarBlocoHorarioSecundario } = await import('../utils/duracaoHoraAula.js');
  const duracaoMin = await getDuracaoHoraAulaMinutos(instituicaoId, tipoAcademico);
  const result = validarBlocoHorarioSecundario(horaInicio, horaFim, duracaoMin);
  if (!result.valido) {
    throw new AppError(result.mensagem ?? 'Bloco de horário inválido para ensino secundário', 400);
  }
}

/**
 * Cria horário vinculado ao Plano de Ensino
 */
export async function criarHorario(
  instituicaoId: string,
  input: CreateHorarioInput
) {
  const plano = await obterPlanoEnsinoParaHorario(input.planoEnsinoId, instituicaoId);

  if (!plano.professorId) {
    throw new AppError('O Plano de Ensino deve ter um professor vinculado', 400);
  }
  if (!plano.turmaId) {
    throw new AppError('O Plano de Ensino deve estar vinculado a uma turma', 400);
  }

  const instituicao = await prisma.instituicao.findUnique({
    where: { id: instituicaoId },
    select: { tipoAcademico: true },
  });
  await validarBlocoPorTipoInstituicao(
    instituicaoId,
    instituicao?.tipoAcademico ?? null,
    input.horaInicio,
    input.horaFim
  );

  await validarConflitos(instituicaoId, {
    professorId: plano.professorId,
    turmaId: plano.turmaId,
    diaSemana: input.diaSemana,
    horaInicio: input.horaInicio,
    horaFim: input.horaFim,
    sala: input.sala,
  });

  return prisma.horario.create({
    data: {
      instituicaoId,
      anoLetivoId: plano.anoLetivoId,
      planoEnsinoId: plano.id,
      turmaId: plano.turmaId!,
      disciplinaId: plano.disciplinaId,
      professorId: plano.professorId,
      diaSemana: input.diaSemana,
      horaInicio: input.horaInicio,
      horaFim: input.horaFim,
      sala: input.sala?.trim() || null,
      status: 'RASCUNHO',
    },
    include: {
      turma: true,
      disciplina: true,
      professor: { include: { user: { select: { nomeCompleto: true } } } },
      planoEnsino: true,
    },
  });
}

/**
 * Atualiza horário com validação de conflitos
 */
export async function atualizarHorario(
  id: string,
  instituicaoId: string,
  input: UpdateHorarioInput
) {
  const existente = await prisma.horario.findFirst({
    where: { id, instituicaoId },
    include: { planoEnsino: true },
  });

  if (!existente) {
    throw new AppError('Horário não encontrado ou acesso negado', 404);
  }

  const professorId = existente.professorId ?? existente.planoEnsino?.professorId;
  if (!professorId) {
    throw new AppError('Horário sem professor vinculado', 400);
  }

  const diaSemana = input.diaSemana ?? existente.diaSemana;
  const horaInicio = input.horaInicio ?? existente.horaInicio;
  const horaFim = input.horaFim ?? existente.horaFim;
  const sala = input.sala !== undefined ? input.sala : existente.sala;

  if (input.horaInicio !== undefined || input.horaFim !== undefined) {
    const instituicao = await prisma.instituicao.findUnique({
      where: { id: instituicaoId },
      select: { tipoAcademico: true },
    });
    await validarBlocoPorTipoInstituicao(
      instituicaoId,
      instituicao?.tipoAcademico ?? null,
      horaInicio,
      horaFim
    );
  }

  await validarConflitos(instituicaoId, {
    professorId,
    turmaId: existente.turmaId,
    diaSemana,
    horaInicio,
    horaFim,
    sala,
  }, id);

  return prisma.horario.update({
    where: { id },
    data: {
      ...(input.diaSemana !== undefined && { diaSemana: input.diaSemana }),
      ...(input.horaInicio !== undefined && { horaInicio: input.horaInicio }),
      ...(input.horaFim !== undefined && { horaFim: input.horaFim }),
      ...(input.sala !== undefined && { sala: input.sala?.trim() || null }),
    },
    include: {
      turma: true,
      disciplina: true,
      professor: { include: { user: { select: { nomeCompleto: true } } } },
      planoEnsino: true,
    },
  });
}

/**
 * Aprova horário (muda status para APROVADO)
 */
export async function aprovarHorario(id: string, instituicaoId: string) {
  const existente = await prisma.horario.findFirst({
    where: { id, instituicaoId },
  });

  if (!existente) {
    throw new AppError('Horário não encontrado ou acesso negado', 404);
  }

  return prisma.horario.update({
    where: { id },
    data: { status: 'APROVADO' },
    include: {
      turma: true,
      disciplina: true,
      professor: { include: { user: { select: { nomeCompleto: true } } } },
    },
  });
}

/**
 * Exclui horário - apenas se status RASCUNHO
 */
export async function excluirHorario(id: string, instituicaoId: string) {
  const existente = await prisma.horario.findFirst({
    where: { id, instituicaoId },
  });

  if (!existente) {
    throw new AppError('Horário não encontrado ou acesso negado', 404);
  }

  if (existente.status !== 'RASCUNHO') {
    throw new AppError('Apenas horários em rascunho podem ser excluídos', 400);
  }

  await prisma.horario.delete({ where: { id } });
}

/**
 * Lista horários com filtros e paginação
 */
export async function listarHorarios(
  instituicaoId: string,
  filters: HorarioListFilters,
  professorIdFilter?: string // Para PROFESSOR: filtrar apenas seus horários
) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
  const skip = (page - 1) * pageSize;

  const where: Prisma.HorarioWhereInput = {
    instituicaoId,
    ...(filters.anoLetivoId && { anoLetivoId: filters.anoLetivoId }),
    ...(filters.turmaId && { turmaId: filters.turmaId }),
    ...(filters.professorId && { professorId: filters.professorId }),
    ...(professorIdFilter && { professorId: professorIdFilter }),
    ...(filters.diaSemana !== undefined && { diaSemana: filters.diaSemana }),
    ...(filters.status && { status: filters.status }),
  };

  const [horarios, total] = await Promise.all([
    prisma.horario.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }],
      include: {
        turma: true,
        disciplina: true,
        professor: { include: { user: { select: { nomeCompleto: true } } } },
        planoEnsino: true,
        anoLetivo: { select: { ano: true } },
      },
    }),
    prisma.horario.count({ where }),
  ]);

  return {
    data: horarios,
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

/**
 * Grade por Turma: Dia | HoraInicio | HoraFim | Disciplina | Professor | Sala
 */
export async function obterGradePorTurma(
  turmaId: string,
  instituicaoId: string
) {
  const turma = await prisma.turma.findFirst({
    where: { id: turmaId, instituicaoId },
    include: {
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

  return {
    turma,
    horarios,
  };
}

/**
 * Sugestão semi-automática de horários para uma turma
 * Retorna planos sem horário com slots sugeridos (respeitando conflitos)
 */
export interface SugestaoHorario {
  planoEnsinoId: string;
  turmaId: string;
  disciplinaNome?: string;
  professorNome?: string;
  diaSemana: number;
  horaInicio: string;
  horaFim: string;
  sala?: string | null;
}

export async function obterSugestoesHorarios(
  turmaId: string,
  instituicaoId: string,
  options?: { turno?: 'manha' | 'tarde' | 'noite' }
): Promise<SugestaoHorario[]> {
  const { getDuracaoHoraAulaMinutos, gerarBlocosPadrao } = await import('../utils/duracaoHoraAula.js');
  const turno = options?.turno ?? 'manha';

  const turma = await prisma.turma.findFirst({
    where: { id: turmaId, instituicaoId },
    include: {
      instituicao: { select: { tipoAcademico: true } },
    },
  });

  if (!turma) {
    throw new AppError('Turma não encontrada ou acesso negado', 404);
  }

  if (!turma.anoLetivoId) {
    throw new AppError('Turma sem ano letivo vinculado', 400);
  }

  const duracaoMin = await getDuracaoHoraAulaMinutos(instituicaoId, turma.instituicao?.tipoAcademico ?? null);
  const blocos = gerarBlocosPadrao(duracaoMin, turno);

  const planos = (await prisma.planoEnsino.findMany({
    where: {
      turmaId,
      instituicaoId,
    },
    include: {
      disciplina: { select: { nome: true } },
      professor: { include: { user: { select: { nomeCompleto: true } } } },
    },
  })).filter((p) => p.professorId != null);

  const professorIds = planos.map((p) => p.professorId).filter((id): id is string => !!id);
  const whereHorarios: any = {
    instituicaoId,
    status: { not: 'INATIVO' },
  };
  if (professorIds.length > 0) {
    whereHorarios.OR = [{ turmaId }, { professorId: { in: professorIds } }];
  } else {
    whereHorarios.turmaId = turmaId;
  }
  const horariosExistentes = await prisma.horario.findMany({
    where: whereHorarios,
    select: { professorId: true, turmaId: true, diaSemana: true, horaInicio: true, horaFim: true, sala: true, planoEnsinoId: true },
  });

  const planosIdsComHorario = new Set(
    horariosExistentes.filter((h) => h.turmaId === turmaId).map((h) => h.planoEnsinoId).filter((id): id is string => !!id)
  );
  const planosSemHorario = planos.filter((p) => !planosIdsComHorario.has(p.id) && p.professorId && p.turmaId);

  const overlaps = (a1: string, a2: string, b1: string, b2: string): boolean =>
    a1 < b2 && a2 > b1;

  const ocupadosTurma: Array<{ dia: number; inicio: string; fim: string }> = [];
  const ocupadosProf: Array<{ profId: string; dia: number; inicio: string; fim: string }> = [];
  horariosExistentes.forEach((h) => {
    if (h.turmaId === turmaId) ocupadosTurma.push({ dia: h.diaSemana, inicio: h.horaInicio, fim: h.horaFim });
    if (h.professorId) ocupadosProf.push({ profId: h.professorId, dia: h.diaSemana, inicio: h.horaInicio, fim: h.horaFim });
  });

  const conflita = (
    dia: number,
    inicio: string,
    fim: string,
    professorId: string | null
  ): boolean => {
    const conflitoTurma = ocupadosTurma.some(
      (o) => o.dia === dia && overlaps(o.inicio, o.fim, inicio, fim)
    );
    const conflitoProf =
      professorId &&
      ocupadosProf.some(
        (o) => o.profId === professorId && o.dia === dia && overlaps(o.inicio, o.fim, inicio, fim)
      );
    return conflitoTurma || !!conflitoProf;
  };

  const diasPrioridade = [1, 2, 3, 4, 5];
  const sugestoes: SugestaoHorario[] = [];

  for (const plano of planosSemHorario) {
    let atribuido = false;
    for (const dia of diasPrioridade) {
      if (atribuido) break;
      for (const bloco of blocos) {
        if (conflita(dia, bloco.inicio, bloco.fim, plano.professorId)) continue;

        const planoComInc = plano as { disciplina?: { nome?: string }; professor?: { user?: { nomeCompleto?: string } } };
        sugestoes.push({
          planoEnsinoId: plano.id,
          turmaId,
          disciplinaNome: planoComInc.disciplina?.nome,
          professorNome: planoComInc.professor?.user?.nomeCompleto ?? undefined,
          diaSemana: dia,
          horaInicio: bloco.inicio,
          horaFim: bloco.fim,
          sala: null,
        });
        ocupadosTurma.push({ dia, inicio: bloco.inicio, fim: bloco.fim });
        if (plano.professorId) ocupadosProf.push({ profId: plano.professorId, dia, inicio: bloco.inicio, fim: bloco.fim });
        atribuido = true;
        break;
      }
    }
  }

  return sugestoes;
}

/**
 * Grade por Professor: Dia | HoraInicio | HoraFim | Disciplina | Turma | Sala
 */
export async function obterGradePorProfessor(
  professorId: string,
  instituicaoId: string
) {
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

  return {
    professor,
    horarios,
  };
}
