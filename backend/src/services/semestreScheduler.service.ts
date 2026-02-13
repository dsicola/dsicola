import prisma from '../lib/prisma.js';
import { AuditService, ModuloAuditoria, EntidadeAuditoria, AcaoAuditoria } from './audit.service.js';

/**
 * Serviço para início automático de semestres baseado em data do calendário acadêmico
 * Executa diariamente via scheduler
 */
export class SemestreSchedulerService {
  /**
   * Processar início automático de semestres
   * Busca semestres com status PLANEJADO e data_inicio <= hoje
   * Atualiza status para INICIADO e atualiza AlunoDisciplina.status de "Matriculado" para "Cursando"
   */
  static async processarInicioAutomatico(): Promise<{
    semestresIniciados: number;
    alunosAtualizados: number;
    erros: string[];
  }> {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0); // Zerar horas para comparação apenas de data

    const erros: string[] = [];
    let semestresIniciados = 0;
    let totalAlunosAtualizados = 0;

    try {
      // 1. Buscar semestres com status PLANEJADO e data_inicio <= hoje
      // IMPORTANTE: anoLetivoId é obrigatório no schema (não nullable), então não precisa filtrar
      const semestresParaIniciar = await prisma.semestre.findMany({
        where: {
          status: 'PLANEJADO',
          dataInicio: {
            lte: hoje,
          },
          // anoLetivoId é obrigatório no schema, então todos os semestres já têm esse campo
        },
        select: {
          id: true,
          anoLetivoId: true, // Incluir anoLetivoId para validação
          anoLetivo: true,
          numero: true,
          dataInicio: true,
          dataFim: true,
          status: true,
          instituicaoId: true,
          ativadoPor: true,
          ativadoEm: true,
          encerradoPor: true,
          encerradoEm: true,
          observacoes: true,
          createdAt: true,
          updatedAt: true,
          anoLetivoRef: {
            select: {
              id: true,
              ano: true,
              status: true, // Validar se Ano Letivo está ATIVO
            },
          },
          instituicao: {
            select: {
              id: true,
              nome: true,
            },
          },
        },
      });

      console.log(`[SemestreScheduler] Encontrados ${semestresParaIniciar.length} semestre(s) para iniciar`);

      // 2. Processar cada semestre
      for (const semestre of semestresParaIniciar) {
        try {
          // VALIDAÇÃO: Verificar se semestre pertence a um Ano Letivo válido
          if (!semestre.anoLetivoId || !semestre.anoLetivoRef) {
            console.warn(`[SemestreScheduler] Semestre ${semestre.id} não possui anoLetivoId válido, ignorando`);
            erros.push(`Semestre ${semestre.id} não possui Ano Letivo associado`);
            continue;
          }

          // VALIDAÇÃO: Verificar se Ano Letivo está ATIVO
          if (semestre.anoLetivoRef.status !== 'ATIVO') {
            console.log(`[SemestreScheduler] Semestre ${semestre.id} pertence a Ano Letivo ${semestre.anoLetivoRef.ano} que está ${semestre.anoLetivoRef.status}, ignorando`);
            continue;
          }

          // Verificar se já foi iniciado (idempotência)
          const semestreAtual = await prisma.semestre.findUnique({
            where: { id: semestre.id },
            select: { 
              id: true,
              status: true,
            },
          });

          if (!semestreAtual) {
            console.log(`[SemestreScheduler] Semestre ${semestre.id} não encontrado, ignorando`);
            continue;
          }

          // Verificar status do semestre
          if (semestreAtual.status !== 'PLANEJADO') {
            console.log(`[SemestreScheduler] Semestre ${semestre.id} já foi processado ou não está mais PLANEJADO. Status atual: ${semestreAtual.status}`);
            continue;
          }

          // 3. Atualizar status do semestre para ATIVO
          await prisma.semestre.update({
            where: { id: semestre.id },
            data: {
              status: 'ATIVO',
              ativadoEm: new Date(),
              ativadoPor: null, // Sistema automático
            },
          });

          console.log(`[SemestreScheduler] Semestre ${semestre.id} (${semestre.anoLetivo}/${semestre.numero}) ativado automaticamente`);

          // 4. Atualizar AlunoDisciplina.status de "Matriculado" para "Cursando"
          // Apenas para alunos da instituição e que correspondem ao ano/semestre do semestre
          // AlunoDisciplina não tem instituicaoId diretamente, então filtramos através do aluno
          const resultado = await prisma.alunoDisciplina.updateMany({
            where: {
              ano: semestre.anoLetivo,
              semestre: String(semestre.numero),
              status: 'Matriculado',
              aluno: {
                ...(semestre.instituicaoId ? { instituicaoId: semestre.instituicaoId } : {}),
              },
            },
            data: {
              status: 'Cursando',
            },
          });

          const alunosAtualizados = resultado.count;
          totalAlunosAtualizados += alunosAtualizados;

          console.log(`[SemestreScheduler] ${alunosAtualizados} aluno(s) atualizado(s) para status "Cursando" no semestre ${semestre.id}`);

          // 5. Registrar auditoria (sistema automático - sem Request)
          await AuditService.log(null, {
            modulo: ModuloAuditoria.ANO_LETIVO,
            acao: AcaoAuditoria.SEMESTRE_INICIADO_AUTOMATICO,
            entidade: EntidadeAuditoria.PERIODO_LETIVO,
            entidadeId: semestre.id,
            instituicaoId: semestre.instituicaoId || undefined,
            dadosAnteriores: {
              status: 'PLANEJADO',
              dataInicio: semestre.dataInicio,
            },
            dadosNovos: {
              status: 'ATIVO',
              ativadoEm: new Date(),
              alunosAtualizados: alunosAtualizados,
            },
            observacao: `Semestre ${semestre.anoLetivo}/${semestre.numero} ativado automaticamente. ${alunosAtualizados} aluno(s) atualizado(s) de "Matriculado" para "Cursando".`,
          });

          semestresIniciados++;
        } catch (error) {
          const errorMsg = `Erro ao processar semestre ${semestre.id}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
          console.error(`[SemestreScheduler] ${errorMsg}`, error);
          erros.push(errorMsg);
        }
      }

      return {
        semestresIniciados,
        alunosAtualizados: totalAlunosAtualizados,
        erros,
      };
    } catch (error) {
      const errorMsg = `Erro geral no processamento: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
      console.error(`[SemestreScheduler] ${errorMsg}`, error);
      erros.push(errorMsg);
      return {
        semestresIniciados,
        alunosAtualizados: totalAlunosAtualizados,
        erros,
      };
    }
  }
}

