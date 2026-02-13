/**
 * ============================================================
 * MIDDLEWARE: resolveProfessor
 * ============================================================
 * 
 * OBJETIVO: Resolver professor institucional e anexar ao request
 * 
 * REGRA ARQUITETURAL SIGA/SIGAE (OPÇÃO B):
 * - Professor é ENTIDADE própria (tabela professores)
 * - JWT contém req.user.id (users.id) e req.user.instituicaoId
 * - Middleware resolve: userId + instituicaoId → professores.id
 * - Anexa req.professor ao request para uso nas rotas
 * 
 * COMPORTAMENTO:
 * 1. Extrai userId e instituicaoId do JWT (req.user)
 * 2. Busca professor na tabela professores
 * 3. Se NÃO encontrar: lança erro 400 claro
 * 4. Se encontrar: anexa req.professor com id, userId, instituicaoId
 * 
 * USO:
 * - Aplicar em rotas que requerem professor
 * - Após autenticação (auth middleware)
 * - Usar req.professor.id nas rotas (NUNCA req.user.id como professorId)
 * 
 * ============================================================
 */

import { Request, Response, NextFunction } from 'express';
import { resolveProfessor as resolveProfessorUtil, validateProfessorIdFromToken } from '../utils/professorResolver.js';
import { AppError } from './errorHandler.js';
import { requireTenantScope } from './auth.js';
import prisma from '../lib/prisma.js';

const FALLBACK_WARNING = '[resolveProfessor] Token antigo sem professorId - resolvido pelo banco. Recomende refresh/relogin ao utilizador.';

declare global {
  namespace Express {
    interface Request {
      professor?: {
        id: string; // professores.id
        userId: string; // users.id (referência)
        instituicaoId: string; // instituições.id
      };
    }
  }
}

/**
 * Middleware para resolver professor institucional
 * 
 * Extrai userId e instituicaoId do JWT e busca o professor na tabela professores.
 * Se encontrar, anexa req.professor ao request.
 * Se não encontrar, lança erro 400 claro.
 * 
 * @throws AppError se professor não for encontrado na instituição
 */
/**
 * Middleware resolveProfessor - FONTE ÚNICA DE VERDADE para resolução de professor
 * 
 * REGRA ARQUITETURAL SIGA/SIGAE (OPÇÃO B):
 * - Professor é ENTIDADE própria (tabela professores)
 * - JWT contém req.user.userId (users.id) e req.user.instituicaoId
 * - Middleware resolve: userId + instituicaoId → professores.id
 * - Anexa req.professor ao request para uso nas rotas
 * 
 * COMPORTAMENTO:
 * 1. Extrai userId e instituicaoId do JWT (req.user)
 * 2. Busca professor na tabela professores (filtro multi-tenant)
 * 3. Se NÃO encontrar: lança erro 400 claro e institucional
 * 4. Se encontrar: anexa req.professor com id, userId, instituicaoId
 * 
 * GARANTIAS:
 * - NÃO retorna user.id como fallback
 * - NÃO busca professor fora da instituição
 * - NÃO aceita professorId vindo do frontend (PROIBIDO)
 * - req.professor.id é SEMPRE professores.id (NÃO users.id)
 * - ADMIN também deve ter professor cadastrado para ações acadêmicas
 */
export const resolveProfessorMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // CORREÇÃO: Garantir assinatura (req, res, next) e que next é função
  // Evita erro "next is not a function" por uso incorreto do middleware
  if (typeof next !== 'function') {
    console.error('[resolveProfessorMiddleware] ERRO: next não é função. Verifique a ordem dos middlewares na rota.');
    return res.status(500).json({ message: 'Erro interno na resolução do professor. Contate o suporte.' });
  }

  try {
    // 1. Extrair do JWT
    // req.user.userId é o users.id (definido no middleware auth)
    const userId = req.user?.userId;
    let instituicaoId: string;
    try {
      instituicaoId = requireTenantScope(req);
    } catch (scopeError) {
      // FALLBACK: Professor sem instituicaoId no JWT (user.instituicaoId null)
      // Buscar professor por userId e usar professor.instituicaoId
      const isProfessor = req.user?.roles?.includes('PROFESSOR') && !req.user?.roles?.includes('ADMIN') && !req.user?.roles?.includes('SUPER_ADMIN');
      if (isProfessor && userId) {
        const prof = await prisma.professor.findFirst({
          where: { userId },
          select: { instituicaoId: true },
        });
        if (prof?.instituicaoId) {
          instituicaoId = prof.instituicaoId;
          if (process.env.NODE_ENV !== 'production') {
            console.log('[resolveProfessorMiddleware] Usando instituicaoId do professor (JWT sem instituicaoId):', instituicaoId);
          }
        } else {
          throw scopeError;
        }
      } else {
        throw scopeError;
      }
    }

    // Debug log para diagnóstico
    if (process.env.NODE_ENV !== 'production') {
      console.log('[resolveProfessorMiddleware] Tentando resolver professor:', {
        userId,
        instituicaoId,
        hasUserId: !!userId,
        hasInstituicaoId: !!instituicaoId,
        userRoles: req.user?.roles,
        reqUserKeys: req.user ? Object.keys(req.user) : [],
      });
    }

    if (!userId) {
      console.error('[resolveProfessorMiddleware] userId não encontrado:', {
        reqUser: req.user ? { ...req.user, roles: req.user.roles } : null,
      });
      return next(new AppError('Usuário não autenticado. Faça login novamente.', 401));
    }

    if (!instituicaoId) {
      console.error('[resolveProfessorMiddleware] instituicaoId não encontrado:', {
        userId,
        reqUserInstituicaoId: req.user?.instituicaoId,
      });
      return next(new AppError('Instituição não identificada. Faça login novamente.', 401));
    }

    // 2. Determinar se é ADMIN ou PROFESSOR
    const isAdmin = req.user?.roles?.includes('ADMIN') || req.user?.roles?.includes('SUPER_ADMIN');
    const isProfessor = req.user?.roles?.includes('PROFESSOR') && !isAdmin;
    
    // 3. PROIBIDO: Aceitar professorId do body para PROFESSOR
    // ADMIN/SUPER_ADMIN podem especificar professorId no body para criar planos para outros professores
    // PROFESSOR sempre usa req.professor.id (não pode criar para outros)
    if (isProfessor && (req.body?.professorId !== undefined || req.body?.professor_id !== undefined)) {
      return next(new AppError(
        'Não é permitido especificar professorId no body. O professor é identificado automaticamente pelo token de autenticação.',
        400
      ));
    }
    // ADMIN/SUPER_ADMIN podem especificar professorId no body (será validado no controller)

    // 4. Resolver professor (regra SIGAE enterprise - hardening)
    // Se req.user.professorId existe no token: validar no banco (NUNCA confiar cegamente)
    // Se não existe: resolver por (userId, instituicaoId) e preencher (fallback - token antigo)
    const tokenProfessorId = req.user?.professorId;
    
    try {
      let professor: { id: string; userId: string; instituicaoId: string };

      if (tokenProfessorId && typeof tokenProfessorId === 'string' && tokenProfessorId.trim()) {
        // Token tem professorId: validar contra banco (owner + tenant)
        const validated = await validateProfessorIdFromToken(tokenProfessorId, userId, instituicaoId);
        if (!validated) {
          console.warn('[resolveProfessor] professorId do token inválido (não pertence ao user/tenant):', {
            professorId: tokenProfessorId,
            userId,
            instituicaoId,
          });
          return next(new AppError('Token inválido para professor (professorId inconsistente). Faça login novamente.', 403));
        }
        professor = validated;
      } else {
        // Fallback: token sem professorId (antigo) - resolver pelo banco
        if (isProfessor) {
          console.warn(FALLBACK_WARNING, { userId, instituicaoId });
        }
        professor = await resolveProfessorUtil(userId, instituicaoId);
      }

      // 5. Anexar ao request (req.professor e req.user.professorId para compatibilidade)
      req.professor = {
        id: professor.id, // professores.id (NÃO users.id)
        userId: professor.userId, // users.id (referência)
        instituicaoId: professor.instituicaoId, // instituições.id
      };
      if (req.user) {
        (req.user as any).professorId = professor.id;
      }
    } catch (error) {
      // Se for ADMIN/SUPER_ADMIN e não encontrar professor, continuar sem req.professor
      // O controller aceitará professorId do body
      if (isAdmin && error instanceof AppError) {
        // ADMIN não tem registro na tabela professores - continuar sem req.professor
        // O controller aceitará professorId do body
        if (process.env.NODE_ENV !== 'production') {
          console.log('[resolveProfessorMiddleware] ADMIN sem registro na tabela professores - continuando sem req.professor');
        }
        return next();
      }
      
      // Se for PROFESSOR e não encontrar, lançar erro
      if (isProfessor) {
        return next(error);
      }
      
      // Outros casos, propagar erro
      return next(error);
    }

    // 6. Continuar para próxima rota (sempre return para evitar "next is not a function" por fall-through)
    return next();
  } catch (error) {
    // Se já é AppError, propagar (inclui erro 400 de professor não encontrado)
    if (error instanceof AppError) {
      return next(error);
    }

    // Erro inesperado - logar detalhes para debug
    console.error('[resolveProfessorMiddleware] Erro inesperado ao resolver professor:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: req.user?.userId,
      instituicaoId: req.user?.instituicaoId,
      userRoles: req.user?.roles,
    });

    // Erro inesperado (evita "next is not a function" ao usar return next())
    return next(
      new AppError(
        'Erro ao resolver professor. Verifique se está cadastrado na tabela professores e tente novamente.',
        500
      )
    );
  }
};

/**
 * Alias para resolveProfessorMiddleware - nome mais curto conforme especificação
 * 
 * USO OBRIGATÓRIO em todas as rotas que requerem professor.
 * Este middleware é a FONTE ÚNICA DE VERDADE para resolução de professor.
 */
export const resolveProfessor = resolveProfessorMiddleware;

/**
 * Middleware opcional para resolver professor - não falha se não encontrar
 * 
 * Usado em rotas onde professor é opcional (ex: GET /plano-ensino para admins)
 * Se encontrar professor, anexa req.professor. Se não encontrar, continua sem erro.
 * 
 * REGRA: Apenas anexa req.professor se o usuário tiver role PROFESSOR
 * REGRA SIGAE: Se token tem professorId, validar contra banco (403 se inconsistente)
 */
export const resolveProfessorOptional = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Apenas tentar resolver se o usuário for professor
    const isProfessor = req.user?.roles?.includes('PROFESSOR');
    
    if (!isProfessor) {
      return next();
    }

    const userId = req.user?.userId;
    let instituicaoId: string;
    try {
      instituicaoId = requireTenantScope(req);
    } catch {
      return next();
    }

    if (!userId) {
      return next();
    }

    const tokenProfessorId = req.user?.professorId;

    try {
      let professor: { id: string; userId: string; instituicaoId: string } | null = null;

      if (tokenProfessorId && typeof tokenProfessorId === 'string' && tokenProfessorId.trim()) {
        const validated = await validateProfessorIdFromToken(tokenProfessorId, userId, instituicaoId);
        if (!validated) {
          console.warn('[resolveProfessorOptional] professorId do token inválido:', { professorId: tokenProfessorId, userId });
          return next(new AppError('Token inválido para professor (professorId inconsistente). Faça login novamente.', 403));
        }
        professor = validated;
      } else {
        try {
          professor = await resolveProfessorUtil(userId, instituicaoId);
          if (professor) {
            console.warn(FALLBACK_WARNING, { userId, instituicaoId });
          }
        } catch {
          // Não encontrar é ok para optional
        }
      }

      if (professor) {
        req.professor = { id: professor.id, userId: professor.userId, instituicaoId: professor.instituicaoId };
        if (req.user) (req.user as any).professorId = professor.id;
      }
    } catch (error) {
      if (error instanceof AppError) {
        return next(error);
      }
      if (process.env.NODE_ENV !== 'production') {
        console.log('[resolveProfessorOptional] Professor não encontrado, continuando sem req.professor');
      }
    }

    return next();
  } catch (error) {
    return next();
  }
};

