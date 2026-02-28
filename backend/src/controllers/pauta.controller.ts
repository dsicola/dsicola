import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AuthenticatedRequest } from '../middlewares/auth.js';
import { addInstitutionFilter, requireTenantScope } from '../middlewares/auth.js';
import { AppError } from '../middlewares/errorHandler.js';
import { gerarPDFPauta } from '../services/pautaPrint.service.js';
import { AuditService } from '../services/audit.service.js';

// Get notas for pautas
export const getNotas = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const { turmaId, alunoId, ano, semestre } = req.query;
    const professorId = req.professor?.id;
    const isProfessor = req.user?.roles?.includes('PROFESSOR');

    const where: any = {};
    
    // CRITICAL: Multi-tenant - filtrar por instituição através do aluno
    if (filter.instituicaoId) {
      where.aluno = { instituicaoId: filter.instituicaoId };
    }
    
    // CRITICAL: Professor só vê suas notas (João nunca vê notas de Maria)
    if (isProfessor && professorId) {
      where.OR = [{ professorId }, { professorId: null }];
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
      
      // Professor: só exames dos SEUS planos (evita ver notas de outros professores)
      let examesWhere: { turmaId: string; planoEnsinoId?: { in: string[] } | null } = { turmaId: turma.id };
      if (isProfessor && professorId) {
        const planos = await prisma.planoEnsino.findMany({
          where: { turmaId: turma.id, professorId, ...(filter.instituicaoId && { instituicaoId: filter.instituicaoId }) },
          select: { id: true },
        });
        const planoIds = planos.map(p => p.id);
        if (planoIds.length === 0) return res.json([]);
        examesWhere.planoEnsinoId = { in: planoIds };
      }
      
      const exames = await prisma.exame.findMany({
        where: examesWhere,
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

/**
 * GET /pautas/:planoEnsinoId/imprimir?tipo=PROVISORIA|DEFINITIVA
 * Professor: apenas PROVISORIA do próprio plano. Admin/Secretaria: PROVISORIA ou DEFINITIVA.
 * DEFINITIVA só se pautaStatus = FECHADA.
 */
export const imprimirPauta = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { planoEnsinoId } = req.params;
    const tipo = (req.query.tipo as string) || 'PROVISORIA';
    const instituicaoId = requireTenantScope(req);
    const userId = req.user?.userId;
    const userRoles = req.user?.roles || [];

    if (!planoEnsinoId) {
      throw new AppError('planoEnsinoId é obrigatório', 400);
    }

    const planoEnsino = await prisma.planoEnsino.findFirst({
      where: { id: planoEnsinoId, instituicaoId },
      include: { professor: { include: { user: { select: { nomeCompleto: true } } } } },
    });

    if (!planoEnsino) {
      throw new AppError('Plano de ensino não encontrado ou acesso negado', 404);
    }

    const isProfessorOnly = userRoles.includes('PROFESSOR') && !userRoles.includes('ADMIN') && !userRoles.includes('SECRETARIA');
    if (isProfessorOnly) {
      if (!req.professor?.id || planoEnsino.professorId !== req.professor.id) {
        throw new AppError('Acesso negado: você só pode imprimir pauta das suas disciplinas', 403);
      }
      if (tipo === 'DEFINITIVA') {
        throw new AppError('Apenas ADMIN ou SECRETARIA podem imprimir pauta definitiva', 403);
      }
    }

    const userProfile = await prisma.user.findUnique({
      where: { id: userId },
      select: { nomeCompleto: true },
    });
    const operadorNome = userProfile?.nomeCompleto || req.user?.email || 'Sistema';
    const professorNome = planoEnsino.professor?.user?.nomeCompleto ?? '-';

    const pdfBuffer = await gerarPDFPauta(
      planoEnsinoId,
      instituicaoId,
      tipo === 'DEFINITIVA' ? 'DEFINITIVA' : 'PROVISORIA',
      operadorNome,
      professorNome
    );

    AuditService.log(req, {
      modulo: 'CONFIGURACAO',
      acao: 'GENERATE_REPORT',
      entidade: 'PAUTA',
      entidadeId: planoEnsinoId,
      dadosNovos: { planoEnsinoId, tipo },
      observacao: `Pauta ${tipo} impressa`,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="pauta-${planoEnsinoId}-${tipo}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length.toString());
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /pautas/:planoEnsinoId/fechar
 * Admin/Secretaria fecham como FECHADA. Só permitir se notas encerradas.
 */
export const fecharPauta = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { planoEnsinoId } = req.params;
    const instituicaoId = requireTenantScope(req);
    const userRoles = req.user?.roles || [];

    if (!userRoles.includes('ADMIN') && !userRoles.includes('SECRETARIA') && !userRoles.includes('SUPER_ADMIN')) {
      throw new AppError('Apenas ADMIN ou SECRETARIA podem fechar pauta como definitiva', 403);
    }

    const planoEnsino = await prisma.planoEnsino.findFirst({
      where: { id: planoEnsinoId, instituicaoId },
      include: { avaliacoes: true },
    });

    if (!planoEnsino) {
      throw new AppError('Plano de ensino não encontrado ou acesso negado', 404);
    }

    const avaliacoesNaoEncerradas = planoEnsino.avaliacoes.filter(
      (a) => a.estado !== 'ENCERRADO' && !a.fechada
    );
    if (avaliacoesNaoEncerradas.length > 0) {
      throw new AppError(
        'Não é possível fechar a pauta: existem avaliações com notas não encerradas. Encerre todas as avaliações primeiro.',
        400
      );
    }

    await prisma.planoEnsino.update({
      where: { id: planoEnsinoId },
      data: { pautaStatus: 'FECHADA' },
    });

    AuditService.log(req, {
      modulo: 'CONFIGURACAO',
      acao: 'UPDATE',
      entidade: 'PAUTA',
      entidadeId: planoEnsinoId,
      dadosNovos: { pautaStatus: 'FECHADA' },
      observacao: 'Pauta fechada como definitiva',
    });

    res.json({ success: true, message: 'Pauta fechada como definitiva' });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /pautas/:planoEnsinoId/provisoria
 * Professor pode marcar pauta como SUBMETIDA (apenas sua disciplina).
 * Admin/Secretaria também podem.
 */
export const gerarProvisoria = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { planoEnsinoId } = req.params;
    const instituicaoId = requireTenantScope(req);
    const userRoles = req.user?.roles || [];

    const planoEnsino = await prisma.planoEnsino.findFirst({
      where: { id: planoEnsinoId, instituicaoId },
    });

    if (!planoEnsino) {
      throw new AppError('Plano de ensino não encontrado ou acesso negado', 404);
    }

    const isProfessorOnly = userRoles.includes('PROFESSOR') && !userRoles.includes('ADMIN') && !userRoles.includes('SECRETARIA');
    if (isProfessorOnly) {
      if (!req.professor?.id || planoEnsino.professorId !== req.professor.id) {
        throw new AppError('Acesso negado: você só pode gerar pauta provisória das suas disciplinas', 403);
      }
    }

    await prisma.planoEnsino.update({
      where: { id: planoEnsinoId },
      data: { pautaStatus: 'SUBMETIDA' },
    });

    AuditService.log(req, {
      modulo: 'CONFIGURACAO',
      acao: 'UPDATE',
      entidade: 'PAUTA',
      entidadeId: planoEnsinoId,
      dadosNovos: { pautaStatus: 'SUBMETIDA' },
      observacao: 'Pauta marcada como provisória',
    });

    res.json({ success: true, message: 'Pauta marcada como provisória' });
  } catch (error) {
    next(error);
  }
};
