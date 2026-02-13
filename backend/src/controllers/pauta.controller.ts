import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AuthenticatedRequest } from '../middlewares/auth.js';
import { addInstitutionFilter } from '../middlewares/auth.js';
import { AppError } from '../middlewares/errorHandler.js';

// Get notas for pautas
export const getNotas = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const { turmaId, alunoId, ano, semestre } = req.query;

    const where: any = {};
    
    // CRITICAL: Multi-tenant - filtrar por instituição através do aluno
    if (filter.instituicaoId) {
      where.aluno = { instituicaoId: filter.instituicaoId };
    }
    
    if (alunoId) {
      // Verificar se aluno pertence à instituição
      if (filter.instituicaoId) {
        const aluno = await prisma.user.findFirst({
          where: { id: alunoId as string, instituicaoId: filter.instituicaoId },
          select: { id: true },
        });
        if (!aluno) {
          return res.json([]);
        }
      }
      where.alunoId = alunoId as string;
    }
    
    if (turmaId) {
      // CRITICAL: Verificar se turma pertence à instituição
      const turmaWhere: any = { id: turmaId as string };
      if (filter.instituicaoId) {
        turmaWhere.instituicaoId = filter.instituicaoId;
      }
      
      const turma = await prisma.turma.findFirst({
        where: turmaWhere,
        select: { id: true },
      });
      
      if (!turma) {
        return res.json([]);
      }
      
      // Get notas for students in this turma through exames
      const exames = await prisma.exame.findMany({
        where: { turmaId: turma.id },
        select: { id: true },
      });
      where.exameId = { in: exames.map(e => e.id) };
    }

    const notas = await prisma.nota.findMany({
      where,
      include: {
        aluno: {
          select: { id: true, nomeCompleto: true, email: true },
        },
        exame: {
          include: {
            turma: {
              select: { id: true, nome: true, ano: true, semestre: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(notas);
  } catch (error) {
    next(error);
  }
};

// Get frequencias for pautas
export const getFrequencias = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const { turmaId, alunoId, ano } = req.query;

    const where: any = {};
    
    // CRITICAL: Multi-tenant - filtrar por instituição através do aluno
    if (filter.instituicaoId) {
      where.aluno = { instituicaoId: filter.instituicaoId };
    }
    
    if (alunoId) {
      // Verificar se aluno pertence à instituição
      if (filter.instituicaoId) {
        const aluno = await prisma.user.findFirst({
          where: { id: alunoId as string, instituicaoId: filter.instituicaoId },
          select: { id: true },
        });
        if (!aluno) {
          return res.json([]);
        }
      }
      where.alunoId = alunoId as string;
    }
    
    if (turmaId) {
      // CRITICAL: Verificar se turma pertence à instituição
      const turmaWhere: any = { id: turmaId as string };
      if (filter.instituicaoId) {
        turmaWhere.instituicaoId = filter.instituicaoId;
      }
      
      const turma = await prisma.turma.findFirst({
        where: turmaWhere,
        select: { id: true },
      });
      
      if (!turma) {
        return res.json([]);
      }
      
      // Get aulas for this turma
      const aulas = await prisma.aula.findMany({
        where: { turmaId: turma.id },
        select: { id: true },
      });
      where.aulaId = { in: aulas.map(a => a.id) };
    }

    const frequencias = await prisma.frequencia.findMany({
      where,
      include: {
        aluno: {
          select: { id: true, nomeCompleto: true, email: true },
        },
        aula: {
          include: {
            turma: {
              select: { id: true, nome: true, ano: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(frequencias);
  } catch (error) {
    next(error);
  }
};

// Get boletim for a student
export const getBoletim = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const { alunoId } = req.params;
    const { ano, semestre } = req.query;

    // CRITICAL: Multi-tenant - verificar se aluno pertence à instituição
    const alunoWhere: any = { id: alunoId };
    if (filter.instituicaoId) {
      alunoWhere.instituicaoId = filter.instituicaoId;
    }

    // Get student info
    const aluno = await prisma.user.findFirst({
      where: alunoWhere,
      select: {
        id: true,
        nomeCompleto: true,
        email: true,
        numeroIdentificacao: true,
      },
    });

    if (!aluno) {
      return res.status(404).json({ message: 'Aluno not found' });
    }

    // Build matriculas where (multi-tenant: turma.instituicaoId quando disponível)
    const matriculasWhere: any = { alunoId };
    if (filter.instituicaoId) {
      matriculasWhere.turma = ano
        ? { instituicaoId: filter.instituicaoId, ano: parseInt(ano as string) }
        : { instituicaoId: filter.instituicaoId };
    } else if (ano) {
      matriculasWhere.turma = { ano: parseInt(ano as string) };
    }

    // Get matriculas (com filtro multi-tenant por turma.instituicaoId)
    const matriculas = await prisma.matricula.findMany({
      where: matriculasWhere,
      include: {
        turma: {
          include: {
            curso: { select: { id: true, nome: true } },
            disciplina: { select: { id: true, nome: true } },
          },
        },
      },
    });

    // Get notas (com filtro multi-tenant por exame.turma.instituicaoId)
    const notasWhere: any = { alunoId };
    if (filter.instituicaoId) {
      notasWhere.exame = { turma: { instituicaoId: filter.instituicaoId } };
    }
    const notas = await prisma.nota.findMany({
      where: notasWhere,
      include: {
        exame: {
          include: {
            turma: {
              include: {
                disciplina: { select: { id: true, nome: true } },
              },
            },
          },
        },
      },
    });

    // Get frequencias count (com filtro multi-tenant por aula.turma.instituicaoId)
    const frequenciasWhere: any = { alunoId };
    if (filter.instituicaoId) {
      frequenciasWhere.aula = { turma: { instituicaoId: filter.instituicaoId } };
    }
    const frequencias = await prisma.frequencia.findMany({
      where: frequenciasWhere,
      include: {
        aula: {
          include: {
            turma: { select: { id: true, nome: true } },
          },
        },
      },
    });

    const totalAulas = frequencias.length;
    const presencas = frequencias.filter(f => f.presente).length;
    const percentualFrequencia = totalAulas > 0 ? (presencas / totalAulas) * 100 : 0;

    res.json({
      aluno,
      matriculas,
      notas,
      frequencia: {
        totalAulas,
        presencas,
        faltas: totalAulas - presencas,
        percentual: percentualFrequencia.toFixed(2),
      },
    });
  } catch (error) {
    next(error);
  }
};
