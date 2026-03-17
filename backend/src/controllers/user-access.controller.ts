/**
 * Controller para gerenciar acesso de usuários (alunos)
 * 
 * Funcionalidades:
 * - Criar conta de acesso para aluno
 * - Ativar/desativar conta
 * - Enviar link de redefinição de senha
 * - Ver informações de acesso (último login, status)
 */

import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import bcrypt from 'bcryptjs';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter } from '../middlewares/auth.js';
import authService from '../services/auth.service.js';
import { enviarNotificacaoCredencial } from '../services/notificacaoCanal.service.js';
import { AuditService } from '../services/audit.service.js';
import { ModuloAuditoria, EntidadeAuditoria, AcaoAuditoria } from '../services/audit.service.js';
import { randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';

const SALT_ROUNDS = 12;

/**
 * Obter informações de acesso do usuário
 * Apenas ADMIN e SECRETARIA podem ver
 */
export const getUserAccessInfo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);

    // Verificar se usuário existe e pertence à instituição
    const user = await prisma.user.findFirst({
      where: { id, ...filter },
      include: {
        roles: {
          select: { role: true }
        }
      }
    });

    if (!user) {
      throw new AppError('Usuário não encontrado', 404);
    }

    // Verificar se tem role ALUNO
    const hasAlunoRole = user.roles.some(r => r.role === 'ALUNO');
    if (!hasAlunoRole) {
      throw new AppError('Este endpoint é apenas para alunos', 403);
    }

    // Último login (baseado na auditoria - JWT é stateless)
    const lastLoginAudit = await prisma.logAuditoria.findFirst({
      where: {
        userId: user.id,
        acao: 'LOGIN_SUCCESS',
        entidade: 'LOGIN_EVENT'
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    });
    const lastLogin = lastLoginAudit?.createdAt || null;

    // Status da conta (baseado em ter senha e não estar bloqueado)
    const hasPassword = !!user.password && user.password.trim() !== '';
    const accountStatus = hasPassword ? 'Ativa' : 'Inativa';

    res.json({
      userId: user.id,
      email: user.email,
      accountStatus,
      role: 'ALUNO', // Sempre ALUNO para este endpoint
      lastLogin: lastLogin ? lastLogin.toISOString() : null,
      hasPassword,
      createdAt: user.createdAt.toISOString()
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Criar conta de acesso para aluno
 * Gera senha aleatória e envia por email
 */
export const createUserAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { sendEmail = true } = req.body;
    const filter = addInstitutionFilter(req);

    // Verificar se usuário existe e pertence à instituição
    const user = await prisma.user.findFirst({
      where: { id, ...filter },
      include: {
        roles: {
          select: { role: true }
        },
        instituicao: {
          select: { id: true, nome: true }
        }
      }
    });

    if (!user) {
      throw new AppError('Usuário não encontrado', 404);
    }

    // Verificar se já tem senha
    if (user.password && user.password.trim() !== '') {
      throw new AppError('Usuário já possui conta de acesso', 400);
    }

    // Verificar se tem role ALUNO
    const hasAlunoRole = user.roles.some(r => r.role === 'ALUNO');
    if (!hasAlunoRole) {
      // Adicionar role ALUNO se não tiver
      await prisma.userRole_.create({
        data: {
          userId: user.id,
          role: 'ALUNO',
          instituicaoId: user.instituicaoId
        }
      });
    }

    // Gerar senha aleatória
    const randomPassword = randomBytes(12).toString('base64').slice(0, 12) + 'A1!';
    const passwordHash = await bcrypt.hash(randomPassword, SALT_ROUNDS);

    // Atualizar senha
    await prisma.user.update({
      where: { id: user.id },
      data: { password: passwordHash }
    });

    await AuditService.log(req, {
      modulo: ModuloAuditoria.SEGURANCA,
      acao: AcaoAuditoria.CREATE,
      entidade: EntidadeAuditoria.USER,
      entidadeId: user.id,
      dadosNovos: { email: user.email, observacao: 'Conta de acesso criada para aluno' },
      instituicaoId: user.instituicaoId ?? undefined,
    }).catch((err) => console.error('[createUserAccess] Erro audit:', err?.message));

    // Enviar notificação por canais conforme plano (Start=email, Pro=email+telegram, Enterprise=email+telegram+sms)
    if (sendEmail) {
      try {
        await enviarNotificacaoCredencial(req, {
          instituicaoId: user.instituicaoId,
          userId: user.id,
          tipo: 'CRIACAO_CONTA_ACESSO',
          emailType: 'CRIACAO_CONTA_ACESSO',
          dados: {
            email: user.email,
            senhaTemporaria: randomPassword,
            nomeUsuario: user.nomeCompleto || 'Aluno',
            linkLogin: `${process.env.FRONTEND_URL || 'http://localhost:8080'}/auth`,
          },
          opts: { destinatarioNome: user.nomeCompleto || undefined },
        });
      } catch (err: any) {
        console.error('[createUserAccess] Erro ao enviar notificação:', err?.message);
      }
    }

    res.json({
      message: 'Conta de acesso criada com sucesso',
      email: user.email,
      password: sendEmail ? undefined : randomPassword, // Só retornar senha se não enviou email
      accountStatus: 'Ativa'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Ativar/desativar conta de acesso
 */
export const toggleUserAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { active } = req.body;
    const filter = addInstitutionFilter(req);

    if (typeof active !== 'boolean') {
      throw new AppError('Parâmetro "active" deve ser boolean', 400);
    }

    // Verificar se usuário existe e pertence à instituição
    const user = await prisma.user.findFirst({
      where: { id, ...filter }
    });

    if (!user) {
      throw new AppError('Usuário não encontrado', 404);
    }

    if (active) {
      // Ativar: garantir que tem senha
      if (!user.password || user.password.trim() === '') {
        // Gerar senha aleatória se não tiver
        const randomPassword = randomBytes(12).toString('base64').slice(0, 12) + 'A1!';
        const passwordHash = await bcrypt.hash(randomPassword, SALT_ROUNDS);
        
        await prisma.user.update({
          where: { id: user.id },
          data: { password: passwordHash }
        });

        res.json({
          message: 'Conta ativada com sucesso',
          accountStatus: 'Ativa',
          password: randomPassword // Retornar senha para admin definir
        });
      } else {
        res.json({
          message: 'Conta já está ativa',
          accountStatus: 'Ativa'
        });
      }
    } else {
      // Desativar: remover senha (não deletar usuário)
      await prisma.user.update({
        where: { id: user.id },
        data: { password: '' }
      });

      // JWT é stateless - não há tokens para revogar
      // Tokens expiram naturalmente conforme configurado

      res.json({
        message: 'Conta desativada com sucesso',
        accountStatus: 'Inativa'
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Enviar link de redefinição de senha
 */
export const sendPasswordResetLink = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);

    // Verificar se usuário existe e pertence à instituição
    const user = await prisma.user.findFirst({
      where: { id, ...filter },
      include: {
        instituicao: {
          select: { id: true, nome: true }
        }
      }
    });

    if (!user) {
      throw new AppError('Usuário não encontrado', 404);
    }

    // Usar o método existente de reset de senha
    await authService.resetPassword(user.email, req);

    res.json({
      message: 'Link de redefinição de senha enviado com sucesso'
    });
  } catch (error) {
    next(error);
  }
};

