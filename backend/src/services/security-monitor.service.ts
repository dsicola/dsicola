import { Request } from 'express';
import prisma from '../lib/prisma.js';
import { AuditService, ModuloAuditoria, AcaoAuditoria } from './audit.service.js';
import { AppError } from '../middlewares/errorHandler.js';

/**
 * Serviço de monitoramento de segurança
 * Detecta e alerta sobre tentativas suspeitas de violação multi-tenant
 */
export class SecurityMonitorService {
  /**
   * Limite de tentativas bloqueadas antes de gerar alerta
   */
  private static readonly ALERT_THRESHOLD = 3;
  
  /**
   * Janela de tempo para contar tentativas (em minutos)
   */
  private static readonly TIME_WINDOW_MINUTES = 15;

  /**
   * Registrar tentativa bloqueada de envio de e-mail cross-tenant
   */
  static async logEmailBlockedAttempt(
    req: Request | null,
    params: {
      userInstituicaoId: string | null | undefined;
      requestedInstituicaoId: string;
      destinatarioEmail: string;
      tipo: string;
    }
  ): Promise<void> {
    try {
      // Registrar no audit log
      if (req) {
        await AuditService.log(req, {
          modulo: ModuloAuditoria.COMUNICACAO,
          acao: AcaoAuditoria.BLOCK,
          entidade: 'EMAIL_ENVIADO',
          observacao: `Tentativa de envio de e-mail bloqueada: usuário tentou enviar para instituição ${params.requestedInstituicaoId} (usuário pertence a ${params.userInstituicaoId || 'N/A'})`,
          dadosNovos: {
            userInstituicaoId: params.userInstituicaoId || null,
            requestedInstituicaoId: params.requestedInstituicaoId,
            destinatarioEmail: params.destinatarioEmail,
            tipo: params.tipo,
          },
        });
      }

      // Se não tiver req, não podemos fazer muito, mas logamos
      if (!req || !req.user) {
        console.error('[SecurityMonitor] ⚠️  Tentativa bloqueada sem contexto de usuário:', params);
        return;
      }

      const userId = req.user.userId;
      const userEmail = req.user.email;
      const userInstituicaoId = params.userInstituicaoId;

      // Verificar se há múltiplas tentativas recentes
      const recentAttempts = await this.countRecentBlockedAttempts(
        userId,
        userInstituicaoId || null
      );

      // Se exceder o limite, gerar alerta
      if (recentAttempts >= this.ALERT_THRESHOLD) {
        await this.generateSecurityAlert(req, {
          userId,
          userEmail,
          userInstituicaoId: userInstituicaoId || null,
          requestedInstituicaoId: params.requestedInstituicaoId,
          attemptCount: recentAttempts + 1,
          tipo: 'EMAIL_CROSS_TENANT',
        });
      }

      // Log detalhado
      console.error('[SecurityMonitor] 🚫 Tentativa bloqueada de envio cross-tenant:', {
        userId,
        userEmail,
        userInstituicaoId,
        requestedInstituicaoId: params.requestedInstituicaoId,
        destinatarioEmail: params.destinatarioEmail,
        tipo: params.tipo,
        recentAttempts: recentAttempts + 1,
        willAlert: recentAttempts + 1 >= this.ALERT_THRESHOLD,
      });
    } catch (error: any) {
      // Não quebrar o fluxo principal se o monitoramento falhar
      console.error('[SecurityMonitor] Erro ao registrar tentativa bloqueada:', error.message);
    }
  }

  /**
   * Contar tentativas bloqueadas recentes do mesmo usuário/instituição
   */
  private static async countRecentBlockedAttempts(
    userId: string,
    instituicaoId: string | null
  ): Promise<number> {
    try {
      const timeWindow = new Date();
      timeWindow.setMinutes(timeWindow.getMinutes() - this.TIME_WINDOW_MINUTES);

      const count = await prisma.logAuditoria.count({
        where: {
          userId,
          instituicaoId: instituicaoId || undefined,
          modulo: ModuloAuditoria.COMUNICACAO,
          acao: AcaoAuditoria.BLOCK,
          createdAt: {
            gte: timeWindow,
          },
          observacao: {
            contains: 'Tentativa de envio de e-mail bloqueada',
          },
        },
      });

      return count;
    } catch (error) {
      console.error('[SecurityMonitor] Erro ao contar tentativas recentes:', error);
      return 0;
    }
  }

  /**
   * Gerar alerta de segurança
   */
  private static async generateSecurityAlert(
    req: Request,
    params: {
      userId: string;
      userEmail: string;
      userInstituicaoId: string | null;
      requestedInstituicaoId: string;
      attemptCount: number;
      tipo: string;
    }
  ): Promise<void> {
    try {
      // Registrar alerta no audit log
      await AuditService.log(req, {
        modulo: ModuloAuditoria.COMUNICACAO,
        acao: 'SECURITY_ALERT' as any,
        entidade: 'SISTEMA',
        observacao: `ALERTA DE SEGURANÇA: ${params.attemptCount} tentativas bloqueadas de violação multi-tenant em ${this.TIME_WINDOW_MINUTES} minutos`,
        dadosNovos: {
          alertType: params.tipo,
          userId: params.userId,
          userEmail: params.userEmail,
          userInstituicaoId: params.userInstituicaoId,
          requestedInstituicaoId: params.requestedInstituicaoId,
          attemptCount: params.attemptCount,
          timeWindow: this.TIME_WINDOW_MINUTES,
        },
      });

      // Log crítico (pode ser integrado com sistema de notificações)
      console.error('[SecurityMonitor] 🚨 ALERTA DE SEGURANÇA:', {
        tipo: params.tipo,
        userId: params.userId,
        userEmail: params.userEmail,
        userInstituicaoId: params.userInstituicaoId,
        requestedInstituicaoId: params.requestedInstituicaoId,
        attemptCount: params.attemptCount,
        timeWindow: `${this.TIME_WINDOW_MINUTES} minutos`,
        action: 'Múltiplas tentativas de violação multi-tenant detectadas',
      });

      // TODO: Integrar com sistema de notificações (e-mail para SUPER_ADMIN, webhook, etc.)
      // Por enquanto, apenas logamos
    } catch (error: any) {
      console.error('[SecurityMonitor] Erro ao gerar alerta de segurança:', error.message);
    }
  }

  /**
   * Verificar se há alertas recentes para um usuário/instituição
   * Útil para implementar bloqueios temporários ou ações preventivas
   */
  static async hasRecentAlerts(
    userId: string,
    instituicaoId: string | null,
    minutes: number = 60
  ): Promise<boolean> {
    try {
      const timeWindow = new Date();
      timeWindow.setMinutes(timeWindow.getMinutes() - minutes);

      const alertCount = await prisma.logAuditoria.count({
        where: {
          userId,
          instituicaoId: instituicaoId || undefined,
          modulo: ModuloAuditoria.COMUNICACAO,
          acao: 'SECURITY_ALERT' as any,
          createdAt: {
            gte: timeWindow,
          },
        },
      });

      return alertCount > 0;
    } catch (error) {
      console.error('[SecurityMonitor] Erro ao verificar alertas recentes:', error);
      return false;
    }
  }

  /**
   * Obter estatísticas de tentativas bloqueadas (para dashboard de segurança)
   * Respeita multi-tenant: SUPER_ADMIN vê tudo, outros veem apenas sua instituição
   */
  static async getBlockedAttemptsStats(
    req: Request,
    options?: {
      startDate?: Date;
      endDate?: Date;
      instituicaoId?: string; // Apenas para SUPER_ADMIN
    }
  ): Promise<{
    total: number;
    byInstitution: Array<{ instituicaoId: string | null; count: number }>;
    recentAlerts: number;
  }> {
    try {
      const isSuperAdmin = req.user?.roles?.includes('SUPER_ADMIN');
      const userInstituicaoId = req.user?.instituicaoId;

      // Construir filtro de instituição
      let instituicaoFilter: any = {};
      if (!isSuperAdmin && userInstituicaoId) {
        instituicaoFilter.instituicaoId = userInstituicaoId;
      } else if (isSuperAdmin && options?.instituicaoId) {
        instituicaoFilter.instituicaoId = options.instituicaoId;
      }

      // Filtro de data
      const dateFilter: any = {};
      if (options?.startDate) {
        dateFilter.gte = options.startDate;
      }
      if (options?.endDate) {
        dateFilter.lte = options.endDate;
      }

      // Contar total de tentativas bloqueadas
      const total = await prisma.logAuditoria.count({
        where: {
          ...instituicaoFilter,
          modulo: ModuloAuditoria.COMUNICACAO,
          acao: AcaoAuditoria.BLOCK,
          observacao: {
            contains: 'Tentativa de envio de e-mail bloqueada',
          },
          ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
        },
      });

      // Contar por instituição (apenas para SUPER_ADMIN)
      let byInstitution: Array<{ instituicaoId: string | null; count: number }> = [];
      if (isSuperAdmin) {
        const stats = await prisma.logAuditoria.groupBy({
          by: ['instituicaoId'],
          where: {
            modulo: ModuloAuditoria.COMUNICACAO,
            acao: AcaoAuditoria.BLOCK,
            observacao: {
              contains: 'Tentativa de envio de e-mail bloqueada',
            },
            ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
          },
          _count: {
            id: true,
          },
        });

        byInstitution = stats.map((stat) => ({
          instituicaoId: stat.instituicaoId || null,
          count: stat._count.id,
        }));
      }

      // Contar alertas recentes (últimas 24 horas)
      const recentDate = new Date();
      recentDate.setHours(recentDate.getHours() - 24);

      const recentAlerts = await prisma.logAuditoria.count({
        where: {
          ...instituicaoFilter,
          modulo: ModuloAuditoria.COMUNICACAO,
          acao: 'SECURITY_ALERT' as any,
          createdAt: {
            gte: recentDate,
          },
        },
      });

      return {
        total,
        byInstitution,
        recentAlerts,
      };
    } catch (error: any) {
      console.error('[SecurityMonitor] Erro ao obter estatísticas:', error.message);
      throw new AppError('Erro ao obter estatísticas de segurança', 500);
    }
  }
}

