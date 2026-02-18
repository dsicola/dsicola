/**
 * Impressão de Horário - PDF
 * RBAC: ADMIN, SECRETARIA podem imprimir turma; PROFESSOR apenas seu próprio horário
 */
import { Request, Response, NextFunction } from 'express';
import { requireTenantScope } from '../middlewares/auth.js';
import { gerarPDFHorarioTurma, gerarPDFHorarioProfessor } from '../services/horarioPrint.service.js';
import { AuditService } from '../services/audit.service.js';
import { AppError } from '../middlewares/errorHandler.js';

/**
 * GET /horarios/turma/:turmaId/imprimir
 * ADMIN, SECRETARIA
 */
export const imprimirTurma = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { turmaId } = req.params;
    const operadorNome = (req.user as { nomeCompleto?: string })?.nomeCompleto ?? req.user?.email ?? undefined;

    const pdfBuffer = await gerarPDFHorarioTurma(turmaId, instituicaoId, operadorNome);

    AuditService.log(req, {
      modulo: 'CONFIGURACAO',
      acao: 'GENERATE_REPORT',
      entidade: 'HORARIO',
      entidadeId: turmaId,
      dadosNovos: { turmaId, tipo: 'TURMA' },
      observacao: `Horário da turma ${turmaId} impresso`,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="horario-turma-${turmaId}.pdf"`
    );
    res.setHeader('Content-Length', pdfBuffer.length.toString());
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /horarios/professor/:professorId/imprimir
 * ADMIN, SECRETARIA: qualquer professor | PROFESSOR: apenas seu próprio (professorId = req.user.professorId)
 */
export const imprimirProfessor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { professorId } = req.params;
    const userProfessorId = req.user?.professorId;
    const operadorNome = (req.user as { nomeCompleto?: string })?.nomeCompleto ?? req.user?.email ?? undefined;

    // PROFESSOR só pode imprimir seu próprio horário
    if (req.user?.roles?.includes('PROFESSOR') && !req.user?.roles?.includes('ADMIN') && !req.user?.roles?.includes('SECRETARIA')) {
      if (userProfessorId !== professorId) {
        throw new AppError('Acesso negado: você só pode imprimir seu próprio horário', 403);
      }
    }

    const pdfBuffer = await gerarPDFHorarioProfessor(professorId, instituicaoId, operadorNome);

    AuditService.log(req, {
      modulo: 'CONFIGURACAO',
      acao: 'GENERATE_REPORT',
      entidade: 'HORARIO',
      entidadeId: professorId,
      dadosNovos: { professorId, tipo: 'PROFESSOR' },
      observacao: `Horário do professor ${professorId} impresso`,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="horario-professor-${professorId}.pdf"`
    );
    res.setHeader('Content-Length', pdfBuffer.length.toString());
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /horarios/:id/imprimir?tipo=turma|professor
 * Rota unificada: tipo=turma usa id como turmaId; tipo=professor usa id como professorId.
 * RBAC: mesmo que imprimirTurma/imprimirProfessor
 */
export const imprimirPorId = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { id } = req.params;
    const tipo = (req.query.tipo as string) || 'turma';

    if (!id) {
      throw new AppError('ID é obrigatório', 400);
    }

    if (tipo === 'professor') {
      const userProfessorId = req.user?.professorId;
      const isProfessorOnly = req.user?.roles?.includes('PROFESSOR') &&
        !req.user?.roles?.includes('ADMIN') &&
        !req.user?.roles?.includes('SECRETARIA');
      if (isProfessorOnly && userProfessorId !== id) {
        throw new AppError('Acesso negado: você só pode imprimir seu próprio horário', 403);
      }
      const operadorNome = (req.user as { nomeCompleto?: string })?.nomeCompleto ?? req.user?.email ?? undefined;
      const pdfBuffer = await gerarPDFHorarioProfessor(id, instituicaoId, operadorNome);
      AuditService.log(req, {
        modulo: 'CONFIGURACAO',
        acao: 'GENERATE_REPORT',
        entidade: 'HORARIO',
        entidadeId: id,
        dadosNovos: { id, tipo: 'PROFESSOR' },
        observacao: `Horário do professor ${id} impresso`,
      });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="horario-professor-${id}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length.toString());
      return res.send(pdfBuffer);
    }

    if (tipo === 'turma') {
      const canPrintTurma = req.user?.roles?.some((r: string) =>
        ['ADMIN', 'SUPER_ADMIN', 'SECRETARIA'].includes(r)
      );
      if (!canPrintTurma) {
        throw new AppError('Acesso negado: apenas ADMIN ou SECRETARIA podem imprimir horário da turma', 403);
      }
      const operadorNome = (req.user as { nomeCompleto?: string })?.nomeCompleto ?? req.user?.email ?? undefined;
      const pdfBuffer = await gerarPDFHorarioTurma(id, instituicaoId, operadorNome);
      AuditService.log(req, {
        modulo: 'CONFIGURACAO',
        acao: 'GENERATE_REPORT',
        entidade: 'HORARIO',
        entidadeId: id,
        dadosNovos: { id, tipo: 'TURMA' },
        observacao: `Horário da turma ${id} impresso`,
      });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="horario-turma-${id}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length.toString());
      return res.send(pdfBuffer);
    }

    throw new AppError('Parâmetro tipo inválido. Use turma ou professor', 400);
  } catch (error) {
    next(error);
  }
};
