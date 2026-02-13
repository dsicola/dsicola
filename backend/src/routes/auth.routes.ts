import { Router } from 'express';
import { z } from 'zod';
import authService from '../services/auth.service.js';
import { authenticate } from '../middlewares/auth.js';
import { AppError } from '../middlewares/errorHandler.js';
import prisma from '../lib/prisma.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres')
});

const registerSchema = z.object({
  email: z.string()
    .refine((val) => val && typeof val === 'string' && val.trim().length > 0, {
      message: 'Email é obrigatório'
    })
    .refine((val) => {
      const trimmed = typeof val === 'string' ? val.trim() : '';
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    }, {
      message: 'Email inválido'
    }),
  password: z.string()
    .min(6, 'Senha deve ter no mínimo 6 caracteres'),
  nomeCompleto: z.string()
    .refine((val) => val && typeof val === 'string' && val.trim().length >= 2, {
      message: 'Nome completo deve ter no mínimo 2 caracteres válidos'
    }),
  instituicaoId: z.string().uuid().optional()
});

// Login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const result = await authService.login(email, password, req);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Login Step 2: Verificar código 2FA
const loginStep2Schema = z.object({
  userId: z.string().uuid('userId deve ser um UUID válido'),
  token: z.string().regex(/^\d{6}$/, 'Token deve ter 6 dígitos')
});

router.post('/login-step2', async (req, res, next) => {
  try {
    const { userId, token } = loginStep2Schema.parse(req.body);
    const result = await authService.loginStep2(userId, token, req);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Register
router.post('/register', async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const result = await authService.register(data);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

// Refresh token
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      throw new AppError('Refresh token obrigatório', 400);
    }
    const result = await authService.refreshToken(refreshToken);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Logout
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    await authService.logout(req.user!.userId, refreshToken);
    res.json({ message: 'Logout realizado com sucesso' });
  } catch (error) {
    next(error);
  }
});

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
      throw new AppError('Usuário não encontrado', 404);
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
      instituicaoId: user.instituicaoId,
      instituicao: user.instituicao,
      roles: user.roles.map((r: { role: string }) => r.role),
      createdAt: user.createdAt
    };

    // PROFESSOR: incluir professorId e tipoAcademico (tipoInstituicao) do token
    let professorId = req.user?.professorId;
    let tipoAcademico = req.user?.tipoAcademico;
    if (user.roles.some((r: { role: string }) => r.role === 'PROFESSOR') && user.instituicaoId && !professorId) {
      const prof = await prisma.professor.findFirst({
        where: { userId: user.id, instituicaoId: user.instituicaoId },
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

// Reset password request
router.post('/reset-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    const result = await authService.resetPassword(email, req);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Confirm reset password with token
router.post('/confirm-reset-password', async (req, res, next) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;
    
    if (!token || !newPassword || !confirmPassword) {
      throw new AppError('Token, nova senha e confirmação de senha são obrigatórios', 400);
    }

    const result = await authService.confirmResetPassword(token, newPassword, confirmPassword);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Reset user password (admin/super admin only)
router.post('/reset-user-password', authenticate, async (req, res, next) => {
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

    if (!userId || !newPassword) {
      throw new AppError('userId e newPassword são obrigatórios', 400);
    }

    const result = await authService.resetUserPassword(
      userId,
      newPassword,
      sendEmail || false,
      req.user!.userId,
      req
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Update password
router.put('/password', authenticate, async (req, res, next) => {
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
router.post('/change-password-required', authenticate, async (req, res, next) => {
  try {
    const { newPassword, confirmPassword } = req.body;
    
    if (!newPassword || !confirmPassword) {
      throw new AppError('Nova senha e confirmação são obrigatórias', 400);
    }

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
router.post('/change-password-required-with-credentials', async (req, res, next) => {
  try {
    const { email, currentPassword, newPassword, confirmPassword } = req.body;
    
    if (!email || !currentPassword || !newPassword || !confirmPassword) {
      throw new AppError('Email, senha atual, nova senha e confirmação são obrigatórios', 400);
    }

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
      throw new AppError('Usuário não encontrado', 404);
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
      instituicaoId: user.instituicaoId,
      instituicao: user.instituicao,
      roles: user.roles.map((r: { role: string }) => r.role),
      createdAt: user.createdAt
    };

    // PROFESSOR: incluir professorId e tipoAcademico (tipoInstituicao) do token
    let professorId = req.user?.professorId;
    let tipoAcademico = req.user?.tipoAcademico;
    if (user.roles.some((r: { role: string }) => r.role === 'PROFESSOR') && user.instituicaoId && !professorId) {
      // Fallback: buscar professorId do DB se token não tiver (ex: token antigo)
      const prof = await prisma.professor.findFirst({
        where: { userId: user.id, instituicaoId: user.instituicaoId },
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
router.post('/check-lockout', async (req, res, next) => {
  try {
    const { email } = req.body;
    
    // Validate email
    if (!email || typeof email !== 'string') {
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
