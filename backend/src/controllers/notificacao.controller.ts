import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { requireTenantScope } from '../middlewares/auth.js';
import { AuditService } from '../services/audit.service.js';

/**
 * Listar notificações - FILTRADO POR TENANT
 */
export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // VALIDAÇÃO 1: Verificar autenticação
    if (!req.user) {
      throw new AppError('Não autenticado', 401);
    }

    // VALIDAÇÃO 2: Extrair roles corretamente (pode ser array de strings ou objetos)
    const userRoles = req.user.roles || [];
    const roleNames = userRoles.map((r: any) => typeof r === 'string' ? r : r.role || r.name).filter(Boolean);
    const isSuperAdmin = roleNames.includes('SUPER_ADMIN');
    
    // VALIDAÇÃO 3: Super Admin sem instituição não tem notificações específicas
    // Retornar array vazio em vez de erro
    let instituicaoId: string | null = null;
    try {
      instituicaoId = requireTenantScope(req);
    } catch (error: any) {
      // Se for Super Admin sem instituição, retornar array vazio
      if (isSuperAdmin && error?.message?.includes('escopo de instituição')) {
        return res.json([]);
      }
      // Se não for Super Admin, lançar o erro normalmente
      throw error;
    }

    const userId = req.user.userId;
    
    const { userId: queryUserId, limit } = req.query;

    // VALIDAÇÃO 4: Verificar se userId existe (crítico para usuários não-admin)
    if (!userId) {
      throw new AppError('Usuário não identificado no token', 401);
    }

    // Construir filtro
    const where: any = {
      instituicaoId, // SEMPRE filtrar por tenant
    };

    // Usuários só veem suas próprias notificações (exceto Admin/Secretaria)
    const isAdmin = roleNames.includes('ADMIN') || roleNames.includes('SECRETARIA') || isSuperAdmin;
    
    if (isAdmin) {
      // Admin pode ver todas as notificações da instituição
      // Se queryUserId foi fornecido, filtrar por esse usuário
      if (queryUserId && typeof queryUserId === 'string') {
        where.userId = queryUserId;
      }
      // Se não fornecido, retorna todas da instituição
    } else {
      // Usuário comum só vê suas próprias notificações
      // Garantir que userId não seja undefined
      where.userId = userId;
    }

    // VALIDAÇÃO 5: Validar limit
    let takeLimit = 50;
    if (limit) {
      const parsedLimit = parseInt(limit as string, 10);
      if (!isNaN(parsedLimit) && parsedLimit > 0 && parsedLimit <= 1000) {
        takeLimit = parsedLimit;
      }
    }

    const notificacoes = await prisma.notificacao.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: takeLimit,
    });

    res.json(notificacoes);
  } catch (error) {
    next(error);
  }
};

/**
 * Buscar notificação por ID - VALIDANDO TENANT
 */
export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // VALIDAÇÃO 1: Verificar autenticação
    if (!req.user) {
      throw new AppError('Não autenticado', 401);
    }

    const { id } = req.params;
    
    if (!id) {
      throw new AppError('ID da notificação é obrigatório', 400);
    }

    const instituicaoId = requireTenantScope(req);
    const userId = req.user.userId;
    const userRoles = req.user.roles || [];
    const roleNames = userRoles.map((r: any) => typeof r === 'string' ? r : r.role || r.name).filter(Boolean);

    const notificacao = await prisma.notificacao.findFirst({
      where: {
        id,
        instituicaoId, // SEMPRE validar tenant
      },
    });

    if (!notificacao) {
      throw new AppError('Notificação não encontrada ou acesso negado', 404);
    }

    // Validação: usuário só pode ver suas próprias notificações (exceto Admin)
    const isAdmin = roleNames.includes('ADMIN') || roleNames.includes('SECRETARIA') || roleNames.includes('SUPER_ADMIN');
    
    if (!isAdmin && notificacao.userId !== userId) {
      throw new AppError('Acesso negado: você só pode ver suas próprias notificações', 403);
    }

    res.json(notificacao);
  } catch (error) {
    next(error);
  }
};

/**
 * Criar notificação - COM VALIDAÇÃO DE TENANT
 */
export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // VALIDAÇÃO 1: Verificar autenticação
    if (!req.user) {
      throw new AppError('Não autenticado', 401);
    }

    // VALIDAÇÃO MULTI-TENANT: Rejeitar explicitamente instituicaoId do body (segurança)
    if (req.body.instituicaoId !== undefined || req.body.instituicao_id !== undefined) {
      throw new AppError('Não é permitido alterar a instituição. O sistema usa a instituição do usuário autenticado.', 400);
    }

    const instituicaoId = requireTenantScope(req);
    const userRoles = req.user.roles || [];
    const roleNames = userRoles.map((r: any) => typeof r === 'string' ? r : r.role || r.name).filter(Boolean);
    const { userId, titulo, mensagem, tipo, link } = req.body;

    if (!userId || !titulo || !mensagem) {
      throw new AppError('Campos obrigatórios: userId, titulo, mensagem', 400);
    }

    // VALIDAÇÃO 1: Verificar que usuário destino pertence ao tenant
    const usuarioDestino = await prisma.user.findUnique({
      where: { id: userId },
      select: { instituicaoId: true },
    });

    if (!usuarioDestino) {
      throw new AppError('Usuário destino não encontrado', 404);
    }

    // VALIDAÇÃO 2: Validar tenant
    if (usuarioDestino.instituicaoId !== instituicaoId) {
      // Registrar tentativa de comunicação inválida
      await AuditService.logAccessBlocked(req, {
        modulo: 'COMUNICACAO',
        acao: 'CREATE',
        recurso: 'Notificacao',
        motivo: 'Tentativa de criar notificação para usuário de outro tenant',
      });

      throw new AppError('Acesso negado: usuário destino pertence a outra instituição', 403);
    }

    // VALIDAÇÃO 3: Apenas Admin/Secretaria/Sistema pode criar notificações
    // (ou usuário para si mesmo em alguns casos específicos)
    const isSelfNotification = userId === req.user.userId;
    const canCreate = roleNames.includes('ADMIN') || 
                     roleNames.includes('SECRETARIA') || 
                     roleNames.includes('SUPER_ADMIN') ||
                     isSelfNotification;

    if (!canCreate) {
      await AuditService.logAccessBlocked(req, {
        modulo: 'COMUNICACAO',
        acao: 'CREATE',
        recurso: 'Notificacao',
        motivo: 'Usuário sem permissão para criar notificações',
      });

      throw new AppError('Acesso negado: apenas administradores podem criar notificações', 403);
    }

    // Criar notificação
    const notificacao = await prisma.notificacao.create({
      data: {
        userId,
        titulo,
        mensagem,
        tipo: tipo || 'info',
        link: link || null,
        instituicaoId, // SEMPRE definir tenant
      },
    });

    // Auditoria
    await AuditService.logCreate(req, {
      modulo: 'COMUNICACAO',
      entidade: 'Notificacao',
      entidadeId: notificacao.id,
      dadosNovos: { titulo, userId, tipo },
      observacao: 'Notificação criada',
    });

    res.status(201).json(notificacao);
  } catch (error) {
    next(error);
  }
};

/**
 * Atualizar notificação - VALIDANDO TENANT
 */
export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const instituicaoId = requireTenantScope(req);
    const data = req.body;

    // Buscar e validar tenant
    const notificacaoExistente = await prisma.notificacao.findFirst({
      where: {
        id,
        instituicaoId,
      },
    });

    if (!notificacaoExistente) {
      throw new AppError('Notificação não encontrada ou acesso negado', 404);
    }

    // Atualizar
    const notificacao = await prisma.notificacao.update({
      where: { id },
      data,
    });

    // Auditoria
    await AuditService.logUpdate(req, {
      modulo: 'COMUNICACAO',
      entidade: 'Notificacao',
      entidadeId: id,
      dadosAnteriores: notificacaoExistente,
      dadosNovos: data,
    });

    res.json(notificacao);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /notificacoes/:id/ler - Marcar uma notificação como lida
 */
export const marcarComoLida = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Não autenticado', 401);
    }

    const { id } = req.params;
    const instituicaoId = requireTenantScope(req);
    const userId = req.user.userId;

    if (!id) {
      throw new AppError('ID da notificação é obrigatório', 400);
    }

    const notificacao = await prisma.notificacao.findFirst({
      where: {
        id,
        instituicaoId,
      },
    });

    if (!notificacao) {
      throw new AppError('Notificação não encontrada ou acesso negado', 404);
    }

    // Usuário só pode marcar suas próprias notificações como lidas
    if (notificacao.userId !== userId) {
      throw new AppError('Acesso negado: você só pode marcar suas próprias notificações como lidas', 403);
    }

    const atualizada = await prisma.notificacao.update({
      where: { id },
      data: { lida: true },
    });

    res.json(atualizada);
  } catch (error) {
    next(error);
  }
};

/**
 * Marcar todas as notificações como lidas - VALIDANDO TENANT
 */
export const marcarTodasLidas = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // VALIDAÇÃO 1: Verificar autenticação
    if (!req.user) {
      throw new AppError('Não autenticado', 401);
    }

    const { userId: paramUserId } = req.params;
    const instituicaoId = requireTenantScope(req);
    const userId = req.user.userId;
    const userRoles = req.user.roles || [];
    const roleNames = userRoles.map((r: any) => typeof r === 'string' ? r : r.role || r.name).filter(Boolean);

    // Validar que usuário só marca suas próprias notificações como lidas
    const targetUserId = paramUserId || userId;

    if (!targetUserId) {
      throw new AppError('Usuário não identificado', 400);
    }

    const isAdmin = roleNames.includes('ADMIN') || roleNames.includes('SECRETARIA') || roleNames.includes('SUPER_ADMIN');
    
    if (targetUserId !== userId && !isAdmin) {
      throw new AppError('Acesso negado: você só pode marcar suas próprias notificações como lidas', 403);
    }

    // Validar tenant do usuário destino
    const usuario = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { instituicaoId: true },
    });

    if (!usuario || usuario.instituicaoId !== instituicaoId) {
      throw new AppError('Usuário não encontrado ou acesso negado', 404);
    }

    const resultado = await prisma.notificacao.updateMany({
      where: {
        userId: targetUserId,
        instituicaoId, // SEMPRE filtrar por tenant
        lida: false,
      },
      data: { lida: true },
    });

    // Auditoria
    await AuditService.log(req, {
      modulo: 'COMUNICACAO',
      acao: 'MESSAGE_READ',
      entidade: 'Notificacao',
      entidadeId: targetUserId,
      observacao: `${resultado.count} notificações marcadas como lidas`,
    });

    res.json({ success: true, marcadas: resultado.count });
  } catch (error) {
    next(error);
  }
};

/**
 * Remover notificação - VALIDANDO TENANT
 */
export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // VALIDAÇÃO 1: Verificar autenticação
    if (!req.user) {
      throw new AppError('Não autenticado', 401);
    }

    const { id } = req.params;
    
    if (!id) {
      throw new AppError('ID da notificação é obrigatório', 400);
    }

    const instituicaoId = requireTenantScope(req);
    const userId = req.user.userId;
    const userRoles = req.user.roles || [];
    const roleNames = userRoles.map((r: any) => typeof r === 'string' ? r : r.role || r.name).filter(Boolean);

    // Buscar e validar tenant
    const notificacao = await prisma.notificacao.findFirst({
      where: {
        id,
        instituicaoId,
      },
    });

    if (!notificacao) {
      throw new AppError('Notificação não encontrada ou acesso negado', 404);
    }

    // Validação: usuário só pode remover suas próprias notificações (exceto Admin)
    const isAdmin = roleNames.includes('ADMIN') || roleNames.includes('SECRETARIA') || roleNames.includes('SUPER_ADMIN');
    
    if (!isAdmin && notificacao.userId !== userId) {
      throw new AppError('Acesso negado: você só pode remover suas próprias notificações', 403);
    }

    // Auditoria antes de remover
    await AuditService.logDelete(req, {
      modulo: 'COMUNICACAO',
      entidade: 'Notificacao',
      entidadeId: id,
      dadosAnteriores: notificacao,
    });

    await prisma.notificacao.delete({ where: { id } });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
