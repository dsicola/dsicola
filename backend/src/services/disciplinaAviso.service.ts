/**
 * Serviço de Mural da Disciplina - Professor ↔ Estudantes
 * Multi-tenant rigoroso + RBAC
 */
import { Request } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { requireTenantScope } from '../middlewares/auth.js';
import { NotificacaoService, TipoNotificacao } from './notificacao.service.js';

export interface CriarAvisoInput {
  titulo: string;
  conteudo: string;
  anexoUrl?: string;
}

export class DisciplinaAvisoService {
  /**
   * Validar que professor está vinculado à disciplina via PlanoEnsino
   */
  private static async validarProfessorVinculado(
    disciplinaId: string,
    professorId: string,
    instituicaoId: string
  ): Promise<boolean> {
    const plano = await prisma.planoEnsino.findFirst({
      where: {
        disciplinaId,
        professorId,
        instituicaoId,
      },
      select: { id: true },
    });
    return !!plano;
  }

  /**
   * Obter IDs dos alunos da disciplina (turmas que têm plano com essa disciplina)
   */
  private static async obterAlunoIdsDisciplina(
    disciplinaId: string,
    instituicaoId: string
  ): Promise<string[]> {
    const planos = await prisma.planoEnsino.findMany({
      where: {
        disciplinaId,
        instituicaoId,
        turmaId: { not: null },
      },
      select: { turmaId: true },
      distinct: ['turmaId'],
    });

    const turmaIds = planos
      .map((p) => p.turmaId)
      .filter((id): id is string => id != null);

    if (turmaIds.length === 0) return [];

    const matriculas = await prisma.matricula.findMany({
      where: {
        turmaId: { in: turmaIds },
        status: 'Ativa',
      },
      select: { alunoId: true },
      distinct: ['alunoId'],
    });

    return matriculas.map((m) => m.alunoId);
  }

  /**
   * Criar aviso na disciplina (apenas professor vinculado)
   */
  static async criar(
    req: Request,
    disciplinaId: string,
    data: CriarAvisoInput
  ) {
    const instituicaoId = requireTenantScope(req);
    const userId = req.user!.userId;

    if (!userId) {
      throw new AppError('Usuário não identificado', 401);
    }

    // Buscar professor
    const professor = await prisma.professor.findFirst({
      where: {
        userId,
        instituicaoId,
      },
      select: { id: true },
    });

    if (!professor) {
      throw new AppError('Apenas professores podem criar avisos', 403);
    }

    // Validar que disciplina existe e pertence ao tenant
    const disciplina = await prisma.disciplina.findFirst({
      where: {
        id: disciplinaId,
        instituicaoId,
      },
      select: { id: true, nome: true },
    });

    if (!disciplina) {
      throw new AppError('Disciplina não encontrada ou acesso negado', 404);
    }

    // Validar que professor está vinculado à disciplina
    const vinculado = await this.validarProfessorVinculado(
      disciplinaId,
      professor.id,
      instituicaoId
    );

    if (!vinculado) {
      throw new AppError(
        'Você não está vinculado a esta disciplina. Apenas professores da disciplina podem criar avisos.',
        403
      );
    }

    if (!data.titulo?.trim()) {
      throw new AppError('Título é obrigatório', 400);
    }
    if (!data.conteudo?.trim()) {
      throw new AppError('Conteúdo é obrigatório', 400);
    }

    const aviso = await prisma.disciplinaAviso.create({
      data: {
        disciplinaId,
        professorId: professor.id,
        titulo: data.titulo.trim(),
        conteudo: data.conteudo.trim(),
        anexoUrl: data.anexoUrl?.trim() || null,
        instituicaoId,
      },
      include: {
        professor: {
          select: {
            user: {
              select: { nomeCompleto: true },
            },
          },
        },
      },
    });

    // Notificações automáticas para alunos da disciplina
    try {
      const alunoIds = await this.obterAlunoIdsDisciplina(
        disciplinaId,
        instituicaoId
      );

      const link = `/disciplinas/${disciplinaId}/avisos`;
      const mensagem = data.conteudo.length > 100
        ? data.conteudo.substring(0, 100) + '...'
        : data.conteudo;

      for (const alunoId of alunoIds) {
        await NotificacaoService.criar(req, {
          userId: alunoId,
          titulo: `Novo aviso: ${data.titulo}`,
          mensagem: `${disciplina.nome}: ${mensagem}`,
          tipo: TipoNotificacao.AVISO_DISCIPLINA,
          link,
          instituicaoId,
        });
      }
    } catch (err: any) {
      console.error('[DisciplinaAvisoService] Erro ao criar notificações:', err.message);
      // Não falhar a criação do aviso
    }

    return aviso;
  }

  /**
   * Listar avisos da disciplina (professor ou aluno da turma)
   */
  static async listar(req: Request, disciplinaId: string) {
    const instituicaoId = requireTenantScope(req);
    const userId = req.user!.userId;

    if (!userId) {
      throw new AppError('Usuário não identificado', 401);
    }

    const userRoles = req.user!.roles || [];
    const roleNames = userRoles.map((r: any) => (typeof r === 'string' ? r : r.role || r.name)).filter(Boolean);
    const isProfessor = roleNames.includes('PROFESSOR');
    const isAluno = roleNames.includes('ALUNO');

    // Validar que disciplina existe e pertence ao tenant
    const disciplina = await prisma.disciplina.findFirst({
      where: {
        id: disciplinaId,
        instituicaoId,
      },
      select: { id: true },
    });

    if (!disciplina) {
      throw new AppError('Disciplina não encontrada ou acesso negado', 404);
    }

    // RBAC: Professor vinculado OU Aluno das turmas da disciplina
    if (isProfessor) {
      const professor = await prisma.professor.findFirst({
        where: { userId, instituicaoId },
        select: { id: true },
      });
      if (professor) {
        const vinculado = await this.validarProfessorVinculado(
          disciplinaId,
          professor.id,
          instituicaoId
        );
        if (!vinculado) {
          throw new AppError('Você não está vinculado a esta disciplina', 403);
        }
      }
    } else if (isAluno) {
      // Aluno: verificar se está matriculado em turma que tem a disciplina
      const alunoIds = await this.obterAlunoIdsDisciplina(
        disciplinaId,
        instituicaoId
      );
      if (!alunoIds.includes(userId)) {
        throw new AppError('Você não está matriculado nesta disciplina', 403);
      }
    } else {
      // ADMIN, SECRETARIA, SUPER_ADMIN podem ver
      const isAdmin = roleNames.includes('ADMIN') || roleNames.includes('SECRETARIA') || roleNames.includes('SUPER_ADMIN');
      if (!isAdmin) {
        throw new AppError('Acesso negado', 403);
      }
    }

    const avisos = await prisma.disciplinaAviso.findMany({
      where: {
        disciplinaId,
        instituicaoId,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        professor: {
          select: {
            user: {
              select: { nomeCompleto: true, avatarUrl: true },
            },
          },
        },
      },
    });

    return avisos;
  }
}
