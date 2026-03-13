import prisma from '../lib/prisma.js';
import { AuditService, ModuloAuditoria, EntidadeAuditoria, AcaoAuditoria } from './audit.service.js';

/**
 * Serviço para abertura automática de anos letivos baseado em data agendada.
 * Executa diariamente via scheduler (00:05 - após semestres).
 * Quando dataInicio <= hoje, ativa o ano letivo PLANEJADO.
 */
export class AnoLetivoSchedulerService {
  static async processarAberturaAutomatica(): Promise<{
    anosAtivados: number;
    erros: string[];
  }> {
    const hoje = new Date();
    hoje.setHours(23, 59, 59, 999); // Fim do dia para incluir hoje

    const erros: string[] = [];
    let anosAtivados = 0;

    try {
      const anosParaAtivar = await prisma.anoLetivo.findMany({
        where: {
          status: 'PLANEJADO',
          dataInicio: { lte: hoje },
        },
        select: {
          id: true,
          ano: true,
          dataInicio: true,
          instituicaoId: true,
          instituicao: { select: { nome: true } },
        },
      });

      for (const al of anosParaAtivar) {
        try {
          // Não pode haver outro ano ATIVO na mesma instituição
          const outroAtivo = await prisma.anoLetivo.findFirst({
            where: {
              instituicaoId: al.instituicaoId,
              status: 'ATIVO',
              id: { not: al.id },
            },
          });

          if (outroAtivo) {
            console.log(
              `[AnoLetivoScheduler] Ano ${al.ano} (${al.instituicao?.nome}): ignorado - já existe ano ${outroAtivo.ano} ATIVO`
            );
            continue;
          }

          await prisma.anoLetivo.update({
            where: { id: al.id },
            data: {
              status: 'ATIVO',
              ativadoEm: new Date(),
              ativadoPor: null, // Sistema automático
            },
          });

          await AuditService.log(null, {
            modulo: ModuloAuditoria.ANO_LETIVO,
            acao: AcaoAuditoria.ANO_LETIVO_ATIVADO_AUTOMATICO,
            entidade: EntidadeAuditoria.ANO_LETIVO,
            entidadeId: al.id,
            instituicaoId: al.instituicaoId || undefined,
            dadosAnteriores: { status: 'PLANEJADO', dataInicio: al.dataInicio },
            dadosNovos: { status: 'ATIVO', ativadoEm: new Date(), ativadoPor: 'sistema' },
            observacao: `Ano letivo ${al.ano} ativado automaticamente (data agendada: ${new Date(al.dataInicio).toLocaleDateString('pt-AO')}).`,
          });

          console.log(`[AnoLetivoScheduler] Ano letivo ${al.ano} (${al.instituicao?.nome}) ativado automaticamente`);
          anosAtivados++;
        } catch (err) {
          const msg = `Ano ${al.ano}: ${err instanceof Error ? err.message : 'Erro desconhecido'}`;
          erros.push(msg);
          console.error(`[AnoLetivoScheduler] ${msg}`, err);
        }
      }

      return { anosAtivados, erros };
    } catch (error) {
      const msg = `Erro geral: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
      console.error(`[AnoLetivoScheduler] ${msg}`, error);
      erros.push(msg);
      return { anosAtivados, erros };
    }
  }
}
