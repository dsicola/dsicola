import { Request } from 'express';
import prisma from '../lib/prisma.js';
import { requireTenantScope } from '../middlewares/auth.js';
import { AuditService } from './audit.service.js';
import { AppError } from '../middlewares/errorHandler.js';

/**
 * Serviço centralizado de comunicação institucional
 * Garante isolamento multi-tenant e validações de permissão
 */
export class ComunicacaoService {
  /**
   * Validar que usuários pertencem ao mesmo tenant
   */
  static async validarTenant(instituicaoId: string, userIds: string[]): Promise<boolean> {
    const usuarios = await prisma.user.findMany({
      where: {
        id: { in: userIds },
      },
      select: {
        id: true,
        instituicaoId: true,
      },
    });

    // Verificar se todos os usuários foram encontrados
    if (usuarios.length !== userIds.length) {
      return false;
    }

    // Verificar se todos pertencem ao mesmo tenant
    return usuarios.every((user) => user.instituicaoId === instituicaoId);
  }

  /**
   * Validar relação responsável-aluno
   */
  static async validarRelacaoResponsavelAluno(
    responsavelId: string,
    alunoId: string,
    instituicaoId: string
  ): Promise<boolean> {
    // Validar tenant primeiro
    const tenantValido = await this.validarTenant(instituicaoId, [responsavelId, alunoId]);
    if (!tenantValido) {
      return false;
    }

    // Verificar relação
    const relacao = await prisma.responsavelAluno.findUnique({
      where: {
        responsavelId_alunoId: {
          responsavelId,
          alunoId,
        },
      },
    });

    return !!relacao;
  }

  /**
   * Validar relação professor-aluno
   */
  static async validarRelacaoProfessorAluno(
    professorId: string,
    alunoId: string,
    instituicaoId: string
  ): Promise<boolean> {
    // Validar tenant primeiro
    const tenantValido = await this.validarTenant(instituicaoId, [professorId, alunoId]);
    if (!tenantValido) {
      return false;
    }

    // Verificar se professor leciona para o aluno
    const professorDisciplina = await prisma.professorDisciplina.findFirst({
      where: {
        professorId,
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

    return !!professorDisciplina;
  }

  /**
   * Criar notificação de forma segura (multi-tenant)
   */
  static async criarNotificacao(
    req: Request,
    params: {
      userId: string;
      titulo: string;
      mensagem: string;
      tipo?: string;
      link?: string;
    }
  ): Promise<any> {
    const instituicaoId = requireTenantScope(req);

    // Validar tenant
    const tenantValido = await this.validarTenant(instituicaoId, [params.userId]);
    if (!tenantValido) {
      await AuditService.logAccessBlocked(req, {
        modulo: 'COMUNICACAO',
        acao: 'CREATE',
        recurso: 'Notificacao',
        motivo: 'Usuário destino pertence a outro tenant',
      });

      throw new AppError('Acesso negado: usuário destino pertence a outra instituição', 403);
    }

    // Criar notificação
    const notificacao = await prisma.notificacao.create({
      data: {
        userId: params.userId,
        titulo: params.titulo,
        mensagem: params.mensagem,
        tipo: params.tipo || 'info',
        link: params.link || null,
        instituicaoId,
      },
    });

    // Auditoria
    await AuditService.log(req, {
      modulo: 'COMUNICACAO',
      acao: 'MESSAGE_SENT',
      entidade: 'Notificacao',
      entidadeId: notificacao.id,
      dadosNovos: { titulo: params.titulo, userId: params.userId },
    });

    return notificacao;
  }

  /**
   * Registrar envio de email com validação de tenant
   */
  static async registrarEmailEnviado(
    req: Request,
    params: {
      destinatarioEmail: string;
      destinatarioNome?: string;
      assunto: string;
      tipo: string;
      status: 'enviado' | 'erro';
      erro?: string;
      destinatarioUserId?: string; // Para validar tenant
    }
  ): Promise<any> {
    const instituicaoId = requireTenantScope(req);

    // Se tiver userId do destinatário, validar tenant
    if (params.destinatarioUserId) {
      const usuario = await prisma.user.findUnique({
        where: { id: params.destinatarioUserId },
        select: { instituicaoId: true, email: true },
      });

      if (usuario) {
        // Validar que email pertence ao usuário
        if (usuario.email !== params.destinatarioEmail) {
          console.warn(`[ComunicacaoService] Email não corresponde ao usuário: ${params.destinatarioEmail}`);
        }

        // Validar tenant
        if (usuario.instituicaoId !== instituicaoId) {
          await AuditService.logAccessBlocked(req, {
            modulo: 'COMUNICACAO',
            acao: 'EMAIL_SENT',
            recurso: 'EmailEnviado',
            motivo: 'Email enviado para usuário de outro tenant',
          });

          throw new AppError('Acesso negado: email destinado a usuário de outra instituição', 403);
        }
      }
    }

    // Criar registro
    const emailRegistro = await prisma.emailEnviado.create({
      data: {
        destinatarioEmail: params.destinatarioEmail,
        destinatarioNome: params.destinatarioNome || null,
        assunto: params.assunto,
        tipo: params.tipo,
        status: params.status,
        erro: params.erro || null,
        instituicaoId,
      },
    });

    // Auditoria
    await AuditService.log(req, {
      modulo: 'COMUNICACAO',
      acao: params.status === 'enviado' ? 'EMAIL_SENT' : 'EMAIL_FAILED',
      entidade: 'EmailEnviado',
      entidadeId: emailRegistro.id,
      dadosNovos: {
        destinatarioEmail: params.destinatarioEmail,
        assunto: params.assunto,
        tipo: params.tipo,
        status: params.status,
      },
      observacao: params.erro || undefined,
    });

    return emailRegistro;
  }

  /**
   * Validar permissão de comunicação
   * Retorna true se comunicação é permitida
   */
  static async validarPermissaoComunicacao(
    req: Request,
    params: {
      remetenteId?: string;
      destinatarioId: string;
      tipo: 'ALUNO_PROFESSOR' | 'RESPONSAVEL_PROFESSOR' | 'INSTITUICAO_USUARIO' | 'ADMIN_INSTITUICAO';
      alunoId?: string; // Para validar relações
    }
  ): Promise<boolean> {
    const instituicaoId = requireTenantScope(req);
    const userRoles = req.user?.roles || [];

    // Validar tenant primeiro
    const userIds = [params.destinatarioId];
    if (params.remetenteId) userIds.push(params.remetenteId);
    if (params.alunoId) userIds.push(params.alunoId);

    const tenantValido = await this.validarTenant(instituicaoId, userIds);
    if (!tenantValido) {
      return false;
    }

    switch (params.tipo) {
      case 'RESPONSAVEL_PROFESSOR':
        if (!params.remetenteId || !params.alunoId) {
          return false;
        }
        // Validar relação responsável-aluno
        const relacaoResponsavel = await this.validarRelacaoResponsavelAluno(
          params.remetenteId,
          params.alunoId,
          instituicaoId
        );
        if (!relacaoResponsavel) {
          return false;
        }
        // Validar relação professor-aluno
        const relacaoProfessor = await this.validarRelacaoProfessorAluno(
          params.destinatarioId,
          params.alunoId,
          instituicaoId
        );
        return relacaoProfessor;

      case 'ALUNO_PROFESSOR':
        if (!params.remetenteId || !params.alunoId) {
          return false;
        }
        // Validar que remetente é o aluno
        if (params.remetenteId !== params.alunoId) {
          return false;
        }
        // Validar relação professor-aluno
        return await this.validarRelacaoProfessorAluno(
          params.destinatarioId,
          params.alunoId,
          instituicaoId
        );

      case 'INSTITUICAO_USUARIO':
        // Admin/Secretaria pode comunicar com qualquer usuário do tenant
        return userRoles.includes('ADMIN') || userRoles.includes('SECRETARIA');

      case 'ADMIN_INSTITUICAO':
        // Super-Admin pode comunicar com qualquer instituição
        return userRoles.includes('SUPER_ADMIN');

      default:
        return false;
    }
  }
}

