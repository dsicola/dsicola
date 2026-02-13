import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter, requireTenantScope } from '../middlewares/auth.js';
import { AuditService } from '../services/audit.service.js';
import { resolveProfessorId } from '../utils/professorResolver.js';

/**
 * Listar mensagens respeitando multi-tenant
 * Valida que usuário só vê mensagens da sua instituição
 */
export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const userId = req.user?.userId;
    const userRoles = req.user?.roles || [];
    const { responsavelId, professorId, alunoId } = req.query;

    // Construir filtro baseado no papel do usuário
    const where: any = {
      instituicaoId, // SEMPRE filtrar por tenant
    };

    // Aluno/Responsável: só vê suas próprias mensagens
    if (userRoles.includes('ALUNO') || userRoles.includes('RESPONSAVEL')) {
      where.responsavelId = userId;
    }

    // Professor: só vê mensagens onde ele é o professor
    // REGRA: Usar req.professor.id se disponível (middleware aplicado), senão resolver manualmente
    if (userRoles.includes('PROFESSOR') && !userRoles.includes('ADMIN')) {
      if (req.professor?.id) {
        // Middleware resolveProfessor aplicado - usar req.professor.id
        where.professorId = req.professor.id;
      } else {
        // Fallback: resolver manualmente (rota sem middleware obrigatório)
        try {
          const professorId = await resolveProfessorId(userId!, instituicaoId);
          where.professorId = professorId;
        } catch (error) {
          // Se não encontrar professor, não retornar mensagens
          where.professorId = 'INVALID_PROFESSOR_ID';
        }
      }
    }

    // Admin/Secretaria: pode ver todas (mas sempre filtrado por tenant)
    if (userRoles.includes('ADMIN') || userRoles.includes('SECRETARIA')) {
      // Pode filtrar por responsavelId, professorId ou alunoId se fornecido
      if (responsavelId) where.responsavelId = responsavelId as string;
      if (professorId) where.professorId = professorId as string;
      if (alunoId) where.alunoId = alunoId as string;
    }

    const mensagens = await prisma.mensagemResponsavel.findMany({
      where,
      include: {
        // Incluir dados relacionados para validação
        // (ajustar conforme schema quando houver relações)
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(mensagens);
  } catch (error) {
    next(error);
  }
};

/**
 * Buscar mensagem por ID - validando tenant
 */
export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const instituicaoId = requireTenantScope(req);
    const userId = req.user?.userId;
    const userRoles = req.user?.roles || [];

    const mensagem = await prisma.mensagemResponsavel.findFirst({
      where: {
        id,
        instituicaoId, // SEMPRE validar tenant
      },
    });

    if (!mensagem) {
      throw new AppError('Mensagem não encontrada ou acesso negado', 404);
    }

    // Validação adicional de permissão
    const isResponsavel = mensagem.responsavelId === userId && userRoles.includes('RESPONSAVEL');
    // REGRA: Usar req.professor.id se disponível (middleware aplicado), senão resolver manualmente
    let isProfessor = false;
    if (userRoles.includes('PROFESSOR')) {
      if (req.professor?.id) {
        // Middleware resolveProfessor aplicado - usar req.professor.id
        isProfessor = mensagem.professorId === req.professor.id;
      } else {
        // Fallback: resolver manualmente (rota sem middleware obrigatório)
        try {
          const professorId = await resolveProfessorId(userId!, instituicaoId);
          isProfessor = mensagem.professorId === professorId;
        } catch (error) {
          // Se não encontrar professor, não tem permissão
          isProfessor = false;
        }
      }
    }
    const isAdmin = userRoles.includes('ADMIN') || userRoles.includes('SECRETARIA');

    if (!isResponsavel && !isProfessor && !isAdmin) {
      throw new AppError('Acesso negado: você não tem permissão para ver esta mensagem', 403);
    }

    res.json(mensagem);
  } catch (error) {
    next(error);
  }
};

/**
 * Criar mensagem - COM VALIDAÇÕES DE TENANT E PERMISSÃO
 */
export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // VALIDAÇÃO MULTI-TENANT: Rejeitar explicitamente instituicaoId do body (segurança)
    if (req.body.instituicaoId !== undefined || req.body.instituicao_id !== undefined) {
      throw new AppError('Não é permitido alterar a instituição. O sistema usa a instituição do usuário autenticado.', 400);
    }

    const instituicaoId = requireTenantScope(req);
    const userId = req.user?.userId;
    const userRoles = req.user?.roles || [];
    const { responsavelId, professorId, alunoId, assunto, mensagem } = req.body;

    if (!responsavelId || !professorId || !alunoId || !assunto || !mensagem) {
      throw new AppError('Campos obrigatórios: responsavelId, professorId, alunoId, assunto, mensagem', 400);
    }

    // VALIDAÇÃO 1: Responsável deve ser o usuário logado (ou admin)
    if (!userRoles.includes('ADMIN') && !userRoles.includes('SECRETARIA')) {
      if (responsavelId !== userId || !userRoles.includes('RESPONSAVEL')) {
        throw new AppError('Você só pode enviar mensagens como responsável', 403);
      }
    }

    // VALIDAÇÃO 2: Verificar que todos pertencem à mesma instituição
    // REGRA ARQUITETURAL SIGA/SIGAE: professorId DEVE ser professores.id (não users.id)
    // PROIBIDO: Aceitar users.id - frontend DEVE enviar professores.id
    // NÃO há lógica híbrida ou legacy - apenas professores.id é aceito
    const professor = await prisma.professor.findFirst({
      where: { id: professorId, instituicaoId },
      select: { id: true, userId: true }
    });
    
    if (!professor) {
      throw new AppError(
        'Professor não encontrado ou não pertence à sua instituição. O professorId deve ser um ID válido da tabela professores (não users.id).',
        404
      );
    }
    
    const finalProfessorId = professor.id;
    
    const [responsavel, professorUser, aluno] = await Promise.all([
      prisma.user.findUnique({ where: { id: responsavelId }, select: { instituicaoId: true } }),
      prisma.professor.findUnique({ where: { id: finalProfessorId }, select: { userId: true, instituicaoId: true } }),
      prisma.user.findUnique({ where: { id: alunoId }, select: { instituicaoId: true } }),
    ]);

    if (!responsavel || !professorUser || !aluno) {
      throw new AppError('Responsável, professor ou aluno não encontrados', 404);
    }

    // VALIDAÇÃO 3: Todos devem pertencer ao mesmo tenant
    if (responsavel.instituicaoId !== instituicaoId || 
        professorUser.instituicaoId !== instituicaoId || 
        aluno.instituicaoId !== instituicaoId) {
      
      // Registrar tentativa de comunicação inválida
      await AuditService.logAccessBlocked(req, {
        modulo: 'COMUNICACAO',
        acao: 'CREATE',
        recurso: 'MensagemResponsavel',
        motivo: 'Tentativa de comunicação entre diferentes tenants',
      });

      throw new AppError('Acesso negado: responsável, professor e aluno devem pertencer à mesma instituição', 403);
    }

    // VALIDAÇÃO 4: Verificar relação responsável-aluno
    const responsavelAluno = await prisma.responsavelAluno.findUnique({
      where: {
        responsavelId_alunoId: {
          responsavelId,
          alunoId,
        },
      },
    });

    if (!responsavelAluno) {
      await AuditService.logAccessBlocked(req, {
        modulo: 'COMUNICACAO',
        acao: 'CREATE',
        recurso: 'MensagemResponsavel',
        motivo: 'Responsável não está relacionado ao aluno',
      });

      throw new AppError('Acesso negado: você não é responsável por este aluno', 403);
    }

    // VALIDAÇÃO 5: Verificar que professor leciona para o aluno
    // Buscar disciplinas do aluno onde o professor leciona
    // CORREÇÃO: Usar finalProfessorId (professores.id) ao invés de professorId do body
    const professorDisciplina = await prisma.professorDisciplina.findFirst({
      where: {
        professorId: finalProfessorId,
        disciplina: {
          turmas: {
            some: {
              matriculas: {
                some: {
                  alunoId,
                  status: 'Ativa',
                },
              },
            },
          },
        },
      },
    });

    if (!professorDisciplina && !userRoles.includes('ADMIN') && !userRoles.includes('SECRETARIA')) {
      // Admin/Secretaria pode criar mensagens sem validação de disciplina
      // Mas vamos registrar
      console.warn(`[Comunicação] Mensagem criada sem validação de disciplina (Admin/Secretaria): ${userId}`);
    }

    // Criar mensagem
    // CORREÇÃO: Usar finalProfessorId (professores.id) ao invés de professorId do body
    const novaMensagem = await prisma.mensagemResponsavel.create({
      data: {
        responsavelId,
        professorId: finalProfessorId, // Sempre usar professores.id
        alunoId,
        assunto,
        mensagem,
        instituicaoId, // SEMPRE definir tenant
      },
    });

    // Auditoria
    await AuditService.logCreate(req, {
      modulo: 'COMUNICACAO',
      entidade: 'MensagemResponsavel',
      entidadeId: novaMensagem.id,
      dadosNovos: { assunto, responsavelId, professorId, alunoId },
      observacao: 'Mensagem criada entre responsável e professor',
    });

    res.status(201).json(novaMensagem);
  } catch (error) {
    next(error);
  }
};

/**
 * Responder mensagem - COM VALIDAÇÃO DE TENANT
 */
export const responder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { resposta } = req.body;
    const instituicaoId = requireTenantScope(req);
    const userId = req.user?.userId;
    const userRoles = req.user?.roles || [];

    if (!resposta) {
      throw new AppError('Resposta é obrigatória', 400);
    }

    // Buscar mensagem e validar tenant
    const mensagem = await prisma.mensagemResponsavel.findFirst({
      where: {
        id,
        instituicaoId, // SEMPRE validar tenant
      },
    });

    if (!mensagem) {
      throw new AppError('Mensagem não encontrada ou acesso negado', 404);
    }

    // Validação: apenas professor pode responder
    // REGRA: Middleware resolveProfessor é OBRIGATÓRIO nesta rota - usar req.professor.id
    if (!req.professor?.id) {
      throw new AppError('Professor não identificado. Middleware resolveProfessor deve ser aplicado nesta rota.', 500);
    }
    
    const isProfessorOfMessage = mensagem.professorId === req.professor.id;
    if (!isProfessorOfMessage && !userRoles.includes('ADMIN') && !userRoles.includes('SECRETARIA')) {
      await AuditService.logAccessBlocked(req, {
        modulo: 'COMUNICACAO',
        acao: 'UPDATE',
        recurso: 'MensagemResponsavel',
        motivo: 'Usuário não é o professor da mensagem',
      });

      throw new AppError('Acesso negado: apenas o professor pode responder', 403);
    }

    const mensagemAtualizada = await prisma.mensagemResponsavel.update({
      where: { id },
      data: {
        resposta,
        dataResposta: new Date(),
      },
    });

    // Auditoria
    await AuditService.logUpdate(req, {
      modulo: 'COMUNICACAO',
      entidade: 'MensagemResponsavel',
      entidadeId: id,
      dadosAnteriores: { resposta: mensagem.resposta },
      dadosNovos: { resposta },
      observacao: 'Mensagem respondida pelo professor',
    });

    res.json(mensagemAtualizada);
  } catch (error) {
    next(error);
  }
};

/**
 * Marcar mensagem como lida - COM VALIDAÇÃO DE TENANT
 */
export const marcarLida = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const instituicaoId = requireTenantScope(req);
    const userId = req.user?.userId;
    const userRoles = req.user?.roles || [];

    // Buscar e validar tenant
    const mensagem = await prisma.mensagemResponsavel.findFirst({
      where: {
        id,
        instituicaoId,
      },
    });

    if (!mensagem) {
      throw new AppError('Mensagem não encontrada ou acesso negado', 404);
    }

    // Validação: apenas destinatário pode marcar como lida
    // REGRA: Usar req.professor.id se disponível (middleware aplicado), senão resolver manualmente
    let isProfessorDestinatario = false;
    if (userRoles.includes('PROFESSOR')) {
      if (req.professor?.id) {
        // Middleware resolveProfessor aplicado - usar req.professor.id
        isProfessorDestinatario = mensagem.professorId === req.professor.id;
      } else {
        // Fallback: resolver manualmente (rota sem middleware obrigatório)
        try {
          const professorId = await resolveProfessorId(userId!, instituicaoId);
          isProfessorDestinatario = mensagem.professorId === professorId;
        } catch (error) {
          isProfessorDestinatario = false;
        }
      }
    }
    const isDestinatario = mensagem.responsavelId === userId || isProfessorDestinatario;
    if (!isDestinatario) {
      throw new AppError('Acesso negado: apenas o destinatário pode marcar como lida', 403);
    }

    const mensagemAtualizada = await prisma.mensagemResponsavel.update({
      where: { id },
      data: { lida: true },
    });

    // Auditoria
    await AuditService.log(req, {
      modulo: 'COMUNICACAO',
      acao: 'MESSAGE_READ',
      entidade: 'MensagemResponsavel',
      entidadeId: id,
      observacao: 'Mensagem marcada como lida',
    });

    res.json(mensagemAtualizada);
  } catch (error) {
    next(error);
  }
};

/**
 * Remover mensagem - COM VALIDAÇÃO DE TENANT
 */
export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const instituicaoId = requireTenantScope(req);
    const userRoles = req.user?.roles || [];

    // Buscar e validar tenant
    const mensagem = await prisma.mensagemResponsavel.findFirst({
      where: {
        id,
        instituicaoId,
      },
    });

    if (!mensagem) {
      throw new AppError('Mensagem não encontrada ou acesso negado', 404);
    }

    // Apenas Admin/Secretaria pode remover
    if (!userRoles.includes('ADMIN') && !userRoles.includes('SECRETARIA')) {
      throw new AppError('Acesso negado: apenas administradores podem remover mensagens', 403);
    }

    // Auditoria antes de remover
    await AuditService.logDelete(req, {
      modulo: 'COMUNICACAO',
      entidade: 'MensagemResponsavel',
      entidadeId: id,
      dadosAnteriores: mensagem,
      observacao: 'Mensagem removida por administrador',
    });

    await prisma.mensagemResponsavel.delete({ where: { id } });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
