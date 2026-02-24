import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import authService from '../services/auth.service.js';
import { authenticate } from '../middlewares/auth.js';
import { AppError } from '../middlewares/errorHandler.js';
import { messages } from '../utils/messages.js';
import prisma from '../lib/prisma.js';
import { buildSubdomainUrl } from '../middlewares/validateTenantDomain.js';
import { validateBody } from '../middlewares/validate.middleware.js';
import {
  loginSchema,
  registerSchema,
  loginStep2Schema,
  refreshTokenSchema,
  logoutBodySchema,
  resetPasswordSchema,
  confirmResetPasswordSchema,
  resetUserPasswordSchema,
  updatePasswordSchema,
  changePasswordRequiredSchema,
  changePasswordRequiredWithCredentialsSchema,
  checkLockoutSchema,
} from '../validators/auth.validator.js';
import {
  isOidcEnabled,
  getOidcProviderName,
  getAuthorizationUrl,
  handleCallback,
} from '../services/oidc.service.js';

const router = Router();

// Rate limit no login - proteção contra brute force
// 10 tentativas por minuto por IP (30 em dev para permitir testes multi-tenant)
const loginRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: process.env.NODE_ENV === 'development' ? 30 : 10,
  message: { message: 'Muitas tentativas de login. Tente novamente em 1 minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limit para reset de senha e endpoints sensíveis
const authSensitiveRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5,
  message: { message: 'Muitas tentativas. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Config de autenticação (público - para frontend saber se OIDC está disponível)
router.get('/config', (req, res) => {
  res.json({
    oidcEnabled: isOidcEnabled(),
    oidcProviderName: isOidcEnabled() ? getOidcProviderName() : undefined,
  });
});

// OIDC: Iniciar login (redireciona para IdP)
router.get('/oidc/login', async (req, res, next) => {
  try {
    if (!isOidcEnabled()) {
      throw new AppError('Login com OIDC não está configurado.', 404);
    }
    const returnUrl = (req.query.returnUrl as string) || req.headers.referer || '/auth';
    const authUrl = await getAuthorizationUrl(returnUrl);
    res.redirect(authUrl);
  } catch (error) {
    next(error);
  }
});

// OIDC: Callback após login no IdP
router.get('/oidc/callback', async (req, res, next) => {
  let returnUrl = '/auth';
  try {
    if (!isOidcEnabled()) {
      throw new AppError('Login com OIDC não está configurado.', 404);
    }
    const state = req.query.state as string;
    if (!state) {
      throw new AppError('Parâmetro state inválido. Tente novamente.', 400);
    }
    const callbackUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const callbackResult = await handleCallback(callbackUrl, state);
    returnUrl = callbackResult.returnUrl;

    const result = await authService.loginWithOidc(callbackResult.email, req);

    if (req.tenantDomainMode === 'subdomain') {
      const userInstId = result.user?.instituicaoId ?? null;
      const tenantId = req.tenantDomainInstituicaoId ?? null;
      if (tenantId !== userInstId) {
        throw new AppError('Usuário não pertence a esta instituição.', 403);
      }
    }

    let redirectToSubdomain: string | undefined;
    if (req.tenantDomainMode === 'central' && result.user?.instituicaoId) {
      const inst = await prisma.instituicao.findUnique({
        where: { id: result.user.instituicaoId },
        select: { subdominio: true }
      });
      if (inst?.subdominio) redirectToSubdomain = buildSubdomainUrl(inst.subdominio);
    }

    // Redirecionar para frontend com tokens em query params
    // (hash pode ser perdido em redirects cross-origin Railway→Vercel)
    const separator = returnUrl.includes('?') ? '&' : '?';
    let redirectTo = `${returnUrl}${separator}oidc=1&access_token=${encodeURIComponent(result.accessToken!)}&refresh_token=${encodeURIComponent(result.refreshToken!)}`;
    if (redirectToSubdomain) redirectTo += `&redirectToSubdomain=${encodeURIComponent(redirectToSubdomain)}`;
    res.redirect(redirectTo);
  } catch (error) {
    // Redirecionar para login com erro (evita JSON no browser)
    const baseUrl = returnUrl.startsWith('http') ? returnUrl : `${process.env.FRONTEND_URL || req.protocol + '://' + req.get('host')}${returnUrl}`;
    const separator = baseUrl.includes('?') ? '&' : '?';
    const errMsg = error instanceof Error ? encodeURIComponent(error.message) : 'Erro ao fazer login';
    res.redirect(`${baseUrl}${separator}oidc_error=${errMsg}`);
  }
});

// Login (com rate limit)
router.post('/login', loginRateLimiter, validateBody(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password, req);

    if (req.tenantDomainMode === 'subdomain') {
      const userInstId = result.user?.instituicaoId ?? null;
      const tenantId = req.tenantDomainInstituicaoId ?? null;
      if (tenantId !== userInstId) {
        throw new AppError('Usuário não pertence a esta instituição.', 403);
      }
    }

    if (req.tenantDomainMode === 'central' && result.user?.instituicaoId && !result.requiresTwoFactor) {
      const inst = await prisma.instituicao.findUnique({
        where: { id: result.user.instituicaoId },
        select: { subdominio: true }
      });
      if (inst?.subdominio) {
        (result as any).redirectToSubdomain = buildSubdomainUrl(inst.subdominio);
      }
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Rate limit para passo 2 do login (2FA) - proteção contra brute force do código
const loginStep2RateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: process.env.NODE_ENV === 'development' ? 20 : 5,
  message: { message: 'Muitas tentativas de código 2FA. Tente novamente em 1 minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Login Step 2: Verificar código 2FA
router.post('/login-step2', loginStep2RateLimiter, validateBody(loginStep2Schema), async (req, res, next) => {
  try {
    const { userId, token } = req.body;
    const result = await authService.loginStep2(userId, token, req);

    if (req.tenantDomainMode === 'subdomain') {
      const userInstId = result.user?.instituicaoId ?? null;
      const tenantId = req.tenantDomainInstituicaoId ?? null;
      if (tenantId !== userInstId) {
        throw new AppError('Usuário não pertence a esta instituição.', 403);
      }
    }

    if (req.tenantDomainMode === 'central' && result.user?.instituicaoId) {
      const inst = await prisma.instituicao.findUnique({
        where: { id: result.user.instituicaoId },
        select: { subdominio: true }
      });
      if (inst?.subdominio) {
        (result as any).redirectToSubdomain = buildSubdomainUrl(inst.subdominio);
      }
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Register (com rate limit)
router.post('/register', loginRateLimiter, validateBody(registerSchema), async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

// Refresh token
router.post('/refresh', validateBody(refreshTokenSchema), async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const result = await authService.refreshToken(refreshToken);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Logout
router.post('/logout', authenticate, validateBody(logoutBodySchema), async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    await authService.logout(req.user!.userId, refreshToken);
    res.json({ message: 'Logout realizado com sucesso' });
  } catch (error) {
    next(error);
  }
});

// Roles de staff que obtêm instituicaoId do Funcionario quando User.instituicaoId é null
const STAFF_ROLES = ['RH', 'SECRETARIA', 'FINANCEIRO', 'POS', 'DIRECAO', 'COORDENADOR'];

// Get current user profile
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: {
        roles: true,
        instituicao: true
      }
    });

    if (!user) {
      throw new AppError(messages.auth.userNotFound, 404);
    }

    let instituicaoId = user.instituicaoId;
    // RH/SECRETARIA/outros staff: se User.instituicaoId null, obter do Funcionario
    if (!instituicaoId && user.roles.some((r: { role: string }) => STAFF_ROLES.includes(r.role))) {
      const func = await prisma.funcionario.findFirst({
        where: { userId: user.id },
        select: { instituicaoId: true }
      });
      if (func?.instituicaoId) instituicaoId = func.instituicaoId;
    }
    if (!instituicaoId && user.roles.some((r: { role: string }) => r.role === 'PROFESSOR')) {
      const prof = await prisma.professor.findFirst({
        where: { userId: user.id },
        select: { instituicaoId: true }
      });
      if (prof?.instituicaoId) instituicaoId = prof.instituicaoId;
    }
    if (!instituicaoId && user.roles.some((r: { role: string }) => r.role === 'ALUNO')) {
      const mat = await prisma.matriculaAnual.findFirst({
        where: { alunoId: user.id },
        select: { instituicaoId: true }
      });
      if (mat?.instituicaoId) instituicaoId = mat.instituicaoId;
    }

    const payload: Record<string, unknown> = {
      id: user.id,
      email: user.email,
      nomeCompleto: user.nomeCompleto,
      telefone: user.telefone,
      avatarUrl: user.avatarUrl,
      dataNascimento: user.dataNascimento,
      genero: user.genero,
      numeroIdentificacao: user.numeroIdentificacao,
      numeroIdentificacaoPublica: user.numeroIdentificacaoPublica,
      morada: user.morada,
      cidade: user.cidade,
      pais: user.pais,
      statusAluno: user.statusAluno,
      instituicaoId: instituicaoId,
      instituicao: user.instituicao,
      roles: user.roles.map((r: { role: string }) => r.role),
      createdAt: user.createdAt
    };

    // PROFESSOR: incluir professorId e tipoAcademico (tipoInstituicao) do token
    let professorId = req.user?.professorId;
    let tipoAcademico = req.user?.tipoAcademico;
    if (user.roles.some((r: { role: string }) => r.role === 'PROFESSOR') && instituicaoId && !professorId) {
      const prof = await prisma.professor.findFirst({
        where: { userId: user.id, instituicaoId },
        select: { id: true }
      });
      if (prof) professorId = prof.id;
    }
    if (!tipoAcademico && user.instituicao?.tipoAcademico) tipoAcademico = user.instituicao.tipoAcademico;
    if (professorId) payload.professorId = professorId;
    if (tipoAcademico) payload.tipoAcademico = tipoAcademico;

    res.json(payload);
  } catch (error) {
    next(error);
  }
});

// Reset password request (com rate limit)
router.post('/reset-password', authSensitiveRateLimiter, validateBody(resetPasswordSchema), async (req, res, next) => {
  try {
    const { email } = req.body;
    const result = await authService.resetPassword(email, req);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Confirm reset password with token (com rate limit)
router.post('/confirm-reset-password', authSensitiveRateLimiter, validateBody(confirmResetPasswordSchema), async (req, res, next) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;
    const result = await authService.confirmResetPassword(token, newPassword, confirmPassword);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Reset user password (admin/super admin only)
router.post('/reset-user-password', authenticate, validateBody(resetUserPasswordSchema), async (req, res, next) => {
  try {
    const { userId, newPassword, sendEmail } = req.body;

    // Verificar permissões (apenas ADMIN, SECRETARIA ou SUPER_ADMIN)
    const userRoles = req.user?.roles || [];
    const hasPermission = userRoles.some((role: string) =>
      ['ADMIN', 'SECRETARIA', 'SUPER_ADMIN'].includes(role)
    );

    if (!hasPermission) {
      throw new AppError('Acesso negado. Apenas administradores podem redefinir senhas.', 403);
    }

    const result = await authService.resetUserPassword(
      userId,
      newPassword,
      sendEmail ?? false,
      req.user!.userId,
      req
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Update password
router.put('/password', authenticate, validateBody(updatePasswordSchema), async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = await authService.updatePassword(
      req.user!.userId,
      currentPassword,
      newPassword
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Change password required (obrigatória - não exige senha atual)
// Versão com autenticação JWT (para usuários já autenticados)
router.post('/change-password-required', authenticate, validateBody(changePasswordRequiredSchema), async (req, res, next) => {
  try {
    const { newPassword, confirmPassword } = req.body;
    const result = await authService.changePasswordRequired(
      req.user!.userId,
      newPassword,
      confirmPassword
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Change password required (obrigatória - SEM autenticação JWT)
// Usado quando login foi bloqueado por mustChangePassword
// Valida identidade usando email + senha atual
router.post('/change-password-required-with-credentials', validateBody(changePasswordRequiredWithCredentialsSchema), async (req, res, next) => {
  try {
    const { email, currentPassword, newPassword, confirmPassword } = req.body;
    const result = await authService.changePasswordRequiredWithCredentials(
      email,
      currentPassword,
      newPassword,
      confirmPassword
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get profile (alias for /me)
router.get('/profile', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: {
        roles: true,
        instituicao: true
      }
    });

    if (!user) {
      throw new AppError(messages.auth.userNotFound, 404);
    }

    let instituicaoId = user.instituicaoId;
    if (!instituicaoId && user.roles.some((r: { role: string }) => STAFF_ROLES.includes(r.role))) {
      const func = await prisma.funcionario.findFirst({
        where: { userId: user.id },
        select: { instituicaoId: true }
      });
      if (func?.instituicaoId) instituicaoId = func.instituicaoId;
    }
    if (!instituicaoId && user.roles.some((r: { role: string }) => r.role === 'PROFESSOR')) {
      const prof = await prisma.professor.findFirst({
        where: { userId: user.id },
        select: { instituicaoId: true }
      });
      if (prof?.instituicaoId) instituicaoId = prof.instituicaoId;
    }
    if (!instituicaoId && user.roles.some((r: { role: string }) => r.role === 'ALUNO')) {
      const mat = await prisma.matriculaAnual.findFirst({
        where: { alunoId: user.id },
        select: { instituicaoId: true }
      });
      if (mat?.instituicaoId) instituicaoId = mat.instituicaoId;
    }

    const payload: Record<string, unknown> = {
      id: user.id,
      email: user.email,
      nomeCompleto: user.nomeCompleto,
      telefone: user.telefone,
      avatarUrl: user.avatarUrl,
      dataNascimento: user.dataNascimento,
      genero: user.genero,
      numeroIdentificacao: user.numeroIdentificacao,
      numeroIdentificacaoPublica: user.numeroIdentificacaoPublica,
      morada: user.morada,
      cidade: user.cidade,
      pais: user.pais,
      statusAluno: user.statusAluno,
      instituicaoId: instituicaoId,
      instituicao: user.instituicao,
      roles: user.roles.map((r: { role: string }) => r.role),
      createdAt: user.createdAt
    };

    let professorId = req.user?.professorId;
    let tipoAcademico = req.user?.tipoAcademico;
    if (user.roles.some((r: { role: string }) => r.role === 'PROFESSOR') && instituicaoId && !professorId) {
      const prof = await prisma.professor.findFirst({
        where: { userId: user.id, instituicaoId },
        select: { id: true }
      });
      if (prof) professorId = prof.id;
    }
    if (!tipoAcademico && user.instituicao?.tipoAcademico) tipoAcademico = user.instituicao.tipoAcademico;
    if (professorId) payload.professorId = professorId;
    if (tipoAcademico) payload.tipoAcademico = tipoAcademico;

    res.json(payload);
  } catch (error) {
    next(error);
  }
});

// Check lockout status
router.post('/check-lockout', validateBody(checkLockoutSchema), async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string' || email.trim() === '') {
      return res.json({
        isLocked: false,
        remainingSeconds: 0,
        remainingAttempts: 5
      });
    }

    const attempt = await prisma.loginAttempt.findUnique({
      where: { email: email.toLowerCase() }
    });
    
    if (attempt?.lockedUntil && attempt.lockedUntil > new Date()) {
      const remainingSeconds = Math.ceil(
        (attempt.lockedUntil.getTime() - Date.now()) / 1000
      );
      return res.json({
        isLocked: true,
        remainingSeconds,
        remainingAttempts: 0
      });
    } else {
      const remainingAttempts = attempt 
        ? Math.max(0, 5 - attempt.attemptCount) 
        : 5;
      return res.json({
        isLocked: false,
        remainingSeconds: 0,
        remainingAttempts
      });
    }
  } catch (error) {
    // On error, return default values instead of throwing
    // This prevents CORS issues from error handlers
    console.error('Error checking lockout:', error);
    res.json({
      isLocked: false,
      remainingSeconds: 0,
      remainingAttempts: 5
    });
  }
});

export default router;
