import { Request, Response, NextFunction } from 'express';
import type { Prisma } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter } from '../middlewares/auth.js';
import { mergeCursoDisciplinasPorDisciplinaPreferindoClasse } from '../lib/cursoDisciplinaResolver.js';

function normalizeClasseIdBody(raw: unknown): string | null {
  if (raw === undefined || raw === null || raw === '') return null;
  const s = String(raw).trim();
  if (s === '' || s === 'null') return null;
  return s;
}

/** DELETE/PATCH: sem query = vínculo global (classe_id nulo). */
function classeIdFromQuery(req: Request): string | null {
  const q = req.query.classeId;
  if (q === undefined) return null;
  if (q === null || q === '') return null;
  const s = Array.isArray(q) ? String(q[0]) : String(q);
  const t = s.trim();
  if (t === '' || t === 'null') return null;
  return t;
}

const vinculoInclude = {
  curso: { select: { id: true, nome: true, codigo: true } },
  disciplina: { select: { id: true, nome: true, codigo: true, cargaHoraria: true } },
  classe: { select: { id: true, nome: true, codigo: true } },
  preRequisitoDisciplina: { select: { id: true, nome: true, codigo: true } },
} as const;

/**
 * Vincular disciplina a um curso
 * POST /cursos/:cursoId/disciplinas
 */
export const vincularDisciplina = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cursoId } = req.params;
    const {
      disciplinaId,
      semestre,
      trimestre,
      cargaHoraria,
      obrigatoria,
      preRequisitoDisciplinaId,
      classeId: classeIdRaw,
    } = req.body;

    if (!disciplinaId) {
      throw new AppError('Disciplina é obrigatória', 400);
    }

    const classeIdVinculo = normalizeClasseIdBody(classeIdRaw);

    const filter = addInstitutionFilter(req);

    const curso = await prisma.curso.findFirst({
      where: { id: cursoId, ...filter },
    });

    if (!curso) {
      throw new AppError('Curso não encontrado', 404);
    }

    const disciplina = await prisma.disciplina.findFirst({
      where: { id: disciplinaId, ...filter },
    });

    if (!disciplina) {
      throw new AppError('Disciplina não encontrada', 404);
    }

    if (classeIdVinculo) {
      const classe = await prisma.classe.findFirst({
        where: { id: classeIdVinculo, ...filter },
      });
      if (!classe) {
        throw new AppError('Classe não encontrada nesta instituição.', 404);
      }
    }

    let preReqId: string | null = null;
    if (preRequisitoDisciplinaId != null && String(preRequisitoDisciplinaId).trim() !== '') {
      preReqId = String(preRequisitoDisciplinaId).trim();
      if (preReqId === disciplinaId) {
        throw new AppError('A disciplina não pode ser pré-requisito de si mesma.', 400);
      }
      const pre = await prisma.disciplina.findFirst({
        where: { id: preReqId, ...filter },
      });
      if (!pre) {
        throw new AppError('Disciplina de pré-requisito não encontrada nesta instituição.', 404);
      }
    }

    const vinculoExistente = await prisma.cursoDisciplina.findFirst({
      where: {
        cursoId,
        disciplinaId,
        classeId: classeIdVinculo,
      },
    });

    if (vinculoExistente) {
      throw new AppError(
        classeIdVinculo
          ? 'Esta disciplina já está vinculada a este curso para esta classe'
          : 'Disciplina já está vinculada a este curso (escopo geral)',
        409
      );
    }

    const vinculo = await prisma.cursoDisciplina.create({
      data: {
        cursoId,
        disciplinaId,
        classeId: classeIdVinculo,
        semestre: semestre ? Number(semestre) : null,
        trimestre: trimestre ? Number(trimestre) : null,
        cargaHoraria: cargaHoraria ? Number(cargaHoraria) : disciplina.cargaHoraria,
        obrigatoria: obrigatoria !== undefined ? Boolean(obrigatoria) : true,
        preRequisitoDisciplinaId: preReqId,
      },
      include: vinculoInclude,
    });

    res.status(201).json(vinculo);
  } catch (error) {
    next(error);
  }
};

/**
 * Desvincular disciplina de um curso
 * DELETE /cursos/:cursoId/disciplinas/:disciplinaId?classeId=uuid (opcional; omitido = vínculo global)
 */
export const desvincularDisciplina = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cursoId, disciplinaId } = req.params;
    const classeAlvo = classeIdFromQuery(req);
    const filter = addInstitutionFilter(req);

    const curso = await prisma.curso.findFirst({
      where: { id: cursoId, ...filter },
    });

    if (!curso) {
      throw new AppError('Curso não encontrado', 404);
    }

    const vinculo = await prisma.cursoDisciplina.findFirst({
      where: {
        cursoId,
        disciplinaId,
        classeId: classeAlvo,
      },
    });

    if (!vinculo) {
      throw new AppError('Vínculo não encontrado', 404);
    }

    const planosCount = await prisma.planoEnsino.count({
      where: {
        cursoId,
        disciplinaId,
      },
    });

    if (planosCount > 0) {
      throw new AppError('Não é possível desvincular disciplina com planos de ensino vinculados', 400);
    }

    await prisma.cursoDisciplina.delete({
      where: { id: vinculo.id },
    });

    res.json({ message: 'Disciplina desvinculada do curso com sucesso' });
  } catch (error) {
    next(error);
  }
};

/**
 * Atualizar vínculo curso–disciplina (semestre, obrigatória, pré-requisito).
 * PATCH /cursos/:cursoId/disciplinas/:disciplinaId?classeId=...
 */
export const atualizarVinculoDisciplina = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cursoId, disciplinaId } = req.params;
    const classeAlvo = classeIdFromQuery(req);
    const { semestre, trimestre, cargaHoraria, obrigatoria, preRequisitoDisciplinaId } = req.body;
    const filter = addInstitutionFilter(req);

    const curso = await prisma.curso.findFirst({
      where: { id: cursoId, ...filter },
    });
    if (!curso) {
      throw new AppError('Curso não encontrado', 404);
    }

    const vinculo = await prisma.cursoDisciplina.findFirst({
      where: {
        cursoId,
        disciplinaId,
        classeId: classeAlvo,
      },
    });
    if (!vinculo) {
      throw new AppError('Vínculo não encontrado', 404);
    }

    const data: Record<string, unknown> = {};
    if (semestre !== undefined) data.semestre = semestre === null || semestre === '' ? null : Number(semestre);
    if (trimestre !== undefined)
      data.trimestre = trimestre === null || trimestre === '' ? null : Number(trimestre);
    if (cargaHoraria !== undefined)
      data.cargaHoraria = cargaHoraria === null || cargaHoraria === '' ? null : Number(cargaHoraria);
    if (obrigatoria !== undefined) data.obrigatoria = Boolean(obrigatoria);

    if (preRequisitoDisciplinaId !== undefined) {
      if (preRequisitoDisciplinaId === null || preRequisitoDisciplinaId === '') {
        data.preRequisitoDisciplinaId = null;
      } else {
        const preId = String(preRequisitoDisciplinaId);
        if (preId === disciplinaId) {
          throw new AppError('A disciplina não pode ser pré-requisito de si mesma.', 400);
        }
        const pre = await prisma.disciplina.findFirst({
          where: { id: preId, ...filter },
        });
        if (!pre) {
          throw new AppError('Disciplina de pré-requisito não encontrada nesta instituição.', 404);
        }
        data.preRequisitoDisciplinaId = preId;
      }
    }

    const atualizado = await prisma.cursoDisciplina.update({
      where: { id: vinculo.id },
      data,
      include: vinculoInclude,
    });

    res.json(atualizado);
  } catch (error) {
    next(error);
  }
};

/**
 * Listar disciplinas de um curso
 * GET /cursos/:cursoId/disciplinas
 * Query opcional:
 * - `paraClasse=<uuid>` — Ensino Secundário: uma entrada por disciplina (preferência pelo vínculo da classe).
 *
 * REGRA MULTI-TENANT: Garante que curso e disciplinas pertencem à instituição do usuário
 */
export const listarDisciplinas = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cursoId } = req.params;
    const paraClasseRaw = req.query.paraClasse;
    const paraClasse =
      paraClasseRaw && String(paraClasseRaw).trim() !== '' && String(paraClasseRaw) !== 'null'
        ? String(paraClasseRaw).trim()
        : null;

    if (!req.user) {
      throw new AppError('Usuário não autenticado', 401);
    }

    const instituicaoId = req.user.instituicaoId;
    if (!instituicaoId && !req.user.roles?.includes('SUPER_ADMIN')) {
      throw new AppError('Usuário sem instituição associada', 403);
    }

    const filter = addInstitutionFilter(req);

    if (!cursoId) {
      throw new AppError('cursoId é obrigatório', 400);
    }

    const curso = await prisma.curso.findFirst({
      where: {
        id: cursoId,
        ...filter,
      },
      select: {
        id: true,
        nome: true,
        instituicaoId: true,
      },
    });

    if (!curso) {
      throw new AppError('Curso não encontrado', 404);
    }

    const instituicaoFilter = filter.instituicaoId || instituicaoId;

    const whereClause: Prisma.CursoDisciplinaWhereInput = {
      cursoId,
      ...(paraClasse
        ? {
            OR: [{ classeId: null }, { classeId: paraClasse }],
          }
        : {}),
    };

    if (instituicaoFilter) {
      whereClause.curso = {
        instituicaoId: instituicaoFilter,
      };
      whereClause.disciplina = {
        instituicaoId: instituicaoFilter,
      };
    }

    let vinculos = await prisma.cursoDisciplina.findMany({
      where: whereClause,
      include: {
        curso: {
          select: {
            id: true,
            nome: true,
            codigo: true,
          },
        },
        disciplina: {
          select: {
            id: true,
            nome: true,
            codigo: true,
            cargaHoraria: true,
            descricao: true,
            ativa: true,
            instituicaoId: true,
          },
        },
        classe: { select: { id: true, nome: true, codigo: true } },
        preRequisitoDisciplina: {
          select: { id: true, nome: true, codigo: true },
        },
      },
      orderBy: [
        { classeId: 'asc' },
        {
          disciplina: {
            nome: 'asc',
          },
        },
      ],
    });

    if (paraClasse) {
      vinculos = mergeCursoDisciplinasPorDisciplinaPreferindoClasse(vinculos, paraClasse);
      vinculos.sort((a, b) =>
        (a.disciplina?.nome || '').localeCompare(b.disciplina?.nome || '', 'pt')
      );
    }

    const vinculosValidos = vinculos.filter((vinculo) => {
      if (!vinculo.disciplina) return false;
      if (instituicaoId && vinculo.disciplina.instituicaoId !== instituicaoId) {
        console.warn('[listarDisciplinas] ⚠️ Disciplina de outra instituição filtrada:', {
          disciplinaId: vinculo.disciplina.id,
          disciplinaInstituicaoId: vinculo.disciplina.instituicaoId,
          userInstituicaoId: instituicaoId,
        });
        return false;
      }
      return true;
    });

    res.json(vinculosValidos);
  } catch (error) {
    next(error);
  }
};
