import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { messages } from '../utils/messages.js';
import { addInstitutionFilter, requireTenantScope } from '../middlewares/auth.js';
import { validarPermissaoAvaliacao, validarPermissaoFecharAvaliacao } from '../middlewares/role-permissions.middleware.js';
import { AuditService, ModuloAuditoria, EntidadeAuditoria, AcaoAuditoria } from '../services/audit.service.js';
import { NotificacaoService } from '../services/notificacao.service.js';
import { TipoAvaliacao } from '@prisma/client';

/**
 * Criar avaliação
 * PROFESSOR: usa req.professor.id (middleware resolveProfessor)
 * ADMIN: pode especificar professorId no body
 */
export const createAvaliacao = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const instituicaoId = requireTenantScope(req);
    const isProfessor = req.user?.roles?.includes('PROFESSOR');

    const {
      planoEnsinoId,
      turmaId,
      professorId: professorIdBody,
      tipo,
      trimestre,
      semestreId,
      trimestreId,
      peso,
      data,
      nome,
      descricao,
    } = req.body;

    if (!planoEnsinoId || !turmaId || !tipo || !data) {
      throw new AppError('Plano de ensino, turma, tipo de avaliação e data são obrigatórios. Preencha todos os campos.', 400);
    }

    // Validar tipo
    const tiposValidos = Object.values(TipoAvaliacao);
    if (!tiposValidos.includes(tipo)) {
      throw new AppError(`tipo deve ser um de: ${tiposValidos.join(', ')}`, 400);
    }

    // Determinar professorId
    let professorId: string;
    if (isProfessor) {
      if (!req.professor?.id) {
        throw new AppError(messages.professor.naoIdentificado, 500);
      }
      professorId = req.professor.id;
    } else {
      // ADMIN pode especificar professorId
      professorId = professorIdBody;
      if (!professorId) {
        throw new AppError('É necessário selecionar o professor responsável pela avaliação.', 400);
      }
    }

    // Validar permissão
    await validarPermissaoAvaliacao(req, undefined, planoEnsinoId);

    // Verificar plano de ensino e turma
    const planoEnsino = await prisma.planoEnsino.findFirst({
      where: {
        id: planoEnsinoId,
        instituicaoId: instituicaoId || undefined,
      },
      include: {
        turma: { select: { id: true, nome: true, disciplina: { select: { nome: true } } } },
      },
    });

    if (!planoEnsino) {
      throw new AppError('Plano de ensino não encontrado', 404);
    }

    if (!planoEnsino.turmaId) {
      throw new AppError('Plano sem turma alocada. Aguarde a atribuição de turma antes de criar avaliações.', 400);
    }

    if (planoEnsino.turmaId !== turmaId) {
      throw new AppError('A turma informada não pertence a este plano de ensino', 400);
    }

    const turma = await prisma.turma.findFirst({
      where: { id: turmaId, instituicaoId: instituicaoId || undefined },
    });

    if (!turma) {
      throw new AppError('Turma não encontrada', 404);
    }

    const avaliacao = await prisma.avaliacao.create({
      data: {
        planoEnsinoId,
        turmaId,
        professorId,
        tipo,
        trimestre: trimestre ?? null,
        semestreId: semestreId ?? null,
        trimestreId: trimestreId ?? null,
        peso: peso ?? 1,
        data: new Date(data),
        nome: nome ?? null,
        descricao: descricao ?? null,
        instituicaoId: instituicaoId ?? null,
      },
      include: {
        planoEnsino: { select: { id: true, disciplina: { select: { nome: true } } } },
        turma: { select: { id: true, nome: true } },
        professor: { select: { id: true } },
      },
    });

    // Auditoria
    await AuditService.log(req, {
      modulo: ModuloAuditoria.AVALIACOES_NOTAS,
      entidade: EntidadeAuditoria.AVALIACAO,
      entidadeId: avaliacao.id,
      acao: AcaoAuditoria.CREATE,
      dadosAnteriores: null,
      dadosNovos: avaliacao,
    });

    // Notificar alunos da turma
    try {
      const matriculas = await prisma.matricula.findMany({
        where: { turmaId, status: 'Ativa' },
        select: { alunoId: true },
      });
      const alunoIds = matriculas.map((m) => m.alunoId);
      if (alunoIds.length > 0) {
        const disciplinaNome = avaliacao.planoEnsino?.disciplina?.nome || 'N/A';
        const avaliacaoNome = avaliacao.nome || avaliacao.tipo;
        await NotificacaoService.notificarAvaliacaoCriada(
          req,
          alunoIds,
          avaliacaoNome,
          disciplinaNome,
          instituicaoId ?? undefined
        );
      }
    } catch (err: any) {
      console.error('[createAvaliacao] Erro ao notificar alunos:', err?.message);
    }

    res.status(201).json(avaliacao);
  } catch (error) {
    next(error);
  }
};

/**
 * Listar avaliações (pode filtrar por turmaId)
 */
export const getAvaliacoes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const { turmaId, planoEnsinoId } = req.query;

    const where: any = {};
    if (filter.instituicaoId) {
      where.instituicaoId = filter.instituicaoId;
    }
    if (turmaId) {
      where.turmaId = turmaId as string;
    }
    if (planoEnsinoId) {
      where.planoEnsinoId = planoEnsinoId as string;
    }

    // Professor: filtrar apenas avaliações dos seus planos
    const isProfessor = req.user?.roles?.includes('PROFESSOR');
    if (isProfessor && req.professor?.id) {
      where.professorId = req.professor.id;
    }

    const avaliacoes = await prisma.avaliacao.findMany({
      where,
      include: {
        planoEnsino: {
          select: {
            id: true,
            disciplina: { select: { id: true, nome: true } },
          },
        },
        turma: {
          select: {
            id: true,
            nome: true,
            curso: { select: { id: true, nome: true } },
            classe: { select: { id: true, nome: true } },
            anoLetivoRef: { select: { id: true, ano: true } },
          },
        },
        professor: { select: { id: true } },
      },
      orderBy: { data: 'asc' },
    });

    res.json(avaliacoes);
  } catch (error) {
    next(error);
  }
};

/**
 * Buscar avaliação por ID
 */
export const getAvaliacaoById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const { id } = req.params;

    const where: any = { id };
    if (filter.instituicaoId) {
      where.instituicaoId = filter.instituicaoId;
    }

    const avaliacao = await prisma.avaliacao.findFirst({
      where,
      include: {
        planoEnsino: {
          select: {
            id: true,
            disciplina: { select: { id: true, nome: true } },
          },
        },
        turma: {
          select: {
            id: true,
            nome: true,
            curso: { select: { id: true, nome: true } },
            classe: { select: { id: true, nome: true } },
            anoLetivoRef: { select: { id: true, ano: true } },
          },
        },
        professor: { select: { id: true } },
      },
    });

    if (!avaliacao) {
      throw new AppError('Avaliação não encontrada', 404);
    }

    // Professor: verificar se é dono
    const isProfessor = req.user?.roles?.includes('PROFESSOR');
    if (isProfessor && req.professor?.id && avaliacao.professorId !== req.professor.id) {
      throw new AppError('Acesso negado: você não é o professor responsável por esta avaliação.', 403);
    }

    res.json(avaliacao);
  } catch (error) {
    next(error);
  }
};

/**
 * Atualizar avaliação
 */
export const updateAvaliacao = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const { id } = req.params;

    await validarPermissaoAvaliacao(req, id);

    const {
      tipo,
      trimestre,
      semestreId,
      trimestreId,
      peso,
      data,
      nome,
      descricao,
    } = req.body;

    const avaliacaoAntes = await prisma.avaliacao.findFirst({
      where: { id, instituicaoId: filter.instituicaoId || undefined },
    });

    if (!avaliacaoAntes) {
      throw new AppError('Avaliação não encontrada', 404);
    }

    if (avaliacaoAntes.fechada) {
      throw new AppError('Não é possível alterar uma avaliação fechada', 400);
    }

    const updateData: any = {};
    if (tipo !== undefined) updateData.tipo = tipo;
    if (trimestre !== undefined) updateData.trimestre = trimestre;
    if (semestreId !== undefined) updateData.semestreId = semestreId;
    if (trimestreId !== undefined) updateData.trimestreId = trimestreId;
    if (peso !== undefined) updateData.peso = peso;
    if (data !== undefined) updateData.data = new Date(data);
    if (nome !== undefined) updateData.nome = nome;
    if (descricao !== undefined) updateData.descricao = descricao;

    const avaliacao = await prisma.avaliacao.update({
      where: { id },
      data: updateData,
      include: {
        planoEnsino: { select: { id: true, disciplina: { select: { nome: true } } } },
        turma: { select: { id: true, nome: true } },
        professor: { select: { id: true } },
      },
    });

    await AuditService.log(req, {
      modulo: ModuloAuditoria.AVALIACOES_NOTAS,
      entidade: EntidadeAuditoria.AVALIACAO,
      entidadeId: avaliacao.id,
      acao: AcaoAuditoria.UPDATE,
      dadosAnteriores: avaliacaoAntes,
      dadosNovos: avaliacao,
    });

    res.json(avaliacao);
  } catch (error) {
    next(error);
  }
};

/**
 * Fechar avaliação (apenas ADMIN)
 */
export const fecharAvaliacao = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const { id } = req.params;

    await validarPermissaoFecharAvaliacao(req);

    const avaliacaoAntes = await prisma.avaliacao.findFirst({
      where: { id, instituicaoId: filter.instituicaoId || undefined },
    });

    if (!avaliacaoAntes) {
      throw new AppError('Avaliação não encontrada', 404);
    }

    if (avaliacaoAntes.fechada) {
      throw new AppError('Avaliação já está fechada', 400);
    }

    const userId = req.user?.userId;

    const avaliacao = await prisma.avaliacao.update({
      where: { id },
      data: {
        fechada: true,
        fechadaPor: userId ?? null,
        fechadaEm: new Date(),
      },
      include: {
        planoEnsino: { select: { id: true, disciplina: { select: { nome: true } } } },
        turma: { select: { id: true, nome: true } },
        professor: { select: { id: true } },
      },
    });

    await AuditService.log(req, {
      modulo: ModuloAuditoria.AVALIACOES_NOTAS,
      entidade: EntidadeAuditoria.AVALIACAO,
      entidadeId: avaliacao.id,
      acao: AcaoAuditoria.CLOSE,
      dadosAnteriores: avaliacaoAntes,
      dadosNovos: avaliacao,
    });

    res.json(avaliacao);
  } catch (error) {
    next(error);
  }
};

/**
 * Deletar avaliação
 */
export const deleteAvaliacao = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const { id } = req.params;

    await validarPermissaoAvaliacao(req, id);

    const avaliacaoAntes = await prisma.avaliacao.findFirst({
      where: { id, instituicaoId: filter.instituicaoId || undefined },
    });

    if (!avaliacaoAntes) {
      throw new AppError('Avaliação não encontrada', 404);
    }

    if (avaliacaoAntes.fechada) {
      throw new AppError('Não é possível excluir uma avaliação fechada', 400);
    }

    // Verificar se há notas lançadas
    const notasCount = await prisma.nota.count({
      where: { avaliacaoId: id },
    });

    if (notasCount > 0) {
      throw new AppError(
        `Não é possível excluir a avaliação pois existem ${notasCount} nota(s) lançada(s). Remova as notas primeiro.`,
        400
      );
    }

    await prisma.avaliacao.delete({
      where: { id },
    });

    await AuditService.log(req, {
      modulo: ModuloAuditoria.AVALIACOES_NOTAS,
      entidade: EntidadeAuditoria.AVALIACAO,
      entidadeId: id,
      acao: AcaoAuditoria.DELETE,
      dadosAnteriores: avaliacaoAntes,
      dadosNovos: null,
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
