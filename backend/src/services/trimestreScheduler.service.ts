import prisma from '../lib/prisma.js';
import { AuditService, ModuloAuditoria, EntidadeAuditoria, AcaoAuditoria } from './audit.service.js';

/**
 * Serviço para abertura automática de trimestres (Ensino Secundário) baseado em data agendada.
 * Executa diariamente via scheduler.
 * Quando dataInicio <= hoje e Ano Letivo está ATIVO, ativa o trimestre PLANEJADO.
 */
export class TrimestreSchedulerService {
  static async processarAberturaAutomatica(): Promise<{
    trimestresAtivados: number;
    alunosAtualizados: number;
    erros: string[];
  }> {
    const hoje = new Date();
    hoje.setHours(23, 59, 59, 999);

    const erros: string[] = [];
    let trimestresAtivados = 0;
    let totalAlunos = 0;

    try {
      const trimestresParaAtivar = await prisma.trimestre.findMany({
        where: {
          status: 'PLANEJADO',
          dataInicio: { lte: hoje },
          anoLetivoRef: { status: 'ATIVO' },
        },
        select: {
          id: true,
          anoLetivo: true,
          numero: true,
          dataInicio: true,
          instituicaoId: true,
          anoLetivoRef: { select: { ano: true } },
        },
      });

      for (const t of trimestresParaAtivar) {
        try {
          const atual = await prisma.trimestre.findUnique({
            where: { id: t.id },
            select: { status: true },
          });
          if (!atual || atual.status !== 'PLANEJADO') continue;

          await prisma.trimestre.update({
            where: { id: t.id },
            data: {
              status: 'ATIVO',
              ativadoEm: new Date(),
              ativadoPor: null,
            },
          });

          const resultado = await prisma.alunoDisciplina.updateMany({
            where: {
              ano: t.anoLetivo,
              semestre: String(t.numero),
              status: 'Matriculado',
              aluno: { ...(t.instituicaoId ? { instituicaoId: t.instituicaoId } : {}) },
            },
            data: { status: 'Cursando' },
          });

          totalAlunos += resultado.count;

          await AuditService.log(null, {
            modulo: ModuloAuditoria.ANO_LETIVO,
            acao: AcaoAuditoria.TRIMESTRE_INICIADO_AUTOMATICO,
            entidade: EntidadeAuditoria.PERIODO_LETIVO,
            entidadeId: t.id,
            instituicaoId: t.instituicaoId || undefined,
            dadosAnteriores: { status: 'PLANEJADO', dataInicio: t.dataInicio },
            dadosNovos: {
              status: 'ATIVO',
              ativadoEm: new Date(),
              alunosAtualizados: resultado.count,
            },
            observacao: `Trimestre ${t.anoLetivo}/${t.numero} ativado automaticamente. ${resultado.count} aluno(s) atualizado(s).`,
          });

          console.log(`[TrimestreScheduler] Trimestre ${t.anoLetivo}/${t.numero} ativado automaticamente`);
          trimestresAtivados++;
        } catch (err) {
          erros.push(`Trimestre ${t.id}: ${err instanceof Error ? err.message : 'Erro'}`);
          console.error(`[TrimestreScheduler] Erro:`, err);
        }
      }

      return { trimestresAtivados, alunosAtualizados: totalAlunos, erros };
    } catch (error) {
      erros.push(`Erro geral: ${error instanceof Error ? error.message : 'Erro'}`);
      console.error(`[TrimestreScheduler]`, error);
      return { trimestresAtivados, alunosAtualizados: totalAlunos, erros };
    }
  }
}
