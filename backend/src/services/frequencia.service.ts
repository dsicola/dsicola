import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { TipoAcademico } from '@prisma/client';

/**
 * Interface para resultado de cálculo de frequência
 */
export interface ResultadoFrequencia {
  totalAulas: number;
  presencas: number;
  faltas: number;
  faltasJustificadas: number;
  percentualFrequencia: number;
  situacao: 'REGULAR' | 'IRREGULAR';
  frequenciaMinima?: number; // Configurável por instituição
}

/**
 * Interface para consolidação do Plano de Ensino
 */
export interface ConsolidacaoPlanoEnsino {
  planoEnsinoId: string;
  disciplina: {
    id: string;
    nome: string;
    cargaHoraria: number;
  };
  totalAulasPlanejadas: number;
  totalAulasMinistradas: number;
  tipoInstituicao?: string | null;
  alunos: Array<{
    alunoId: string;
    nomeCompleto: string;
    numeroIdentificacaoPublica?: string | null;
    frequencia: ResultadoFrequencia;
    notas: {
      mediaFinal?: number;
      status?: string;
    };
    situacaoAcademica: 'APROVADO' | 'REPROVADO' | 'REPROVADO_FALTA' | 'EM_CURSO';
  }>;
}

/**
 * Calcular frequência de um aluno em um Plano de Ensino
 * 
 * @param planoEnsinoId - ID do Plano de Ensino
 * @param alunoId - ID do Aluno
 * @param instituicaoId - ID da Instituição (multi-tenant)
 * @returns Promise<ResultadoFrequencia>
 */
export async function calcularFrequenciaAluno(
  planoEnsinoId: string,
  alunoId: string,
  instituicaoId: string
): Promise<ResultadoFrequencia> {
  // Validar que o plano de ensino existe e pertence à instituição
  const planoEnsino = await prisma.planoEnsino.findFirst({
    where: {
      id: planoEnsinoId,
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
      instituicao: {
        select: {
          tipoAcademico: true,
        },
      },
    },
  });

  if (!planoEnsino) {
    throw new AppError('Plano de ensino não encontrado ou não pertence à sua instituição', 404);
  }

  // Buscar todas as aulas lançadas do plano de ensino
  const aulasLancadas = await prisma.aulaLancada.findMany({
    where: {
      planoEnsinoId,
      instituicaoId,
    },
    select: {
      id: true,
      data: true,
      cargaHoraria: true,
    },
    orderBy: {
      data: 'asc',
    },
  });

  const totalAulas = aulasLancadas.length;

  if (totalAulas === 0) {
    return {
      totalAulas: 0,
      presencas: 0,
      faltas: 0,
      faltasJustificadas: 0,
      percentualFrequencia: 0,
      situacao: 'IRREGULAR',
      frequenciaMinima: obterFrequenciaMinima(planoEnsino.instituicao?.tipoAcademico),
    };
  }

  // Buscar todas as presenças do aluno nas aulas do plano
  const aulaIds = aulasLancadas.map(a => a.id);
  const presencas = await prisma.presenca.findMany({
    where: {
      aulaLancadaId: { in: aulaIds },
      alunoId,
      instituicaoId,
    },
    select: {
      status: true,
    },
  });

  // Contar presenças, faltas e faltas justificadas
  let presencasCount = 0;
  let faltasCount = 0;
  let faltasJustificadasCount = 0;

  presencas.forEach(p => {
    if (p.status === 'PRESENTE') {
      presencasCount++;
    } else if (p.status === 'JUSTIFICADO') {
      faltasJustificadasCount++;
    } else {
      faltasCount++;
    }
  });

  // Calcular faltas totais (não justificadas)
  const faltasNaoJustificadas = totalAulas - presencasCount - faltasJustificadasCount;
  const faltas = faltasNaoJustificadas;

  // Calcular percentual de frequência
  // Frequência = (Presenças + Faltas Justificadas) / Total de Aulas
  const percentualFrequencia = totalAulas > 0
    ? ((presencasCount + faltasJustificadasCount) / totalAulas) * 100
    : 0;

  // Obter frequência mínima configurável (padrão: 75%)
  const frequenciaMinima = obterFrequenciaMinima(planoEnsino.instituicao?.tipoAcademico);

  // Determinar situação
  const situacao = percentualFrequencia >= frequenciaMinima ? 'REGULAR' : 'IRREGULAR';

  return {
    totalAulas,
    presencas: presencasCount,
    faltas,
    faltasJustificadas: faltasJustificadasCount,
    percentualFrequencia: Math.round(percentualFrequencia * 100) / 100, // Arredondar para 2 casas decimais
    situacao,
    frequenciaMinima,
  };
}

/**
 * Consolidar dados do Plano de Ensino (frequência + notas)
 * 
 * @param planoEnsinoId - ID do Plano de Ensino
 * @param instituicaoId - ID da Instituição (multi-tenant)
 * @returns Promise<ConsolidacaoPlanoEnsino>
 */
export async function consolidarPlanoEnsino(
  planoEnsinoId: string,
  instituicaoId: string,
  tipoAcademico?: 'SUPERIOR' | 'SECUNDARIO' | null // Tipo acadêmico da instituição (vem do JWT)
): Promise<ConsolidacaoPlanoEnsino> {
  // Validar que o plano de ensino existe e pertence à instituição
  const planoEnsino = await prisma.planoEnsino.findFirst({
    where: {
      id: planoEnsinoId,
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
      turma: {
        select: {
          id: true,
          nome: true,
        },
        include: {
          matriculas: {
            include: {
              aluno: {
                select: {
                  id: true,
                  nomeCompleto: true,
                  numeroIdentificacaoPublica: true,
                },
              },
            },
          },
        },
      },
      aulas: {
        select: {
          id: true,
          quantidadeAulas: true,
        },
      },
      instituicao: {
        select: {
          tipoAcademico: true,
        },
      },
    },
  });

  if (!planoEnsino) {
    throw new AppError('Plano de ensino não encontrado ou não pertence à sua instituição', 404);
  }

  // Calcular total de aulas planejadas e ministradas
  const totalAulasPlanejadas = planoEnsino.aulas.reduce((sum, aula) => sum + aula.quantidadeAulas, 0);
  
  const totalAulasMinistradas = await prisma.aulaLancada.count({
    where: {
      planoEnsinoId,
      instituicaoId,
    },
  });

  // Buscar alunos da turma (se houver turma)
  let alunos: Array<{ alunoId: string; nomeCompleto: string; numeroIdentificacaoPublica?: string | null }> = [];

  if (planoEnsino.turma && planoEnsino.turma.matriculas) {
    alunos = planoEnsino.turma.matriculas.map(m => ({
      alunoId: m.aluno.id,
      nomeCompleto: m.aluno.nomeCompleto,
      numeroIdentificacaoPublica: (m.aluno as { numeroIdentificacaoPublica?: string | null }).numeroIdentificacaoPublica ?? null,
    }));
  } else {
    // Se não houver turma, buscar alunos matriculados na disciplina
    const matriculasAnuais = await prisma.matriculaAnual.findMany({
      where: {
        disciplinaId: planoEnsino.disciplinaId,
        anoLetivoId: planoEnsino.anoLetivoId,
        instituicaoId,
        status: 'ATIVA',
      },
      include: {
        aluno: {
          select: {
            id: true,
            nomeCompleto: true,
            numeroIdentificacaoPublica: true,
          },
        },
      },
    });

    alunos = matriculasAnuais.map(m => ({
      alunoId: m.aluno.id,
      nomeCompleto: m.aluno.nomeCompleto,
      numeroIdentificacaoPublica: (m.aluno as { numeroIdentificacaoPublica?: string | null }).numeroIdentificacaoPublica ?? null,
    }));
  }

  // Calcular frequência e notas para cada aluno
  const alunosConsolidados = await Promise.all(
    alunos.map(async (aluno) => {
      // Calcular frequência
      const frequencia = await calcularFrequenciaAluno(planoEnsinoId, aluno.alunoId, instituicaoId);

      // Usar serviço de cálculo de notas (padrão SIGA/SIGAE)
      const { calcularMedia } = await import('./calculoNota.service.js');
      
      let resultadoNotas;
      try {
        resultadoNotas = await calcularMedia({
          alunoId: aluno.alunoId,
          planoEnsinoId,
          instituicaoId,
          tipoAcademico: tipoAcademico || null, // CRÍTICO: tipoAcademico vem do parâmetro (req.user.tipoAcademico do JWT)
        });
      } catch (error: any) {
        // Se houver erro no cálculo, usar valores padrão
        resultadoNotas = {
          media_final: 0,
          status: 'REPROVADO' as const,
          detalhes_calculo: {
            notas_utilizadas: [],
            formula_aplicada: 'Erro no cálculo',
            observacoes: [error?.message || 'Erro ao calcular notas'],
          },
        };
      }

      // Buscar avaliações e notas individuais para exibir na pauta
      const avaliacoes = await prisma.avaliacao.findMany({
        where: {
          planoEnsinoId,
          instituicaoId,
        },
        include: {
          notas: {
            where: {
              alunoId: aluno.alunoId,
            },
            select: {
              id: true,
              valor: true,
            },
          },
        },
        orderBy: [
          { data: 'asc' },
          { tipo: 'asc' },
        ],
      });

      // Organizar notas por avaliação para exibição na pauta
      const notasPorAvaliacao = avaliacoes.map(av => ({
        avaliacaoId: av.id,
        avaliacaoNome: av.nome,
        avaliacaoTipo: av.tipo,
        avaliacaoData: av.data,
        trimestre: av.trimestre,
        nota: av.notas.length > 0 ? av.notas[0].valor : null,
      }));

      // Determinar situação acadêmica (prioridade: frequência > notas)
      let situacaoAcademica: 'APROVADO' | 'REPROVADO' | 'REPROVADO_FALTA' | 'EM_CURSO' = 'EM_CURSO';

      if (frequencia.situacao === 'IRREGULAR') {
        situacaoAcademica = 'REPROVADO_FALTA';
      } else if (resultadoNotas.status === 'APROVADO') {
        situacaoAcademica = 'APROVADO';
      } else if (resultadoNotas.status === 'REPROVADO' || resultadoNotas.status === 'REPROVADO_FALTA') {
        situacaoAcademica = 'REPROVADO';
      } else {
        situacaoAcademica = 'EM_CURSO';
      }

      return {
        alunoId: aluno.alunoId,
        nomeCompleto: aluno.nomeCompleto,
        numeroIdentificacaoPublica: aluno.numeroIdentificacaoPublica ?? null,
        frequencia,
        notas: {
          mediaFinal: resultadoNotas.media_final,
          mediaParcial: resultadoNotas.media_parcial,
          mediaTrimestral: resultadoNotas.media_trimestral,
          status: resultadoNotas.status,
          detalhes: resultadoNotas.detalhes_calculo,
          notasPorAvaliacao, // Notas individuais por avaliação (para exibição na pauta)
        },
        situacaoAcademica,
      };
    })
  );

  return {
    planoEnsinoId,
    disciplina: {
      id: planoEnsino.disciplina.id,
      nome: planoEnsino.disciplina.nome,
      cargaHoraria: planoEnsino.disciplina.cargaHoraria,
    },
    totalAulasPlanejadas,
    totalAulasMinistradas,
    alunos: alunosConsolidados,
    tipoInstituicao: planoEnsino.instituicao?.tipoAcademico || null, // Para o frontend renderizar corretamente
  };
}

/**
 * Obter frequência mínima configurável por tipo de instituição
 * 
 * @param tipoAcademico - Tipo acadêmico da instituição
 * @returns Frequência mínima em percentual (padrão: 75%)
 */
function obterFrequenciaMinima(tipoAcademico: TipoAcademico | null | undefined): number {
  // Por padrão, 75% para ambos os tipos
  // Pode ser configurável por instituição no futuro
  return 75;
}

