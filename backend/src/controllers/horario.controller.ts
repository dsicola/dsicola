/**
 * Módulo Completo de Horários - DSICOLA
 * RBAC: ADMIN, SECRETARIA (criar, editar, aprovar, excluir) | PROFESSOR (apenas visualizar próprios)
 */
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { requireTenantScope } from '../middlewares/auth.js';
import * as horarioService from '../services/horario.service.js';

export const getAll = async (req: any, res: any, next: any) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { anoLetivoId, turmaId, professorId, diaSemana, status, page, pageSize } = req.query;

    const isProfessorOnly = req.user?.roles?.includes('PROFESSOR') &&
      !req.user?.roles?.includes('ADMIN') && !req.user?.roles?.includes('SECRETARIA');

    let professorIdFilter: string | undefined;
    if (isProfessorOnly && req.user?.professorId) {
      professorIdFilter = req.user.professorId;
    }

    const result = await horarioService.listarHorarios(
      instituicaoId,
      {
        anoLetivoId: anoLetivoId as string | undefined,
        turmaId: turmaId as string | undefined,
        professorId: professorId as string | undefined,
        diaSemana: diaSemana !== undefined ? parseInt(String(diaSemana), 10) : undefined,
        status: status as any,
        page: page ? parseInt(String(page), 10) : undefined,
        pageSize: pageSize ? parseInt(String(pageSize), 10) : undefined,
      },
      professorIdFilter
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req: any, res: any, next: any) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { id } = req.params;

    const horario = await prisma.horario.findFirst({
      where: { id, instituicaoId },
      include: {
        turma: true,
        disciplina: true,
        professor: { include: { user: { select: { nomeCompleto: true } } } },
        planoEnsino: true,
        anoLetivo: { select: { ano: true } },
      },
    });

    if (!horario) {
      throw new AppError('Horário não encontrado ou acesso negado', 404);
    }

    const isProfessorOnly = req.user?.roles?.includes('PROFESSOR') &&
      !req.user?.roles?.includes('ADMIN') && !req.user?.roles?.includes('SECRETARIA');
    if (isProfessorOnly && req.user?.professorId && horario.professorId !== req.user.professorId) {
      throw new AppError('Acesso negado: você só pode visualizar seus próprios horários', 403);
    }

    res.json(horario);
  } catch (error) {
    next(error);
  }
};

export const create = async (req: any, res: any, next: any) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { planoEnsinoId, turmaId, disciplinaId, diaSemana, horaInicio, horaFim, sala } = req.body;

    if (req.body.instituicaoId !== undefined) {
      throw new AppError('Não é permitido definir instituição. Use o token de autenticação.', 400);
    }

    let planoId = planoEnsinoId;
    if (!planoId && turmaId) {
      const plano = await prisma.planoEnsino.findFirst({
        where: {
          turmaId,
          instituicaoId,
          ...(disciplinaId && { disciplinaId }),
        },
      });
      if (!plano) {
        throw new AppError(
          'Plano de Ensino é obrigatório. Vincule a turma a um Plano de Ensino ou informe planoEnsinoId.',
          400
        );
      }
      planoId = plano.id;
    }

    if (!planoId) {
      throw new AppError('planoEnsinoId é obrigatório', 400);
    }
    if (diaSemana === undefined || diaSemana === null) {
      throw new AppError('diaSemana é obrigatório', 400);
    }
    if (!horaInicio || !horaFim) {
      throw new AppError('horaInicio e horaFim são obrigatórios', 400);
    }

    const horario = await horarioService.criarHorario(instituicaoId, {
      planoEnsinoId: planoId,
      diaSemana: parseInt(String(diaSemana), 10),
      horaInicio: String(horaInicio),
      horaFim: String(horaFim),
      sala: sala || null,
    });

    res.status(201).json(horario);
  } catch (error) {
    next(error);
  }
};

export const update = async (req: any, res: any, next: any) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { id } = req.params;
    const { diaSemana, horaInicio, horaFim, sala } = req.body;

    if (req.body.instituicaoId !== undefined) {
      throw new AppError('Não é permitido alterar a instituição do horário', 400);
    }

    const existente = await prisma.horario.findFirst({
      where: { id, instituicaoId },
    });
    if (!existente) {
      throw new AppError('Horário não encontrado ou acesso negado', 404);
    }

    const isProfessorOnly = req.user?.roles?.includes('PROFESSOR') &&
      !req.user?.roles?.includes('ADMIN') && !req.user?.roles?.includes('SECRETARIA');
    if (isProfessorOnly) {
      throw new AppError('Apenas ADMIN e SECRETARIA podem editar horários', 403);
    }

    const horario = await horarioService.atualizarHorario(id, instituicaoId, {
      diaSemana: diaSemana !== undefined ? parseInt(String(diaSemana), 10) : undefined,
      horaInicio,
      horaFim,
      sala,
    });

    res.json(horario);
  } catch (error) {
    next(error);
  }
};

export const aprovar = async (req: any, res: any, next: any) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { id } = req.params;

    const isProfessorOnly = req.user?.roles?.includes('PROFESSOR') &&
      !req.user?.roles?.includes('ADMIN') && !req.user?.roles?.includes('SECRETARIA');
    if (isProfessorOnly) {
      throw new AppError('Apenas ADMIN e SECRETARIA podem aprovar horários', 403);
    }

    const horario = await horarioService.aprovarHorario(id, instituicaoId);
    res.json(horario);
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: any, res: any, next: any) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { id } = req.params;

    const isProfessorOnly = req.user?.roles?.includes('PROFESSOR') &&
      !req.user?.roles?.includes('ADMIN') && !req.user?.roles?.includes('SECRETARIA');
    if (isProfessorOnly) {
      throw new AppError('Apenas ADMIN e SECRETARIA podem excluir horários', 403);
    }

    await horarioService.excluirHorario(id, instituicaoId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

/** Grade por Turma: GET /horarios/grade/turma/:turmaId */
export const gradeTurma = async (req: any, res: any, next: any) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { turmaId } = req.params;

    const result = await horarioService.obterGradePorTurma(turmaId, instituicaoId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/** Sugestões semi-automáticas: GET /horarios/sugestoes/:turmaId?turno=manha|tarde|noite */
export const getSugestoes = async (req: any, res: any, next: any) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { turmaId } = req.params;
    const turnoRaw = req.query.turno;
    const turnoStr = Array.isArray(turnoRaw)
      ? (turnoRaw[0] ?? '')
      : (typeof turnoRaw === 'string' ? turnoRaw : '');
    const turno = String(turnoStr).toLowerCase().trim();
    const turnoValido: 'manha' | 'tarde' | 'noite' =
      turno === 'tarde' || turno === 'noite' ? turno : 'manha';

    const sugestoes = await horarioService.obterSugestoesHorarios(turmaId, instituicaoId, {
      turno: turnoValido,
    });
    res.json(sugestoes);
  } catch (error) {
    next(error);
  }
};

/** Criar horários em lote (a partir de sugestões): POST /horarios/bulk */
export const criarBulk = async (req: any, res: any, next: any) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { horarios } = req.body;

    if (!Array.isArray(horarios) || horarios.length === 0) {
      throw new AppError('Envie um array não vazio de horários', 400);
    }

    const criados: any[] = [];
    const erros: Array<{ planoEnsinoId: string; disciplinaNome?: string; message: string }> = [];

    for (const h of horarios) {
      try {
        const horario = await horarioService.criarHorario(instituicaoId, {
          planoEnsinoId: h.planoEnsinoId,
          diaSemana: parseInt(String(h.diaSemana), 10),
          horaInicio: String(h.horaInicio),
          horaFim: String(h.horaFim),
          sala: h.sala || null,
        });
        criados.push(horario);
      } catch (err: any) {
        erros.push({
          planoEnsinoId: h.planoEnsinoId,
          disciplinaNome: h.disciplinaNome,
          message: err?.message || 'Erro ao criar horário',
        });
      }
    }

    res.status(201).json({
      criados: criados.length,
      erros: erros.length,
      horarios: criados,
      detalhesErros: erros,
    });
  } catch (error) {
    next(error);
  }
};

/** Grade por Professor: GET /horarios/grade/professor/:professorId */
export const gradeProfessor = async (req: any, res: any, next: any) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { professorId } = req.params;

    const isProfessorOnly = req.user?.roles?.includes('PROFESSOR') &&
      !req.user?.roles?.includes('ADMIN') && !req.user?.roles?.includes('SECRETARIA');
    if (isProfessorOnly && req.user?.professorId !== professorId) {
      throw new AppError('Acesso negado: você só pode visualizar seu próprio horário', 403);
    }

    const result = await horarioService.obterGradePorProfessor(professorId, instituicaoId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};
