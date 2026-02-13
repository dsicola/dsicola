import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter, requireTenantScope } from '../middlewares/auth.js';

/**
 * Vincular professor a um curso
 * POST /professores/:professorId/cursos
 */
export const vincularProfessorCurso = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { professorId } = req.params;
    const { cursoId } = req.body;

    if (!cursoId) {
      throw new AppError('Curso é obrigatório', 400);
    }

    const instituicaoId = requireTenantScope(req);
    const filter = addInstitutionFilter(req);

    // Verificar se professor existe e pertence à instituição
    const professor = await prisma.professor.findFirst({
      where: { 
        id: professorId,
        instituicaoId,
      },
      include: {
        user: {
          select: { id: true, nomeCompleto: true }
        }
      }
    });

    if (!professor) {
      throw new AppError('Professor não encontrado ou não pertence à sua instituição', 404);
    }

    // Verificar se curso existe e pertence à instituição
    const curso = await prisma.curso.findFirst({
      where: { id: cursoId, ...filter },
    });

    if (!curso) {
      throw new AppError('Curso não encontrado ou não pertence à sua instituição', 404);
    }

    // Verificar se vínculo já existe
    const vinculoExistente = await prisma.professorCurso.findUnique({
      where: {
        professorId_cursoId: {
          professorId,
          cursoId,
        },
      },
    });

    if (vinculoExistente) {
      throw new AppError('Professor já está vinculado a este curso', 409);
    }

    // Criar vínculo
    const vinculo = await prisma.professorCurso.create({
      data: {
        professorId,
        cursoId,
      },
      include: {
        professor: {
          include: {
            user: {
              select: { id: true, nomeCompleto: true }
            }
          }
        },
        curso: {
          select: { id: true, nome: true, codigo: true },
        },
      },
    });

    res.status(201).json(vinculo);
  } catch (error) {
    next(error);
  }
};

/**
 * Desvincular professor de um curso
 * DELETE /professores/:professorId/cursos/:cursoId
 */
export const desvincularProfessorCurso = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { professorId, cursoId } = req.params;
    const instituicaoId = requireTenantScope(req);
    const filter = addInstitutionFilter(req);

    // Verificar se professor existe e pertence à instituição
    const professor = await prisma.professor.findFirst({
      where: { 
        id: professorId,
        instituicaoId,
      },
    });

    if (!professor) {
      throw new AppError('Professor não encontrado ou não pertence à sua instituição', 404);
    }

    // Verificar se curso existe e pertence à instituição
    const curso = await prisma.curso.findFirst({
      where: { id: cursoId, ...filter },
    });

    if (!curso) {
      throw new AppError('Curso não encontrado ou não pertence à sua instituição', 404);
    }

    // Verificar se vínculo existe
    const vinculo = await prisma.professorCurso.findUnique({
      where: {
        professorId_cursoId: {
          professorId,
          cursoId,
        },
      },
    });

    if (!vinculo) {
      throw new AppError('Vínculo não encontrado', 404);
    }

    // Verificar se há planos de ensino usando este vínculo
    const planosCount = await prisma.planoEnsino.count({
      where: {
        professorId,
        cursoId,
      },
    });

    if (planosCount > 0) {
      throw new AppError('Não é possível desvincular professor com planos de ensino vinculados', 400);
    }

    await prisma.professorCurso.delete({
      where: {
        professorId_cursoId: {
          professorId,
          cursoId,
        },
      },
    });

    res.json({ message: 'Professor desvinculado do curso com sucesso' });
  } catch (error) {
    next(error);
  }
};

/**
 * Listar cursos de um professor
 * GET /professores/:professorId/cursos
 */
export const listarCursosProfessor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { professorId } = req.params;
    const instituicaoId = requireTenantScope(req);

    // Verificar se professor existe e pertence à instituição
    const professor = await prisma.professor.findFirst({
      where: { 
        id: professorId,
        instituicaoId,
      },
    });

    if (!professor) {
      throw new AppError('Professor não encontrado ou não pertence à sua instituição', 404);
    }

    const vinculos = await prisma.professorCurso.findMany({
      where: { professorId },
      include: {
        curso: {
          select: {
            id: true,
            nome: true,
            codigo: true,
            ativo: true,
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
 * Listar professores de um curso
 * GET /cursos/:cursoId/professores
 */
export const listarProfessoresCurso = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cursoId } = req.params;
    const filter = addInstitutionFilter(req);

    // Verificar se curso existe e pertence à instituição
    const curso = await prisma.curso.findFirst({
      where: { id: cursoId, ...filter },
    });

    if (!curso) {
      throw new AppError('Curso não encontrado ou não pertence à sua instituição', 404);
    }

    const vinculos = await prisma.professorCurso.findMany({
      where: { cursoId },
      include: {
        professor: {
          include: {
            user: {
              select: {
                id: true,
                nomeCompleto: true,
                email: true,
              }
            }
          }
        },
      },
      orderBy: {
        professor: {
          user: {
            nomeCompleto: 'asc',
          },
        },
      },
    });

    res.json(vinculos);
  } catch (error) {
    next(error);
  }
};

