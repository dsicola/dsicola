import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';
import { AppError } from './errorHandler.js';
import { UserRole } from '@prisma/client';
import { bloquearAcessoSeEncerrado } from './rh-status.middleware.js';

// Regex para validar UUID v4
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface JwtPayload {
  sub?: string; // Subject: user.id (padrão JWT)
  userId?: string; // Compatibilidade com tokens antigos
  email: string;
  instituicaoId: string | null; // Sempre presente no token (pode ser null para SUPER_ADMIN)
  roles?: UserRole[]; // Roles incluídos no token para evitar busca no DB
  tipoAcademico?: 'SUPERIOR' | 'SECUNDARIO' | null; // Tipo acadêmico (tipoInstituicao)
  professorId?: string | null; // professores.id - apenas para PROFESSOR
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string; // user.id
        email: string;
        instituicaoId: string | null; // Sempre presente (pode ser null)
        roles: UserRole[]; // user.perfil
        tipoAcademico?: 'SUPERIOR' | 'SECUNDARIO' | null; // Tipo acadêmico (tipoInstituicao)
        professorId?: string | null; // professores.id - apenas para PROFESSOR
      };
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string; // user.id
    email: string;
    instituicaoId: string | null; // Sempre presente (pode ser null)
    roles: UserRole[]; // user.perfil
    tipoAcademico?: 'SUPERIOR' | 'SECUNDARIO' | null; // Tipo acadêmico (tipoInstituicao)
    professorId?: string | null; // professores.id - apenas para PROFESSOR
  };
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    let token: string | undefined;
    
    // Try to get token from Authorization header first
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else {
      // Fallback: try to get token from query parameter (for signed URLs)
      token = req.query.token as string | undefined;
    }
    
    if (!token) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[AUTH] ❌ Token não fornecido:', {
          route: `${req.method} ${req.path}`,
          hasAuthHeader: !!req.headers.authorization,
        });
      }
      const error = new AppError('Token não fornecido', 401);
      (error as any).reason = 'TOKEN_MISSING';
      throw error;
    }
    
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'secret'
    ) as JwtPayload;

    // Extrair userId do sub (subject) - padrão JWT, ou userId para compatibilidade
    const userId = decoded.sub || decoded.userId;
    if (!userId) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[AUTH] ❌ Token sem userId/sub:', {
          decoded: Object.keys(decoded),
          route: `${req.method} ${req.path}`,
        });
      }
      const error = new AppError('Token inválido: identificação do usuário não encontrada', 401);
      (error as any).reason = 'INVALID_TOKEN_MISSING_USER_ID';
      throw error;
    }

    // Validar que instituicaoId está no token (pode ser null para SUPER_ADMIN, mas deve estar presente)
    if (decoded.instituicaoId === undefined) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[AUTH] ❌ Token sem instituicaoId:', {
          userId: userId,
          email: decoded.email,
          route: `${req.method} ${req.path}`,
        });
      }
      const error = new AppError('Token inválido: instituição não identificada', 401);
      (error as any).reason = 'INVALID_TOKEN_MISSING_INSTITUICAO_ID';
      throw error;
    }

    // Validar instituicaoId: deve ser UUID válido ou null (apenas SUPER_ADMIN)
    // NÃO normalizar para null se inválido - tokens devem ter valores válidos
    let validatedInstituicaoId: string | null = null;
    if (decoded.instituicaoId) {
      // Garantir que é uma string
      const rawInstituicaoId = typeof decoded.instituicaoId === 'string' 
        ? decoded.instituicaoId 
        : String(decoded.instituicaoId || '');
      
      const trimmed = rawInstituicaoId.trim();
      
      // Validar formato UUID v4
      if (trimmed && UUID_V4_REGEX.test(trimmed)) {
        validatedInstituicaoId = trimmed;
      } else if (trimmed) {
        // Token com instituicaoId inválido - erro de configuração
        // Isso pode acontecer com tokens antigos gerados antes da validação
        if (process.env.NODE_ENV !== 'production') {
          console.error('[AUTH] ❌ Token com instituicaoId inválido:', {
            userId: userId,
            email: decoded.email,
            instituicaoId: decoded.instituicaoId,
            trimmed,
            tipo: typeof decoded.instituicaoId,
            route: `${req.method} ${req.path}`,
          });
        }
        const error = new AppError('Token inválido: ID de instituição inválido. Faça login novamente.', 401);
        (error as any).reason = 'INVALID_TOKEN_INSTITUICAO_ID';
        throw error;
      }
      // Se trimmed for vazio, manter como null
    }
    // null é válido apenas para SUPER_ADMIN - será validado quando necessário

    // Se roles já estão no token (versão mais recente), usar eles
    // Caso contrário, buscar do DB (compatibilidade com tokens antigos)
    let roles: UserRole[] = [];
    if (decoded.roles && Array.isArray(decoded.roles) && decoded.roles.length > 0) {
      roles = decoded.roles;
    } else {
      // Fallback: buscar roles do DB para compatibilidade
      const userRoles = await prisma.userRole_.findMany({
        where: { userId: userId },
        select: { role: true }
      });
      roles = userRoles.map(r => r.role);
    }

    if (!roles || roles.length === 0) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[AUTH] ❌ Usuário sem roles:', {
          userId: decoded.userId,
          email: decoded.email,
          route: `${req.method} ${req.path}`,
        });
      }
      const error = new AppError('Usuário sem permissões configuradas', 403);
      (error as any).reason = 'NO_ROLES';
      return next(error);
    }

    // Mapear corretamente: user.id (userId), user.instituicaoId, user.roles (perfil), tipoAcademico, professorId
    // IMPORTANTE: instituicaoId SEMPRE vem do token validado, nunca do request
    // IMPORTANTE: tipoAcademico e professorId vêm do token (injetados no login)
    req.user = {
      userId: userId, // user.id (de sub ou userId)
      email: decoded.email,
      instituicaoId: validatedInstituicaoId, // user.instituicaoId (sempre do token: UUID válido ou null para SUPER_ADMIN)
      roles: roles, // user.perfil (roles)
      tipoAcademico: decoded.tipoAcademico || null, // tipoInstituicao (SUPERIOR | SECUNDARIO)
      professorId: decoded.professorId || null // professores.id - apenas para PROFESSOR
    };

    // Debug log para verificar token
    if (process.env.NODE_ENV !== 'production') {
      console.log('[AUTH] User authenticated:', {
        userId: req.user.userId,
        email: req.user.email,
        instituicaoId: req.user.instituicaoId,
        hasInstituicaoId: !!req.user.instituicaoId,
        tipoAcademico: req.user.tipoAcademico,
        roles: req.user.roles,
      });
    }

    // Validar status RH antes de permitir acesso (bloquear ENCERRADO)
    // Isso é aplicado globalmente para todos os usuários autenticados
    // Chama o middleware de validação RH e continua o fluxo
    return bloquearAcessoSeEncerrado(req, res, next);
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[AUTH] ❌ Token inválido:', {
          route: `${req.method} ${req.path}`,
          error: error.message,
        });
      }
      const appError = new AppError('Token inválido', 401);
      (appError as any).reason = 'TOKEN_INVALID';
      return next(appError);
    }
    if (error instanceof jwt.TokenExpiredError) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[AUTH] ❌ Token expirado:', {
          route: `${req.method} ${req.path}`,
        });
      }
      const appError = new AppError('Token expirado', 401);
      (appError as any).reason = 'TOKEN_EXPIRED';
      return next(appError);
    }
    next(error);
  }
};

/**
 * Middleware para autorizar acesso baseado em roles
 * Permite múltiplas roles. Usuário precisa ter pelo menos uma das roles permitidas.
 */
export const authorize = (...allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Não autenticado', 401));
    }

    const hasRole = req.user.roles.some(role => allowedRoles.includes(role));
    
    if (!hasRole) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[AUTH] ❌ Acesso negado - role insuficiente:', {
          userId: req.user.userId,
          userRoles: req.user.roles,
          requiredRoles: allowedRoles,
          route: `${req.method} ${req.path}`,
        });
      }
      const error = new AppError('Acesso negado: permissão insuficiente', 403);
      (error as any).reason = 'INSUFFICIENT_PERMISSIONS';
      return next(error);
    }

    next();
  };
};

/**
 * Alias para authorize - mantém compatibilidade
 */
export const authorizeRoles = authorize;

/**
 * Middleware para garantir que operações respeitem o multi-tenant
 * Garante que usuários só acessem dados da sua instituição
 * SUPER_ADMIN pode acessar qualquer instituição
 */
export const enforceTenant = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(new AppError('Não autenticado', 401));
  }

  // SUPER_ADMIN pode acessar qualquer instituição
  if (req.user.roles.includes('SUPER_ADMIN')) {
    return next();
  }

  // Verificar se o usuário tem instituicaoId
  if (!req.user.instituicaoId) {
    return next(new AppError('Usuário sem instituição associada', 403));
  }

  // IMPORTANTE: Não validar instituicaoId do request
  // Apenas verificar se o usuário tem instituicaoId no token
  // O SUPER_ADMIN pode usar query param, mas isso é tratado em getInstituicaoIdFromAuth
  // Para outros usuários, NUNCA usar req.params/req.body/req.query para instituicaoId
  
  next();
};

/**
 * Alias para enforceTenant - mantém compatibilidade
 * @deprecated Use enforceTenant instead
 */
export const belongsToInstitution = enforceTenant;

/**
 * Get instituicaoId from authenticated request
 * Returns null if user is not authenticated or doesn't have instituicaoId
 * SUPER_ADMIN can optionally provide instituicaoId via query param
 * IMPORTANTE: Para usuários não-SUPER_ADMIN, NUNCA lê req.query.instituicaoId
 */
export const getInstituicaoIdFromAuth = (req: Request): string | null => {
  if (!req.user) return null;
  
  // SUPER_ADMIN can optionally filter by instituicaoId via query param
  if (req.user.roles.includes('SUPER_ADMIN')) {
    const queryInstId = req.query.instituicaoId as string;
    if (queryInstId) {
      // Sanitizar e retornar query param (validação será feita no controller)
      return queryInstId.trim();
    }
    // SUPER_ADMIN sem query param: usar instituicaoId do token ou null
    const tokenInstId = req.user.instituicaoId || null;
    return tokenInstId ? tokenInstId.trim() : null;
  }

  // Para usuários não-SUPER_ADMIN: SEMPRE usar apenas do JWT, nunca de req.query/req.params/req.body
  const instituicaoId = req.user.instituicaoId || null;
  // Sanitizar espaços se presente
  return instituicaoId ? instituicaoId.trim() : null;
};

/**
 * Require tenant scope - throws error if user doesn't have instituicaoId
 * Use this for operations that MUST be scoped to a tenant
 * Valida que o instituicaoId é um UUID válido
 */
export const requireTenantScope = (req: Request): string => {
  const instituicaoId = getInstituicaoIdFromAuth(req);
  
  if (!instituicaoId) {
    // Mensagem mais clara para SUPER_ADMIN
    if (req.user?.roles.includes('SUPER_ADMIN')) {
      throw new AppError('Operação requer escopo de instituição. SUPER_ADMIN deve especificar uma instituição via parâmetro de consulta (?instituicaoId=xxx) ou ter uma instituição associada ao token.', 403);
    }
    throw new AppError('Operação requer escopo de instituição', 403);
  }
  
  // Validação extra: garantir que instituicaoId é um UUID válido
  // Isso previne erros com tokens antigos ou corrompidos
  const trimmed = instituicaoId.trim();
  if (!UUID_V4_REGEX.test(trimmed)) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[requireTenantScope] ❌ InstituicaoId não é um UUID válido:', {
        instituicaoId,
        trimmed,
        tipo: typeof instituicaoId,
        userId: req.user?.userId,
        email: req.user?.email,
        route: `${req.method} ${req.path}`,
      });
    }
    // Token inválido - retornar 401 para forçar re-login
    throw new AppError('Token inválido: ID de instituição inválido. Faça login novamente.', 401);
  }
  
  return trimmed;
};

/** Filter type: never instituicaoId: null - Prisma WhereInput rejects null */
export type InstitutionFilter = { instituicaoId?: string | { in: string[] } };

/** Get instituicaoId as string when filter has it (for non-Prisma contexts). Use getInstituicaoIdFromAuth(req) when you have req. */
export const getInstituicaoIdFromFilter = (filter: InstitutionFilter): string | undefined => {
  const v = filter.instituicaoId;
  return typeof v === 'string' ? v : undefined;
};

/**
 * Add institution filter for queries
 * Returns filter object to be used in Prisma where clauses
 * For entities that have instituicaoId field directly
 * IMPORTANTE: Para usuários não-SUPER_ADMIN, NUNCA lê req.query.instituicaoId
 */
export const addInstitutionFilter = (req: Request): InstitutionFilter => {
  if (!req.user) {
    console.warn('[addInstitutionFilter] ⚠️  Request sem usuário autenticado!');
    return {};
  }
  
  // SUPER_ADMIN pode ver todas as instituições, mas por padrão filtra pela sua própria
  // Apenas se passar instituicaoId na query explicitamente, filtra por outra instituição
  if (req.user.roles.includes('SUPER_ADMIN')) {
    // Se tiver instituicaoId na query, usar esse (permite ver outra instituição)
    const queryInstId = req.query.instituicaoId as string;
    if (queryInstId) {
      return { instituicaoId: queryInstId.trim() };
    }
    // Caso contrário, usar o instituicaoId do token (filtro padrão)
    if (req.user.instituicaoId) {
      return { instituicaoId: req.user.instituicaoId.trim() };
    }
    // Se SUPER_ADMIN não tem instituicaoId no token, retornar vazio (vê tudo)
    // Isso só acontece em casos muito específicos
    return {};
  }

  // Others see only their institution
  // IMPORTANTE: SEMPRE usar apenas req.user.instituicaoId do JWT, nunca de req.query/req.params/req.body
  // Se não tem instituicaoId, retornar filtro que não retorna nada
  if (!req.user.instituicaoId) {
    console.warn('[addInstitutionFilter] ⚠️  Usuário sem instituicaoId no token!', {
      userId: req.user.userId,
      email: req.user.email,
      roles: req.user.roles,
    });
    // Prisma não aceita instituicaoId: null em PlanoEnsinoWhereInput - usar filtro que não retorna nada
    return { instituicaoId: { in: [] } } as any;
  }

  const filter: InstitutionFilter = { instituicaoId: req.user.instituicaoId!.trim() };
  
  // Debug log
  if (process.env.NODE_ENV !== 'production') {
    console.log('[addInstitutionFilter] Filter aplicado:', filter);
  }
  
  return filter;
};

/**
 * Add institution filter for nested queries (e.g., aluno.instituicaoId)
 * Returns filter object to be used in Prisma where clauses with nested relations
 */
export const addNestedInstitutionFilter = (req: Request, relationField: string = 'instituicaoId') => {
  const instituicaoId = getInstituicaoIdFromAuth(req);
  
  if (!instituicaoId) {
    // Return filter that matches nothing
    return { [relationField]: null };
  }
  
  return { [relationField]: instituicaoId };
};
