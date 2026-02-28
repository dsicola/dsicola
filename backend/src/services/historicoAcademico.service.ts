import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { calcularFrequenciaAluno } from './frequencia.service.js';
import { calcularMedia } from './calculoNota.service.js';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * ========================================
 * SERVIÇO: HISTÓRICO ACADÊMICO (SNAPSHOT)
 * ========================================
 * 
 * REGRAS ABSOLUTAS (SIGA/SIGAE):
 * - Histórico é IMUTÁVEL (nunca pode ser editado ou deletado)
 * - Histórico só consolida dados de ANO LETIVO ENCERRADO
 * - Histórico NÃO depende de dados dinâmicos
 * - Histórico NÃO pode ser recalculado após encerramento
 */

/**
 * Gerar snapshot do histórico acadêmico para um ano letivo encerrado
 * 
 * @param anoLetivoId - ID do ano letivo ENCERRADO
 * @param instituicaoId - ID da instituição (multi-tenant)
 * @param geradoPor - ID do usuário que encerrou o ano letivo
 * @returns Promise<{ totalGerado: number; erros: string[] }>
 */
export async function gerarSnapshotHistorico(
  anoLetivoId: string,
  instituicaoId: string,
  geradoPor: string,
  tipoAcademico?: 'SUPERIOR' | 'SECUNDARIO' | null // Tipo acadêmico da instituição (vem do JWT)
): Promise<{ totalGerado: number; erros: string[] }> {
  const erros: string[] = [];
  let totalGerado = 0;

  // Verificar se o ano letivo está encerrado
  const anoLetivo = await prisma.anoLetivo.findFirst({
    where: {
      id: anoLetivoId,
      instituicaoId,
      status: 'ENCERRADO',
    },
  });

  if (!anoLetivo) {
    throw new AppError(
      'Ano letivo não encontrado ou não está encerrado. Histórico só pode ser gerado para anos letivos encerrados.',
      400
    );
  }

  // Verificar se já existe histórico gerado para este ano letivo
  const historicoExistente = await prisma.historicoAcademico.findFirst({
    where: {
      anoLetivoId,
      instituicaoId,
    },
  });

  if (historicoExistente) {
    // Histórico já existe - não gerar novamente (imutabilidade)
    return {
      totalGerado: 0,
      erros: ['Histórico acadêmico já foi gerado para este ano letivo. Não é possível regenerar (imutabilidade).'],
    };
  }

  // Buscar todos os planos de ensino do ano letivo
  const planosEnsino = await prisma.planoEnsino.findMany({
    where: {
      anoLetivoId,
      instituicaoId,
    },
    include: {
      disciplina: {
        select: {
          id: true,
          nome: true,
          cargaHoraria: true,
        },
      },
      curso: {
        select: {
          id: true,
        },
      },
      classe: {
        select: {
          id: true,
        },
      },
      turma: {
        select: {
          id: true,
          matriculas: {
            where: {
              status: 'Ativa',
            },
            select: {
              alunoId: true,
            },
          },
        },
      },
    },
  });

  if (planosEnsino.length === 0) {
    return {
      totalGerado: 0,
      erros: ['Nenhum plano de ensino encontrado para este ano letivo.'],
    };
  }

  // Para cada plano de ensino, gerar histórico para cada aluno
  for (const plano of planosEnsino) {
    // Buscar alunos do plano (via turma ou matrícula anual)
    let alunosIds: string[] = [];

    if (plano.turma?.matriculas) {
      alunosIds = plano.turma.matriculas.map(m => m.alunoId);
    } else {
      // Buscar alunos via matrícula anual
      const matriculasAnuais = await prisma.matriculaAnual.findMany({
        where: {
          anoLetivoId,
          instituicaoId,
          disciplinaId: plano.disciplinaId,
          status: 'ATIVA',
        },
        select: {
          alunoId: true,
        },
      });
      alunosIds = matriculasAnuais.map(m => m.alunoId);
    }

    if (alunosIds.length === 0) {
      erros.push(`Plano de Ensino "${plano.disciplina.nome}" não possui alunos matriculados.`);
      continue;
    }

    // Para cada aluno, gerar snapshot
    for (const alunoId of alunosIds) {
      try {
        // Calcular frequência (snapshot)
        const frequencia = await calcularFrequenciaAluno(plano.id, alunoId, instituicaoId);

        // Calcular notas (snapshot)
        // CRÍTICO: tipoAcademico vem do parâmetro (req.user.tipoAcademico do JWT)
        const resultadoNotas = await calcularMedia({
          alunoId,
          planoEnsinoId: plano.id,
          professorId: plano.professorId || undefined, // Garantir média apenas com notas do professor do plano
          instituicaoId,
          tipoAcademico: tipoAcademico || null, // Passar tipoAcademico do parâmetro
        });

        // Determinar situação acadêmica
        let situacaoAcademica: 'APROVADO' | 'REPROVADO' | 'REPROVADO_FALTA' = 'REPROVADO';
        if (frequencia.situacao === 'IRREGULAR') {
          situacaoAcademica = 'REPROVADO_FALTA';
        } else if (resultadoNotas.status === 'APROVADO') {
          situacaoAcademica = 'APROVADO';
        } else if (resultadoNotas.status === 'REPROVADO' || resultadoNotas.status === 'REPROVADO_FALTA') {
          situacaoAcademica = 'REPROVADO';
        }

        // REGRA CRÍTICA: Histórico é IMUTÁVEL - nunca atualizar, apenas criar se não existir
        const historicoExistente = await prisma.historicoAcademico.findFirst({
          where: {
            instituicaoId,
            alunoId,
            anoLetivoId,
            planoEnsinoId: plano.id,
          },
        });

        // Se já existe, pular (imutabilidade - nunca regenerar)
        if (historicoExistente) {
          continue;
        }

        // Criar snapshot (apenas se não existir)
        await prisma.historicoAcademico.create({
          data: {
            instituicaoId,
            alunoId,
            anoLetivoId,
            planoEnsinoId: plano.id,
            disciplinaId: plano.disciplinaId,
            cursoId: plano.cursoId || null,
            classeId: plano.classeId || null,
            turmaId: plano.turmaId || null,
            cargaHoraria: plano.disciplina.cargaHoraria,
            totalAulas: frequencia.totalAulas,
            presencas: frequencia.presencas,
            faltas: frequencia.faltas,
            faltasJustificadas: frequencia.faltasJustificadas,
            percentualFrequencia: new Decimal(frequencia.percentualFrequencia),
            mediaFinal: new Decimal(resultadoNotas.media_final),
            mediaParcial: resultadoNotas.media_parcial ? new Decimal(resultadoNotas.media_parcial) : null,
            situacaoAcademica,
            origemEncerramento: true,
            geradoPor,
            geradoEm: new Date(),
          },
        });

        totalGerado++;
      } catch (error: any) {
        erros.push(
          `Erro ao gerar histórico para aluno ${alunoId} no plano "${plano.disciplina.nome}": ${error?.message || 'Erro desconhecido'}`
        );
      }
    }
  }

  return {
    totalGerado,
    erros,
  };
}

/**
 * Buscar histórico acadêmico de um aluno (usando snapshot)
 * 
 * REGRAS SIGA/SIGAE:
 * - Histórico inclui disciplinas cursadas (snapshot)
 * - Histórico inclui equivalências deferidas (registro oficial)
 * - Equivalências aparecem como "Dispensada por Equivalência"
 * - NÃO recalcula notas ou frequência de equivalências
 * 
 * @param alunoId - ID do aluno
 * @param instituicaoId - ID da instituição (multi-tenant)
 * @param anoLetivoId - ID do ano letivo (opcional - se não fornecido, busca todos)
 * @returns Promise com histórico consolidado (snapshot + equivalências)
 */
export async function buscarHistoricoAluno(
  alunoId: string,
  instituicaoId: string,
  anoLetivoId?: string
) {
  const where: any = {
    alunoId,
    instituicaoId,
  };

  if (anoLetivoId) {
    where.anoLetivoId = anoLetivoId;
  }

  // Buscar histórico snapshot (disciplinas cursadas)
  const historicoSnapshot = await prisma.historicoAcademico.findMany({
    where,
    include: {
      anoLetivo: {
        select: {
          id: true,
          ano: true,
          status: true,
        },
      },
      disciplina: {
        select: {
          id: true,
          nome: true,
          cargaHoraria: true,
        },
      },
      curso: {
        select: {
          id: true,
          nome: true,
          codigo: true,
        },
      },
      classe: {
        select: {
          id: true,
          nome: true,
          codigo: true,
        },
      },
      turma: {
        select: {
          id: true,
          nome: true,
        },
      },
    },
    orderBy: [
      { anoLetivo: { ano: 'desc' } },
      { disciplina: { nome: 'asc' } },
    ],
  });

  // Buscar equivalências deferidas (registros oficiais)
  const equivalenciasWhere: any = {
    alunoId,
    instituicaoId,
    deferido: true, // Apenas equivalências deferidas aparecem no histórico
  };

  const equivalencias = await prisma.equivalenciaDisciplina.findMany({
    where: equivalenciasWhere,
    include: {
      disciplinaDestino: {
        select: {
          id: true,
          nome: true,
          cargaHoraria: true,
        },
      },
      cursoDestino: {
        select: {
          id: true,
          nome: true,
          codigo: true,
        },
      },
      disciplinaOrigem: {
        select: {
          id: true,
          nome: true,
          cargaHoraria: true,
        },
      },
      cursoOrigem: {
        select: {
          id: true,
          nome: true,
          codigo: true,
        },
      },
      deferidoPorUser: {
        select: {
          id: true,
          nomeCompleto: true,
        },
      },
    },
    orderBy: {
      deferidoEm: 'desc',
    },
  });

  // Converter equivalências para formato de histórico
  // Nota: Equivalências não têm anoLetivo específico, mas aparecem no histórico
  // Buscar ano letivo mais recente para agrupamento (ou usar ano atual se não houver histórico)
  const anoLetivoMaisRecente = historicoSnapshot.length > 0
    ? historicoSnapshot[0].anoLetivo
    : await prisma.anoLetivo.findFirst({
        where: { instituicaoId },
        orderBy: { ano: 'desc' },
        select: { id: true, ano: true, status: true },
      });

  // Converter equivalências para formato compatível com histórico
  // Nota: Usar `any` temporariamente para compatibilidade de tipos
  const equivalenciasComoHistorico: any[] = equivalencias.map((eq) => ({
    id: eq.id,
    alunoId: eq.alunoId,
    instituicaoId: eq.instituicaoId,
    anoLetivoId: anoLetivoMaisRecente?.id || null,
    planoEnsinoId: null, // Equivalências não têm plano de ensino
    disciplinaId: eq.disciplinaDestinoId,
    cursoId: eq.cursoDestinoId,
    classeId: null,
    turmaId: null,
    cargaHoraria: eq.cargaHorariaEquivalente,
    totalAulas: 0,
    presencas: 0,
    faltas: 0,
    faltasJustificadas: 0,
    percentualFrequencia: new Decimal(100), // 100% por equivalência
    mediaFinal: eq.notaOrigem || new Decimal(0),
    mediaParcial: null,
    situacaoAcademica: 'APROVADO' as const, // Equivalência = aprovado
    origemEncerramento: false,
    origemEquivalencia: true, // Flag para identificar equivalência
    geradoPor: eq.deferidoPor || null,
    geradoEm: eq.deferidoEm || eq.createdAt,
    anoLetivo: anoLetivoMaisRecente || null,
    disciplina: {
      id: eq.disciplinaDestino.id,
      nome: eq.disciplinaDestino.nome,
      cargaHoraria: eq.cargaHorariaEquivalente,
    },
    curso: eq.cursoDestino,
    classe: null,
    turma: null,
    // Dados adicionais de equivalência (para uso no controller)
    equivalencia: {
      disciplinaOrigem: eq.disciplinaOrigem || {
        id: null,
        nome: eq.disciplinaOrigemNome || 'Disciplina Externa',
        cargaHoraria: eq.cargaHorariaOrigem,
      },
      cursoOrigem: eq.cursoOrigem,
      instituicaoOrigemNome: eq.instituicaoOrigemNome,
      criterio: eq.criterio,
      deferidoEm: eq.deferidoEm,
      deferidoPor: eq.deferidoPorUser,
    },
  }));

  // Combinar histórico snapshot + equivalências
  return [...historicoSnapshot, ...equivalenciasComoHistorico] as any[];
}

