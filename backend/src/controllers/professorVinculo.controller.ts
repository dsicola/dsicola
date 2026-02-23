import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter, requireTenantScope } from '../middlewares/auth.js';
import { gerarNumeroIdentificacaoPublica } from '../services/user.service.js';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
import { parseListQuery, listMeta } from '../utils/parseListQuery.js';
import * as userController from './user.controller.js';

/**
 * Listar professores (entidade acadêmica)
 * GET /professores?page=1&pageSize=20&search=&sortBy=nome&sortOrder=asc&status=Ativo&...
 * REGRA SIGA/SIGAE: Retorna professores da tabela professores com join em users
 * Fonte para selects de Plano de Ensino - NUNCA usar /users?role=PROFESSOR
 *
 * NOTA: NÃO filtrar por user.roles (role PROFESSOR) - a presença na tabela professores
 * é a fonte da verdade. Professores criados via Gestão de Professores ou outros fluxos
 * (ex.: funcionário vinculado) podem não ter a role UserRole_ correta, mas devem aparecer.
 */
export const listarProfessores = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { page, pageSize, skip, take, search, sortBy, sortOrder, filters } = parseListQuery(req.query as Record<string, string | string[] | undefined>);

    // PROFESSOR: retornar apenas seu próprio registro (para Avaliações e Notas)
    const isProfessor = req.user?.roles?.includes('PROFESSOR') && !req.user?.roles?.includes('ADMIN') && !req.user?.roles?.includes('SUPER_ADMIN');
    const professorIdFilter = isProfessor && req.professor?.id ? { id: req.professor.id } : {};

    const userConditions: Prisma.UserWhereInput[] = [];

    // Status (user.statusAluno)
    if (filters.status) {
      const s = filters.status.toLowerCase();
      if (s !== 'all' && s !== 'todos') {
        userConditions.push({ statusAluno: filters.status });
      }
    } else {
      userConditions.push({
        OR: [
          { statusAluno: null },
          { statusAluno: 'Ativo' },
          { statusAluno: { notIn: ['Inativo', 'Inativo por inadimplência'] } },
        ],
      });
    }

    // Search: nome, email, nº identificação, código público
    if (search) {
      userConditions.push({
        OR: [
          { nomeCompleto: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { numeroIdentificacao: { contains: search, mode: 'insensitive' } },
          { numeroIdentificacaoPublica: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    const userWhere: Prisma.UserWhereInput = userConditions.length > 1 ? { AND: userConditions } : userConditions[0] || {};

    const orderField = sortBy === 'email' ? 'email' : sortBy === 'numero' ? 'numeroIdentificacao' : 'nomeCompleto';
    const orderBy: Prisma.ProfessorOrderByWithRelationInput = { user: { [orderField]: sortOrder } };

    const where: Prisma.ProfessorWhereInput = {
      ...professorIdFilter,
      instituicaoId,
      user: userWhere,
    };

    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(filters.from);
      if (filters.to) (where.createdAt as Prisma.DateTimeFilter).lte = new Date(filters.to + 'T23:59:59.999Z');
    }

    if (filters.cursoId) {
      where.cursos = { some: { cursoId: filters.cursoId } };
    }

    const [professores, total] = await Promise.all([
      prisma.professor.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          user: {
            select: {
              id: true,
              nomeCompleto: true,
              email: true,
              telefone: true,
              numeroIdentificacao: true,
              numeroIdentificacaoPublica: true,
            },
          },
        },
      }),
      prisma.professor.count({ where }),
    ]);

    // Backfill numeroIdentificacaoPublica em background (não bloqueia resposta)
    const toBackfill = professores.filter((p) => {
      const u = p.user as { numeroIdentificacaoPublica?: string | null };
      return !u?.numeroIdentificacaoPublica?.trim();
    });
    if (toBackfill.length > 0) {
      setImmediate(async () => {
        for (const p of toBackfill) {
          try {
            const num = await gerarNumeroIdentificacaoPublica('PROFESSOR', instituicaoId);
            await prisma.user.update({ where: { id: p.userId }, data: { numeroIdentificacaoPublica: num } });
          } catch (e) {
            console.warn('[listarProfessores] Backfill numeroIdentificacaoPublica falhou para user', p.userId, e);
          }
        }
      });
    }

    const data = professores.map((p) => {
      const u = p.user as { numeroIdentificacaoPublica?: string | null };
      return {
        id: p.id,
        userId: p.userId,
        nomeCompleto: p.user.nomeCompleto,
        nome_completo: p.user.nomeCompleto,
        email: p.user.email,
        telefone: p.user.telefone ?? null,
        numero_identificacao: p.user.numeroIdentificacao ?? null,
        numero_identificacao_publica: u?.numeroIdentificacaoPublica ?? null,
        numeroIdentificacaoPublica: u?.numeroIdentificacaoPublica ?? null,
      };
    });

    res.json({ data, meta: listMeta(page, pageSize, total) });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /professores/:professorId/comprovativo
 * Aceita professores.id — resolve userId internamente e delega para user.controller
 * Evita erro 400 quando frontend envia professor.id em vez de userId
 */
export const getComprovativo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { professorId } = req.params;
    if (!professorId?.trim()) {
      throw new AppError('ID do professor é obrigatório', 400);
    }
    if (!UUID_V4_REGEX.test(professorId.trim())) {
      throw new AppError('ID do professor inválido. Use o ID da tabela professores (professores.id).', 400);
    }

    const filter = addInstitutionFilter(req);
    const professor = await prisma.professor.findFirst({
      where: { id: professorId, ...filter },
      select: { userId: true },
    });

    if (!professor) {
      throw new AppError('Professor não encontrado ou não pertence à sua instituição.', 404);
    }

    req.params.id = professor.userId;
    return userController.getProfessorComprovativo(req, res, next);
  } catch (error) {
    next(error);
  }
};

/**
 * Vincular professor a um curso
 * POST /professores/:professorId/cursos
 * REGRA SIGAE: DESCONTINUADO - A ÚNICA fonte de verdade para atribuição é PlanoEnsino.
 */
export const vincularProfessorCurso = async (req: Request, res: Response, next: NextFunction) => {
  throw new AppError(
    'Endpoint descontinuado. Use Plano de Ensino para atribuir professor a turma/disciplina. A única fonte de verdade é PlanoEnsino.',
    410
  );
};

/**
 * Desvincular professor de um curso
 * DELETE /professores/:professorId/cursos/:cursoId
 * REGRA SIGAE: DESCONTINUADO - A ÚNICA fonte de verdade para atribuição é PlanoEnsino.
 */
export const desvincularProfessorCurso = async (req: Request, res: Response, next: NextFunction) => {
  throw new AppError(
    'Endpoint descontinuado. Use Plano de Ensino para atribuir professor a turma/disciplina. A única fonte de verdade é PlanoEnsino.',
    410
  );
};

/**
 * Vincular professor a uma disciplina
 * POST /professores/:professorId/disciplinas
 * REGRA SIGAE: DESCONTINUADO - A ÚNICA fonte de verdade para atribuição é PlanoEnsino.
 */
export const vincularProfessorDisciplina = async (req: Request, res: Response, next: NextFunction) => {
  throw new AppError(
    'Endpoint descontinuado. Use Plano de Ensino para atribuir professor a turma/disciplina. A única fonte de verdade é PlanoEnsino.',
    410
  );
};

/**
 * Desvincular professor de uma disciplina
 * DELETE /professores/:professorId/disciplinas/:disciplinaId
 * REGRA SIGAE: DESCONTINUADO - A ÚNICA fonte de verdade para atribuição é PlanoEnsino.
 */
export const desvincularProfessorDisciplina = async (req: Request, res: Response, next: NextFunction) => {
  throw new AppError(
    'Endpoint descontinuado. Use Plano de Ensino para atribuir professor a turma/disciplina. A única fonte de verdade é PlanoEnsino.',
    410
  );
};

/**
 * Listar cursos de um professor
 * GET /professores/:professorId/cursos
 */
export const listarCursosProfessor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { professorId } = req.params;
    const filter = addInstitutionFilter(req);

    // REGRA ARQUITETURAL SIGA/SIGAE: Buscar APENAS por professores.id
    // PROIBIDO: Aceitar users.id - lógica híbrida removida
    const professor = await prisma.professor.findFirst({
      where: { 
        id: professorId,
        ...filter 
      },
    });

    if (!professor) {
      throw new AppError(
        'Professor não encontrado ou não pertence à sua instituição. O professorId deve ser um ID válido da tabela professores (não users.id).',
        404
      );
    }

    const vinculos = await prisma.professorCurso.findMany({
      where: { professorId: professor.id },
      include: {
        curso: {
          select: {
            id: true,
            nome: true,
            codigo: true,
          },
        },
      },
      orderBy: {
        curso: {
          nome: 'asc',
        },
      },
    });

    res.json(vinculos);
  } catch (error) {
    next(error);
  }
};

/**
 * Listar disciplinas de um professor
 * GET /professores/:professorId/disciplinas
 */
export const listarDisciplinasProfessor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { professorId } = req.params;
    const filter = addInstitutionFilter(req);

    // REGRA ARQUITETURAL SIGA/SIGAE: Buscar APENAS por professores.id
    // PROIBIDO: Aceitar users.id - lógica híbrida removida
    const professor = await prisma.professor.findFirst({
      where: { 
        id: professorId,
        ...filter 
      },
    });

    if (!professor) {
      throw new AppError(
        'Professor não encontrado ou não pertence à sua instituição. O professorId deve ser um ID válido da tabela professores (não users.id).',
        404
      );
    }

    const vinculos = await prisma.professorDisciplina.findMany({
      where: { professorId: professor.id },
      include: {
        disciplina: {
          select: {
            id: true,
            nome: true,
            codigo: true,
            cargaHoraria: true,
            descricao: true,
            ativa: true,
          },
        },
        curso: {
          select: {
            id: true,
            nome: true,
            codigo: true,
          },
        },
      },
      orderBy: {
        disciplina: {
          nome: 'asc',
        },
      },
    });

    res.json(vinculos);
  } catch (error) {
    next(error);
  }
};

