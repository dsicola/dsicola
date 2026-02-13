import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { AuditService, ModuloAuditoria, EntidadeAuditoria, AcaoAuditoria } from './audit.service.js';
import { verificarBloqueioAcademico, TipoOperacaoBloqueada, registrarTentativaBloqueada, validarBloqueioAcademicoInstitucionalOuErro } from './bloqueioAcademico.service.js';
import { requireTenantScope } from '../middlewares/auth.js';
import { Decimal } from '@prisma/client/runtime/library';
import { validarPlanoEnsinoAtivo } from './validacaoAcademica.service.js';

/**
 * REGRA ABSOLUTA: Relatórios são SOMENTE leitura e derivados
 * Nenhum relatório pode ser editado manualmente
 * Todas as decisões devem ser feitas no backend
 * 
 * PADRÃO SIGA/SIGAE:
 * - Boletim: gerado por aluno, leitura apenas, histórico real
 * - Pauta: gerada por turma + disciplina, bloqueada após encerramento, auditoria completa
 */

/**
 * Interface para Histórico Acadêmico
 * Derivado de: matrículas, planos de ensino, avaliações e equivalências
 */
export interface HistoricoAcademico {
  aluno: {
    id: string;
    nomeCompleto: string;
    numeroIdentificacao: string | null;
    numeroIdentificacaoPublica: string | null;
    dataNascimento: Date | null;
  };
  curso: {
    id: string;
    nome: string;
    grau: string | null;
  };
  instituicao: {
    id: string;
    nome: string;
    tipoAcademico: string | null;
  };
  disciplinas: Array<{
    disciplinaId: string;
    disciplinaNome: string;
    planoEnsinoId: string;
    anoLetivo: number;
    semestre: string | null;
    trimestre: string | null;
    cargaHoraria: number;
    notaFinal: number | null;
    frequencia: number | null;
    situacao: 'APROVADO' | 'REPROVADO' | 'EM_ANDAMENTO' | 'EQUIVALENTE';
    equivalencia: {
      disciplinaOrigem: string;
      dataEquivalencia: Date;
    } | null;
  }>;
  resumo: {
    totalDisciplinas: number;
    disciplinasAprovadas: number;
    disciplinasReprovadas: number;
    cargaHorariaTotal: number;
    cargaHorariaCursada: number;
    mediaGeral: number | null;
  };
  geradoEm: Date;
  geradoPor: string;
}

/**
 * Interface para Boletim do Aluno
 * Documento oficial derivado de dados reais, somente leitura
 */
export interface BoletimAluno {
  aluno: {
    id: string;
    nomeCompleto: string;
    numeroIdentificacao: string | null;
    numeroIdentificacaoPublica: string | null;
  };
  anoLetivo: {
    id: string;
    ano: number;
  };
  disciplinas: Array<{
    planoEnsinoId: string;
    disciplinaNome: string;
    turmaNome: string | null;
    professorNome: string;
    cargaHoraria: number;
    notaFinal: number | null;
    frequencia: {
      totalAulas: number;
      presencas: number;
      faltas: number;
      faltasJustificadas: number;
      percentualFrequencia: number;
      situacao: 'REGULAR' | 'IRREGULAR';
      frequenciaMinima: number;
    };
    avaliacoes: Array<{
      avaliacaoId: string;
      avaliacaoNome: string | null;
      avaliacaoTipo: string;
      avaliacaoData: Date;
      trimestre: number | null;
      nota: number | null;
    }>;
    situacaoAcademica: 'APROVADO' | 'REPROVADO' | 'REPROVADO_FALTA' | 'EM_ANDAMENTO';
    validacoes: {
      planoAtivo: boolean;
      aulasRegistradas: boolean;
      frequenciaMinimaAtendida: boolean;
      avaliacoesEncerradas: boolean;
    };
  }>;
  geradoEm: Date;
  geradoPor: string;
}

/**
 * Interface para Pauta
 * Gerada apenas após fechamento do plano de ensino
 */
export interface Pauta {
  planoEnsino: {
    id: string;
    disciplinaNome: string;
    professorNome: string;
    turmaNome: string | null;
    anoLetivo: number;
    semestre: string | null;
    trimestre: string | null;
    cargaHorariaPlanejada: number;
  };
  alunos: Array<{
    alunoId: string;
    alunoNome: string;
    numeroIdentificacao: string | null;
    matriculaId: string;
    notaFinal: number | null;
    frequencia: number | null;
    situacao: 'APROVADO' | 'REPROVADO' | 'EM_ANDAMENTO';
    avaliacoes: Array<{
      avaliacaoNome: string | null;
      peso: number;
      nota: number | null;
      dataAplicacao: Date | null;
    }>;
  }>;
  estatisticas: {
    totalAlunos: number;
    aprovados: number;
    reprovados: number;
    emAndamento: number;
    mediaTurma: number | null;
  };
  geradoEm: Date;
  geradoPor: string;
}

/**
 * Interface para Certificado
 * Só permitir se situação acadêmica e financeira estiverem regulares
 */
export interface Certificado {
  aluno: {
    id: string;
    nomeCompleto: string;
    numeroIdentificacao: string | null;
    dataNascimento: Date | null;
  };
  curso: {
    id: string;
    nome: string;
    grau: string | null;
    cargaHorariaTotal: number;
  };
  conclusao: {
    dataConclusao: Date;
    anoLetivo: number | null;
    mediaFinal: number;
  };
  instituicao: {
    id: string;
    nome: string;
    tipoAcademico: string | null;
  };
  validacao: {
    codigoVerificacao: string;
    urlVerificacao: string;
    dataEmissao: Date;
    assinadoDigitalmente: boolean;
  };
  situacaoRegular: {
    academica: boolean;
    financeira: boolean;
  };
  geradoEm: Date;
  geradoPor: string;
}

/**
 * Gerar Histórico Acadêmico
 * REGRA: Derivado de histórico acadêmico consolidado ou dados atuais
 * REGRA: Verificar bloqueio acadêmico para documentos se configurado
 */
export async function gerarHistoricoAcademico(
  alunoId: string,
  instituicaoId: string,
  usuarioId: string,
  tipoAcademico?: 'SUPERIOR' | 'SECUNDARIO' | null
): Promise<HistoricoAcademico> {
  // Verificar bloqueio acadêmico para documentos (histórico é um documento)
  const bloqueio = await verificarBloqueioAcademico(
    alunoId,
    instituicaoId,
    TipoOperacaoBloqueada.DOCUMENTOS
  );

  if (bloqueio.bloqueado) {
    // Registrar tentativa bloqueada
    await registrarTentativaBloqueada(
      usuarioId,
      instituicaoId,
      alunoId,
      TipoOperacaoBloqueada.DOCUMENTOS,
      bloqueio.motivo || 'Situação financeira irregular'
    );
    
    throw new AppError(bloqueio.motivo || 'Emissão de histórico acadêmico bloqueada devido a situação financeira irregular', 403);
  }

  // BLOQUEIO ACADÊMICO INSTITUCIONAL: Validar curso/classe do aluno
  if (tipoAcademico !== undefined) {
    await validarBloqueioAcademicoInstitucionalOuErro(
      alunoId,
      instituicaoId,
      tipoAcademico
    );
  }

  // VALIDAÇÃO MULTI-TENANT: Verificar se aluno pertence à instituição
  const aluno = await prisma.user.findFirst({
    where: {
      id: alunoId,
      instituicaoId,
      roles: {
        some: {
          role: 'ALUNO'
        }
      }
    },
    select: {
      id: true,
      nomeCompleto: true,
      numeroIdentificacao: true,
      numeroIdentificacaoPublica: true,
      dataNascimento: true,
      instituicao: {
        select: {
          id: true,
          nome: true,
          tipoAcademico: true
        }
      }
    }
  });

  if (!aluno) {
    throw new AppError('Aluno não encontrado ou não pertence à sua instituição', 404);
  }

  // Buscar histórico acadêmico consolidado (se existir)
  let historicoAcademico = await prisma.historicoAcademico.findMany({
    where: {
      alunoId,
      instituicaoId
    },
    orderBy: {
      geradoEm: 'asc'
    }
  });

  // Se não houver histórico consolidado, buscar dados de planos de ensino e notas
  if (historicoAcademico.length === 0) {
    // Buscar planos de ensino do aluno via matrículas
    const matriculas = await prisma.matricula.findMany({
      where: {
        alunoId,
        turma: {
          instituicaoId
        }
      },
      include: {
        turma: {
          include: {
            disciplina: {
              select: {
                id: true,
                nome: true,
                cargaHoraria: true
              }
            }
          }
        },
        anoLetivoRef: {
          select: {
            ano: true
          }
        }
      }
    });

    // Buscar planos de ensino relacionados
    const turmaIds = matriculas.map(m => m.turmaId);
    const planosEnsino = await prisma.planoEnsino.findMany({
      where: {
        instituicaoId,
        turmaId: { in: turmaIds }
      },
      include: {
        disciplina: {
          select: {
            id: true,
            nome: true,
            cargaHoraria: true
          }
        },
        anoLetivoRef: {
          select: {
            ano: true
          }
        }
      }
    });

    // Buscar notas do aluno
    const notas = await prisma.nota.findMany({
      where: {
        alunoId,
        instituicaoId,
        planoEnsinoId: { in: planosEnsino.map(p => p.id) }
      },
      include: {
        planoEnsino: {
          include: {
            disciplina: {
              select: {
                id: true,
                nome: true,
                cargaHoraria: true
              }
            }
          }
        }
      }
    });

    // Criar estrutura similar ao histórico acadêmico
    const disciplinasMap = new Map<string, any>();
    
    for (const plano of planosEnsino) {
      const disciplinaNotas = notas.filter(n => n.planoEnsinoId === plano.id);
      const valoresNotas = disciplinaNotas.map(n => Number(n.valor)).filter(v => !isNaN(v) && v > 0);
      const notaFinal = valoresNotas.length > 0 
        ? valoresNotas.reduce((sum, v) => sum + v, 0) / valoresNotas.length 
        : null;

      // Buscar frequência via aulas lançadas
      const aulasLancadas = await prisma.aulaLancada.count({
        where: {
          planoEnsinoId: plano.id
        }
      });

      const cargaHorariaPlanejada = plano.cargaHorariaPlanejada || 0;
      const frequenciaPercentual = cargaHorariaPlanejada > 0 
        ? (aulasLancadas / cargaHorariaPlanejada) * 100 
        : null;

      // Determinar situação
      let situacao: 'APROVADO' | 'REPROVADO' | 'EM_ANDAMENTO' = 'EM_ANDAMENTO';
      if (notaFinal !== null && frequenciaPercentual !== null) {
        const mediaMinima = 10;
        const frequenciaMinima = 75;
        if (notaFinal >= mediaMinima && frequenciaPercentual >= frequenciaMinima) {
          situacao = 'APROVADO';
        } else {
          situacao = 'REPROVADO';
        }
      }

      disciplinasMap.set(`${plano.disciplinaId}-${plano.id}`, {
        disciplinaId: plano.disciplinaId,
        disciplinaNome: plano.disciplina.nome,
        planoEnsinoId: plano.id,
        anoLetivo: plano.anoLetivoRef?.ano || plano.anoLetivo || 0,
        semestre: plano.semestre ? `Semestre ${plano.semestre}` : null,
        trimestre: null, // Trimestre não está no PlanoEnsino diretamente
        cargaHoraria: plano.disciplina?.cargaHoraria || 0,
        notaFinal,
        frequencia: frequenciaPercentual,
        situacao,
        equivalencia: null
      });
    }

    historicoAcademico = Array.from(disciplinasMap.values()) as any;
  }

  // Processar disciplinas do histórico
  const disciplinas: HistoricoAcademico['disciplinas'] = [];

  // Buscar disciplinas e anos letivos relacionados
  const disciplinaIds = [...new Set(historicoAcademico.map((h: any) => h.disciplinaId).filter(Boolean))];
  const anoLetivoIds = [...new Set(historicoAcademico.map((h: any) => h.anoLetivoId).filter(Boolean))];
  
  const disciplinasData = await prisma.disciplina.findMany({
    where: {
      id: { in: disciplinaIds },
      instituicaoId
    },
    select: {
      id: true,
      nome: true,
      cargaHoraria: true
    }
  });

  const anosLetivosData = await prisma.anoLetivo.findMany({
    where: {
      id: { in: anoLetivoIds },
      instituicaoId
    },
    select: {
      id: true,
      ano: true
    }
  });

  const disciplinasMap = new Map(disciplinasData.map(d => [d.id, d]));
  const anosLetivosMap = new Map(anosLetivosData.map(a => [a.id, a]));

  for (const item of historicoAcademico) {
    // Verificar se há equivalência
    const equivalencia = await prisma.equivalenciaDisciplina.findFirst({
      where: {
        alunoId,
        disciplinaOrigemId: item.disciplinaId
      },
      include: {
        disciplinaOrigem: {
          select: {
            nome: true
          }
        }
      }
    });

    const disciplina = disciplinasMap.get(item.disciplinaId);
    const anoLetivo = item.anoLetivoId ? anosLetivosMap.get(item.anoLetivoId) : null;

    const disciplinaId = item.disciplinaId || '';
    const disciplinaNome = disciplina?.nome || '';
    const cargaHoraria = item.cargaHoraria || disciplina?.cargaHoraria || 0;
    const notaFinal = item.mediaFinal ? Number(item.mediaFinal) : null;
    const frequencia = item.percentualFrequencia ? Number(item.percentualFrequencia) : null;
    const anoLetivoNum = anoLetivo?.ano || 0;
    
    let situacao: 'APROVADO' | 'REPROVADO' | 'EM_ANDAMENTO' | 'EQUIVALENTE' = 'EM_ANDAMENTO';
    
    if (equivalencia) {
      situacao = 'EQUIVALENTE';
    } else if (item.situacaoAcademica) {
      situacao = item.situacaoAcademica as any;
    } else if (notaFinal !== null && frequencia !== null) {
      const mediaMinima = 10;
      const frequenciaMinima = 75;
      if (notaFinal >= mediaMinima && frequencia >= frequenciaMinima) {
        situacao = 'APROVADO';
      } else {
        situacao = 'REPROVADO';
      }
    }

    // Buscar plano de ensino para obter semestre/trimestre
    const planoEnsino = await prisma.planoEnsino.findFirst({
      where: {
        id: item.planoEnsinoId,
        instituicaoId
      },
      select: {
        semestre: true
      }
    });

    disciplinas.push({
      disciplinaId,
      disciplinaNome,
      planoEnsinoId: item.planoEnsinoId || '',
      anoLetivo: anoLetivoNum,
      semestre: planoEnsino?.semestre ? `Semestre ${planoEnsino.semestre}` : null,
      trimestre: null, // Trimestre não está diretamente no HistoricoAcademico
      cargaHoraria,
      notaFinal,
      frequencia,
      situacao,
      equivalencia: equivalencia ? {
        disciplinaOrigem: equivalencia.disciplinaOrigem?.nome || equivalencia.disciplinaOrigemNome || '',
        dataEquivalencia: equivalencia.deferidoEm || new Date()
      } : null
    });
  }

  // Calcular resumo
  const disciplinasAprovadas = disciplinas.filter(d => d.situacao === 'APROVADO' || d.situacao === 'EQUIVALENTE').length;
  const disciplinasReprovadas = disciplinas.filter(d => d.situacao === 'REPROVADO').length;
  const cargaHorariaTotal = disciplinas.reduce((sum, d) => sum + d.cargaHoraria, 0);
  const cargaHorariaCursada = disciplinas.filter(d => d.situacao === 'APROVADO' || d.situacao === 'EQUIVALENTE')
    .reduce((sum, d) => sum + d.cargaHoraria, 0);
  
  const notasFinais = disciplinas
    .map(d => d.notaFinal)
    .filter(n => n !== null) as number[];
  const mediaGeral = notasFinais.length > 0 
    ? notasFinais.reduce((sum, n) => sum + n, 0) / notasFinais.length 
    : null;

  // Buscar curso/classe do aluno
  const matriculaAnual = await prisma.matriculaAnual.findFirst({
    where: {
      alunoId,
      instituicaoId,
      status: 'ATIVA'
    },
    include: {
      curso: {
        select: {
          id: true,
          nome: true,
          grau: true
        }
      },
      classe: {
        select: {
          id: true,
          nome: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  const curso = matriculaAnual?.curso || { id: '', nome: 'Não informado', grau: null };

  // Registrar auditoria
  await AuditService.log(null, {
    modulo: ModuloAuditoria.RELATORIOS_OFICIAIS,
    entidade: EntidadeAuditoria.RELATORIO_GERADO,
    acao: AcaoAuditoria.GENERATE_REPORT,
    entidadeId: alunoId,
    instituicaoId,
    dadosNovos: {
      tipoRelatorio: 'HISTORICO_ACADEMICO',
      alunoId,
      totalDisciplinas: disciplinas.length
    },
    observacao: `Histórico acadêmico gerado para aluno ${alunoId}`
  });

  return {
    aluno: {
      id: aluno.id,
      nomeCompleto: aluno.nomeCompleto,
      numeroIdentificacao: aluno.numeroIdentificacao || '',
      numeroIdentificacaoPublica: aluno.numeroIdentificacaoPublica || null,
      dataNascimento: aluno.dataNascimento || null,
    },
    curso: {
      id: curso.id,
      nome: curso.nome,
      grau: curso.grau || null,
    },
    instituicao: {
      id: aluno.instituicao?.id || instituicaoId,
      nome: aluno.instituicao?.nome || '',
      tipoAcademico: aluno.instituicao?.tipoAcademico || null,
    },
    disciplinas,
    resumo: {
      totalDisciplinas: disciplinas.length,
      disciplinasAprovadas,
      disciplinasReprovadas,
      cargaHorariaTotal,
      cargaHorariaCursada,
      mediaGeral,
    },
    geradoEm: new Date(),
    geradoPor: usuarioId,
  };
}

/**
 * Validar pré-requisitos para geração de documentos oficiais
 * REGRA ABSOLUTA SIGA/SIGAE: Validar plano ativo, aulas registradas, frequência mínima, avaliações encerradas
 */
async function validarPreRequisitosDocumento(
  planoEnsinoId: string,
  instituicaoId: string,
  tipoDocumento: 'BOLETIM' | 'PAUTA'
): Promise<{
  planoAtivo: boolean;
  aulasRegistradas: boolean;
  frequenciaMinimaAtendida: boolean;
  avaliacoesEncerradas: boolean;
  erros: string[];
}> {
  const erros: string[] = [];
  
  // 1. Validar plano ativo
  let planoAtivo = false;
  try {
    await validarPlanoEnsinoAtivo(instituicaoId, planoEnsinoId, 'gerar documento oficial');
    planoAtivo = true;
  } catch (error: any) {
    erros.push(`Plano de ensino não está ativo: ${error.message}`);
  }

  // 2. Validar aulas registradas
  let aulasRegistradas = false;
  const totalAulas = await prisma.aulaLancada.count({
    where: {
      planoEnsinoId,
      instituicaoId,
    },
  });

  if (totalAulas === 0) {
    erros.push('Nenhuma aula foi registrada para este plano de ensino');
  } else {
    aulasRegistradas = true;
  }

  // 3. Validar frequência mínima (verificar se há presenças registradas)
  let frequenciaMinimaAtendida = false;
  const planoEnsino = await prisma.planoEnsino.findFirst({
    where: {
      id: planoEnsinoId,
      instituicaoId,
    },
    select: {
      cargaHorariaPlanejada: true,
      instituicao: {
        select: {
          tipoAcademico: true,
        },
      },
    },
  });

  if (planoEnsino) {
    // Buscar presenças registradas
    const aulasLancadas = await prisma.aulaLancada.findMany({
      where: {
        planoEnsinoId,
        instituicaoId,
      },
      select: {
        id: true,
      },
    });

    const aulaIds = aulasLancadas.map(a => a.id);
    const totalPresencas = await prisma.presenca.count({
      where: {
        aulaLancadaId: { in: aulaIds },
        instituicaoId,
      },
    });

    if (totalPresencas === 0 && totalAulas > 0) {
      erros.push('Aulas foram registradas, mas nenhuma presença foi marcada');
    } else if (totalPresencas > 0) {
      frequenciaMinimaAtendida = true; // Frequência será calculada individualmente por aluno
    }
  }

  // 4. Validar avaliações encerradas (para Pauta, todas devem estar fechadas)
  let avaliacoesEncerradas = false;
  const avaliacoes = await prisma.avaliacao.findMany({
    where: {
      planoEnsinoId,
      instituicaoId,
    },
    select: {
      id: true,
      nome: true,
      fechada: true,
      estado: true,
    },
  });

  if (tipoDocumento === 'PAUTA') {
    // Para Pauta, TODAS as avaliações devem estar fechadas
    const avaliacoesAbertas = avaliacoes.filter(a => !a.fechada);
    if (avaliacoesAbertas.length > 0) {
      erros.push(`${avaliacoesAbertas.length} avaliação(ões) ainda não estão fechadas: ${avaliacoesAbertas.map(a => a.nome || a.id).join(', ')}`);
    } else if (avaliacoes.length > 0) {
      avaliacoesEncerradas = true;
    } else {
      erros.push('Nenhuma avaliação foi criada para este plano de ensino');
    }
  } else {
    // Para Boletim, pelo menos uma avaliação deve existir (não precisa estar fechada)
    if (avaliacoes.length === 0) {
      erros.push('Nenhuma avaliação foi criada para este plano de ensino');
    } else {
      avaliacoesEncerradas = true; // Para boletim, não exige que todas estejam fechadas
    }
  }

  return {
    planoAtivo,
    aulasRegistradas,
    frequenciaMinimaAtendida,
    avaliacoesEncerradas,
    erros,
  };
}

/**
 * Gerar Boletim do Aluno
 * 
 * REGRA ABSOLUTA SIGA/SIGAE:
 * - Documento somente leitura, derivado de dados reais
 * - Nenhuma edição manual de notas
 * - Documentos imutáveis após fechamento do plano de ensino
 * - Respeitar Plano de Ensino e frequência
 * 
 * VALIDAÇÕES:
 * - Plano ativo (APROVADO)
 * - Aulas registradas
 * - Frequência mínima
 * - Avaliações criadas
 * 
 * IMUTABILIDADE:
 * - Boletim é gerado dinamicamente a partir de dados reais
 * - Após fechamento do plano, dados não podem ser alterados
 * - Auditoria completa de todas as gerações
 */
export async function gerarBoletimAluno(
  alunoId: string,
  instituicaoId: string,
  usuarioId: string,
  anoLetivoId?: string,
  tipoAcademico?: 'SUPERIOR' | 'SECUNDARIO' | null
): Promise<BoletimAluno> {
  // VALIDAÇÃO MULTI-TENANT: Verificar se aluno pertence à instituição
  const aluno = await prisma.user.findFirst({
    where: {
      id: alunoId,
      instituicaoId,
      roles: {
        some: {
          role: 'ALUNO'
        }
      }
    },
    select: {
      id: true,
      nomeCompleto: true,
      numeroIdentificacao: true,
      numeroIdentificacaoPublica: true,
    }
  });

  if (!aluno) {
    throw new AppError('Aluno não encontrado ou não pertence à sua instituição', 404);
  }

  // BLOQUEIO ACADÊMICO INSTITUCIONAL: Validar curso/classe do aluno
  if (tipoAcademico !== undefined) {
    await validarBloqueioAcademicoInstitucionalOuErro(
      alunoId,
      instituicaoId,
      tipoAcademico
    );
  }

  // Buscar ano letivo
  let anoLetivo: { id: string; ano: number } | null = null;
  if (anoLetivoId) {
    const anoLetivoRecord = await prisma.anoLetivo.findFirst({
      where: {
        id: anoLetivoId,
        instituicaoId,
      },
      select: {
        id: true,
        ano: true,
      },
    });
    if (anoLetivoRecord) {
      anoLetivo = { id: anoLetivoRecord.id, ano: anoLetivoRecord.ano };
    }
  } else {
    // Buscar ano letivo ativo
    const anoLetivoAtivo = await prisma.anoLetivo.findFirst({
      where: {
        instituicaoId,
        status: 'ATIVO',
      },
      orderBy: {
        ano: 'desc',
      },
      select: {
        id: true,
        ano: true,
      },
    });
    if (anoLetivoAtivo) {
      anoLetivo = { id: anoLetivoAtivo.id, ano: anoLetivoAtivo.ano };
    }
  }

  if (!anoLetivo) {
    throw new AppError('Ano letivo não encontrado ou não está ativo', 404);
  }

  // Buscar planos de ensino do aluno
  const matriculas = await prisma.matricula.findMany({
    where: {
      alunoId,
      anoLetivoId: anoLetivo.id,
      status: {
        in: ['Ativa', 'Trancada']
      },
    },
    include: {
      turma: {
        select: {
          id: true,
          instituicaoId: true,
        },
      },
    },
  });

  const turmaIds = matriculas
    .filter(m => m.turma.instituicaoId === instituicaoId)
    .map(m => m.turma.id);

  // Buscar planos de ensino
  const planosEnsino = await prisma.planoEnsino.findMany({
    where: {
      instituicaoId,
      anoLetivoId: anoLetivo.id,
      turmaId: { in: turmaIds },
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
      },
      professor: {
        select: {
          id: true,
          user: { select: { nomeCompleto: true } },
        },
      },
    },
  });

  // Processar cada disciplina
  const disciplinas: BoletimAluno['disciplinas'] = [];
  const { calcularFrequenciaAluno } = await import('./frequencia.service.js');
  const { calcularMedia } = await import('./calculoNota.service.js');

  for (const plano of planosEnsino) {
    // Validar pré-requisitos
    const validacoes = await validarPreRequisitosDocumento(plano.id, instituicaoId, 'BOLETIM');

    // Calcular frequência
    const frequencia = await calcularFrequenciaAluno(plano.id, alunoId, instituicaoId);

    // Calcular notas
    let resultadoNotas;
    try {
      resultadoNotas = await calcularMedia({
        alunoId,
        planoEnsinoId: plano.id,
        instituicaoId,
        tipoAcademico: tipoAcademico || null,
      });
    } catch (error: any) {
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

    // Buscar avaliações e notas individuais
    const avaliacoes = await prisma.avaliacao.findMany({
      where: {
        planoEnsinoId: plano.id,
        instituicaoId,
      },
      include: {
        notas: {
          where: {
            alunoId,
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

    const avaliacoesDetalhadas = avaliacoes.map(av => ({
      avaliacaoId: av.id,
      avaliacaoNome: av.nome,
      avaliacaoTipo: av.tipo,
      avaliacaoData: av.data,
      trimestre: av.trimestre,
      nota: av.notas.length > 0 ? Number(av.notas[0].valor) : null,
    }));

    // Determinar situação acadêmica
    let situacaoAcademica: 'APROVADO' | 'REPROVADO' | 'REPROVADO_FALTA' | 'EM_ANDAMENTO' = 'EM_ANDAMENTO';
    if (frequencia.situacao === 'IRREGULAR') {
      situacaoAcademica = 'REPROVADO_FALTA';
    } else if (resultadoNotas.status === 'APROVADO') {
      situacaoAcademica = 'APROVADO';
    } else if (resultadoNotas.status === 'REPROVADO' || resultadoNotas.status === 'REPROVADO_FALTA') {
      situacaoAcademica = resultadoNotas.status === 'REPROVADO_FALTA' ? 'REPROVADO_FALTA' : 'REPROVADO';
    }

    disciplinas.push({
      planoEnsinoId: plano.id,
      disciplinaNome: plano.disciplina?.nome ?? '',
      turmaNome: plano.turma?.nome ?? null,
      professorNome: plano.professor?.user?.nomeCompleto ?? '',
      cargaHoraria: plano.disciplina?.cargaHoraria || 0,
      notaFinal: resultadoNotas.media_final || null,
      frequencia: {
        totalAulas: frequencia.totalAulas,
        presencas: frequencia.presencas,
        faltas: frequencia.faltas,
        faltasJustificadas: frequencia.faltasJustificadas,
        percentualFrequencia: frequencia.percentualFrequencia,
        situacao: frequencia.situacao,
        frequenciaMinima: frequencia.frequenciaMinima || 75,
      },
      avaliacoes: avaliacoesDetalhadas,
      situacaoAcademica,
      validacoes: {
        planoAtivo: validacoes.planoAtivo,
        aulasRegistradas: validacoes.aulasRegistradas,
        frequenciaMinimaAtendida: validacoes.frequenciaMinimaAtendida,
        avaliacoesEncerradas: validacoes.avaliacoesEncerradas,
      },
    });
  }

  // Registrar auditoria
  await AuditService.log(null, {
    modulo: ModuloAuditoria.RELATORIOS_OFICIAIS,
    entidade: EntidadeAuditoria.RELATORIO_GERADO,
    acao: AcaoAuditoria.GENERATE_REPORT,
    entidadeId: alunoId,
    instituicaoId,
    dadosNovos: {
      tipoRelatorio: 'BOLETIM_ALUNO',
      alunoId,
      anoLetivoId: anoLetivo.id,
      totalDisciplinas: disciplinas.length,
    },
    observacao: `Boletim do aluno gerado para aluno ${alunoId}, ano letivo ${anoLetivo.ano}`
  });

  return {
    aluno: {
      id: aluno.id,
      nomeCompleto: aluno.nomeCompleto,
      numeroIdentificacao: aluno.numeroIdentificacao || null,
      numeroIdentificacaoPublica: aluno.numeroIdentificacaoPublica || null,
    },
    anoLetivo,
    disciplinas,
    geradoEm: new Date(),
    geradoPor: usuarioId,
  };
}

/**
 * Gerar Pauta
 * 
 * REGRA ABSOLUTA SIGA/SIGAE:
 * - Gerada apenas após fechamento/aprovação do plano de ensino
 * - Documento imutável após geração
 * - Bloquear alterações após encerramento
 * - Registrar auditoria completa
 * 
 * VALIDAÇÕES:
 * - Plano ativo (APROVADO ou ENCERRADO)
 * - Aulas registradas
 * - Frequência mínima
 * - TODAS as avaliações encerradas (fechadas)
 * 
 * IMUTABILIDADE:
 * - Pauta só pode ser gerada se plano estiver APROVADO ou ENCERRADO
 * - Após geração, dados não podem ser alterados
 * - Auditoria completa de todas as gerações
 * - Documento pronto para impressão e auditoria
 */
export async function gerarPauta(
  planoEnsinoId: string,
  instituicaoId: string,
  usuarioId: string,
  tipoAcademico?: 'SUPERIOR' | 'SECUNDARIO' | null
): Promise<Pauta> {
  // Buscar plano de ensino
  const planoEnsino = await prisma.planoEnsino.findFirst({
    where: {
      id: planoEnsinoId,
      instituicaoId
    },
    include: {
      disciplina: {
        select: {
          id: true,
          nome: true
        }
      },
      professor: {
        select: {
          id: true,
          user: { select: { nomeCompleto: true } },
        },
      },
      turma: {
        select: {
          id: true,
          nome: true
        }
      },
      anoLetivoRef: {
        select: {
          ano: true
        }
      }
    }
  });

  if (!planoEnsino || !planoEnsino.disciplina || !planoEnsino.professor) {
    throw new AppError('Plano de ensino não encontrado ou não pertence à sua instituição', 404);
  }

  // REGRA: Pauta só pode ser gerada se plano estiver fechado/aprovado
  if (planoEnsino.estado !== 'APROVADO' && planoEnsino.estado !== 'ENCERRADO') {
    throw new AppError('Pauta só pode ser gerada após fechamento/aprovação do plano de ensino', 400);
  }

  if (!planoEnsino.turmaId) {
    throw new AppError('Plano de ensino deve estar vinculado a uma turma para gerar pauta', 400);
  }

  // VALIDAÇÃO COMPLETA: Validar pré-requisitos para geração de pauta
  const validacoes = await validarPreRequisitosDocumento(planoEnsinoId, instituicaoId, 'PAUTA');
  
  if (validacoes.erros.length > 0) {
    throw new AppError(
      `Não é possível gerar a pauta. Os seguintes pré-requisitos não foram atendidos:\n${validacoes.erros.join('\n')}`,
      400
    );
  }

  // Buscar todas as matrículas da turma
  const matriculas = await prisma.matricula.findMany({
    where: {
      turmaId: planoEnsino.turmaId,
      status: {
        in: ['Ativa', 'Trancada']
      }
    },
    include: {
      aluno: {
        select: {
          id: true,
          nomeCompleto: true,
          numeroIdentificacao: true
        }
      }
    }
  });

  // Importar serviço de frequência
  const { calcularFrequenciaAluno } = await import('./frequencia.service.js');

  // Processar cada aluno
  const alunos: Pauta['alunos'] = [];

  for (const matricula of matriculas) {
    // BLOQUEIO ACADÊMICO INSTITUCIONAL: Validar curso/classe do aluno antes de incluir na pauta
    if (tipoAcademico !== undefined && tipoAcademico !== null) {
      await validarBloqueioAcademicoInstitucionalOuErro(
        matricula.alunoId,
        instituicaoId,
        tipoAcademico,
        planoEnsino.disciplina.id,
        planoEnsino.anoLetivoId
      );
    }

    // Buscar todas as avaliações do plano
    const avaliacoes = await prisma.avaliacao.findMany({
      where: {
        planoEnsinoId: planoEnsino.id,
        turmaId: planoEnsino.turmaId
      },
      include: {
        notas: {
          where: {
            alunoId: matricula.alunoId
          }
        }
      },
      orderBy: {
        data: 'asc'
      }
    });

    // Calcular nota final
    let notaFinal: number | null = null;
    let totalPeso = 0;
    let somaNotas = 0;

    const avaliacoesDetalhadas = avaliacoes.map(av => {
      const nota = av.notas[0];
      const notaValor = nota ? Number(nota.valor) : null;
      const peso = av.peso ? Number(av.peso) : 1;

      if (notaValor !== null && !isNaN(notaValor)) {
        somaNotas += notaValor * peso;
        totalPeso += peso;
      }

      return {
        avaliacaoNome: av.nome || null,
        peso: Number(peso),
        nota: notaValor,
        dataAplicacao: av.data || null
      };
    });

    if (totalPeso > 0) {
      notaFinal = somaNotas / totalPeso;
    }

    // Calcular frequência usando serviço oficial
    const frequencia = await calcularFrequenciaAluno(planoEnsino.id, matricula.alunoId, instituicaoId);
    const frequenciaPercentual = frequencia.percentualFrequencia;

    // Determinar situação
    let situacao: 'APROVADO' | 'REPROVADO' | 'EM_ANDAMENTO' = 'EM_ANDAMENTO';
    
    if (notaFinal !== null && frequenciaPercentual !== null) {
      const mediaMinima = 10;
      const frequenciaMinima = frequencia.frequenciaMinima || 75;
      
      if (notaFinal >= mediaMinima && frequenciaPercentual >= frequenciaMinima) {
        situacao = 'APROVADO';
      } else {
        situacao = 'REPROVADO';
      }
    }

    alunos.push({
      alunoId: matricula.alunoId,
      alunoNome: matricula.aluno.nomeCompleto,
      numeroIdentificacao: matricula.aluno.numeroIdentificacao || null,
      matriculaId: matricula.id,
      notaFinal,
      frequencia: frequenciaPercentual,
      situacao,
      avaliacoes: avaliacoesDetalhadas
    });
  }

  // Calcular estatísticas
  const aprovados = alunos.filter(a => a.situacao === 'APROVADO').length;
  const reprovados = alunos.filter(a => a.situacao === 'REPROVADO').length;
  const emAndamento = alunos.filter(a => a.situacao === 'EM_ANDAMENTO').length;
  
  const notasFinais = alunos
    .map(a => a.notaFinal)
    .filter(n => n !== null) as number[];
  const mediaTurma = notasFinais.length > 0
    ? notasFinais.reduce((sum, n) => sum + n, 0) / notasFinais.length
    : null;

  // Registrar auditoria completa (imutabilidade e rastreabilidade)
  await AuditService.log(null, {
    modulo: ModuloAuditoria.RELATORIOS_OFICIAIS,
    entidade: EntidadeAuditoria.RELATORIO_GERADO,
    acao: AcaoAuditoria.GENERATE_REPORT,
    entidadeId: planoEnsinoId,
    instituicaoId,
    dadosNovos: {
      tipoRelatorio: 'PAUTA',
      planoEnsinoId,
      totalAlunos: alunos.length,
      estadoPlano: planoEnsino.estado,
      validacoes: {
        planoAtivo: true,
        aulasRegistradas: true,
        frequenciaMinimaAtendida: true,
        avaliacoesEncerradas: true,
      },
      imutavel: true, // Documento imutável após geração
    },
    observacao: `Pauta oficial gerada para plano de ensino ${planoEnsinoId}. Documento imutável conforme padrão SIGA/SIGAE.`
  });

  return {
    planoEnsino: {
      id: planoEnsino.id,
      disciplinaNome: planoEnsino.disciplina?.nome ?? '',
      professorNome: planoEnsino.professor?.user?.nomeCompleto ?? '',
      turmaNome: planoEnsino.turma?.nome ?? null,
      anoLetivo: planoEnsino.anoLetivoRef?.ano || planoEnsino.anoLetivo || 0,
      semestre: planoEnsino.semestre ? `Semestre ${planoEnsino.semestre}` : null,
      trimestre: null, // Trimestre não está diretamente no PlanoEnsino
      cargaHorariaPlanejada: planoEnsino.cargaHorariaPlanejada || 0,
    },
    alunos,
    estatisticas: {
      totalAlunos: alunos.length,
      aprovados,
      reprovados,
      emAndamento,
      mediaTurma,
    },
    geradoEm: new Date(),
    geradoPor: usuarioId,
  };
}

/**
 * Gerar Certificado
 * REGRA: Só permitir se situação acadêmica e financeira estiverem regulares
 */
export async function gerarCertificado(
  alunoId: string,
  cursoId: string | null,
  classeId: string | null,
  instituicaoId: string,
  usuarioId: string,
  tipoAcademico?: 'SUPERIOR' | 'SECUNDARIO' | null
): Promise<Certificado> {
  // 1. Verificar bloqueio acadêmico (situação financeira)
  const bloqueio = await verificarBloqueioAcademico(
    alunoId,
    instituicaoId,
    TipoOperacaoBloqueada.CERTIFICADOS
  );

  if (bloqueio.bloqueado) {
    // Registrar tentativa bloqueada
    await registrarTentativaBloqueada(
      usuarioId,
      instituicaoId,
      alunoId,
      TipoOperacaoBloqueada.CERTIFICADOS,
      bloqueio.motivo || 'Situação financeira irregular'
    );
    
    throw new AppError(bloqueio.motivo || 'Certificado bloqueado devido a situação financeira irregular', 403);
  }

  // BLOQUEIO ACADÊMICO INSTITUCIONAL: Validar curso/classe do aluno
  if (tipoAcademico !== undefined && tipoAcademico !== null) {
    await validarBloqueioAcademicoInstitucionalOuErro(
      alunoId,
      instituicaoId,
      tipoAcademico
    );
  }

  // 2. Verificar situação acadêmica (conclusão do curso)
  const whereConclusao: any = {
    alunoId,
    instituicaoId,
    status: 'CONCLUIDO'
  };

  if (cursoId) {
    whereConclusao.cursoId = cursoId;
  } else if (classeId) {
    whereConclusao.classeId = classeId;
  }

  const conclusao = await prisma.conclusaoCurso.findFirst({
    where: whereConclusao,
    include: {
      curso: {
        select: {
          id: true,
          nome: true,
          grau: true,
          cargaHoraria: true
        }
      },
      classe: {
        select: {
          id: true,
          nome: true,
          cargaHoraria: true
        }
      }
    }
  });

  if (!conclusao) {
    throw new AppError('Curso/classe não concluído. O aluno deve ter concluído o curso/classe para emitir certificado', 400);
  }

  // 3. Buscar dados do aluno
  const aluno = await prisma.user.findFirst({
    where: {
      id: alunoId,
      instituicaoId
    },
    select: {
      id: true,
      nomeCompleto: true,
      numeroIdentificacao: true,
      dataNascimento: true
    }
  });

  if (!aluno) {
    throw new AppError('Aluno não encontrado ou não pertence à sua instituição', 404);
  }

  // 4. Buscar dados da instituição
  const instituicao = await prisma.instituicao.findUnique({
    where: {
      id: instituicaoId
    },
    select: {
      id: true,
      nome: true,
      tipoAcademico: true
    }
  });

  if (!instituicao) {
    throw new AppError('Instituição não encontrada', 404);
  }

  // 5. Gerar código de verificação único
  const codigoVerificacao = `${instituicaoId.substring(0, 4)}-${alunoId.substring(0, 4)}-${Date.now().toString(36).toUpperCase()}`;
  const urlVerificacao = `${process.env.FRONTEND_URL || 'https://dsicola.com'}/verificar-certificado/${codigoVerificacao}`;

  // 6. Verificar assinatura digital (se aplicável)
  const assinaturaDigital = await prisma.assinatura.findFirst({
    where: {
      instituicaoId
    }
  });

  // Determinar curso/classe para o certificado
  const cursoCertificado = conclusao.curso || (conclusao.classe ? {
    id: conclusao.classe.id,
    nome: conclusao.classe.nome,
    grau: null,
    cargaHoraria: conclusao.classe.cargaHoraria || 0
  } : null);

  if (!cursoCertificado) {
    throw new AppError('Curso ou classe não encontrado na conclusão', 404);
  }

  // Registrar auditoria
  await AuditService.log(null, {
    modulo: ModuloAuditoria.RELATORIOS_OFICIAIS,
    entidade: EntidadeAuditoria.CERTIFICADO,
    acao: AcaoAuditoria.GENERATE_REPORT,
    entidadeId: alunoId,
    instituicaoId,
    dadosNovos: {
      tipoRelatorio: 'CERTIFICADO',
      alunoId,
      cursoId: cursoId || null,
      classeId: classeId || null,
      codigoVerificacao,
      situacaoRegular: {
        academica: true,
        financeira: bloqueio.situacaoFinanceira?.situacaoRegular || false
      }
    },
    observacao: `Certificado gerado para aluno ${alunoId}, curso/classe ${cursoId || classeId}`
  });

  return {
    aluno: {
      id: aluno.id,
      nomeCompleto: aluno.nomeCompleto,
      numeroIdentificacao: aluno.numeroIdentificacao || null,
      dataNascimento: aluno.dataNascimento || null,
    },
    curso: {
      id: cursoCertificado.id,
      nome: cursoCertificado.nome,
      grau: cursoCertificado.grau || null,
      cargaHorariaTotal: cursoCertificado.cargaHoraria || 0,
    },
    conclusao: {
      dataConclusao: conclusao.dataConclusao,
      anoLetivo: null, // ConclusaoCurso não tem anoLetivo diretamente
      mediaFinal: conclusao.mediaGeral ? Number(conclusao.mediaGeral) : 0,
    },
    instituicao: {
      id: instituicao.id,
      nome: instituicao.nome,
      tipoAcademico: instituicao.tipoAcademico || null,
    },
    validacao: {
      codigoVerificacao,
      urlVerificacao,
      dataEmissao: new Date(),
      assinadoDigitalmente: !!assinaturaDigital,
    },
    situacaoRegular: {
      academica: true,
      financeira: bloqueio.situacaoFinanceira?.situacaoRegular || false,
    },
    geradoEm: new Date(),
    geradoPor: usuarioId,
  };
}
