import { Request, Response, NextFunction } from 'express';
import { PermissionService, ModuloPermissao, TipoPermissao, ContextoPermissao, EstadoWorkflow } from '../services/permission.service.js';
import { AppError } from './errorHandler.js';
import prisma from '../lib/prisma.js';

/**
 * Middleware para verificar permissão específica
 * 
 * @example
 * router.post('/plano-ensino', 
 *   authenticate,
 *   checkPermission('PLANO_ENSINO', 'CREATE', 'plano_ensino'),
 *   controller.create
 * );
 */
export const checkPermission = (
  modulo: ModuloPermissao,
  acao: TipoPermissao,
  recurso: string
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await PermissionService.requirePermission(req, modulo, acao, recurso);
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware para verificar permissão com contexto académico
 * 
 * @example
 * router.post('/plano-ensino', 
 *   authenticate,
 *   checkPermissionWithContext('PLANO_ENSINO', 'CREATE', 'plano_ensino', (req) => ({
 *     disciplinaId: req.body.disciplinaId,
 *     cursoId: req.body.cursoId,
 *   })),
 *   controller.create
 * );
 */
export const checkPermissionWithContext = (
  modulo: ModuloPermissao,
  acao: TipoPermissao,
  recurso: string,
  getContext: (req: Request) => ContextoPermissao | undefined
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const contexto = getContext(req);
      await PermissionService.requirePermission(req, modulo, acao, recurso, contexto);
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware para verificar permissão com contexto e estado do workflow
 * 
 * @example
 * router.put('/plano-ensino/:id/submit', 
 *   authenticate,
 *   checkPermissionWithWorkflow(
 *     'PLANO_ENSINO', 
 *     'SUBMIT', 
 *     'plano_ensino',
 *     async (req) => {
 *       const plano = await getPlano(req.params.id);
 *       return {
 *         disciplinaId: plano.disciplinaId,
 *         cursoId: plano.cursoId,
 *       };
 *     },
 *     async (req) => {
 *       const plano = await getPlano(req.params.id);
 *       return {
 *         status: plano.status,
 *         bloqueado: plano.bloqueado,
 *       };
 *     }
 *   ),
 *   controller.submit
 * );
 */
export const checkPermissionWithWorkflow = (
  modulo: ModuloPermissao,
  acao: TipoPermissao,
  recurso: string,
  getContext?: (req: Request) => Promise<ContextoPermissao | undefined> | ContextoPermissao | undefined,
  getWorkflowState?: (req: Request) => Promise<EstadoWorkflow | undefined> | EstadoWorkflow | undefined
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const contexto = getContext ? await getContext(req) : undefined;
      const estadoWorkflow = getWorkflowState ? await getWorkflowState(req) : undefined;
      
      await PermissionService.requirePermission(req, modulo, acao, recurso, contexto, estadoWorkflow);
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware para verificar se usuário pode acessar contexto específico
 * Professores só podem acessar suas disciplinas/turmas
 * Coordenadores só podem acessar seus cursos
 */
export const checkContext = (
  getContext: (req: Request) => ContextoPermissao | Promise<ContextoPermissao>
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError('Não autenticado', 401);
      }

      const contexto = await getContext(req);

      // ADMIN, DIRECAO, SECRETARIA têm acesso total
      if (req.user.roles.some(r => ['ADMIN', 'DIRECAO', 'SECRETARIA', 'SUPER_ADMIN'].includes(r))) {
        return next();
      }

      // Verificar contexto do usuário
      const userContexts = await prisma.userContext.findMany({
        where: {
          userId: req.user.userId,
          ativo: true,
          instituicaoId: req.user.instituicaoId || undefined,
          ...(contexto.anoLetivo && { anoLetivo: contexto.anoLetivo }),
        },
      });

      if (userContexts.length === 0) {
        throw new AppError('Acesso negado: sem contexto académico atribuído', 403);
      }

      // PROFESSOR: verificar se tem atribuição
      if (req.user.roles.includes('PROFESSOR')) {
        const hasAccess = 
          (!contexto.disciplinaId || userContexts.some(uc => uc.disciplinaId === contexto.disciplinaId)) &&
          (!contexto.turmaId || userContexts.some(uc => uc.turmaId === contexto.turmaId));
        
        if (!hasAccess) {
          throw new AppError('Acesso negado: disciplina/turma não atribuída', 403);
        }
      }

      // COORDENADOR: verificar curso
      if (req.user.roles.includes('COORDENADOR')) {
        if (contexto.cursoId) {
          const hasAccess = userContexts.some(uc => uc.cursoId === contexto.cursoId);
          if (!hasAccess) {
            throw new AppError('Acesso negado: curso não sob sua coordenação', 403);
          }
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware para verificar estado do workflow
 * Garante que ações só sejam executadas em estados permitidos
 */
export const checkWorkflowState = (
  getEntityState: (req: Request) => Promise<EstadoWorkflow | undefined> | EstadoWorkflow | undefined,
  allowedStates: string[],
  action: string
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const estado = await getEntityState(req);

      if (!estado || !estado.status) {
        throw new AppError(`Estado do registro não encontrado para ${action}`, 400);
      }

      if (!allowedStates.includes(estado.status)) {
        throw new AppError(
          `Ação ${action} não permitida no estado atual: ${estado.status}`,
          400
        );
      }

      if (estado.bloqueado && action !== 'REOPEN') {
        throw new AppError('Registro bloqueado. Apenas administradores podem reabrir.', 403);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

