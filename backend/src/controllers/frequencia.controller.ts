import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter, getInstituicaoIdFromAuth } from '../middlewares/auth.js';

export const getFrequencias = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { aulaId, alunoId, turmaId } = req.query;
    const filter = addInstitutionFilter(req);
    // REGRA SIGA/SIGAE (OPÇÃO B): Usar req.professor.id do middleware
    // Se middleware não foi aplicado, professorId será undefined (não é erro para ADMIN)
    const professorId = req.professor?.id;
    const isProfessor = req.user?.roles?.includes('PROFESSOR');

    const where: any = {};
    if (aulaId) where.aulaId = aulaId as string;
    if (alunoId) where.alunoId = alunoId as string;

    // If turmaId, get frequencias for all aulas of that turma
    if (turmaId) {
      // CRITICAL: Multi-tenant - verify turma belongs to institution
      const turmaWhere: any = { id: turmaId as string };
      if (filter.instituicaoId) {
        turmaWhere.instituicaoId = filter.instituicaoId;
      }

      // Se for professor, verificar se existe plano de ensino vinculando professor à turma
      if (isProfessor && professorId) {
        const planoEnsino = await prisma.planoEnsino.findFirst({
          where: {
            turmaId: turmaId as string,
            professorId,
            ...filter,
          },
          select: { id: true },
        });

        if (!planoEnsino) {
          // Professor não tem plano de ensino para esta turma
          return res.json([]);
        }
      }

      const turma = await prisma.turma.findFirst({
        where: turmaWhere,
        select: { id: true }
      });

      if (!turma) {
        if (isProfessor) {
          return res.json([]);
        }
        throw new AppError('Turma não encontrada ou sem permissão', 404);
      }

      const aulas = await prisma.aula.findMany({
        where: { turmaId: turma.id },
        select: { id: true }
      });
      where.aulaId = { in: aulas.map(a => a.id) };
    } else if (filter.instituicaoId) {
      // If no turmaId but has institution filter, filter through turmas
      const turmas = await prisma.turma.findMany({
        where: filter,
        select: { id: true }
      });
      const turmaIds = turmas.map(t => t.id);
      if (turmaIds.length > 0) {
        const aulas = await prisma.aula.findMany({
          where: { turmaId: { in: turmaIds } },
          select: { id: true }
        });
        where.aulaId = { in: aulas.map(a => a.id) };
      } else {
        return res.json([]);
      }
    } else if (isProfessor && professorId) {
      // Professor sees only frequencias from their turmas
      const turmasDoProfessor = await prisma.turma.findMany({
        where: {
          professorId,
          ...filter
        },
        select: { id: true }
      });
      const turmaIds = turmasDoProfessor.map(t => t.id);
      if (turmaIds.length > 0) {
        const aulas = await prisma.aula.findMany({
          where: { turmaId: { in: turmaIds } },
          select: { id: true }
        });
        where.aulaId = { in: aulas.map(a => a.id) };
      } else {
        return res.json([]);
      }
    }

    const frequencias = await prisma.frequencia.findMany({
      where,
      include: {
        aluno: { select: { id: true, nomeCompleto: true, numeroIdentificacao: true } },
        aula: {
          include: {
            turma: { select: { id: true, nome: true } }
          }
        }
      },
      orderBy: { aula: { data: 'desc' } }
    });

    res.json(frequencias);
  } catch (error) {
    next(error);
  }
};

export const getFrequenciaById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);

    const frequencia = await prisma.frequencia.findUnique({
      where: { id },
      include: {
        aluno: {
          select: {
            id: true,
            nomeCompleto: true,
            instituicaoId: true
          }
        },
        aula: {
          include: {
            turma: {
              select: {
                id: true,
                nome: true,
                instituicaoId: true
              }
            }
          }
        }
      }
    });

    if (!frequencia) {
      throw new AppError('Frequência não encontrada', 404);
    }

    // CRITICAL: Multi-tenant check
    if (filter.instituicaoId) {
      const turmaInstituicaoId = frequencia.aula.turma.instituicaoId;
      if (turmaInstituicaoId !== filter.instituicaoId) {
        throw new AppError('Frequência não encontrada', 404);
      }
    }

    res.json(frequencia);
  } catch (error) {
    next(error);
  }
};

export const createFrequencia = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // VALIDAÇÃO MULTI-TENANT: Rejeitar explicitamente instituicaoId do body (segurança)
    if (req.body.instituicaoId !== undefined || req.body.instituicao_id !== undefined) {
      throw new AppError('Não é permitido alterar a instituição. O sistema usa a instituição do usuário autenticado.', 400);
    }

    const { aulaId, alunoId, presente, justificativa, observacoes } = req.body;
    const filter = addInstitutionFilter(req);

    // CRITICAL: Multi-tenant - verify aula belongs to institution
    const aula = await prisma.aula.findUnique({
      where: { id: aulaId },
      include: {
        turma: {
          select: {
            id: true,
            instituicaoId: true
          }
        }
      }
    });

    if (!aula) {
      throw new AppError('Aula não encontrada', 404);
    }

    if (filter.instituicaoId && aula.turma.instituicaoId !== filter.instituicaoId) {
      throw new AppError('Acesso negado', 403);
    }

    // Verify aluno belongs to institution
    if (filter.instituicaoId) {
      const aluno = await prisma.user.findFirst({
        where: {
          id: alunoId,
          instituicaoId: filter.instituicaoId
        }
      });

      if (!aluno) {
        throw new AppError('Aluno não encontrado ou não pertence à sua instituição', 404);
      }
    }

    // Check if already exists
    const existing = await prisma.frequencia.findFirst({
      where: { aulaId, alunoId }
    });

    if (existing) {
      throw new AppError('Frequência já registrada para este aluno nesta aula', 400);
    }

    const frequencia = await prisma.frequencia.create({
      data: {
        aulaId,
        alunoId,
        presente: presente ?? false,
        justificativa,
        observacoes
      },
      include: {
        aluno: true,
        aula: true
      }
    });

    res.status(201).json(frequencia);
  } catch (error) {
    next(error);
  }
};

export const updateFrequencia = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { presente, justificativa, observacoes } = req.body;
    const filter = addInstitutionFilter(req);

    const existing = await prisma.frequencia.findUnique({
      where: { id },
      include: {
        aula: {
          include: {
            turma: {
              select: {
                id: true,
                instituicaoId: true
              }
            }
          }
        }
      }
    });

    if (!existing) {
      throw new AppError('Frequência não encontrada', 404);
    }

    // CRITICAL: Multi-tenant check
    if (filter.instituicaoId && existing.aula.turma.instituicaoId !== filter.instituicaoId) {
      throw new AppError('Frequência não encontrada', 404);
    }

    const frequencia = await prisma.frequencia.update({
      where: { id },
      data: {
        presente,
        justificativa,
        observacoes
      },
      include: {
        aluno: true,
        aula: true
      }
    });

    res.json(frequencia);
  } catch (error) {
    next(error);
  }
};

export const deleteFrequencia = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);

    const existing = await prisma.frequencia.findUnique({
      where: { id },
      include: {
        aula: {
          include: {
            turma: {
              select: {
                id: true,
                instituicaoId: true
              }
            }
          }
        }
      }
    });

    if (!existing) {
      throw new AppError('Frequência não encontrada', 404);
    }

    // CRITICAL: Multi-tenant check
    if (filter.instituicaoId && existing.aula.turma.instituicaoId !== filter.instituicaoId) {
      throw new AppError('Frequência não encontrada', 404);
    }

    await prisma.frequencia.delete({ where: { id } });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const registrarFrequenciasEmLote = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { aulaId, frequencias } = req.body;
    const filter = addInstitutionFilter(req);

    if (!Array.isArray(frequencias) || frequencias.length === 0) {
      throw new AppError('Lista de frequências inválida', 400);
    }

    // CRITICAL: Multi-tenant - verify aula belongs to institution
    const aula = await prisma.aula.findUnique({
      where: { id: aulaId },
      include: {
        turma: {
          select: {
            id: true,
            instituicaoId: true
          }
        }
      }
    });

    if (!aula) {
      throw new AppError('Aula não encontrada', 404);
    }

    if (filter.instituicaoId && aula.turma.instituicaoId !== filter.instituicaoId) {
      throw new AppError('Acesso negado', 403);
    }

    // Verify all alunos belong to institution
    if (filter.instituicaoId) {
      const alunoIds = frequencias.map((f: any) => f.alunoId);
      const alunos = await prisma.user.findMany({
        where: {
          id: { in: alunoIds },
          instituicaoId: filter.instituicaoId
        },
        select: { id: true }
      });

      if (alunos.length !== alunoIds.length) {
        throw new AppError('Alguns alunos não pertencem à sua instituição', 403);
      }
    }

    // Upsert each frequencia
    const results = await Promise.all(
      frequencias.map(async (f: any) => {
        return prisma.frequencia.upsert({
          where: {
            alunoId_aulaId: {
              alunoId: f.alunoId,
              aulaId,
            },
          },
          update: {
            presente: f.presente,
            justificativa: f.justificativa,
            observacoes: f.observacoes
          },
          create: {
            aulaId,
            alunoId: f.alunoId,
            presente: f.presente,
            justificativa: f.justificativa,
            observacoes: f.observacoes
          }
        });
      })
    );

    res.status(201).json(results);
  } catch (error) {
    next(error);
  }
};

export const getFrequenciasByAluno = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const alunoId = req.user?.userId;
    const filter = addInstitutionFilter(req);

    if (!alunoId) {
      return res.json([]);
    }

    // Additional security: verify aluno belongs to institution
    if (filter.instituicaoId) {
      const aluno = await prisma.user.findFirst({
        where: {
          id: alunoId,
          instituicaoId: filter.instituicaoId
        }
      });

      if (!aluno) {
        return res.json([]);
      }
    }

    const frequencias = await prisma.frequencia.findMany({
      where: { alunoId },
      include: {
        aula: {
          include: {
            turma: {
              include: {
                disciplina: true,
                curso: true,
                instituicao: { select: { id: true } }
              }
            }
          }
        }
      },
      orderBy: { aula: { data: 'desc' } }
    });

    // Filter by institution if needed (extra security layer)
    const filtered = filter.instituicaoId
      ? frequencias.filter(f => f.aula.turma.instituicaoId === filter.instituicaoId)
      : frequencias;

    res.json(filtered);
  } catch (error) {
    next(error);
  }
};
