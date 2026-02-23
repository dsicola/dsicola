/**
 * Validadores Zod para rotas de autenticação.
 * Usados com validateBody/validateQuery do validate.middleware (erros tratados pelo errorHandler).
 */
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

export const registerSchema = z.object({
  email: z
    .string()
    .refine((val) => val && typeof val === 'string' && val.trim().length > 0, {
      message: 'Email é obrigatório',
    })
    .refine((val) => {
      const trimmed = typeof val === 'string' ? val.trim() : '';
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    }, { message: 'Email inválido' }),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  nomeCompleto: z
    .string()
    .refine((val) => val && typeof val === 'string' && val.trim().length >= 2, {
      message: 'Nome completo deve ter no mínimo 2 caracteres válidos',
    }),
  instituicaoId: z.string().uuid().optional(),
});

export const loginStep2Schema = z.object({
  userId: z.string().uuid('userId deve ser um UUID válido'),
  token: z.string().regex(/^\d{6}$/, 'Token deve ter 6 dígitos'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token é obrigatório'),
});

export const logoutBodySchema = z.object({
  refreshToken: z.string().optional(),
}).strict();

export const resetPasswordSchema = z.object({
  email: z.string().email('Email inválido'),
});

export const confirmResetPasswordSchema = z.object({
  token: z.string().min(1, 'Token é obrigatório'),
  newPassword: z.string().min(6, 'Nova senha deve ter no mínimo 6 caracteres'),
  confirmPassword: z.string().min(1, 'Confirmação de senha é obrigatória'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'A confirmação de senha não coincide',
  path: ['confirmPassword'],
});

export const resetUserPasswordSchema = z.object({
  userId: z.string().uuid('userId deve ser um UUID válido'),
  newPassword: z.string().min(6, 'Nova senha deve ter no mínimo 6 caracteres'),
  sendEmail: z.boolean().optional(),
});

export const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Senha atual é obrigatória'),
  newPassword: z.string().min(6, 'Nova senha deve ter no mínimo 6 caracteres'),
});

export const changePasswordRequiredSchema = z.object({
  newPassword: z.string().min(6, 'Nova senha deve ter no mínimo 6 caracteres'),
  confirmPassword: z.string().min(1, 'Confirmação é obrigatória'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'A confirmação de senha não coincide',
  path: ['confirmPassword'],
});

export const changePasswordRequiredWithCredentialsSchema = z.object({
  email: z.string().email('Email inválido'),
  currentPassword: z.string().min(1, 'Senha atual é obrigatória'),
  newPassword: z.string().min(6, 'Nova senha deve ter no mínimo 6 caracteres'),
  confirmPassword: z.string().min(1, 'Confirmação é obrigatória'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'A confirmação de senha não coincide',
  path: ['confirmPassword'],
});

export const checkLockoutSchema = z.object({
  email: z.string().optional(),
});

export type LoginBody = z.infer<typeof loginSchema>;
export type RegisterBody = z.infer<typeof registerSchema>;
export type LoginStep2Body = z.infer<typeof loginStep2Schema>;
export type RefreshTokenBody = z.infer<typeof refreshTokenSchema>;
export type LogoutBody = z.infer<typeof logoutBodySchema>;
export type ResetPasswordBody = z.infer<typeof resetPasswordSchema>;
export type ConfirmResetPasswordBody = z.infer<typeof confirmResetPasswordSchema>;
export type ResetUserPasswordBody = z.infer<typeof resetUserPasswordSchema>;
export type UpdatePasswordBody = z.infer<typeof updatePasswordSchema>;
export type ChangePasswordRequiredBody = z.infer<typeof changePasswordRequiredSchema>;
export type ChangePasswordRequiredWithCredentialsBody = z.infer<typeof changePasswordRequiredWithCredentialsSchema>;
