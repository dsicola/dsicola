import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from './errorHandler.js';
import { AuditService, AcaoAuditoria } from '../services/audit.service.js';
import { EmailService } from '../services/email.service.js';

/**
 * Middleware para validar licença/assinatura da instituição
 * 
 * REGRAS ABSOLUTAS:
 * 1) Nenhuma instituição pode usar o sistema sem licença ACTIVE
 * 2) Licença expirada → BLOQUEIO AUTOMÁTICO
 * 3) SUPER_ADMIN ignora licenciamento
 * 4) Rotas públicas ignoram licenciamento
 */
export const validateLicense = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // DEBUG: Log inicial
    if (process.env.NODE_ENV !== 'production') {
      console.log('[validateLicense] 📋 Iniciando validação de licença:', {
        route: `${req.method} ${req.path}`,
        userId: req.user?.userId,
        email: req.user?.email,
        instituicaoId: req.user?.instituicaoId,
        roles: req.user?.roles,
        hasUser: !!req.user,
      });
    }

    // ⚠️ BYPASS REMOVIDO - Sistema funciona apenas com assinatura válida
    // Em produção e desenvolvimento, TODAS as instituições precisam de assinatura válida

    // Roles globais (SUPER_ADMIN, COMERCIAL) ignoram licenciamento (operam em nível SaaS)
    if (req.user?.roles.includes('SUPER_ADMIN') || req.user?.roles.includes('COMERCIAL')) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[validateLicense] ✅ Role global - bypass de licença');
      }
      return next();
    }

    // Se não há usuário autenticado, não valida (será bloqueado pelo authenticate)
    if (!req.user) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[validateLicense] ⚠️  Sem usuário - deixando authenticate bloquear');
      }
      return next();
    }

    // Se não tem instituicaoId, não valida (será bloqueado por outras validações)
    if (!req.user.instituicaoId) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[validateLicense] ⚠️  Usuário sem instituicaoId - deixando outras validações bloquearem');
      }
      return next();
    }

    // Buscar assinatura da instituição
    const assinatura = await prisma.assinatura.findUnique({
      where: { instituicaoId: req.user.instituicaoId },
      include: {
        plano: true,
      },
    });

    // VALIDAÇÃO 1: Instituição sem assinatura → BLOQUEIO IMEDIATO
    if (!assinatura) {
      // Gerar audit log de bloqueio
      AuditService.log(req, {
        modulo: 'LICENCIAMENTO' as any,
        acao: AcaoAuditoria.BLOCK,
        entidade: 'ASSINATURA' as any,
        observacao: `Acesso bloqueado: instituição sem assinatura`,
      }).catch((error) => {
        console.error('[validateLicense] Erro ao gerar audit log:', error);
      });

      if (process.env.NODE_ENV !== 'production') {
        console.error('[validateLicense] ❌ BLOQUEADO: Instituição sem assinatura', {
          instituicaoId: req.user.instituicaoId,
          route: `${req.method} ${req.path}`,
        });
      }

      const errorMessage = 'Acesso bloqueado: sua instituição não possui uma assinatura ativa. ' +
        'Entre em contato com o suporte para ativar sua conta.';
      
      const error = new AppError(errorMessage, 403);
      (error as any).reason = 'LICENSE_NOT_FOUND';
      throw error;
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    // VALIDAÇÃO 2: Status não ativo → BLOQUEADO
    if (assinatura.status !== 'ativa') {
      const motivo = 
        assinatura.status === 'suspensa' ? 'assinatura suspensa' :
        assinatura.status === 'cancelada' ? 'assinatura cancelada' :
        assinatura.status === 'teste' ? 'período de teste expirado' :
        `status: ${assinatura.status}`;

      // Gerar audit log de bloqueio
      AuditService.log(req, {
        modulo: 'LICENCIAMENTO' as any,
        acao: AcaoAuditoria.BLOCK,
        entidade: 'ASSINATURA' as any,
        entidadeId: assinatura.id,
        observacao: `Acesso bloqueado: ${motivo}`,
      }).catch((error) => {
        console.error('[validateLicense] Erro ao gerar audit log:', error);
      });

      if (process.env.NODE_ENV !== 'production') {
        console.error('[validateLicense] ❌ BLOQUEADO: Status de assinatura inválido', {
          instituicaoId: req.user.instituicaoId,
          status: assinatura.status,
          route: `${req.method} ${req.path}`,
        });
      }

      const error = new AppError(
        `Acesso bloqueado: sua assinatura está ${motivo}. ` +
        'Entre em contato com o suporte para reativar sua conta.',
        403
      );
      (error as any).reason = 'LICENSE_STATUS_INVALID';
      throw error;
    }

    // VALIDAÇÃO 3: Data fim expirada → MARCAR COMO EXPIRADA E BLOQUEAR
    if (assinatura.dataFim) {
      const dataFim = new Date(assinatura.dataFim);
      dataFim.setHours(0, 0, 0, 0);

      if (dataFim < hoje) {
        // Marcar assinatura como expirada automaticamente
        if (assinatura.status === 'ativa') {
          await prisma.assinatura.update({
            where: { id: assinatura.id },
            data: { status: 'expirada' as any },
          }).catch((error) => {
            console.error('[validateLicense] Erro ao marcar assinatura como expirada:', error);
          });

          // Buscar email do admin (preferir) ou emailContato para notificar
          const { getAdminEmailForInstituicao } = await import('../services/instituicaoAdmin.service.js');
          const instituicao = await prisma.instituicao.findUnique({
            where: { id: assinatura.instituicaoId },
            select: { emailContato: true, nome: true },
          }).catch(() => null);
          const emailDestino = await getAdminEmailForInstituicao(assinatura.instituicaoId)
            .catch(() => null) || instituicao?.emailContato;

          // Enviar e-mail de assinatura expirada (não abortar se falhar)
          if (emailDestino && instituicao?.nome) {
            try {
              await EmailService.sendEmail(
                req,
                emailDestino,
                'ASSINATURA_EXPIRADA',
                {
                  dataExpiracao: dataFim.toLocaleDateString('pt-BR'),
                  nomeInstituicao: instituicao.nome,
                  nomeDestinatario: 'Administrador',
                },
                {
                  instituicaoId: assinatura.instituicaoId || undefined,
                }
              );
            } catch (emailError: any) {
              console.error('[validateLicense] Erro ao enviar e-mail (não crítico):', emailError.message);
            }
          }

          // Notificação interna: Assinatura expirada (não bloquear se falhar)
          try {
            const { NotificacaoService } = await import('../services/notificacao.service.js');
            await NotificacaoService.notificarAssinaturaExpirada(
              req,
              assinatura.instituicaoId
            );
          } catch (notifError: any) {
            console.error('[validateLicense] Erro ao criar notificação (não crítico):', notifError.message);
          }
        }

        // Notificação interna: Bloqueio por assinatura (para todos os usuários da instituição)
        try {
          const { NotificacaoService } = await import('../services/notificacao.service.js');
          await NotificacaoService.notificarBloqueioAssinatura(
            req,
            assinatura.instituicaoId
          );
        } catch (notifError: any) {
          console.error('[validateLicense] Erro ao criar notificação de bloqueio (não crítico):', notifError.message);
        }

        // Gerar audit log de bloqueio
        AuditService.log(req, {
          modulo: 'LICENCIAMENTO' as any,
          acao: AcaoAuditoria.BLOCK,
          entidade: 'ASSINATURA' as any,
          entidadeId: assinatura.id,
          observacao: `Acesso bloqueado: assinatura expirada em ${dataFim.toLocaleDateString('pt-BR')}`,
        }).catch((error) => {
          console.error('[validateLicense] Erro ao gerar audit log:', error);
        });

        if (process.env.NODE_ENV !== 'production') {
          console.error('[validateLicense] ❌ BLOQUEADO: Assinatura expirada', {
            instituicaoId: req.user.instituicaoId,
            dataFim: dataFim.toLocaleDateString('pt-BR'),
            route: `${req.method} ${req.path}`,
          });
        }

        // Mensagem personalizada para DEMO vs PAGA
        const isDemo = assinatura.tipo === 'DEMO';
        const mensagem = isDemo
          ? `Sua licença de demonstração expirou em ${dataFim.toLocaleDateString('pt-BR')}. Entre em contato para ativar a versão completa.`
          : `Acesso bloqueado: sua assinatura expirou em ${dataFim.toLocaleDateString('pt-BR')}. Renove sua assinatura para continuar usando o sistema.`;

        const error = new AppError(mensagem, 403);
        (error as any).reason = 'LICENSE_EXPIRED';
        throw error;
      }
    }

    // VALIDAÇÃO 4: Status deve ser 'ativa' (LÓGICA ÚNICA PARA DEMO E PAGA)
    // DEMO e PAGA funcionam da mesma forma: precisam de status 'ativa' e data_fim válida
    // A única diferença é a duração e a mensagem de bloqueio

    // Todas as validações passaram
    if (process.env.NODE_ENV !== 'production') {
      console.log('[validateLicense] ✅ Licença válida - permitindo acesso', {
        instituicaoId: req.user.instituicaoId,
        route: `${req.method} ${req.path}`,
      });
    }
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Verificar limites de plano (usuários, alunos, cursos, etc.)
 * Usado em controllers específicos antes de criar recursos
 */
export const validatePlanLimits = async (
  req: Request,
  limitType: 'alunos' | 'professores' | 'cursos' | 'usuarios',
  currentCount?: number,
  instituicaoIdOverride?: string // Para fluxos como aprovar candidatura (SUPER_ADMIN sem instituicaoId)
): Promise<void> => {
  const instituicaoId = instituicaoIdOverride || req.user?.instituicaoId;
  if (!instituicaoId) {
    throw new AppError('Usuário sem instituição associada', 403);
  }

  // SUPER_ADMIN ignora limites apenas quando não há instituicaoId especificada
  // Quando instituicaoIdOverride é passada (ex: aprovar candidatura), validar limites
  if (req.user?.roles.includes('SUPER_ADMIN') && !instituicaoIdOverride) {
    return;
  }

  const assinatura = await prisma.assinatura.findUnique({
    where: { instituicaoId },
    include: { plano: true },
  });

  if (!assinatura || assinatura.status !== 'ativa') {
    throw new AppError('Assinatura não encontrada ou inativa', 403);
  }

  const plano = assinatura.plano;
  let limite: number | null = null;
  let count: number;

  // Obter limite do plano
  switch (limitType) {
    case 'alunos':
      limite = plano.limiteAlunos;
      if (currentCount === undefined) {
        count = await prisma.userRole_.count({
          where: {
            instituicaoId,
            role: 'ALUNO',
          },
        });
      } else {
        count = currentCount;
      }
      break;
    case 'professores':
      limite = plano.limiteProfessores;
      if (currentCount === undefined) {
        count = await prisma.userRole_.count({
          where: {
            instituicaoId,
            role: 'PROFESSOR',
          },
        });
      } else {
        count = currentCount;
      }
      break;
    case 'cursos':
      limite = plano.limiteCursos;
      if (currentCount === undefined) {
        count = await prisma.curso.count({
          where: { instituicaoId },
        });
      } else {
        count = currentCount;
      }
      break;
    case 'usuarios':
      // Limite de usuários = soma de alunos + professores
      const alunosCount = await prisma.userRole_.count({
        where: {
          instituicaoId,
          role: 'ALUNO',
        },
      });
      const professoresCount = await prisma.userRole_.count({
        where: {
          instituicaoId,
          role: 'PROFESSOR',
        },
      });
      count = alunosCount + professoresCount;
      // Usar o menor limite disponível (alunos ou professores)
      limite = plano.limiteAlunos || plano.limiteProfessores;
      break;
    default:
      return; // Tipo desconhecido, não valida
  }

  // NULL = ilimitado (plano Enterprise)
  if (limite === null) {
    return;
  }

  // Tolerância configurável (ex: 10% = plano 30 permite até 33)
  let limiteEfetivo = limite;
  if (limitType === 'alunos' && instituicaoId) {
    try {
      const parametros = await prisma.parametrosSistema.findUnique({
        where: { instituicaoId },
        select: { toleranciaPercentualLimiteAlunos: true },
      });
      const tolerancia = parametros?.toleranciaPercentualLimiteAlunos ?? 10;
      if (tolerancia > 0 && tolerancia <= 100) {
        limiteEfetivo = limite + Math.ceil((limite * tolerancia) / 100);
      }
    } catch {
      // Em caso de erro, usar limite sem tolerância
    }
  }

  // Verificar se excedeu o limite (com tolerância para alunos)
  if (count >= limiteEfetivo) {
    const tipoLabel = 
      limitType === 'alunos' ? 'alunos' :
      limitType === 'professores' ? 'professores' :
      limitType === 'cursos' ? 'cursos' :
      'usuários';

    const msgTolerancia = limitType === 'alunos' && limiteEfetivo > limite
      ? ` (com tolerância de até ${limiteEfetivo})`
      : '';
    throw new AppError(
      `Limite de ${tipoLabel} atingido! Seu plano "${plano.nome}" permite até ${limite} ${tipoLabel}${msgTolerancia}. ` +
      `Atualmente você tem ${count} ${tipoLabel} cadastrados. Atualize seu plano para cadastrar mais.`,
      403
    );
  }
};

/**
 * Middleware: valida se o plano da instituição inclui a funcionalidade
 * Usado em rotas que exigem funcionalidades específicas (alojamentos, comunicados, analytics, api_access)
 * SUPER_ADMIN bypassa a validação
 */
export const validatePlanFeature = (funcionalidade: string) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (req.user?.roles?.includes('SUPER_ADMIN')) return next();

      const instituicaoId = req.user?.instituicaoId;
      if (!instituicaoId) {
        return next();
      }

      const { validatePlanFuncionalidade } = await import('../services/planFeatures.service.js');
      await validatePlanFuncionalidade(instituicaoId, funcionalidade, true, req.user?.roles);
      next();
    } catch (error) {
      next(error);
    }
  };
};

