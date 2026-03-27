import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { TipoAcademico } from '@prisma/client';
import { calcularFrequenciaAluno } from './frequencia.service.js';
import { calcularSuperior, calcularSecundario } from './calculoNota.service.js';
import { Decimal } from '@prisma/client/runtime/library';
import {
  calcularPautaConclusaoCicloSecundario,
  obterClasseIdsCicloSecundario,
} from './pautaConclusaoCicloSecundario.service.js';

/**
 * Conclusão, pauta de ciclo e certificado exigem estudante na instituição e registo académico:
 * pelo menos uma nota lançada OU linha de histórico (após encerramento do ano).
 */
export async function verificarRegistoAcademicoMinimo(
  alunoId: string,
  instituicaoId: string
): Promise<{ ok: boolean; alunoExiste: boolean; mensagem?: string }> {
  const aluno = await prisma.user.findFirst({
    where: { id: alunoId, instituicaoId },
    select: { id: true },
  });
  if (!aluno) {
    return {
      ok: false,
      alunoExiste: false,
      mensagem: 'Estudante não encontrado nesta instituição.',
    };
  }

  const [hist, nota] = await Promise.all([
    prisma.historicoAcademico.findFirst({
      where: { alunoId, instituicaoId },
      select: { id: true },
    }),
    prisma.nota.findFirst({
      where: {
        alunoId,
        OR: [{ instituicaoId }, { instituicaoId: null }],
      },
      select: { id: true },
    }),
  ]);

  if (!hist && !nota) {
    return {
      ok: false,
      alunoExiste: true,
      mensagem:
        'Não há notas nem histórico académico para este estudante. Lance notas antes de validar conclusão ou emitir documentos. A pauta de conclusão do ciclo também depende de histórico gerado após o encerramento do ano letivo.',
    };
  }

  return { ok: true, alunoExiste: true };
}

/**
 * Interface para resultado de validação de requisitos
 */
export interface ValidacaoRequisitos {
  valido: boolean;
  erros: string[];
  avisos: string[];
  checklist: {
    disciplinasObrigatorias: {
      total: number;
      concluidas: number;
      pendentes: string[];
    };
    cargaHoraria: {
      exigida: number;
      cumprida: number;
      percentual: number;
    };
    frequencia: {
      media: number;
      minima: number;
      aprovado: boolean;
    };
    anoLetivoEncerrado: boolean;
    mediaGeral?: number;
  };
}

/**
 * Validar requisitos para conclusão de curso
 * 
 * REGRAS ABSOLUTAS (institucional):
 * - NÃO permitir conclusão manual sem validação
 * - NÃO confiar no frontend
 * - Todas as verificações devem ocorrer no backend
 * - Usar tipoAcademico do JWT (req.user.tipoAcademico) para decidir regras
 * - Retornar mensagens claras e institucionais
 * 
 * @param alunoId - ID do Aluno
 * @param cursoId - ID do Curso (Ensino Superior) ou null
 * @param classeId - ID da Classe (Ensino Secundário) ou null
 * @param instituicaoId - ID da Instituição (multi-tenant)
 * @param tipoAcademico - Tipo acadêmico da instituição (vem do JWT - req.user.tipoAcademico)
 * @returns Promise<ValidacaoRequisitos>
 */
export async function validarRequisitosConclusao(
  alunoId: string,
  cursoId: string | null,
  classeId: string | null,
  instituicaoId: string,
  tipoAcademico: 'SUPERIOR' | 'SECUNDARIO' | null
): Promise<ValidacaoRequisitos> {
  // Validar que pelo menos um (cursoId ou classeId) foi fornecido
  if (!cursoId && !classeId) {
    throw new AppError('Curso ou Classe é obrigatório para validação de conclusão', 400);
  }

  // CRÍTICO: tipoAcademico deve vir do JWT (req.user.tipoAcademico)
  // Se não fornecido, buscar da instituição (fallback, mas não ideal)
  let tipoAcademicoFinal = tipoAcademico;
  if (!tipoAcademicoFinal) {
    const instituicao = await prisma.instituicao.findUnique({
      where: { id: instituicaoId },
      select: { tipoAcademico: true },
    });

    if (!instituicao) {
      throw new AppError('Instituição não encontrada', 404);
    }

    tipoAcademicoFinal = instituicao.tipoAcademico;
  }

  // CRÍTICO: Validar tipo de instituição e campos permitidos
  // ENSINO SUPERIOR: NUNCA permitir classeId
  if (tipoAcademicoFinal === 'SUPERIOR') {
    if (classeId) {
      throw new AppError('Campo "classeId" não é válido para Ensino Superior. Use "cursoId".', 400);
    }
    if (!cursoId) {
      throw new AppError('cursoId é obrigatório para Ensino Superior', 400);
    }
  }

  // ENSINO SECUNDÁRIO: cursoId é OPCIONAL, classeId é OBRIGATÓRIO
  if (tipoAcademicoFinal === 'SECUNDARIO') {
    // REGRA: Curso é OPCIONAL no Ensino Secundário (pode ser fornecido ou não)
    // REGRA: Classe é OBRIGATÓRIA no Ensino Secundário
    if (!classeId) {
      throw new AppError('classeId é obrigatório para Ensino Secundário', 400);
    }
    // cursoId é aceito quando fornecido (opcional) - não rejeitar
  }

  const erros: string[] = [];
  const avisos: string[] = [];

  const regAcadem = await verificarRegistoAcademicoMinimo(alunoId, instituicaoId);
  if (!regAcadem.alunoExiste) {
    erros.push(regAcadem.mensagem ?? 'Estudante não encontrado nesta instituição.');
  } else if (!regAcadem.ok) {
    erros.push(regAcadem.mensagem ?? 'Sem registo académico mínimo (notas ou histórico).');
  }

  // ============================================================================
  // VALIDAÇÃO 1: MATRÍCULA ANUAL VÁLIDA
  // ============================================================================
  const matriculaAnual = await prisma.matriculaAnual.findFirst({
    where: {
      alunoId,
      instituicaoId,
      status: 'ATIVA',
      ...(cursoId ? { cursoId } : {}),
      ...(classeId ? { classeId } : {}),
    },
    select: {
      id: true,
      status: true,
      cursoId: true,
      classeId: true,
      anoLetivoId: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  if (!matriculaAnual) {
    erros.push('Aluno não possui matrícula anual válida e ativa para este curso/classe');
  } else {
    // Validar que matrícula tem curso/classe correto conforme tipo acadêmico
    if (tipoAcademicoFinal === 'SUPERIOR' && !matriculaAnual.cursoId) {
      erros.push('Matrícula anual não possui curso definido (obrigatório para Ensino Superior)');
    }
    if (tipoAcademicoFinal === 'SECUNDARIO' && !matriculaAnual.classeId) {
      erros.push('Matrícula anual não possui classe definida (obrigatório para Ensino Secundário)');
    }
  }

  // ============================================================================
  // VALIDAÇÃO 2: BLOQUEIO ACADÊMICO
  // ============================================================================
  // Verificar se aluno tem bloqueio acadêmico (situação financeira, etc.)
  try {
    const { validarBloqueioAcademicoInstitucional } = await import('./bloqueioAcademico.service.js');
    const bloqueio = await validarBloqueioAcademicoInstitucional(
      alunoId,
      instituicaoId,
      tipoAcademicoFinal,
      undefined, // disciplinaId (opcional)
      matriculaAnual?.anoLetivoId || undefined
    );

    if (bloqueio.bloqueado && bloqueio.motivo) {
      erros.push(`Bloqueio acadêmico: ${bloqueio.motivo}`);
    }
  } catch (error: any) {
    // Se erro for de bloqueio, adicionar aos erros
    if (error.message && error.message.includes('bloqueado')) {
      erros.push(error.message);
    } else {
      // Outros erros: apenas aviso (não bloquear conclusão por erro técnico)
      console.warn('[ConclusaoCurso] Erro ao verificar bloqueio acadêmico:', error);
      avisos.push('Não foi possível verificar bloqueios acadêmicos. Verifique manualmente.');
    }
  }

  // Buscar curso ou classe
  let curso: any = null;
  let classe: any = null;

  if (cursoId) {
    // CRÍTICO: Filtrar por instituicaoId para garantir multi-tenant
    curso = await prisma.curso.findFirst({
      where: { id: cursoId, instituicaoId },
      include: {
        disciplinas: {
          where: { 
            obrigatoria: true,
            instituicaoId, // CRÍTICO: Multi-tenant - garantir que disciplinas pertencem à instituição
          },
          select: {
            id: true,
            nome: true,
            cargaHoraria: true,
          },
        },
      },
    });

    if (!curso) {
      throw new AppError('Curso não encontrado', 404);
    }
  }

  if (classeId) {
    // CRÍTICO: Filtrar por instituicaoId para garantir multi-tenant
    // Classe não tem relação direta com disciplinas - buscar disciplinas da instituição
    classe = await prisma.classe.findFirst({
      where: { id: classeId, instituicaoId },
    });

    if (!classe) {
      throw new AppError('Classe não encontrada', 404);
    }
    // Buscar disciplinas da instituição para Ensino Secundário (Classe não tem relação disciplinas)
    (classe as any).disciplinas = await prisma.disciplina.findMany({
      where: { instituicaoId, ativa: true },
      select: { id: true, nome: true, cargaHoraria: true },
    });
  }

  // Ensino Secundário: histórico do ciclo (10–12 ou configurado), não só da classe final
  let cicloClasseIdsSec: string[] = [];
  if (tipoAcademicoFinal === 'SECUNDARIO' && classeId) {
    cicloClasseIdsSec = await obterClasseIdsCicloSecundario(instituicaoId);
  }

  // Buscar histórico acadêmico do aluno
  // IMPORTANTE: Histórico acadêmico só existe após encerramento de ano letivo
  // Se não houver histórico, buscar dados de AlunoDisciplina e Notas
  let historicoAcademico = await prisma.historicoAcademico.findMany({
    where: {
      alunoId,
      instituicaoId,
      ...(cursoId ? { cursoId } : {}),
      ...(tipoAcademicoFinal === 'SECUNDARIO'
        ? cicloClasseIdsSec.length > 0
          ? { classeId: { in: cicloClasseIdsSec } }
          : classeId
            ? { classeId }
            : {}
        : classeId
          ? { classeId }
          : {}),
    },
    include: {
      disciplina: {
        select: {
          id: true,
          nome: true,
          cargaHoraria: true,
          obrigatoria: true,
        },
      },
    },
  });

  // Se não houver histórico consolidado, usar dados atuais (AlunoDisciplina + Notas)
  // Isso permite validar requisitos mesmo antes do encerramento do ano letivo
  if (historicoAcademico.length === 0) {
    // Buscar disciplinas do aluno via AlunoDisciplina
    // CRÍTICO: Filtrar por instituicaoId para garantir multi-tenant
    const alunoDisciplinas = await prisma.alunoDisciplina.findMany({
      where: {
        alunoId,
        disciplina: {
          instituicaoId, // CRÍTICO: Multi-tenant
          ...(cursoId ? { cursoDisciplinas: { some: { cursoId } } } : {}),
        },
      },
      include: {
        disciplina: {
          select: {
            id: true,
            nome: true,
            cargaHoraria: true,
            obrigatoria: true,
          },
        },
      },
    });

    // Buscar notas para calcular médias
    const planosEnsino = await prisma.planoEnsino.findMany({
      where: {
        instituicaoId,
        ...(cursoId ? { cursoId } : {}),
        ...(tipoAcademicoFinal === 'SECUNDARIO' && cicloClasseIdsSec.length > 0
          ? { classeId: { in: cicloClasseIdsSec } }
          : classeId
            ? { classeId }
            : {}),
        disciplinaId: { in: alunoDisciplinas.map((ad) => ad.disciplinaId) },
      },
      select: {
        id: true,
        disciplinaId: true,
      },
    });

    const notas = await prisma.nota.findMany({
      where: {
        alunoId,
        instituicaoId,
        planoEnsinoId: { in: planosEnsino.map((p) => p.id) },
      },
      include: {
        planoEnsino: {
          include: {
            disciplina: {
              select: {
                id: true,
                nome: true,
                cargaHoraria: true,
                obrigatoria: true,
              },
            },
          },
        },
      },
    });

    // Criar estrutura similar ao histórico acadêmico para validação
    // Nota: Esta é uma aproximação - o histórico consolidado é mais preciso
    historicoAcademico = alunoDisciplinas.map((ad) => {
      const disciplinaNotas = notas.filter(
        (n) => n.planoEnsino.disciplinaId === ad.disciplinaId
      );
      const medias = disciplinaNotas.map((n) => Number(n.valor)).filter((m) => !isNaN(m) && m > 0);
      const mediaFinal = medias.length > 0 ? medias.reduce((sum, m) => sum + m, 0) / medias.length : 0;

      return {
        disciplinaId: ad.disciplinaId,
        disciplina: ad.disciplina,
        cargaHoraria: ad.disciplina.cargaHoraria,
        situacaoAcademica: mediaFinal >= 10 ? 'APROVADO' : 'REPROVADO',
        percentualFrequencia: 100, // Aproximação - frequência real vem do histórico
        mediaFinal: mediaFinal,
      } as any;
    });
  }

  let pautaCiclo: Awaited<ReturnType<typeof calcularPautaConclusaoCicloSecundario>> | null = null;
  if (tipoAcademicoFinal === 'SECUNDARIO' && classeId) {
    try {
      pautaCiclo = await calcularPautaConclusaoCicloSecundario({
        alunoId,
        instituicaoId,
        tipoAcademico: 'SECUNDARIO',
      });
      for (const a of pautaCiclo.avisos) {
        if (!avisos.includes(a)) avisos.push(a);
      }
    } catch (e) {
      console.warn('[ConclusaoCurso] Pauta ciclo secundário:', e);
    }
  }

  // Buscar disciplinas obrigatórias
  const disciplinasObrigatorias = curso
    ? curso.disciplinas.filter((d: any) => d.obrigatoria !== false)
    : classe
    ? classe.disciplinas.filter((d: any) => d.obrigatoria !== false)
    : [];

  // Verificar quais disciplinas obrigatórias foram concluídas (APROVADO)
  const disciplinasConcluidas = historicoAcademico.filter(
    (h) => h.situacaoAcademica === 'APROVADO'
  );

  const disciplinasConcluidasIds = new Set(disciplinasConcluidas.map((h) => h.disciplinaId));
  let disciplinasPendentes = disciplinasObrigatorias.filter(
    (d: any) => !disciplinasConcluidasIds.has(d.id)
  );

  if (tipoAcademicoFinal === 'SECUNDARIO' && pautaCiclo && disciplinasObrigatorias.length > 0) {
    const okIds = new Set(
      pautaCiclo.disciplinas.filter((d) => d.aprovadoDisciplina).map((d) => d.disciplinaId),
    );
    disciplinasPendentes = disciplinasObrigatorias.filter((d: any) => !okIds.has(d.id));
  }

  // Validar disciplinas obrigatórias
  if (disciplinasPendentes.length > 0) {
    erros.push(
      `Faltam ${disciplinasPendentes.length} disciplina(s) obrigatória(s): ${disciplinasPendentes.map((d: any) => d.nome).join(', ')}`
    );
  }

  // Calcular carga horária
  const cargaHorariaExigida = curso ? curso.cargaHoraria : classe ? classe.cargaHoraria : 0;
  let cargaHorariaCumprida = disciplinasConcluidas.reduce((sum, h) => sum + h.cargaHoraria, 0);
  if (tipoAcademicoFinal === 'SECUNDARIO' && pautaCiclo) {
    const chMap = new Map<string, number>();
    for (const h of historicoAcademico) {
      if (h.situacaoAcademica !== 'APROVADO') continue;
      const sid = h.disciplinaId;
      chMap.set(sid, Math.max(chMap.get(sid) ?? 0, Number(h.cargaHoraria) || 0));
    }
    cargaHorariaCumprida = [...chMap.values()].reduce((sum, ch) => sum + ch, 0);
  }
  const percentualCargaHoraria =
    cargaHorariaExigida > 0 ? (cargaHorariaCumprida / cargaHorariaExigida) * 100 : 0;

  // Validar carga horária mínima (deve ser >= 100% para conclusão)
  if (percentualCargaHoraria < 100) {
    erros.push(
      `Carga horária insuficiente: ${cargaHorariaCumprida}h de ${cargaHorariaExigida}h exigidas (${percentualCargaHoraria.toFixed(2)}%)`
    );
  }

  // Calcular frequência média
  const frequencias = historicoAcademico.map((h) => h.percentualFrequencia);
  const frequenciaMedia =
    frequencias.length > 0
      ? frequencias.reduce((sum, f) => sum + Number(f), 0) / frequencias.length
      : 0;

  const frequenciaMinima = 75; // Configurável no futuro
  const frequenciaAprovada = frequenciaMedia >= frequenciaMinima;

  if (!frequenciaAprovada) {
    erros.push(
      `Frequência média insuficiente: ${frequenciaMedia.toFixed(2)}% (mínimo: ${frequenciaMinima}%)`
    );
  }

  // Calcular média geral (secundário: média do ciclo por disciplina — alinhado à pauta de conclusão)
  let mediaGeral: number | null = null;
  if (tipoAcademicoFinal === 'SECUNDARIO' && pautaCiclo?.mediaFinalCurso != null) {
    mediaGeral = pautaCiclo.mediaFinalCurso;
  } else {
    const medias = historicoAcademico
      .map((h) => Number(h.mediaFinal))
      .filter((m) => !isNaN(m) && m > 0);
    mediaGeral =
      medias.length > 0 ? medias.reduce((sum, m) => sum + m, 0) / medias.length : null;
  }

  // Validar ano letivo encerrado
  // Buscar anos letivos relacionados ao histórico
  const anosLetivosIds = historicoAcademico
    .map((h: any) => h.anoLetivoId)
    .filter((id: string | undefined) => id !== undefined && id !== null);

  let todosAnosEncerrados = true;

  if (anosLetivosIds.length > 0) {
    const anosLetivos = await prisma.anoLetivo.findMany({
      where: {
        id: { in: anosLetivosIds },
        instituicaoId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    todosAnosEncerrados = anosLetivos.every((a) => a.status === 'ENCERRADO');
  } else {
    // Se não houver histórico consolidado, verificar se há ano letivo ativo
    // Aviso: conclusão idealmente deve ser feita após encerramento
    avisos.push(
      'Histórico acadêmico consolidado não encontrado. Recomenda-se encerrar o ano letivo antes da conclusão.'
    );
  }

  if (anosLetivosIds.length > 0 && !todosAnosEncerrados) {
    erros.push('Todos os anos letivos relacionados devem estar encerrados');
  }

  // ============================================================================
  // VALIDAÇÕES ESPECÍFICAS POR TIPO DE INSTITUIÇÃO
  // REGRAS ABSOLUTAS institucional
  // ============================================================================
  if (tipoAcademicoFinal === 'SUPERIOR') {
    // ========================================================================
    // ENSINO SUPERIOR: Validações específicas
    // ========================================================================
    
    // 1. Verificar se aluno possui curso definido
    if (!cursoId) {
      erros.push('Ensino Superior requer curso definido. Aluno não possui curso vinculado.');
    }

    // 2. Verificar se matrícula anual tem curso
    if (matriculaAnual && !matriculaAnual.cursoId) {
      erros.push('Matrícula anual não possui curso definido (obrigatório para Ensino Superior)');
    }

    // 3. Verificar se todos os semestres foram concluídos
    if (cursoId && matriculaAnual?.anoLetivoId) {
      const anoLetivo = await prisma.anoLetivo.findUnique({
        where: { id: matriculaAnual.anoLetivoId },
        select: { ano: true },
      });

      if (anoLetivo) {
        const semestres = await prisma.semestre.findMany({
          where: {
            instituicaoId,
            anoLetivo: anoLetivo.ano,
          },
          select: {
            id: true,
            numero: true,
          },
        });

        if (semestres.length > 0) {
          // Verificar se todos os semestres têm encerramento acadêmico
          const encerramentos = await prisma.encerramentoAcademico.findMany({
            where: {
              instituicaoId,
              anoLetivo: anoLetivo.ano,
              status: 'ENCERRADO',
              periodo: {
                in: semestres.map((s) => `SEMESTRE_${s.numero}` as any),
              },
            },
            select: {
              periodo: true,
            },
          });

          const semestresEncerrados = encerramentos.length;
          if (semestresEncerrados < semestres.length) {
            erros.push(
              `Nem todos os semestres foram concluídos: ${semestresEncerrados} de ${semestres.length} semestres encerrados`
            );
          }
        } else {
          avisos.push('Nenhum semestre cadastrado para este ano letivo. Verifique se o curso possui semestres configurados.');
        }
      }
    }

    // 4. Mensagem de erro específica para Ensino Superior (conforme requisito)
    if (disciplinasPendentes.length > 0) {
      erros.push('Aluno não cumpre todos os requisitos da matriz curricular.');
    }
  } else if (tipoAcademicoFinal === 'SECUNDARIO') {
    // ========================================================================
    // ENSINO SECUNDÁRIO: Validações específicas
    // ========================================================================
    
    // 1. Verificar se aluno possui classe definida
    if (!classeId) {
      erros.push('Ensino Secundário requer classe definida. Aluno não possui classe vinculada.');
    }

    // 2. Verificar se matrícula anual tem classe
    if (matriculaAnual && !matriculaAnual.classeId) {
      erros.push('Matrícula anual não possui classe definida (obrigatório para Ensino Secundário)');
    }

    // 3. Verificar se aluno concluiu a classe final do ciclo
    if (classeId) {
      const classe = await prisma.classe.findUnique({
        where: { id: classeId, instituicaoId },
        select: {
          id: true,
          nome: true,
          codigo: true,
        },
      });

      if (!classe) {
        erros.push('Classe não encontrada ou não pertence à instituição');
      }
    }

    // 4. Mensagem de erro específica para Ensino Secundário (conforme requisito)
    // REGRA: Mensagem institucional clara conforme padrão institucional
    if (disciplinasPendentes.length > 0) {
      erros.push('Aluno não concluiu todas as classes obrigatórias.');
    }
  }

  const valido = erros.length === 0;

  const concluidasCountSec =
    tipoAcademicoFinal === 'SECUNDARIO' && pautaCiclo
      ? pautaCiclo.disciplinas.filter((d) => d.aprovadoDisciplina).length
      : disciplinasConcluidas.length;

  return {
    valido,
    erros,
    avisos,
    checklist: {
      disciplinasObrigatorias: {
        total: disciplinasObrigatorias.length,
        concluidas:
          disciplinasObrigatorias.length > 0
            ? disciplinasObrigatorias.length - disciplinasPendentes.length
            : concluidasCountSec,
        pendentes: disciplinasPendentes.map((d: any) => d.nome),
      },
      cargaHoraria: {
        exigida: cargaHorariaExigida,
        cumprida: cargaHorariaCumprida,
        percentual: percentualCargaHoraria,
      },
      frequencia: {
        media: frequenciaMedia,
        minima: frequenciaMinima,
        aprovado: frequenciaAprovada,
      },
      anoLetivoEncerrado: todosAnosEncerrados,
      mediaGeral: mediaGeral || undefined,
    },
  };
}

/**
 * Verificar se aluno tem curso/classe concluído
 * REGRA institucional: Após conclusão, histórico acadêmico é IMUTÁVEL
 * 
 * @param alunoId - ID do Aluno
 * @param cursoId - ID do Curso (opcional, para Ensino Superior)
 * @param classeId - ID da Classe (opcional, para Ensino Secundário)
 * @param instituicaoId - ID da Instituição (multi-tenant)
 * @returns Promise<{ concluido: boolean, conclusao?: any }>
 */
export async function verificarAlunoConcluido(
  alunoId: string,
  cursoId: string | null,
  classeId: string | null,
  instituicaoId: string
): Promise<{ concluido: boolean; conclusao?: any }> {
  const where: any = {
    instituicaoId,
    alunoId,
    status: 'CONCLUIDO',
  };

  if (cursoId) {
    where.cursoId = cursoId;
  } else if (classeId) {
    where.classeId = classeId;
  }

  const conclusao = await prisma.conclusaoCurso.findFirst({
    where,
    include: {
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
    },
  });

  return {
    concluido: !!conclusao,
    conclusao: conclusao || undefined,
  };
}

