import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { UserRole } from '@prisma/client';
import { EmailService } from './email.service.js';
import { AuditService, ModuloAuditoria, EntidadeAuditoria, AcaoAuditoria } from './audit.service.js';

// Regex para validar UUID v4
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Normaliza e valida instituicaoId
 * Retorna null se for string vazia, undefined ou UUID inválido
 * Retorna o UUID válido se estiver correto
 */
function normalizeInstituicaoId(instituicaoId: string | null | undefined): string | null {
  // Se for null ou undefined, retornar null
  if (!instituicaoId) {
    return null;
  }

  // Se for string vazia ou apenas espaços, retornar null
  const trimmed = instituicaoId.trim();
  if (trimmed === '') {
    return null;
  }

  // Validar formato UUID v4
  if (!UUID_V4_REGEX.test(trimmed)) {
    // Log apenas em desenvolvimento para debug
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[AUTH] ⚠️  InstituicaoId inválido detectado:', {
        original: instituicaoId,
        trimmed,
        length: trimmed.length
      });
    }
    return null;
  }

  return trimmed;
}

interface LoginResult {
  accessToken?: string;
  refreshToken?: string;
  requiresTwoFactor?: boolean;
  userId?: string;
  user: {
    id: string;
    email: string;
    nomeCompleto: string;
    roles: UserRole[];
    instituicaoId: string | null;
    tipoAcademico?: 'SUPERIOR' | 'SECUNDARIO' | null;
    professorId?: string | null;
  };
}

interface RegisterData {
  email: string;
  password: string;
  nomeCompleto: string;
  instituicaoId?: string;
}

import { getJwtSecret, getJwtRefreshSecret } from '../lib/jwtSecrets.js';

class AuthService {
  private get JWT_SECRET(): string {
    return getJwtSecret();
  }
  private get JWT_REFRESH_SECRET(): string {
    return getJwtRefreshSecret();
  }
  private readonly JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || '15m';
  private readonly JWT_REFRESH_EXPIRES_IN: string = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  private readonly SALT_ROUNDS = 12;
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutos

  /**
   * Calcula o nível de força da senha
   * Retorna: 'PÉSSIMA' | 'MÉDIA' | 'BOA' | 'FORTE'
   */
  private calculatePasswordStrength(password: string): 'PÉSSIMA' | 'MÉDIA' | 'BOA' | 'FORTE' {
    if (!password) return 'PÉSSIMA';

    const hasMinLength = password.length >= 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>\[\]\\\/_+\-=~`]/.test(password);

    // Requisitos mínimos para não ser "Péssima":
    // - Mínimo 8 caracteres
    // - Pelo menos 1 maiúscula
    // - Pelo menos 1 caractere especial
    const meetsMinimum = hasMinLength && hasUpperCase && hasSpecialChar;

    if (!meetsMinimum) {
      return 'PÉSSIMA';
    }

    // Calcular score baseado em critérios
    let score = 0;

    // Comprimento (máximo 30 pontos)
    if (password.length >= 8) score += 10;
    if (password.length >= 12) score += 10;
    if (password.length >= 16) score += 10;

    // Diversidade de caracteres (máximo 40 pontos)
    if (hasUpperCase) score += 10;
    if (hasLowerCase) score += 10;
    if (hasNumber) score += 10;
    if (hasSpecialChar) score += 10;

    // Complexidade adicional (máximo 30 pontos)
    const typeCount = [hasUpperCase, hasLowerCase, hasNumber, hasSpecialChar].filter(Boolean).length;
    if (typeCount >= 3) score += 15;
    if (typeCount === 4) score += 15;

    // Classificar baseado no score
    if (score < 40) return 'PÉSSIMA';
    if (score < 60) return 'MÉDIA';
    if (score < 80) return 'BOA';
    return 'FORTE';
  }

  /**
   * Valida se a senha é forte (mínimo 1 maiúscula e 1 caractere especial)
   * Aplicado apenas para roles: ADMIN, PROFESSOR, SECRETARIA, SUPER_ADMIN, POS
   * ALUNO não exige senha forte
   * BLOQUEIA se a senha for classificada como "PÉSSIMA"
   */
  validateStrongPassword(password: string, userRoles: UserRole[]): void {
    // Verificar se o usuário tem alguma role que exige senha forte
    const rolesExigemSenhaForte = ['ADMIN', 'PROFESSOR', 'SECRETARIA', 'SUPER_ADMIN', 'COMERCIAL', 'POS'];
    const temRoleExigente = userRoles.some(role => rolesExigemSenhaForte.includes(role));

    if (!temRoleExigente) {
      // Para outras roles (ALUNO, etc), apenas validar comprimento mínimo
      if (!password || password.length < 6) {
        throw new AppError('A senha deve ter no mínimo 6 caracteres', 400);
      }
      return;
    }

    // Para roles exigentes, validar senha forte
    if (!password || password.length < 8) {
      throw new AppError('A senha deve ter no mínimo 8 caracteres', 400);
    }

    // Calcular força da senha
    const strength = this.calculatePasswordStrength(password);

    // BLOQUEAR se for "Péssima"
    if (strength === 'PÉSSIMA') {
      throw new AppError('Senha muito fraca. Escolha uma senha mais segura. Utilize letras maiúsculas, números e símbolos.', 400);
    }

    // Verificar requisitos básicos (para mensagens de erro mais específicas)
    const hasUpperCase = /[A-Z]/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>\[\]\\\/_+\-=~`]/.test(password);

    if (!hasUpperCase) {
      throw new AppError('A senha deve conter pelo menos uma letra maiúscula', 400);
    }

    if (!hasSpecialChar) {
      throw new AppError('A senha deve conter pelo menos um caractere especial (!@#$%^&*(),.?":{}|<>)', 400);
    }
  }

  /**
   * Verifica se a conta está bloqueada
   */
  async isAccountLocked(email: string): Promise<boolean> {
    const attempt = await prisma.loginAttempt.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!attempt || !attempt.lockedUntil) return false;
    return attempt.lockedUntil > new Date();
  }

  /**
   * Registra tentativa de login falhada
   * @param email Email do usuário
   * @param req Request opcional para capturar IP e userAgent
   */
  async recordFailedLogin(email: string, req?: any): Promise<void> {
    const now = new Date();
    const lockoutUntil = new Date(now.getTime() + this.LOCKOUT_DURATION_MS);

    // Capturar IP e User Agent
    let ipOrigem: string | null = null;
    let userAgent: string | null = null;
    let instituicaoId: string | null = null;

    if (req) {
      ipOrigem = req.ip || req.socket.remoteAddress || (Array.isArray(req.headers['x-forwarded-for']) 
        ? req.headers['x-forwarded-for'][0] 
        : req.headers['x-forwarded-for']) || 'unknown';
      userAgent = req.headers['user-agent'] || 'unknown';
      
      // Tentar identificar instituição pelo email (buscar usuário)
      try {
        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
          select: { instituicaoId: true }
        });
        instituicaoId = user?.instituicaoId || null;
      } catch (error) {
        // Ignorar erro - não bloquear registro de tentativa
      }
    }

    const attempt = await prisma.loginAttempt.upsert({
      where: { email: email.toLowerCase() },
      create: {
        email: email.toLowerCase(),
        attemptCount: 1,
        lastAttemptAt: now,
        ipOrigem: ipOrigem,
        userAgent: userAgent,
        instituicaoId: instituicaoId
      },
      update: {
        attemptCount: { increment: 1 },
        lastAttemptAt: now,
        ipOrigem: ipOrigem, // Atualizar IP e userAgent na última tentativa
        userAgent: userAgent,
        instituicaoId: instituicaoId
      }
    });

    // Bloquear se atingiu o limite
    if (attempt.attemptCount >= this.MAX_LOGIN_ATTEMPTS) {
      await prisma.loginAttempt.update({
        where: { email: email.toLowerCase() },
        data: { lockedUntil: lockoutUntil }
      });
      
      // Auditoria: Bloqueio aplicado
      if (req) {
        await this.auditLoginEvent(req, email, 'BLOCKED', `Conta bloqueada após ${this.MAX_LOGIN_ATTEMPTS} tentativas falhadas`);
      }
    }
  }

  /**
   * Reseta tentativas de login
   * @returns true se havia tentativas bloqueadas, false caso contrário
   */
  async resetLoginAttempts(email: string): Promise<boolean> {
    const attempt = await prisma.loginAttempt.findUnique({
      where: { email: email.toLowerCase() }
    });
    
    const hadLockedAttempts = attempt && attempt.lockedUntil && attempt.lockedUntil > new Date();
    
    await prisma.loginAttempt.deleteMany({
      where: { email: email.toLowerCase() }
    });
    
    return hadLockedAttempts || false;
  }

  /**
   * Registra evento de login na auditoria
   */
  private async auditLoginEvent(
    req: any,
    email: string,
    eventType: 'SUCCESS' | 'FAILED' | 'BLOCKED' | 'UNLOCKED',
    observacao?: string
  ): Promise<void> {
    try {
      // Buscar usuário para obter instituicaoId
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        select: { id: true, instituicaoId: true, roles: { select: { role: true } } }
      });

      // Mapear tipo de evento para ação de auditoria específica de segurança
      let acao: AcaoAuditoria;
      switch (eventType) {
        case 'SUCCESS':
          acao = AcaoAuditoria.LOGIN_SUCCESS; // Ação específica para login bem-sucedido
          break;
        case 'FAILED':
          acao = AcaoAuditoria.LOGIN_FAILED; // Ação específica para falhas de login
          break;
        case 'BLOCKED':
          acao = AcaoAuditoria.LOGIN_BLOCKED; // Ação específica para bloqueios
          break;
        case 'UNLOCKED':
          acao = AcaoAuditoria.LOGIN_UNLOCKED; // Ação específica para desbloqueios
          break;
        default:
          acao = AcaoAuditoria.SECURITY_ALERT;
      }

      // Criar request simulado para auditoria
      const auditReq = {
        ...req,
        user: user ? {
          userId: user.id,
          email: email,
          roles: user.roles.map(r => r.role),
          instituicaoId: user.instituicaoId
        } : null
      };

      await AuditService.log(auditReq, {
        modulo: ModuloAuditoria.SEGURANCA, // Módulo específico de segurança
        acao: acao,
        entidade: EntidadeAuditoria.LOGIN_EVENT,
        entidadeId: user?.id ?? undefined,
        dadosNovos: {
          eventType,
          email: email.toLowerCase(),
          timestamp: new Date().toISOString()
        },
        observacao: observacao || `Evento de login: ${eventType}`
      });
    } catch (error) {
      // Não bloquear login por erro de auditoria
      console.error('[AuthService] Erro ao registrar auditoria de login:', error);
    }
  }

  /**
   * Gera token de acesso JWT
   * IMPORTANTE: instituicaoId é obrigatório no payload (pode ser null para SUPER_ADMIN)
   * Claim padronizado como "instituicaoId"
   * Subject (sub) é o user.id conforme padrão JWT
   */
  generateAccessToken(payload: {
    userId: string;
    email: string;
    instituicaoId: string | null; // Sempre presente no payload (pode ser null)
    roles: UserRole[];
    tipoAcademico?: 'SUPERIOR' | 'SECUNDARIO' | null; // Tipo acadêmico da instituição (opcional, será buscado se não fornecido)
    professorId?: string | null; // professores.id - apenas para role PROFESSOR
  }): string {
    const secret = this.JWT_SECRET;
    const expiresIn = this.JWT_EXPIRES_IN;
    
    // Validar instituicaoId: deve ser UUID válido ou null (para SUPER_ADMIN)
    // Não normalizar para null se for inválido - isso causaria erros em rotas protegidas
    let validatedInstituicaoId: string | null = null;
    if (payload.instituicaoId) {
      const trimmed = payload.instituicaoId.trim();
      if (trimmed && UUID_V4_REGEX.test(trimmed)) {
        validatedInstituicaoId = trimmed;
      } else {
        // Se for inválido e não for SUPER_ADMIN, isso será tratado no login
        // Aceitar null apenas se for SUPER_ADMIN
        validatedInstituicaoId = null;
      }
    }
    
    // Payload JWT padronizado com sub (subject) = user.id
    // CRÍTICO: tipoAcademico e professorId vêm do payload (injetados no login)
    const tokenPayload: Record<string, unknown> = {
      sub: payload.userId, // Subject: user.id (padrão JWT)
      email: payload.email,
      instituicaoId: validatedInstituicaoId, // Sempre presente: UUID válido ou null
      roles: payload.roles,
      tipoAcademico: payload.tipoAcademico || null // Tipo acadêmico (tipoInstituicao: SUPERIOR | SECUNDARIO)
    };
    if (payload.professorId) {
      tokenPayload.professorId = payload.professorId; // professores.id - apenas para PROFESSOR
    }
    
    return jwt.sign(tokenPayload, secret, {
      expiresIn: expiresIn
    } as jwt.SignOptions);
  }

  /**
   * Gera refresh token JWT
   */
  generateRefreshToken(userId: string): string {
    const secret = this.JWT_REFRESH_SECRET;
    const expiresIn = this.JWT_REFRESH_EXPIRES_IN;
    return jwt.sign({ userId }, secret, {
      expiresIn: expiresIn
    } as jwt.SignOptions);
  }

  /**
   * Verifica token de acesso
   * Retorna payload com instituicaoId sempre presente (pode ser null)
   * userId vem do sub (subject)
   * tipoAcademico vem do token (injetado no login)
   */
  verifyAccessToken(token: string): {
    userId: string; // Lê de sub para compatibilidade
    email: string;
    instituicaoId: string | null; // Sempre presente (pode ser null)
    roles: UserRole[];
    tipoAcademico?: 'SUPERIOR' | 'SECUNDARIO' | null; // Tipo acadêmico (tipoInstituicao)
    professorId?: string | null; // professores.id - apenas para PROFESSOR
  } {
    const decoded = jwt.verify(token, this.JWT_SECRET) as any;
    return {
      userId: decoded.sub || decoded.userId, // Usar sub (padrão JWT) ou userId (compatibilidade)
      email: decoded.email,
      instituicaoId: decoded.instituicaoId,
      roles: decoded.roles || [],
      tipoAcademico: decoded.tipoAcademico || null, // Tipo acadêmico da instituição (vem do token)
      professorId: decoded.professorId || null // professores.id - apenas para PROFESSOR
    };
  }

  /**
   * Verifica refresh token
   */
  verifyRefreshToken(token: string): { userId: string } {
    return jwt.verify(token, this.JWT_REFRESH_SECRET) as { userId: string };
  }

  /**
   * Salva refresh token no banco
   * 
   * ⚠️ DEPRECATED - Este método NÃO faz mais nada (no-op)
   * 
   * JWT é stateless e NÃO deve ser persistido no banco de dados.
   * Persistir JWT em tabela com constraint UNIQUE causaria erro 409 (Conflict)
   * quando o mesmo usuário faz login novamente.
   * 
   * Tokens são validados apenas via:
   * - Assinatura JWT (JWT_SECRET)
   * - Expiração (expiresIn)
   * - Payload (userId, roles, instituicaoId)
   * 
   * Este método é mantido apenas para compatibilidade com código legado,
   * mas não executa nenhuma operação de banco de dados.
   * 
   * @deprecated Este método não faz mais nada. JWT é stateless.
   * 
   * @param userId - ID do usuário (ignorado)
   * @param token - Token JWT (ignorado)
   * @returns Promise que resolve imediatamente sem fazer nada
   */
  async saveRefreshToken(userId: string, token: string): Promise<void> {
    // JWT é stateless - não persistir no banco
    // Apenas manter método para compatibilidade (no-op)
    // NUNCA tentar persistir JWT - isso causaria erro 409 em logins subsequentes
    // 
    // Se você está vendo erros 409 relacionados a tokens, verifique se há código
    // tentando chamar prisma.refreshToken.create diretamente.
    return Promise.resolve();
  }

  /**
   * Verifica se refresh token é válido
   * JWT é stateless - valida apenas via assinatura e expiração
   */
  async isRefreshTokenValid(token: string): Promise<boolean> {
    try {
      // Verificar assinatura e expiração do JWT (stateless)
      const decoded = this.verifyRefreshToken(token);
      
      // Se chegou aqui, o token é válido (verifyRefreshToken já valida assinatura e expiração)
      return !!decoded.userId;
    } catch {
      // Token inválido ou expirado
      return false;
    }
  }

  /**
   * Revoga refresh token
   * 
   * ⚠️ DEPRECATED - Este método NÃO faz mais nada (no-op)
   * 
   * JWT é stateless e NÃO há persistência no banco para revogar.
   * Tokens expiram naturalmente conforme configurado no JWT_REFRESH_EXPIRES_IN.
   * 
   * Este método é mantido apenas para compatibilidade com código legado,
   * mas não executa nenhuma operação de banco de dados.
   * 
   * @deprecated Este método não faz mais nada. JWT é stateless.
   * 
   * @param token - Token JWT (ignorado)
   * @returns Promise que resolve imediatamente sem fazer nada
   */
  async revokeRefreshToken(token: string): Promise<void> {
    // JWT é stateless - não há persistência para revogar
    // Apenas manter método para compatibilidade (no-op)
    // Tokens expiram naturalmente conforme JWT_REFRESH_EXPIRES_IN
    return Promise.resolve();
  }

  /**
   * Login do usuário
   * @param email Email do usuário
   * @param password Senha do usuário
   * @param req Request opcional para capturar IP, userAgent e auditoria
   */
  async login(email: string, password: string, req?: any): Promise<LoginResult> {
    // DEBUG: Log entrada do login
    if (process.env.NODE_ENV !== 'production') {
      console.log('[AUTH] Login attempt:', { email: email.toLowerCase() });
    }

    // Verificar se conta está bloqueada
    const isLocked = await this.isAccountLocked(email);
    if (isLocked) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[AUTH] Account locked:', email);
      }
      // Auditoria: Tentativa de login em conta bloqueada
      if (req) {
        await this.auditLoginEvent(req, email, 'BLOCKED', 'Conta bloqueada por múltiplas tentativas');
      }
      throw new AppError('Muitas tentativas de login. Tente novamente mais tarde.', 423);
    }

    // Buscar usuário (incluindo instituição para verificar 2FA)
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { 
        roles: true,
        instituicao: {
          select: {
            id: true,
            nome: true,
            // twoFactorEnabled removido temporariamente - campo pode não estar no banco ainda
            // TODO: Adicionar migração para incluir twoFactorEnabled na tabela instituicoes
          }
        }
      }
    });

    if (!user) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[AUTH] User not found:', email.toLowerCase());
      }
      await this.recordFailedLogin(email, req);
      // Auditoria: Login falhado (usuário não encontrado)
      if (req) {
        await this.auditLoginEvent(req, email, 'FAILED', 'Usuário não encontrado');
      }
      throw new AppError('Email ou senha inválidos', 401);
    }

    // DEBUG: Log usuário encontrado
    if (process.env.NODE_ENV !== 'production') {
      console.log('[AUTH] User found:', {
        id: user.id,
        email: user.email,
        hasPassword: !!user.password,
        passwordLength: user.password?.length || 0,
        rolesCount: user.roles.length,
        roles: user.roles.map(r => r.role)
      });
    }

    // Verificar se password existe e não está vazio
    if (!user.password || user.password.trim() === '') {
      console.error(`[AUTH] Usuário ${user.email} não tem senha cadastrada`);
      await this.recordFailedLogin(email, req);
      // Auditoria: Login falhado (sem senha)
      if (req) {
        await this.auditLoginEvent(req, email, 'FAILED', 'Usuário sem senha cadastrada');
      }
      throw new AppError('Usuário sem senha cadastrada. Entre em contato com o administrador.', 401);
    }

    // Verificar se a senha está no formato bcrypt (deve começar com $2a$, $2b$ ou $2y$)
    if (!user.password.startsWith('$2')) {
      console.error(`[AUTH] Senha do usuário ${user.email} não está no formato bcrypt`);
      await this.recordFailedLogin(email, req);
      // Auditoria: Login falhado (formato de senha inválido)
      if (req) {
        await this.auditLoginEvent(req, email, 'FAILED', 'Formato de senha inválido');
      }
      throw new AppError('Erro na configuração da senha. Entre em contato com o administrador.', 401);
    }

    // Verificar senha
    let isValidPassword = false;
    try {
      isValidPassword = await bcrypt.compare(password, user.password);
      
      // DEBUG: Log resultado da comparação
      if (process.env.NODE_ENV !== 'production') {
        console.log('[AUTH] Password comparison:', {
          email: user.email,
          isValid: isValidPassword,
          passwordProvided: !!password,
          passwordLength: password.length
        });
      }
    } catch (error) {
      console.error(`[AUTH] Erro ao comparar senha para usuário ${user.email}:`, error);
      await this.recordFailedLogin(email, req);
      // Auditoria: Login falhado (erro ao comparar senha)
      if (req) {
        await this.auditLoginEvent(req, email, 'FAILED', 'Erro ao comparar senha');
      }
      throw new AppError('Erro ao verificar senha. Tente novamente.', 500);
    }

    if (!isValidPassword) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[AUTH] Invalid password for:', user.email);
      }
      await this.recordFailedLogin(email, req);
      // Auditoria: Login falhado (senha inválida)
      if (req) {
        await this.auditLoginEvent(req, email, 'FAILED', 'Senha inválida');
      }
      throw new AppError('Email ou senha inválidos', 401);
    }

    // Reset tentativas de login (desbloqueio automático)
    const hadLockedAttempts = await this.resetLoginAttempts(email);
    
    // Auditoria: Desbloqueio automático (se havia tentativas bloqueadas)
    if (hadLockedAttempts && req) {
      await this.auditLoginEvent(req, email, 'UNLOCKED', 'Desbloqueio automático após login bem-sucedido');
    }

    // ============================================================
    // POLÍTICA DE SEGURANÇA DE SENHAS
    // ============================================================
    
    // 1. VERIFICAR TROCA OBRIGATÓRIA DE SENHA
    if (user.mustChangePassword) {
      throw new AppError('MUST_CHANGE_PASSWORD', 403); // Código especial para o frontend interceptar
    }

    // 2. VERIFICAR EXPIRAÇÃO DE SENHA (apenas para ADMIN)
    const roles = user.roles.map(r => r.role);
    const isAdmin = roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');
    
    if (isAdmin && user.passwordUpdatedAt) {
      const daysSinceUpdate = Math.floor(
        (new Date().getTime() - new Date(user.passwordUpdatedAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      
      // Senha expirada após 90 dias
      if (daysSinceUpdate > 90) {
        // Forçar troca de senha
        await prisma.user.update({
          where: { id: user.id },
          data: { mustChangePassword: true }
        });
        throw new AppError('MUST_CHANGE_PASSWORD', 403); // Código especial para o frontend interceptar
      }
    }

    // Gerar tokens
    
    // DEBUG: Verificar se tem roles
    if (roles.length === 0) {
      console.error('[AUTH] ⚠️  WARNING: User has no roles!', {
        userId: user.id,
        email: user.email
      });
    }
    
    // Validar instituicaoId: deve ser UUID válido (exceto SUPER_ADMIN/COMERCIAL que podem ter null)
    // NÃO converter para null se inválido - isso causaria erros em rotas protegidas
    let validatedInstituicaoId: string | null = null;
    const isSuperAdmin = roles.includes(UserRole.SUPER_ADMIN);
    const isComercial = roles.includes(UserRole.COMERCIAL);
    const isRoleGlobal = isSuperAdmin || isComercial;

    if (user.instituicaoId) {
      const trimmed = user.instituicaoId.trim();
      if (UUID_V4_REGEX.test(trimmed)) {
        validatedInstituicaoId = trimmed;
      } else {
        // Se instituicaoId é inválido e usuário não é role global, bloquear login
        if (!isRoleGlobal) {
          console.error('[AUTH] ❌ Usuário tem instituicaoId inválido no banco:', {
            userId: user.id,
            email: user.email,
            instituicaoId: user.instituicaoId
          });
          throw new AppError('Erro interno: ID de instituição inválido. Entre em contato com o administrador.', 500);
        }
        // Roles globais podem ter null
        validatedInstituicaoId = null;
      }
    }
    // RH/SECRETARIA/outros staff: se User.instituicaoId null, obter do Funcionario
    const STAFF_ROLES: UserRole[] = [UserRole.RH, UserRole.SECRETARIA, UserRole.FINANCEIRO, UserRole.POS, UserRole.DIRECAO, UserRole.COORDENADOR];
    if (!validatedInstituicaoId && roles.some((r) => STAFF_ROLES.includes(r))) {
      const func = await prisma.funcionario.findFirst({
        where: { userId: user.id },
        select: { instituicaoId: true }
      });
      if (func?.instituicaoId && UUID_V4_REGEX.test(func.instituicaoId.trim())) {
        validatedInstituicaoId = func.instituicaoId.trim();
      }
    }
    // Roles globais (SUPER_ADMIN, COMERCIAL) podem ter null, outros devem ter UUID válido
    if (!validatedInstituicaoId && !isRoleGlobal) {
      throw new AppError('Usuário sem instituição associada. Entre em contato com o administrador.', 403);
    }
    
    // ============================================================
    // VERIFICAÇÃO DE 2FA
    // ============================================================
    
    // Verificar se 2FA é obrigatório
    // NOTA: isAdmin já foi declarado acima (linha 601), reutilizando aqui
    // Buscar twoFactorEnabled usando query raw (Prisma Client pode estar desatualizado)
    let instituicaoHas2FA = false;
    let userHas2FA = false;
    
    // Verificar 2FA do usuário (usar query raw para evitar erro do Prisma Client)
    try {
      const userRaw = await prisma.$queryRaw<Array<{ two_factor_enabled: boolean | null }>>`
        SELECT two_factor_enabled FROM users WHERE id = ${user.id}
      `;
      userHas2FA = userRaw?.[0]?.two_factor_enabled === true;
    } catch (error) {
      // Se o campo não existir, considerar como false
      console.warn('[AUTH] Campo twoFactorEnabled não encontrado no usuário, considerando false');
      userHas2FA = false;
    }
    
    // Verificar 2FA da instituição (usar query raw)
    if (user.instituicao?.id) {
      try {
        const instituicaoRaw = await prisma.$queryRaw<Array<{ two_factor_enabled: boolean | null }>>`
          SELECT two_factor_enabled FROM instituicoes WHERE id = ${user.instituicao.id}
        `;
        instituicaoHas2FA = instituicaoRaw?.[0]?.two_factor_enabled === true;
      } catch (error) {
        // Se o campo não existir no banco, considerar como false
        console.warn('[AUTH] Campo twoFactorEnabled não encontrado na instituição, considerando false');
        instituicaoHas2FA = false;
      }
    }
    
    // REGRA: Se instituição tem 2FA ativo E usuário é ADMIN
    // - Se usuário JÁ tem 2FA configurado: exigir código 2FA
    // - Se usuário NÃO tem 2FA configurado: permitir login mas alertar que precisa configurar
    if (isAdmin && instituicaoHas2FA) {
      if (userHas2FA) {
        // Usuário tem 2FA configurado: exigir código antes de emitir tokens
        return {
          requiresTwoFactor: true,
          userId: user.id,
          user: {
            id: user.id,
            email: user.email,
            nomeCompleto: user.nomeCompleto,
            roles,
            instituicaoId: validatedInstituicaoId
          }
        };
      } else {
        // Instituição tem 2FA ativo mas usuário não configurou ainda
        // Permitir login mas retornar flag indicando que precisa configurar
        // (Em produção, pode-se forçar configuração imediata)
        // Por enquanto, permitimos login mas alertamos
      }
    }
    
    // CRÍTICO: Buscar tipoAcademico da instituição para injetar no token
    let tipoAcademico: 'SUPERIOR' | 'SECUNDARIO' | null = null;
    if (validatedInstituicaoId) {
      try {
        const instituicao = await prisma.instituicao.findUnique({
          where: { id: validatedInstituicaoId },
          select: { tipoAcademico: true }
        });
        tipoAcademico = instituicao?.tipoAcademico || null;
      } catch (error) {
        // Se houver erro ao buscar, manter como null (não bloquear login)
        console.error('[AUTH] Erro ao buscar tipoAcademico:', error);
      }
    }

    // REGRA QA: PROFESSOR - injetar professor_id no token e no response
    let professorId: string | null = null;
    const isProfessor = roles.includes('PROFESSOR') && !roles.includes('ADMIN') && !roles.includes('SUPER_ADMIN');
    if (isProfessor && validatedInstituicaoId) {
      try {
        const prof = await prisma.professor.findFirst({
          where: { userId: user.id, instituicaoId: validatedInstituicaoId },
          select: { id: true }
        });
        professorId = prof?.id || null;
      } catch (error) {
        console.error('[AUTH] Erro ao buscar professor_id:', error);
      }
    }
    
    // Payload padronizado com instituicaoId, tipoAcademico e professorId (quando PROFESSOR)
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      instituicaoId: validatedInstituicaoId, // UUID válido ou null (apenas SUPER_ADMIN)
      roles,
      tipoAcademico, // Tipo acadêmico da instituição (SUPERIOR | SECUNDARIO)
      professorId: professorId || undefined // professores.id - apenas para role PROFESSOR
    };

    const accessToken = this.generateAccessToken(tokenPayload);
    const refreshToken = this.generateRefreshToken(user.id);

    // ============================================================
    // JWT É STATELESS - NÃO PERSISTIR NO BANCO
    // ============================================================
    // REGRA ABSOLUTA: JWT não deve ser salvo em tabela com constraint UNIQUE
    // Isso causaria erro 409 (Conflict) quando o mesmo usuário faz login novamente
    // 
    // Tokens são validados apenas via:
    // - Assinatura JWT (JWT_SECRET)
    // - Expiração (expiresIn)
    // - Payload (userId, roles, instituicaoId)
    //
    // NÃO HÁ NECESSIDADE de persistir tokens no banco de dados.
    // O método saveRefreshToken() é um no-op (não faz nada) por design.
    // ============================================================
    
    // Auditoria: Login bem-sucedido (não bloquear login se auditoria falhar)
    // IMPORTANTE: Erros de auditoria NUNCA devem impedir o login
    if (req) {
      try {
        await this.auditLoginEvent(req, user.email, 'SUCCESS', 'Login bem-sucedido');
      } catch (auditError) {
        // Não bloquear login por erro de auditoria
        // Log apenas para debug, mas continuar com o login normalmente
        console.error('[AUTH] ⚠️  Erro ao registrar auditoria de login (não crítico, login continua):', auditError);
      }
    }

    // DEBUG: Log sucesso
    if (process.env.NODE_ENV !== 'production') {
      console.log('[AUTH] ✅ Login successful:', {
        userId: user.id,
        email: user.email,
        roles: roles,
        hasToken: !!accessToken
      });
    }

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        nomeCompleto: user.nomeCompleto,
        roles,
        instituicaoId: validatedInstituicaoId,
        tipoAcademico: tipoAcademico ?? undefined, // tipoInstituicao (SUPERIOR | SECUNDARIO)
        professorId: professorId ?? undefined // professores.id - apenas para PROFESSOR
      }
    };
  }

  /**
   * Login Step 2: Verificar código 2FA e completar login
   * @param userId ID do usuário (vem do step 1)
   * @param token Código TOTP de 6 dígitos
   * @param req Request opcional para auditoria
   */
  async loginStep2(userId: string, token: string, req?: any): Promise<LoginResult> {
    // Importar serviço 2FA dinamicamente para evitar dependência circular
    const { twoFactorService } = await import('./twoFactor.service.js');
    
    // Verificar código 2FA
    const isValid = await twoFactorService.verifyTwoFactorLogin(userId, token);
    
    if (!isValid) {
      // Auditoria: Tentativa de login com código 2FA inválido
      if (req) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true }
        });
        if (user) {
          await this.auditLoginEvent(req, user.email, 'FAILED', 'Código 2FA inválido');
        }
      }
      throw new AppError('Código 2FA inválido', 401);
    }
    
    // Buscar usuário completo
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: true, instituicao: true }
    });
    
    if (!user) {
      throw new AppError('Usuário não encontrado', 404);
    }
    
    // Gerar tokens (mesma lógica do login normal)
    const roles = user.roles.map(r => r.role);
    let validatedInstituicaoId: string | null = null;
    const isRoleGlobal = roles.includes(UserRole.SUPER_ADMIN) || roles.includes(UserRole.COMERCIAL);

    if (user.instituicaoId) {
      const trimmed = user.instituicaoId.trim();
      if (UUID_V4_REGEX.test(trimmed)) {
        validatedInstituicaoId = trimmed;
      } else if (!isRoleGlobal) {
        throw new AppError('Erro interno: ID de instituição inválido.', 500);
      }
    }

    if (!validatedInstituicaoId && !isRoleGlobal) {
      throw new AppError('Usuário sem instituição associada.', 403);
    }
    
    // Buscar tipoAcademico
    let tipoAcademico: 'SUPERIOR' | 'SECUNDARIO' | null = null;
    if (validatedInstituicaoId) {
      try {
        const instituicao = await prisma.instituicao.findUnique({
          where: { id: validatedInstituicaoId },
          select: { tipoAcademico: true }
        });
        tipoAcademico = instituicao?.tipoAcademico || null;
      } catch (error) {
        console.error('[AUTH] Erro ao buscar tipoAcademico:', error);
      }
    }
    
    // REGRA QA: PROFESSOR - injetar professor_id no token (mesmo do login)
    let professorId: string | null = null;
    const isProfessor = roles.includes(UserRole.PROFESSOR) && !roles.includes(UserRole.ADMIN) && !roles.includes(UserRole.SUPER_ADMIN) && !roles.includes(UserRole.COMERCIAL);
    if (isProfessor && validatedInstituicaoId) {
      try {
        const prof = await prisma.professor.findFirst({
          where: { userId: user.id, instituicaoId: validatedInstituicaoId },
          select: { id: true }
        });
        professorId = prof?.id || null;
      } catch (error) {
        console.error('[AUTH] Erro ao buscar professor_id (loginStep2):', error);
      }
    }

    const tokenPayload = {
      userId: user.id,
      email: user.email,
      instituicaoId: validatedInstituicaoId,
      roles,
      tipoAcademico,
      professorId: professorId || undefined
    };
    
    const accessToken = this.generateAccessToken(tokenPayload);
    const refreshToken = this.generateRefreshToken(user.id);
    
    // ============================================================
    // JWT É STATELESS - NÃO PERSISTIR NO BANCO
    // ============================================================
    // REGRA ABSOLUTA: JWT não deve ser salvo em tabela com constraint UNIQUE
    // Isso causaria erro 409 (Conflict) quando o mesmo usuário faz login novamente
    // 
    // Tokens são validados apenas via:
    // - Assinatura JWT (JWT_SECRET)
    // - Expiração (expiresIn)
    // - Payload (userId, roles, instituicaoId)
    //
    // NÃO HÁ NECESSIDADE de persistir tokens no banco de dados.
    // O método saveRefreshToken() é um no-op (não faz nada) por design.
    // ============================================================
    
    // Auditoria: Login bem-sucedido com 2FA (não bloquear login se auditoria falhar)
    // IMPORTANTE: Erros de auditoria NUNCA devem impedir o login
    if (req) {
      try {
        await this.auditLoginEvent(req, user.email, 'SUCCESS', 'Login bem-sucedido com 2FA');
      } catch (auditError) {
        // Não bloquear login por erro de auditoria
        // Log apenas para debug, mas continuar com o login normalmente
        console.error('[AUTH] ⚠️  Erro ao registrar auditoria de login 2FA (não crítico, login continua):', auditError);
      }
    }
    
    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        nomeCompleto: user.nomeCompleto,
        roles,
        instituicaoId: validatedInstituicaoId,
        tipoAcademico: tipoAcademico ?? undefined,
        professorId: professorId ?? undefined
      }
    };
  }

  /**
   * Login via OIDC (Google, Azure AD, etc.)
   * Utilizador deve já existir na base - não há auto-criação por segurança em produção.
   */
  async loginWithOidc(email: string, req?: any): Promise<LoginResult> {
    const emailLower = email.toLowerCase().trim();

    // Busca case-insensitive (PostgreSQL: DB pode ter "User@Mail.com", Google envia "user@mail.com")
    const user = await prisma.user.findFirst({
      where: { email: { equals: emailLower, mode: 'insensitive' } },
      include: { roles: true, instituicao: true }
    });

    if (!user) {
      if (req) {
        await this.auditLoginEvent(req, emailLower, 'FAILED', 'OIDC: Usuário não encontrado na base');
      }
      throw new AppError(
        'Conta não encontrada. Cadastre-se primeiro ou use o login com email e senha.',
        401
      );
    }

    const roles = user.roles.map(r => r.role);
    if (!roles || roles.length === 0) {
      if (req) {
        await this.auditLoginEvent(req, user.email, 'FAILED', 'OIDC: Usuário sem roles');
      }
      throw new AppError('Usuário sem perfil configurado. Entre em contato com o administrador.', 403);
    }

    const isRoleGlobal = roles.includes(UserRole.SUPER_ADMIN) || roles.includes(UserRole.COMERCIAL);
    let validatedInstituicaoId: string | null = null;

    if (user.instituicaoId) {
      const trimmed = user.instituicaoId.trim();
      if (UUID_V4_REGEX.test(trimmed)) {
        validatedInstituicaoId = trimmed;
      } else if (!isRoleGlobal) {
        throw new AppError('Erro interno: ID de instituição inválido.', 500);
      }
    }

    if (!validatedInstituicaoId && !isRoleGlobal) {
      throw new AppError('Usuário sem instituição associada.', 403);
    }

    let tipoAcademico: 'SUPERIOR' | 'SECUNDARIO' | null = null;
    if (validatedInstituicaoId) {
      try {
        const instituicao = await prisma.instituicao.findUnique({
          where: { id: validatedInstituicaoId },
          select: { tipoAcademico: true }
        });
        tipoAcademico = instituicao?.tipoAcademico || null;
      } catch (error) {
        console.error('[AUTH] Erro ao buscar tipoAcademico (OIDC):', error);
      }
    }

    let professorId: string | null = null;
    const isProfessor = roles.includes(UserRole.PROFESSOR) && !roles.includes(UserRole.ADMIN) && !roles.includes(UserRole.SUPER_ADMIN) && !roles.includes(UserRole.COMERCIAL);
    if (isProfessor && validatedInstituicaoId) {
      try {
        const prof = await prisma.professor.findFirst({
          where: { userId: user.id, instituicaoId: validatedInstituicaoId },
          select: { id: true }
        });
        professorId = prof?.id || null;
      } catch (error) {
        console.error('[AUTH] Erro ao buscar professor_id (OIDC):', error);
      }
    }

    const tokenPayload = {
      userId: user.id,
      email: user.email,
      instituicaoId: validatedInstituicaoId,
      roles,
      tipoAcademico,
      professorId: professorId || undefined
    };

    const accessToken = this.generateAccessToken(tokenPayload);
    const refreshToken = this.generateRefreshToken(user.id);

    if (req) {
      try {
        await this.auditLoginEvent(req, user.email, 'SUCCESS', 'Login via OIDC');
      } catch (auditError) {
        console.error('[AUTH] ⚠️ Erro auditoria OIDC (não crítico):', auditError);
      }
    }

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        nomeCompleto: user.nomeCompleto,
        roles,
        instituicaoId: validatedInstituicaoId,
        tipoAcademico: tipoAcademico ?? undefined,
        professorId: professorId ?? undefined
      }
    };
  }

  /**
   * Registro de novo usuário
   */
  async register(data: RegisterData): Promise<{ message: string; user: { id: string; email: string } }> {
    // Verificar se email já existe
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() }
    });

    if (existingUser) {
      throw new AppError('Email já cadastrado', 409);
    }

    // Hash da senha
    const passwordHash = await bcrypt.hash(data.password, this.SALT_ROUNDS);

    // Criar usuário
    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        password: passwordHash,
        nomeCompleto: data.nomeCompleto,
        instituicaoId: data.instituicaoId || null
      }
    });

    // Criar role padrão ALUNO
    await prisma.userRole_.create({
      data: {
        userId: user.id,
        role: 'ALUNO',
        instituicaoId: data.instituicaoId || null
      }
    });

    return {
      message: 'Usuário registrado com sucesso',
      user: {
        id: user.id,
        email: user.email
      }
    };
  }

  /**
   * Refresh do access token
   * JWT é stateless - valida apenas via assinatura e expiração
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    // Verificar se token é válido (stateless - apenas assinatura e expiração)
    const isValid = await this.isRefreshTokenValid(refreshToken);
    if (!isValid) {
      throw new AppError('Refresh token inválido ou expirado', 401);
    }

    // Decodificar token
    const decoded = this.verifyRefreshToken(refreshToken);

    // Buscar usuário
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { roles: true }
    });

    if (!user) {
      throw new AppError('Usuário não encontrado', 404);
    }

    // JWT é stateless - não há necessidade de revogar token antigo

    // Validar instituicaoId: deve ser UUID válido (exceto roles globais que podem ter null)
    let validatedInstituicaoId: string | null = null;
    const roles = user.roles.map(r => r.role);
    const isRoleGlobal = roles.includes(UserRole.SUPER_ADMIN) || roles.includes(UserRole.COMERCIAL);

    if (user.instituicaoId) {
      const trimmed = user.instituicaoId.trim();
      if (UUID_V4_REGEX.test(trimmed)) {
        validatedInstituicaoId = trimmed;
      } else {
        // Se instituicaoId é inválido e usuário não é role global, erro
        if (!isRoleGlobal) {
          console.error('[AUTH] ❌ Usuário tem instituicaoId inválido no banco:', {
            userId: user.id,
            email: user.email,
            instituicaoId: user.instituicaoId
          });
          throw new AppError('Erro interno: ID de instituição inválido. Entre em contato com o administrador.', 500);
        }
        validatedInstituicaoId = null;
      }
    }

    // CRÍTICO: Buscar tipoAcademico da instituição para injetar no token (mesmo processo do login)
    let tipoAcademico: 'SUPERIOR' | 'SECUNDARIO' | null = null;
    if (validatedInstituicaoId) {
      try {
        const instituicao = await prisma.instituicao.findUnique({
          where: { id: validatedInstituicaoId },
          select: { tipoAcademico: true }
        });
        tipoAcademico = instituicao?.tipoAcademico || null;
      } catch (error) {
        // Se houver erro ao buscar, manter como null (não bloquear refresh)
        console.error('[AUTH] Erro ao buscar tipoAcademico no refresh:', error);
      }
    }

    // REGRA QA: PROFESSOR - injetar professor_id no token (mesmo do login)
    let professorId: string | null = null;
    const isProfessor = roles.includes(UserRole.PROFESSOR) && !roles.includes(UserRole.ADMIN) && !roles.includes(UserRole.SUPER_ADMIN) && !roles.includes(UserRole.COMERCIAL);
    if (isProfessor && validatedInstituicaoId) {
      try {
        const prof = await prisma.professor.findFirst({
          where: { userId: user.id, instituicaoId: validatedInstituicaoId },
          select: { id: true }
        });
        professorId = prof?.id || null;
      } catch (error) {
        console.error('[AUTH] Erro ao buscar professor_id (refresh):', error);
      }
    }

    const tokenPayload = {
      userId: user.id,
      email: user.email,
      instituicaoId: validatedInstituicaoId, // UUID válido ou null (roles globais: SUPER_ADMIN, COMERCIAL)
      roles,
      tipoAcademico, // Tipo acadêmico da instituição (injetado automaticamente)
      professorId: professorId || undefined // professores.id - apenas para PROFESSOR
    };

    const newAccessToken = this.generateAccessToken(tokenPayload);
    const newRefreshToken = this.generateRefreshToken(user.id);

    // ============================================================
    // JWT É STATELESS - NÃO PERSISTIR NO BANCO
    // ============================================================
    // REGRA ABSOLUTA: JWT não deve ser salvo em tabela com constraint UNIQUE
    // Isso causaria erro 409 (Conflict) em refresh subsequentes
    // 
    // Tokens são validados apenas via:
    // - Assinatura JWT (JWT_SECRET)
    // - Expiração (expiresIn)
    // - Payload (userId, roles, instituicaoId)
    //
    // NÃO HÁ NECESSIDADE de persistir tokens no banco de dados.
    // O método saveRefreshToken() é um no-op (não faz nada) por design.
    // ============================================================

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    };
  }

  /**
   * Logout do usuário
   * JWT é stateless - não há persistência para revogar
   * Mantido apenas para compatibilidade com a API
   */
  async logout(userId: string, refreshToken?: string): Promise<void> {
    // JWT é stateless - não há persistência para revogar
    // Tokens expiram naturalmente conforme configurado no JWT_EXPIRES_IN
    // Apenas manter método para compatibilidade (no-op)
    return Promise.resolve();
  }

  /**
   * Reset de senha (solicitação)
   * Gera token único e envia e-mail com link de recuperação
   * Token expira em 30 minutos e é de uso único
   */
  async resetPassword(email: string, req?: any): Promise<{ message: string }> {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        instituicao: {
          select: {
            id: true,
            nome: true,
          },
        },
        roles: true,
      },
    });

    // Não revelar se o email existe por segurança
    if (!user) {
      return {
        message: 'Se o email existir, enviaremos instruções de recuperação.'
      };
    }

    // Invalidar tokens anteriores não utilizados do usuário
    await prisma.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        used: false,
      },
      data: {
        used: true, // Marcar como usado para invalidar
      },
    });

    // Gerar token único (32 bytes = 64 caracteres hex)
    const resetToken = randomBytes(32).toString('hex');
    const tokenExpiry = new Date();
    tokenExpiry.setMinutes(tokenExpiry.getMinutes() + 30); // Expiração de 30 minutos

    // Salvar token no banco (uso único)
    await prisma.passwordResetToken.create({
      data: {
        token: resetToken,
        userId: user.id,
        expiresAt: tokenExpiry,
        used: false,
      },
    });

    // Construir link de reset
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
    const resetLink = `${frontendUrl}/redefinir-senha?token=${resetToken}`;

    // Enviar e-mail (não abortar se falhar)
    try {
      await EmailService.sendEmail(
        req || null,
        user.email,
        'RECUPERACAO_SENHA',
        {
          resetLink,
          nomeUsuario: user.nomeCompleto || 'Usuário',
        },
        {
          destinatarioNome: user.nomeCompleto || undefined,
          instituicaoId: user.instituicaoId || undefined,
        }
      );
    } catch (emailError: any) {
      // Log do erro mas não revelar ao usuário
      console.error('[resetPassword] Erro ao enviar e-mail (não crítico):', emailError.message);
    }

    // Auditoria: Registrar solicitação de reset de senha
    if (req) {
      try {
        // Criar request simulado para auditoria
        const auditReq = {
          ...req,
          user: {
            userId: user.id,
            email: user.email,
            roles: user.roles.map(r => r.role),
            instituicaoId: user.instituicaoId
          }
        };

        await AuditService.log(auditReq, {
          modulo: ModuloAuditoria.SEGURANCA,
          acao: AcaoAuditoria.PASSWORD_RESET_REQUESTED,
          entidade: EntidadeAuditoria.PASSWORD_RESET,
          entidadeId: user.id,
          dadosNovos: {
            email: user.email.toLowerCase(),
            tokenGerado: true,
            expiraEm: tokenExpiry.toISOString(),
            timestamp: new Date().toISOString()
          },
          observacao: 'Solicitação de reset de senha via e-mail'
        });
      } catch (auditError) {
        // Não bloquear reset por erro de auditoria
        console.error('[resetPassword] Erro ao registrar auditoria:', auditError);
      }
    }

    return {
      message: 'Se o email existir, enviaremos instruções de recuperação.'
    };
  }

  /**
   * Redefinir senha de um usuário (admin/super admin)
   */
  async resetUserPassword(
    userId: string, 
    newPassword: string, 
    sendEmail: boolean = false,
    adminUserId?: string,
    req?: any
  ): Promise<{ message: string }> {
    // Buscar usuário
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: true,
        instituicao: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
    });

    if (!user) {
      throw new AppError('Usuário não encontrado', 404);
    }

    // Validar senha forte baseado nas roles do usuário
    const userRoles = user.roles.map(r => r.role);
    this.validateStrongPassword(newPassword, userRoles);

    // Hash da nova senha
    const passwordHash = await bcrypt.hash(newPassword, this.SALT_ROUNDS);

    // Atualizar senha e definir mustChangePassword = true (usuário deve trocar no próximo login)
    await prisma.user.update({
      where: { id: userId },
      data: {
        password: passwordHash,
        passwordUpdatedAt: new Date(),
        mustChangePassword: true, // Obrigar troca no próximo login
      }
    });

    // Auditoria: Registrar reset de senha (OBRIGATÓRIO para governança)
    if (req && adminUserId) {
      try {
        const adminUser = await prisma.user.findUnique({
          where: { id: adminUserId },
          select: { email: true, nomeCompleto: true, instituicaoId: true }
        });

        if (adminUser) {
          // Registrar na auditoria principal (imutável)
          await AuditService.log(req, {
            modulo: ModuloAuditoria.SEGURANCA, // Módulo específico de segurança
            acao: AcaoAuditoria.PASSWORD_RESET_COMPLETED, // Ação específica para reset de senha
            entidade: EntidadeAuditoria.PASSWORD_RESET,
            entidadeId: userId,
            dadosNovos: {
              usuarioAfetadoId: userId,
              usuarioAfetadoEmail: user.email,
              usuarioAfetadoNome: user.nomeCompleto || 'Usuário',
              redefinidoPorId: adminUserId,
              redefinidoPorEmail: adminUser.email,
              redefinidoPorNome: adminUser.nomeCompleto || 'Admin',
              enviadoPorEmail: sendEmail,
            },
            observacao: `Senha redefinida por administrador${sendEmail ? ' (enviada por e-mail)' : ''}`,
          });

          // Tentar inserir log adicional (pode falhar se tabela não existir, não é crítico)
          try {
            await prisma.logRedefinicaoSenha.create({
              data: {
                usuarioAfetadoId: userId,
                usuarioAfetadoEmail: user.email,
                usuarioAfetadoNome: user.nomeCompleto || 'Usuário',
                redefinidoPorId: adminUserId,
                redefinidoPorEmail: adminUser.email,
                redefinidoPorNome: adminUser.nomeCompleto || 'Admin',
                enviadoPorEmail: sendEmail,
                ipAddress: req?.ip || req?.connection?.remoteAddress || null,
              },
            });
          } catch (logError) {
            // Log não crítico, apenas registrar no console
            console.warn('[resetUserPassword] Erro ao registrar log adicional (não crítico):', logError);
          }
        }
      } catch (error) {
        // Não falhar a operação por erro de auditoria, mas registrar
        console.error('[resetUserPassword] Erro ao registrar auditoria:', error);
      }
    }

    // Enviar e-mail se solicitado
    if (sendEmail) {
      try {
        await EmailService.sendEmail(
          req || null,
          user.email,
          'SENHA_REDEFINIDA',
          {
            novaSenha: newPassword,
            nomeUsuario: user.nomeCompleto || 'Usuário',
          },
          {
            destinatarioNome: user.nomeCompleto || undefined,
            instituicaoId: user.instituicaoId || undefined,
          }
        );
      } catch (emailError: any) {
        // Log do erro mas não abortar operação
        console.error('[resetUserPassword] Erro ao enviar e-mail (não crítico):', emailError.message);
      }
    }

    return {
      message: 'Senha redefinida com sucesso'
    };
  }

  /**
   * Confirmar reset de senha com token único
   * Valida o token único, marca como usado e atualiza a senha do usuário
   * Define mustChangePassword = false após reset bem-sucedido
   */
  async confirmResetPassword(token: string, newPassword: string, confirmPassword: string): Promise<{ message: string }> {
    // Validar que as senhas coincidem
    if (newPassword !== confirmPassword) {
      throw new AppError('As senhas não coincidem', 400);
    }

    // Buscar token no banco
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: {
        user: {
          include: { roles: true }
        }
      }
    });

    if (!resetToken) {
      throw new AppError('Token de redefinição inválido', 401);
    }

    // Verificar se token já foi usado
    if (resetToken.used) {
      throw new AppError('Token de redefinição já foi utilizado. Solicite um novo link.', 401);
    }

    // Verificar se token expirou
    if (resetToken.expiresAt < new Date()) {
      // Marcar como usado para limpar
      await prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { used: true }
      });
      throw new AppError('Token de redefinição expirado. Solicite um novo link.', 401);
    }

    const user = resetToken.user;
    if (!user) {
      throw new AppError('Usuário não encontrado', 404);
    }

    // Validar senha forte baseado nas roles do usuário
    const userRoles = user.roles.map(r => r.role);
    this.validateStrongPassword(newPassword, userRoles);

    // Hash da nova senha
    const passwordHash = await bcrypt.hash(newPassword, this.SALT_ROUNDS);

    // Atualizar senha, marcar token como usado e limpar mustChangePassword
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          password: passwordHash,
          passwordUpdatedAt: new Date(),
          mustChangePassword: false, // Reset bem-sucedido, não precisa mais trocar
        }
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { used: true }
      })
    ]);

    return {
      message: 'Senha redefinida com sucesso'
    };
  }

  /**
   * Atualização de senha (troca normal)
   * Atualiza passwordUpdatedAt e limpa mustChangePassword
   */
  async updatePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ message: string }> {
    // Buscar usuário com roles
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: true }
    });

    if (!user) {
      throw new AppError('Usuário não encontrado', 404);
    }

    // Verificar senha atual
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      throw new AppError('Senha atual incorreta', 401);
    }

    // Validar senha forte baseado nas roles do usuário
    const userRoles = user.roles.map(r => r.role);
    this.validateStrongPassword(newPassword, userRoles);

    // Hash da nova senha
    const passwordHash = await bcrypt.hash(newPassword, this.SALT_ROUNDS);

    // Atualizar senha, data de atualização e limpar mustChangePassword
    await prisma.user.update({
      where: { id: userId },
      data: {
        password: passwordHash,
        passwordUpdatedAt: new Date(),
        mustChangePassword: false, // Senha atualizada, não precisa mais trocar
      }
    });

    return {
      message: 'Senha atualizada com sucesso'
    };
  }

  /**
   * Alteração obrigatória de senha
   * Usado quando mustChangePassword = true (primeiro acesso ou reset)
   * Não exige senha atual, apenas nova senha forte
   */
  async changePasswordRequired(userId: string, newPassword: string, confirmPassword: string): Promise<{ message: string }> {
    // Validar que as senhas coincidem
    if (newPassword !== confirmPassword) {
      throw new AppError('As senhas não coincidem', 400);
    }

    // Buscar usuário com roles
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: true }
    });

    if (!user) {
      throw new AppError('Usuário não encontrado', 404);
    }

    // Verificar se realmente precisa trocar senha
    if (!user.mustChangePassword) {
      throw new AppError('Não é necessário trocar a senha neste momento', 400);
    }

    // Validar senha forte baseado nas roles do usuário
    const userRoles = user.roles.map(r => r.role);
    this.validateStrongPassword(newPassword, userRoles);

    // Hash da nova senha
    const passwordHash = await bcrypt.hash(newPassword, this.SALT_ROUNDS);

    // Atualizar senha, data de atualização e limpar mustChangePassword
    await prisma.user.update({
      where: { id: userId },
      data: {
        password: passwordHash,
        passwordUpdatedAt: new Date(),
        mustChangePassword: false, // Senha alterada, não precisa mais trocar
      }
    });

    return {
      message: 'Senha alterada com sucesso'
    };
  }

  /**
   * Alteração obrigatória de senha usando credenciais (email + senha atual)
   * Usado quando login foi bloqueado por mustChangePassword
   * Não requer JWT, mas valida identidade usando email + senha atual
   */
  async changePasswordRequiredWithCredentials(
    email: string,
    currentPassword: string,
    newPassword: string,
    confirmPassword: string
  ): Promise<{ message: string }> {
    // Validar que as senhas coincidem
    if (newPassword !== confirmPassword) {
      throw new AppError('As senhas não coincidem', 400);
    }

    // Buscar usuário com roles
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { roles: true }
    });

    if (!user) {
      // Não revelar se o email existe por segurança
      throw new AppError('Credenciais inválidas', 401);
    }

    // Verificar se realmente precisa trocar senha
    if (!user.mustChangePassword) {
      throw new AppError('Não é necessário trocar a senha neste momento', 400);
    }

    // Verificar senha atual para validar identidade
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      throw new AppError('Credenciais inválidas', 401);
    }

    // Validar senha forte baseado nas roles do usuário
    const userRoles = user.roles.map(r => r.role);
    this.validateStrongPassword(newPassword, userRoles);

    // Hash da nova senha
    const passwordHash = await bcrypt.hash(newPassword, this.SALT_ROUNDS);

    // Atualizar senha, data de atualização e limpar mustChangePassword
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: passwordHash,
        passwordUpdatedAt: new Date(),
        mustChangePassword: false, // Senha alterada, não precisa mais trocar
      }
    });

    return {
      message: 'Senha alterada com sucesso'
    };
  }
}

// Exportar instância única do serviço
const authService = new AuthService();
export default authService;
