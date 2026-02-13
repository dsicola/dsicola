import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter } from '../middlewares/auth.js';

export const getAulas = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { turmaId, dataInicio, dataFim } = req.query;
    const filter = addInstitutionFilter(req);
    // REGRA ARQUITETURAL SIGA/SIGAE (OPÇÃO B): Usar req.professor.id do middleware
    // Se middleware não foi aplicado, professorId será undefined (não é erro)
    const professorId = req.professor?.id;
    const isProfessor = req.user?.roles?.includes('PROFESSOR');

    const where: any = {};
    
    // Se professor, garantir que só vê aulas das suas turmas
    // REGRA ARQUITETURAL SIGA/SIGAE (OPÇÃO B): Turma não tem professorId diretamente
    // Professor é vinculado via PlanoEnsino - buscar turmas através de planos de ensino
    if (isProfessor && professorId) {
      if (turmaId) {
        // Verificar se existe Plano de Ensino vinculando professor à turma
        const planoEnsino = await prisma.planoEnsino.findFirst({
          where: {
            turmaId: turmaId as string,
            professorId,
            ...filter
          },
          select: { id: true }
        });
        
        if (!planoEnsino) {
          return res.json([]); // Professor sem permissão para esta turma
        }
        
        where.turmaId = turmaId as string;
      } else {
        // Buscar todas as turmas do professor através de planos de ensino
        const planosEnsino = await prisma.planoEnsino.findMany({
          where: {
            professorId,
            ...filter,
            turmaId: { not: null } // Apenas planos com turma vinculada
          },
          select: { turmaId: true },
          distinct: ['turmaId']
        });
        
        const turmaIds = planosEnsino
          .map((plano) => plano.turmaId)
          .filter((id): id is string => id !== null && id !== undefined);
        
        if (turmaIds.length === 0) {
          return res.json([]); // Professor sem turmas
        }
        
        where.turmaId = { in: turmaIds };
      }
    } else {
      // Para outros roles, usar turmaId normalmente mas com filtro de instituição
      if (turmaId) {
        // Verificar se a turma pertence à instituição
        const turma = await prisma.turma.findFirst({
          where: {
            id: turmaId as string,
            ...filter
          },
          select: { id: true }
        });
        
        if (!turma) {
          return res.json([]);
        }
        
        where.turmaId = turmaId as string;
      } else if (filter.instituicaoId) {
        // Se não tem turmaId mas tem filtro de instituição, buscar turmas da instituição
        const turmas = await prisma.turma.findMany({
          where: filter,
          select: { id: true }
        });
        
        const turmaIds = turmas.map(t => t.id);
        if (turmaIds.length > 0) {
          where.turmaId = { in: turmaIds };
        } else {
          return res.json([]);
        }
      }
    }
    
    if (dataInicio || dataFim) {
      where.data = {};
      if (dataInicio) where.data.gte = new Date(dataInicio as string);
      if (dataFim) where.data.lte = new Date(dataFim as string);
    }

    const aulas = await prisma.aula.findMany({
      where,
      include: {
        turma: {
          include: {
            disciplina: { select: { id: true, nome: true } },
            curso: { select: { id: true, nome: true } }
          }
        },
        frequencias: {
          include: {
            aluno: { select: { id: true, nomeCompleto: true } }
          }
        }
      },
      orderBy: { data: 'desc' }
    });

    res.json(aulas);
  } catch (error) {
    next(error);
  }
};

export const getAulaById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);

    const aula = await prisma.aula.findUnique({
      where: { id },
      include: {
        turma: {
          include: {
            disciplina: true,
            curso: true,
            matriculas: {
              include: {
                aluno: true
              }
            }
          }
        },
        frequencias: {
          include: {
            aluno: true
          }
        }
      }
    });

    if (!aula) {
      throw new AppError('Aula não encontrada', 404);
    }

    // CRITICAL: Multi-tenant check
    if (filter.instituicaoId && aula.turma.instituicaoId !== filter.instituicaoId) {
      throw new AppError('Aula não encontrada', 404);
    }

    res.json(aula);
  } catch (error) {
    next(error);
  }
};

export const createAula = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { turmaId, data, conteudo, observacoes } = req.body;
    const filter = addInstitutionFilter(req);
    const instituicaoId = filter.instituicaoId;

    // CRITICAL: Multi-tenant - verify turma belongs to institution
    const turma = await prisma.turma.findFirst({
      where: {
        id: turmaId,
        ...filter
      },
      include: {
        disciplina: { select: { id: true, nome: true } },
        curso: { select: { id: true } },
        classe: { select: { id: true } }
      }
    });

    if (!turma) {
      throw new AppError('Turma não encontrada ou sem permissão', 404);
    }

    // REGRA MESTRA SIGA/SIGAE: Validar que existe Plano de Ensino ATIVO para esta turma/disciplina
    // NOTA: Este endpoint (Aula) é legado. O sistema atual usa AulaLancada vinculado ao PlanoEnsino.
    // Esta validação garante que mesmo o sistema legado respeita a regra mestre.
    if (turma.disciplina?.id && instituicaoId) {
      // Buscar ano letivo ativo
      const anoLetivoAtivo = await prisma.anoLetivo.findFirst({
        where: {
          instituicaoId,
          status: 'ATIVO'
        },
        select: { id: true, ano: true }
      });

      if (anoLetivoAtivo) {
        // Verificar se existe Plano de Ensino ATIVO para esta disciplina/turma
        const planoEnsino = await prisma.planoEnsino.findFirst({
          where: {
            disciplinaId: turma.disciplina.id,
            turmaId: turmaId,
            anoLetivoId: anoLetivoAtivo.id,
            instituicaoId,
            estado: 'APROVADO',
            bloqueado: false
          },
          select: { id: true }
        });

        if (!planoEnsino) {
          throw new AppError(
            `Não é possível criar aula sem um Plano de Ensino ATIVO. É necessário criar e aprovar um Plano de Ensino para a disciplina "${turma.disciplina.nome}" antes de criar aulas. Acesse o módulo de Plano de Ensino para criar o plano necessário.`,
            400
          );
        }
      }
    }

    const aula = await prisma.aula.create({
      data: {
        turmaId,
        data: new Date(data),
        conteudo,
        observacoes
      },
      include: {
        turma: {
          include: {
            disciplina: { select: { id: true, nome: true } },
            matriculas: {
              where: { status: 'Ativa' },
              select: { alunoId: true }
            }
          }
        }
      }
    });

    // Notificação acadêmica: Aula criada (notificar alunos da turma)
    try {
      const { NotificacaoService } = await import('../services/notificacao.service.js');
      if (aula.turma.matriculas && aula.turma.matriculas.length > 0) {
        const alunoIds = aula.turma.matriculas.map(m => m.alunoId);
        const dataFormatada = new Date(data).toLocaleDateString('pt-BR');
        await NotificacaoService.notificarAulaCriada(
          req,
          alunoIds,
          aula.turma.disciplina?.nome || 'N/A',
          dataFormatada,
          turma.instituicaoId || filter.instituicaoId || undefined
        );
      }
    } catch (notifError: any) {
      // Não bloquear se notificação falhar
      console.error('[createAula] Erro ao criar notificações (não crítico):', notifError.message);
    }

    res.status(201).json(aula);
  } catch (error) {
    next(error);
  }
};

export const updateAula = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { data, conteudo, observacoes } = req.body;
    const filter = addInstitutionFilter(req);

    const existing = await prisma.aula.findUnique({
      where: { id },
      include: {
        turma: {
          select: {
            id: true,
            instituicaoId: true
          }
        }
      }
    });

    if (!existing) {
      throw new AppError('Aula não encontrada', 404);
    }

    // CRITICAL: Multi-tenant check
    if (filter.instituicaoId && existing.turma.instituicaoId !== filter.instituicaoId) {
      throw new AppError('Aula não encontrada', 404);
    }

    const aula = await prisma.aula.update({
      where: { id },
      data: {
        data: data ? new Date(data) : undefined,
        conteudo,
        observacoes
      },
      include: {
        turma: true
      }
    });

    res.json(aula);
  } catch (error) {
    next(error);
  }
};

export const deleteAula = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);

    const existing = await prisma.aula.findUnique({
      where: { id },
      include: {
        turma: {
          select: {
            id: true,
            instituicaoId: true
          }
        }
      }
    });

    if (!existing) {
      throw new AppError('Aula não encontrada', 404);
    }

    // CRITICAL: Multi-tenant check
    if (filter.instituicaoId && existing.turma.instituicaoId !== filter.instituicaoId) {
      throw new AppError('Aula não encontrada', 404);
    }

    // Delete related frequencias first
    await prisma.frequencia.deleteMany({ where: { aulaId: id } });
    await prisma.aula.delete({ where: { id } });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
