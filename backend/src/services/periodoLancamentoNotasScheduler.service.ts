import prisma from '../lib/prisma.js';
import { StatusPeriodoLancamentoNotas } from '@prisma/client';
import { AuditService, ModuloAuditoria, EntidadeAuditoria, AcaoAuditoria } from './audit.service.js';

/**
 * Serviço para abertura automática de períodos de lançamento de notas.
 * Executa diariamente via scheduler.
 * Quando dataInicio <= hoje e dataFim >= hoje, abre período com status FECHADO.
 */
export class PeriodoLancamentoNotasSchedulerService {
  static async processarAberturaAutomatica(): Promise<{
    periodosAbertos: number;
    erros: string[];
  }> {
    const agora = new Date();
    const inicioDia = new Date(agora);
    inicioDia.setHours(0, 0, 0, 0);
    const fimDia = new Date(agora);
    fimDia.setHours(23, 59, 59, 999);

    const erros: string[] = [];
    let periodosAbertos = 0;

    try {
      // Períodos com dataInicio <= hoje, dataFim >= hoje, status FECHADO
      const periodosParaAbrir = await prisma.periodoLancamentoNotas.findMany({
        where: {
          status: StatusPeriodoLancamentoNotas.FECHADO,
          dataInicio: { lte: fimDia },
          dataFim: { gte: inicioDia },
        },
        select: {
          id: true,
          anoLetivoId: true,
          tipoPeriodo: true,
          numeroPeriodo: true,
          dataInicio: true,
          dataFim: true,
          instituicaoId: true,
          anoLetivo: { select: { ano: true } },
        },
      });

      for (const p of periodosParaAbrir) {
        try {
          await prisma.periodoLancamentoNotas.update({
            where: { id: p.id },
            data: {
              status: StatusPeriodoLancamentoNotas.ABERTO,
              reabertoPor: null,
              reabertoEm: null,
              motivoReabertura: null,
            },
          });

          await AuditService.log(null, {
            modulo: ModuloAuditoria.PERIODO_LANCAMENTO_NOTAS,
            acao: AcaoAuditoria.PERIODO_LANCAMENTO_NOTAS_ABERTO_AUTOMATICO,
            entidade: EntidadeAuditoria.PERIODO_LANCAMENTO_NOTAS,
            entidadeId: p.id,
            instituicaoId: p.instituicaoId,
            dadosAnteriores: { status: 'FECHADO', dataInicio: p.dataInicio, dataFim: p.dataFim },
            dadosNovos: {
              status: 'ABERTO',
              aberturaAutomatica: true,
            },
            observacao: `Período de lançamento ${p.tipoPeriodo} ${p.numeroPeriodo} (ano ${p.anoLetivo?.ano}) aberto automaticamente. Janela: ${new Date(p.dataInicio).toLocaleDateString('pt-AO')} a ${new Date(p.dataFim).toLocaleDateString('pt-AO')}.`,
          });

          console.log(
            `[PeriodoLancamentoNotasScheduler] Período ${p.tipoPeriodo} ${p.numeroPeriodo} (ano ${p.anoLetivo?.ano}) aberto automaticamente`
          );
          periodosAbertos++;
        } catch (err) {
          erros.push(`Período ${p.id}: ${err instanceof Error ? err.message : 'Erro'}`);
          console.error(`[PeriodoLancamentoNotasScheduler] Erro:`, err);
        }
      }

      return { periodosAbertos, erros };
    } catch (error) {
      erros.push(`Erro geral: ${error instanceof Error ? error.message : 'Erro'}`);
      console.error(`[PeriodoLancamentoNotasScheduler]`, error);
      return { periodosAbertos, erros };
    }
  }
}
