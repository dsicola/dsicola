import * as cron from 'node-cron';
import { SemestreSchedulerService } from './semestreScheduler.service.js';
import { encerrarReaberturasExpiradas } from './reaberturaAnoLetivo.service.js';
import {
  processarEventosPendentes,
  processarEventosPendentesComErro,
} from './governo/eventoGovernamental.service.js';
import { BackupService } from './backup.service.js';

/**
 * Serviço centralizado de schedulers/jobs automáticos
 * Todos os jobs agendados devem ser registrados aqui
 */
export class SchedulerService {
  private static jobs: cron.ScheduledTask[] = [];

  /**
   * Inicializar todos os schedulers
   * Deve ser chamado no startup do servidor
   */
  static initialize(): void {
    console.log('[SchedulerService] Inicializando schedulers...');

    // Job diário: Início automático de semestres
    // Executa todos os dias às 00:00 (meia-noite)
    const semestreJob = cron.schedule('0 0 * * *', async () => {
      console.log('[SchedulerService] Executando job de início automático de semestres...');
      try {
        const resultado = await SemestreSchedulerService.processarInicioAutomatico();
        console.log('[SchedulerService] Job concluído:', {
          semestresIniciados: resultado.semestresIniciados,
          alunosAtualizados: resultado.alunosAtualizados,
          erros: resultado.erros.length,
        });
        if (resultado.erros.length > 0) {
          console.error('[SchedulerService] Erros encontrados:', resultado.erros);
        }
      } catch (error) {
        console.error('[SchedulerService] Erro ao executar job de início de semestres:', error);
      }
    }, {
      scheduled: true,
      timezone: 'Africa/Luanda', // Ajustar conforme necessário
    } as any);

    this.jobs.push(semestreJob);
    console.log('[SchedulerService] Job de início automático de semestres agendado (diário às 00:00)');

    // Job diário: Encerrar reaberturas expiradas
    // Executa todos os dias às 01:00 (1h da manhã)
    const reaberturaJob = cron.schedule('0 1 * * *', async () => {
      console.log('[SchedulerService] Executando job de encerramento automático de reaberturas expiradas...');
      try {
        const encerradas = await encerrarReaberturasExpiradas();
        console.log('[SchedulerService] Job de reaberturas concluído:', {
          reaberturasEncerradas: encerradas,
        });
        if (encerradas > 0) {
          console.log(`[SchedulerService] ${encerradas} reabertura(s) expirada(s) encerrada(s) automaticamente`);
        }
      } catch (error) {
        console.error('[SchedulerService] Erro ao executar job de encerramento de reaberturas:', error);
      }
    }, {
      scheduled: true,
      timezone: 'Africa/Luanda', // Ajustar conforme necessário
    } as any);

    this.jobs.push(reaberturaJob);
    console.log('[SchedulerService] Job de encerramento automático de reaberturas agendado (diário às 01:00)');

    // Job periódico: Processar eventos governamentais pendentes
    // Executa a cada 15 minutos
    const eventosPendentesJob = cron.schedule('*/15 * * * *', async () => {
      console.log('[SchedulerService] Executando job de processamento de eventos governamentais pendentes...');
      try {
        const resultado = await processarEventosPendentes();
        console.log('[SchedulerService] Job de eventos pendentes concluído:', {
          processados: resultado.processados,
          sucessos: resultado.sucessos,
          erros: resultado.erros,
        });
      } catch (error) {
        console.error('[SchedulerService] Erro ao executar job de eventos pendentes:', error);
      }
    }, {
      scheduled: true,
      timezone: 'Africa/Luanda',
    } as any);

    this.jobs.push(eventosPendentesJob);
    console.log('[SchedulerService] Job de processamento de eventos governamentais pendentes agendado (a cada 15 minutos)');

    // Job periódico: Retry automático de eventos com erro
    // Executa a cada 30 minutos
    const eventosErroJob = cron.schedule('*/30 * * * *', async () => {
      console.log('[SchedulerService] Executando job de retry automático de eventos governamentais com erro...');
      try {
        const resultado = await processarEventosPendentesComErro();
        console.log('[SchedulerService] Job de retry automático concluído:', {
          processados: resultado.processados,
          sucessos: resultado.sucessos,
          erros: resultado.erros,
        });
      } catch (error) {
        console.error('[SchedulerService] Erro ao executar job de retry automático:', error);
      }
    }, {
      scheduled: true,
      timezone: 'Africa/Luanda',
    } as any);

    this.jobs.push(eventosErroJob);
    console.log('[SchedulerService] Job de retry automático de eventos governamentais agendado (a cada 30 minutos)');

    // Job periódico: Executar backups agendados
    // Executa a cada hora para verificar backups agendados
    const backupJob = cron.schedule('0 * * * *', async () => {
      console.log('[SchedulerService] Executando job de backups agendados...');
      try {
        await BackupService.executeScheduledBackups();
        console.log('[SchedulerService] Job de backups agendados concluído');
      } catch (error) {
        console.error('[SchedulerService] Erro ao executar job de backups agendados:', error);
        // Falhas de backup não devem quebrar o sistema
      }
    }, {
      scheduled: true,
      timezone: 'Africa/Luanda',
    } as any);

    this.jobs.push(backupJob);
    console.log('[SchedulerService] Job de backups agendados agendado (a cada hora)');

    // Job diário: Limpar backups antigos
    // Executa todos os dias às 02:00 (2h da manhã)
    const cleanupBackupJob = cron.schedule('0 2 * * *', async () => {
      console.log('[SchedulerService] Executando job de limpeza de backups antigos...');
      try {
        const deleted = await BackupService.cleanupOldBackups();
        console.log('[SchedulerService] Job de limpeza de backups concluído:', {
          arquivosDeletados: deleted,
        });
        if (deleted > 0) {
          console.log(`[SchedulerService] ${deleted} arquivo(s) de backup antigo(s) deletado(s)`);
        }
      } catch (error) {
        console.error('[SchedulerService] Erro ao executar job de limpeza de backups:', error);
      }
    }, {
      scheduled: true,
      timezone: 'Africa/Luanda',
    } as any);

    this.jobs.push(cleanupBackupJob);
    console.log('[SchedulerService] Job de limpeza de backups antigos agendado (diário às 02:00)');

    // Para desenvolvimento/teste: também executar imediatamente na inicialização
    // (comentar em produção se não desejar)
    if (process.env.NODE_ENV !== 'production') {
      console.log('[SchedulerService] Modo desenvolvimento: executando jobs imediatamente...');
      SemestreSchedulerService.processarInicioAutomatico()
        .then((resultado) => {
          console.log('[SchedulerService] Execução inicial de semestres concluída:', resultado);
        })
        .catch((error) => {
          console.error('[SchedulerService] Erro na execução inicial de semestres:', error);
        });
      
      encerrarReaberturasExpiradas()
        .then((encerradas) => {
          console.log('[SchedulerService] Execução inicial de reaberturas concluída:', { encerradas });
        })
        .catch((error) => {
          console.error('[SchedulerService] Erro na execução inicial de reaberturas:', error);
        });
    }

    console.log(`[SchedulerService] ${this.jobs.length} scheduler(s) inicializado(s)`);
  }

  /**
   * Parar todos os schedulers
   * Útil para shutdown graceful
   */
  static stop(): void {
    console.log('[SchedulerService] Parando schedulers...');
    this.jobs.forEach((job) => job.stop());
    this.jobs = [];
    console.log('[SchedulerService] Todos os schedulers parados');
  }

  /**
   * Executar job manualmente (para testes)
   */
  static async executarInicioSemestres(): Promise<void> {
    console.log('[SchedulerService] Executando job manualmente...');
    const resultado = await SemestreSchedulerService.processarInicioAutomatico();
    console.log('[SchedulerService] Resultado:', resultado);
  }
}

