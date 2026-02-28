import prisma from '../lib/prisma.js';
import { TipoAcademico } from '@prisma/client';
import { AppError } from '../middlewares/errorHandler.js';

/**
 * Interface para dados de entrada do cálculo
 */
export interface DadosCalculoNota {
  alunoId: string;
  planoEnsinoId?: string; // OBRIGATÓRIO: Cálculo baseado em Plano de Ensino (se não fornecido, pode ser derivado de avaliacaoId)
  disciplinaId?: string;
  turmaId?: string;
  professorId?: string; // CRÍTICO: Garantir que média use apenas notas do professor correto (professores.id)
  avaliacaoId?: string;
  anoLetivoId?: string;
  anoLetivo?: number;
  semestreId?: string;
  trimestreId?: string;
  trimestre?: number;
  instituicaoId: string;
  tipoAcademico?: 'SUPERIOR' | 'SECUNDARIO' | null; // Tipo acadêmico da instituição (vem do JWT, não buscar no banco)
}

/**
 * Interface para notas individuais
 */
export interface NotaIndividual {
  tipo: string; // P1, P2, P3, Trabalho, Recurso, 1º Trimestre, etc.
  valor: number | null; // null = sem nota lançada (ex.: trimestre vazio no boletim)
  peso?: number;
  avaliacaoId?: string;
}

/**
 * Interface para resultado do cálculo
 */
export interface ResultadoCalculo {
  media_parcial?: number;
  media_final: number;
  media_trimestral?: { [trimestre: number]: number };
  media_anual?: number;
  status: 'APROVADO' | 'REPROVADO' | 'EXAME_RECURSO' | 'REPROVADO_FALTA';
  detalhes_calculo: {
    notas_utilizadas: NotaIndividual[];
    formula_aplicada: string;
    observacoes?: string[];
  };
}

/**
 * Obter tipo acadêmico da instituição
 */
async function obterTipoAcademico(instituicaoId: string): Promise<TipoAcademico | null> {
  const instituicao = await prisma.instituicao.findUnique({
    where: { id: instituicaoId },
    select: { tipoAcademico: true }
  });

  return instituicao?.tipoAcademico || null;
}

/**
 * Buscar todas as notas do aluno para um Plano de Ensino
 * REGRA MESTRA: Cálculo baseado em Plano de Ensino
 */
async function buscarNotasAluno(dados: DadosCalculoNota): Promise<NotaIndividual[]> {
  const where: any = {
    alunoId: dados.alunoId,
    // Incluir notas com instituicaoId = contexto OU null (notas já gravadas sem tenant passam a aparecer)
    ...(dados.instituicaoId != null
      ? { OR: [{ instituicaoId: dados.instituicaoId }, { instituicaoId: null }] }
      : {}),
    // CRÍTICO: Notas do professor do plano OU legacy (professorId null) - para boletim do estudante ver todas as notas da disciplina
    ...(dados.professorId && {
      OR: [{ professorId: dados.professorId }, { professorId: null }],
    }),
    ...(dados.disciplinaId && { disciplinaId: dados.disciplinaId }),
    ...(dados.turmaId && { turmaId: dados.turmaId }),
  };

  // PRIORIDADE 1: Se tiver planoEnsinoId, filtrar diretamente por ele
  if (dados.planoEnsinoId) {
    where.planoEnsinoId = dados.planoEnsinoId;
  }
  // PRIORIDADE 2: Se tiver avaliacaoId, obter planoEnsinoId da avaliação
  else if (dados.avaliacaoId) {
    const avaliacao = await prisma.avaliacao.findFirst({
      where: {
        id: dados.avaliacaoId,
        instituicaoId: dados.instituicaoId,
      },
    });

    // Acessar planoEnsinoId usando type assertion
    const planoEnsinoId = (avaliacao as any)?.planoEnsinoId;
    if (planoEnsinoId) {
      where.planoEnsinoId = planoEnsinoId;
    } else {
      // Se não encontrou avaliação ou ela não tem planoEnsinoId, usar avaliacaoId diretamente
      where.avaliacaoId = dados.avaliacaoId;
    }
  }
  // PRIORIDADE 3: Fallback - buscar avaliações por turmaId/semestreId/trimestreId (compatibilidade)
  else {
    const avaliacaoWhere: any = {
      instituicaoId: dados.instituicaoId,
    };

    if (dados.turmaId) {
      avaliacaoWhere.turmaId = dados.turmaId;
    }

    if (dados.semestreId) {
      avaliacaoWhere.semestreId = dados.semestreId;
    }

    if (dados.trimestreId) {
      avaliacaoWhere.trimestreId = dados.trimestreId;
    }

    if (dados.trimestre) {
      avaliacaoWhere.trimestre = dados.trimestre;
    }

    const avaliacoes = await prisma.avaliacao.findMany({
      where: avaliacaoWhere,
    });

    if (avaliacoes.length > 0) {
      // Agrupar por planoEnsinoId se houver
      const planoEnsinoIds = avaliacoes.map(a => (a as any).planoEnsinoId).filter(Boolean) as string[];
      if (planoEnsinoIds.length > 0) {
        where.planoEnsinoId = { in: planoEnsinoIds };
      } else {
        // Se não há planoEnsinoId, usar avaliacaoId (fallback para compatibilidade)
        where.avaliacaoId = { in: avaliacoes.map(a => a.id) };
      }
    } else {
      // Se não há avaliações, retornar array vazio
      return [];
    }
  }

  const notas = await prisma.nota.findMany({
    where,
    include: {
      avaliacao: {
        select: {
          id: true,
          tipo: true,
          peso: true,
          trimestre: true,
          semestreId: true,
          trimestreId: true,
          data: true,
        }
      },
      exame: {
        select: {
          id: true,
          tipo: true,
          nome: true,
          dataExame: true,
        }
      }
    },
    orderBy: { createdAt: 'asc' },
  });

  return notas.map(nota => {
    const tipo = nota.avaliacao?.tipo || nota.exame?.tipo || nota.exame?.nome || 'PROVA';
    return {
      tipo,
      valor: nota.valor != null ? Number(nota.valor) : null,
      peso: nota.avaliacao?.peso ? Number(nota.avaliacao.peso) : 1,
      avaliacaoId: nota.avaliacaoId || undefined,
    };
  });
}

/**
 * Calcular média para ENSINO SUPERIOR
 * 
 * REGRAS:
 * - P1, P2, P3 (opcional), Trabalho (opcional), Recurso (opcional)
 * - Média Parcial (MP):
 *   - Sem Trabalho: MP = (P1 + P2 + P3) / quantidade
 *   - Com Trabalho: MP = (Média das Provas × 0.8) + (Trabalho × 0.2)
 * - Status após MP:
 *   - MP ≥ 10 → APROVADO
 *   - MP ≥ 7 e < 10 → EXAME_RECURSO
 *   - MP < 7 → REPROVADO
 * - Média Final (MF):
 *   - Com Recurso: MF = (MP + Recurso) / 2
 *   - Sem Recurso: MF = MP
 * - Status Final:
 *   - MF ≥ 10 → APROVADO
 *   - MF < 10 → REPROVADO
 */
export async function calcularSuperior(
  notas: NotaIndividual[],
  percentualMinimoAprovacao: number = 10,
  tipoMedia: string = 'simples',
  permitirExameRecurso: boolean = false
): Promise<ResultadoCalculo> {
  const observacoes: string[] = [];
  
  // Buscar avaliações para ordenar por data e identificar P1, P2, P3
  const avaliacaoIds = notas.map(n => n.avaliacaoId).filter(Boolean) as string[];
  const avaliacoes = await prisma.avaliacao.findMany({
    where: {
      id: { in: avaliacaoIds },
    },
    select: {
      id: true,
      tipo: true,
      data: true,
      nome: true,
    },
    orderBy: {
      data: 'asc',
    },
  });

  // Separar notas por tipo, ordenadas por data da avaliação
  // P1, P2, P3 são identificadas pela ordem (primeira, segunda, terceira prova por data)
  const provasNotas = notas.filter(n => n.tipo === 'PROVA');
  
  // Ordenar provas por data da avaliação
  const provas = provasNotas
    .map(nota => {
      const avaliacao = avaliacoes.find(av => av.id === nota.avaliacaoId);
      return { nota, avaliacao, data: avaliacao?.data || new Date(0) };
    })
    .sort((a, b) => a.data.getTime() - b.data.getTime())
    .map((item, index) => {
      // Identificar P1, P2, P3 pela ordem ou pelo nome da avaliação
      const nomeAvaliacao = item.avaliacao?.nome?.toUpperCase() || '';
      let identificacao = '';
      
      // Tentar identificar pelo nome (ex: "P1", "1ª Prova", "Prova 1")
      if (nomeAvaliacao.includes('P1') || nomeAvaliacao.includes('1ª') || nomeAvaliacao.includes('1º') || nomeAvaliacao.match(/PROVA\s*1/i)) {
        identificacao = 'P1';
      } else if (nomeAvaliacao.includes('P2') || nomeAvaliacao.includes('2ª') || nomeAvaliacao.includes('2º') || nomeAvaliacao.match(/PROVA\s*2/i)) {
        identificacao = 'P2';
      } else if (nomeAvaliacao.includes('P3') || nomeAvaliacao.includes('3ª') || nomeAvaliacao.includes('3º') || nomeAvaliacao.match(/PROVA\s*3/i)) {
        identificacao = 'P3';
      } else {
        // Se não identificou pelo nome, usar ordem: primeira = P1, segunda = P2, terceira = P3
        identificacao = index === 0 ? 'P1' : index === 1 ? 'P2' : index === 2 ? 'P3' : `P${index + 1}`;
      }
      
      return { ...item.nota, identificacao };
    });
  
  const trabalhos = notas.filter(n => n.tipo === 'TRABALHO');
  const recursos = notas.filter(n => n.tipo === 'RECUPERACAO' || n.tipo === 'PROVA_FINAL');

  // Se não há provas, retornar resultado com status apropriado (não erro)
  // Sempre incluir P1, P2 e Exame (com valor null) para o boletim carregar os três campos
  if (provas.length === 0) {
    const outrasNotas = [
      ...trabalhos.map((t) => ({ ...t, tipo: 'Trabalho' as string })),
      ...recursos.map((r) => ({ ...r, tipo: 'Exame de Recurso' as string })),
    ];
    const notasParaFrontendVazias: NotaIndividual[] = [
      { tipo: 'P1', valor: null },
      { tipo: 'P2', valor: null },
      { tipo: 'Exame de Recurso', valor: recursos[0]?.valor ?? null },
      ...trabalhos.map((t) => ({ ...t, tipo: 'Trabalho' as string })),
      ...recursos.slice(1).map((r) => ({ ...r, tipo: 'Exame de Recurso' as string })),
    ];
    return {
      media_parcial: 0,
      media_final: 0,
      status: 'REPROVADO',
      detalhes_calculo: {
        notas_utilizadas: notasParaFrontendVazias,
        formula_aplicada: 'Aguardando lançamento de provas',
        observacoes: ['É necessário pelo menos uma prova (P1) para calcular a média no Ensino Superior.'],
      },
    };
  }

  // Calcular média das provas
  let mediaProvas = 0;
  if (provas.length > 0) {
    const somaProvas = provas.reduce((acc, n) => acc + (n.valor ?? 0), 0);
    mediaProvas = somaProvas / provas.length;
  }

  // Calcular Média Parcial (MP)
  let mediaParcial = 0;
  let formulaMP = '';

  if (trabalhos.length > 0) {
    // Com Trabalho: MP = (Média das Provas × 0.8) + (Trabalho × 0.2)
    const trabalho = trabalhos[0]; // Usar o primeiro trabalho
    const vTrabalho = trabalho.valor ?? 0;
    mediaParcial = (mediaProvas * 0.8) + (vTrabalho * 0.2);
    formulaMP = `MP = (Média das Provas × 0.8) + (Trabalho × 0.2) = (${mediaProvas.toFixed(2)} × 0.8) + (${vTrabalho} × 0.2) = ${mediaParcial.toFixed(2)}`;
  } else {
    // Sem Trabalho: MP = Média das Provas
    mediaParcial = mediaProvas;
    formulaMP = `MP = Média das Provas = ${mediaParcial.toFixed(2)}`;
  }

  // Determinar status após Média Parcial (usar percentual mínimo configurado)
  let status: 'APROVADO' | 'REPROVADO' | 'EXAME_RECURSO' = 'REPROVADO';
  if (mediaParcial >= percentualMinimoAprovacao) {
    status = 'APROVADO';
  } else if (mediaParcial >= 7 && mediaParcial < percentualMinimoAprovacao && permitirExameRecurso) {
    status = 'EXAME_RECURSO';
  }

  // Calcular Média Final (MF)
  let mediaFinal = mediaParcial;
  let formulaMF = '';

  if (recursos.length > 0 && status === 'EXAME_RECURSO' && permitirExameRecurso) {
    // Com Recurso: MF = (MP + Recurso) / 2
    const recurso = recursos[0]; // Usar o primeiro recurso
    const vRecurso = recurso.valor ?? 0;
    mediaFinal = (mediaParcial + vRecurso) / 2;
    formulaMF = `MF = (MP + Recurso) / 2 = (${mediaParcial.toFixed(2)} + ${vRecurso}) / 2 = ${mediaFinal.toFixed(2)}`;
    
    // Status final após recurso (usar percentual mínimo configurado)
    if (mediaFinal >= percentualMinimoAprovacao) {
      status = 'APROVADO';
    } else {
      status = 'REPROVADO';
    }
  } else {
    // Sem Recurso: MF = MP
    formulaMF = `MF = MP = ${mediaFinal.toFixed(2)}`;
    
    // Se já estava aprovado, manter; senão, reprovado
    if (status !== 'APROVADO') {
      status = 'REPROVADO';
    }
  }
  
  // Observação se recurso não permitido mas tentado
  if (recursos.length > 0 && !permitirExameRecurso) {
    observacoes.push('Notas de recurso encontradas, mas recurso/exame está desativado para esta instituição.');
  }

  // Observações
  if (provas.length < 2) {
    observacoes.push('Apenas uma prova foi lançada. Recomenda-se lançar P2 para cálculo completo.');
  }
  if (trabalhos.length > 1) {
    observacoes.push('Múltiplos trabalhos encontrados. Apenas o primeiro foi considerado no cálculo.');
  }
  if (recursos.length > 1) {
    observacoes.push('Múltiplos recursos encontrados. Apenas o primeiro foi considerado no cálculo.');
  }

  // Montar notas_utilizadas sempre com P1, P2 e Exame para o boletim carregar os três campos (valor null se não houver)
  const valorP1 = provas[0]?.valor ?? null;
  const valorP2 = provas[1]?.valor ?? null;
  const valorExame = provas[2]?.valor ?? recursos[0]?.valor ?? null;
  const notasParaFrontend: NotaIndividual[] = [
    { tipo: 'P1', valor: valorP1, peso: provas[0]?.peso, avaliacaoId: provas[0]?.avaliacaoId },
    { tipo: 'P2', valor: valorP2, peso: provas[1]?.peso, avaliacaoId: provas[1]?.avaliacaoId },
    { tipo: 'Exame de Recurso', valor: valorExame, peso: recursos[0]?.peso ?? provas[2]?.peso, avaliacaoId: recursos[0]?.avaliacaoId ?? provas[2]?.avaliacaoId },
    ...trabalhos.map((t) => ({ ...t, tipo: 'Trabalho' as string })),
    ...recursos.slice(1).map((r) => ({ ...r, tipo: 'Exame de Recurso' as string })),
  ];

  return {
    media_parcial: Number(mediaParcial.toFixed(2)),
    media_final: Number(mediaFinal.toFixed(2)),
    status,
    detalhes_calculo: {
      notas_utilizadas: notasParaFrontend,
      formula_aplicada: `${formulaMP}; ${formulaMF}`,
      observacoes: observacoes.length > 0 ? observacoes : undefined,
    },
  };
}

/**
 * Calcular média para ENSINO SECUNDÁRIO
 * 
 * REGRAS:
 * - Avaliação Contínua, Provas Trimestrais, Trabalhos (opcional)
 * - Média Trimestral (MT):
 *   - MT = (Avaliação Contínua + Prova Trimestral) / 2
 * - Média Anual (MA):
 *   - MA = (MT1 + MT2 + MT3) / 3
 * - Status Final:
 *   - MA ≥ média_minima (padrão: 10) → APROVADO
 *   - MA < média_minima → REPROVADO
 */
export async function calcularSecundario(
  notas: NotaIndividual[],
  instituicaoId: string,
  trimestre?: number,
  percentualMinimoAprovacao: number = 10,
  tipoMedia: string = 'simples',
  permitirExameRecurso: boolean = false
): Promise<ResultadoCalculo> {
  const observacoes: string[] = [];
  
  // Usar percentual mínimo de aprovação configurado (padrão: 10 = 50% de 20)
  const mediaMinima = percentualMinimoAprovacao;

  // Buscar avaliações para obter trimestres
  const avaliacaoIds = notas.map(n => n.avaliacaoId).filter(Boolean) as string[];
  const avaliacoes = await prisma.avaliacao.findMany({
    where: {
      id: { in: avaliacaoIds },
    },
    select: {
      id: true,
      trimestre: true,
      tipo: true,
    },
  });

  // Se trimestre específico foi solicitado, calcular apenas para esse trimestre
  if (trimestre) {
    const notasTrimestre = notas.filter(n => {
      const avaliacao = avaliacoes.find(a => a.id === n.avaliacaoId);
      return avaliacao && avaliacao.trimestre === trimestre;
    });

    if (notasTrimestre.length === 0) {
      throw new AppError(`Nenhuma nota encontrada para o ${trimestre}º trimestre`, 400);
    }

    // Calcular média trimestral
    // Assumir que há avaliação contínua e prova trimestral
    const avaliacaoContinua = notasTrimestre.find(n => n.tipo === 'TESTE' || n.tipo === 'TRABALHO');
    const provaTrimestral = notasTrimestre.find(n => n.tipo === 'PROVA');

    // Se não há avaliações, retornar resultado com status apropriado (não erro)
    if (!avaliacaoContinua && !provaTrimestral) {
      return {
        media_trimestral: { [trimestre]: 0 },
        media_final: 0,
        status: 'REPROVADO',
        detalhes_calculo: {
          notas_utilizadas: notasTrimestre,
          formula_aplicada: `Aguardando lançamento de avaliações para o ${trimestre}º trimestre`,
          observacoes: [`É necessário pelo menos uma avaliação (Contínua ou Prova) para calcular a média do ${trimestre}º trimestre.`],
        },
      };
    }

    let mediaTrimestral = 0;
    const vCont = avaliacaoContinua?.valor ?? 0;
    const vProva = provaTrimestral?.valor ?? 0;
    if (avaliacaoContinua && provaTrimestral) {
      mediaTrimestral = (vCont + vProva) / 2;
    } else if (avaliacaoContinua) {
      mediaTrimestral = vCont;
      observacoes.push('Apenas avaliação contínua encontrada. Prova trimestral não foi lançada.');
    } else if (provaTrimestral) {
      mediaTrimestral = vProva;
      observacoes.push('Apenas prova trimestral encontrada. Avaliação contínua não foi lançada.');
    }

    const status = mediaTrimestral >= mediaMinima ? 'APROVADO' : 'REPROVADO';

    return {
      media_trimestral: { [trimestre]: Number(mediaTrimestral.toFixed(2)) },
      media_final: Number(mediaTrimestral.toFixed(2)),
      status,
      detalhes_calculo: {
        notas_utilizadas: notasTrimestre,
        formula_aplicada: `MT${trimestre} = (Avaliação Contínua + Prova Trimestral) / 2 = ${mediaTrimestral.toFixed(2)}`,
        observacoes: observacoes.length > 0 ? observacoes : undefined,
      },
    };
  }

  // Calcular média anual (todos os trimestres)
  // Avaliações já foram buscadas acima

  // Extrair trimestre de tipo (ex: "1º Trimestre" -> 1) para notas de exame
  const trimestreFromTipo = (t: string): number | null => {
    const m = (t || '').match(/^([123])[º°o]\s*trimestre/i);
    return m ? parseInt(m[1], 10) : null;
  };

  // Agrupar notas por trimestre (avaliacao.trimestre OU tipo "1º Trimestre" para exames)
  const notasPorTrimestre: { [trimestre: number]: NotaIndividual[] } = {};
  const mediasTrimestrais: { [trimestre: number]: number } = {};

  notas.forEach(nota => {
    const avaliacao = avaliacoes.find(a => a.id === nota.avaliacaoId);
    let trim: number | null = avaliacao?.trimestre ?? null;
    if (trim == null) {
      trim = trimestreFromTipo(nota.tipo);
    }
    if (trim != null) {
      if (!notasPorTrimestre[trim]) {
        notasPorTrimestre[trim] = [];
      }
      notasPorTrimestre[trim].push(nota);
    }
  });

  // Calcular média por trimestre (ordem garantida: 1, 2, 3)
  const trimestresOrdenados = Object.keys(notasPorTrimestre).map(Number).sort((a, b) => a - b);
  trimestresOrdenados.forEach(trimestre => {
    const notasTrim = notasPorTrimestre[trimestre];
    
    // Separar avaliação contínua e prova trimestral
    const avaliacaoContinua = notasTrim.find(n => {
      const av = avaliacoes.find(a => a.id === n.avaliacaoId);
      return av && (av.tipo === 'TESTE' || av.tipo === 'TRABALHO');
    });
    const provaTrimestral = notasTrim.find(n => {
      const av = avaliacoes.find(a => a.id === n.avaliacaoId);
      return av && av.tipo === 'PROVA';
    });

    let mediaTrimestral = 0;
    const vCont = avaliacaoContinua?.valor ?? 0;
    const vProva = provaTrimestral?.valor ?? 0;
    if (avaliacaoContinua && provaTrimestral) {
      mediaTrimestral = (vCont + vProva) / 2;
    } else if (avaliacaoContinua) {
      mediaTrimestral = vCont;
      observacoes.push(`Trimestre ${trimestre}: Apenas avaliação contínua encontrada. Prova trimestral não foi lançada.`);
    } else if (provaTrimestral) {
      mediaTrimestral = vProva;
      observacoes.push(`Trimestre ${trimestre}: Apenas prova trimestral encontrada. Avaliação contínua não foi lançada.`);
    } else {
      // Se não há avaliação contínua nem prova, calcular média simples
      const soma = notasTrim.reduce((acc, n) => acc + (n.valor ?? 0), 0);
      mediaTrimestral = soma / notasTrim.length;
      observacoes.push(`Trimestre ${trimestre}: Média calculada a partir de todas as avaliações disponíveis.`);
    }

    mediasTrimestrais[trimestre] = Number(mediaTrimestral.toFixed(2));
  });

  // Calcular média anual (média aritmética dos trimestres)
  const trimestres = Object.keys(mediasTrimestrais).map(Number);
  let mediaAnual = 0;
  
  if (trimestres.length > 0) {
    const somaMedias = trimestres.reduce((acc, trim) => acc + mediasTrimestrais[trim], 0);
    mediaAnual = somaMedias / trimestres.length;
  } else {
    // Se não há trimestres identificados, calcular média simples de todas as notas
    const somaNotas = notas.reduce((acc, n) => acc + (n.valor ?? 0), 0);
    mediaAnual = somaNotas / notas.length;
    observacoes.push('Nenhum trimestre identificado. Média calculada a partir de todas as notas disponíveis.');
  }

  const status = mediaAnual >= mediaMinima ? 'APROVADO' : 'REPROVADO';

  // Montar notas_utilizadas sempre com 1º, 2º e 3º Trimestre para o boletim carregar os três campos
  const notasParaFrontend: NotaIndividual[] = [1, 2, 3].map((trim) => ({
    tipo: `${trim}º Trimestre`,
    valor: mediasTrimestrais[trim] ?? null,
    peso: 1,
  }));

  return {
    media_trimestral: Object.keys(mediasTrimestrais).length > 0 ? mediasTrimestrais : undefined,
    media_anual: Number(mediaAnual.toFixed(2)),
    media_final: Number(mediaAnual.toFixed(2)),
    status,
    detalhes_calculo: {
      notas_utilizadas: notasParaFrontend,
      formula_aplicada: `MA = (MT1 + MT2 + MT3) / 3 = ${mediaAnual.toFixed(2)}`,
      observacoes: observacoes.length > 0 ? observacoes : undefined,
    },
  };
}

/**
 * Função principal: Calcular média baseado no tipo de instituição
 * 
 * @param dados - Dados para o cálculo
 * @returns Resultado do cálculo com média e status
 */
export async function calcularMedia(dados: DadosCalculoNota): Promise<ResultadoCalculo> {
  // Validar dados obrigatórios
  if (!dados.alunoId || !dados.instituicaoId) {
    throw new AppError('alunoId e instituicaoId são obrigatórios', 400);
  }

  // CRÍTICO: tipoAcademico deve vir do parâmetro (req.user.tipoAcademico do JWT)
  // Fallback para buscar no banco apenas se não fornecido (compatibilidade com código legado)
  let tipoAcademico: TipoAcademico | null = null;
  if (dados.tipoAcademico) {
    tipoAcademico = dados.tipoAcademico as TipoAcademico;
  } else {
    // Fallback: buscar no banco (apenas para compatibilidade com código legado)
    // TODO: Remover este fallback após atualizar todos os chamadores
    tipoAcademico = await obterTipoAcademico(dados.instituicaoId);
  }

  if (!tipoAcademico) {
    throw new AppError('Tipo acadêmico da instituição não identificado. Configure o tipo da instituição primeiro.', 400);
  }

  // Buscar notas do aluno
  const notas = await buscarNotasAluno(dados);

  // Se não há notas, retornar resultado vazio (não erro)
  // Frontend pode exibir "Aguardando lançamento de notas"
  if (notas.length === 0) {
    return {
      media_final: 0,
      status: 'REPROVADO',
      detalhes_calculo: {
        notas_utilizadas: [],
        formula_aplicada: 'Nenhuma nota lançada',
        observacoes: ['Nenhuma nota encontrada para o aluno. Aguardando lançamento de notas.'],
      },
    };
  }

  // Validar notas (valores entre 0 e 20 ou padrão institucional)
  // Buscar configuração da instituição para intervalo de notas (se houver)
  const instituicao = await prisma.instituicao.findUnique({
    where: { id: dados.instituicaoId },
    select: { id: true },
  });

  // Buscar parâmetros do sistema para usar configurações institucionais
  const parametrosSistema = await prisma.parametrosSistema.findUnique({
    where: { instituicaoId: dados.instituicaoId },
  });

  const notaMaxima = 20; // Padrão: 0-20, pode ser configurável no futuro
  const notaMinima = 0;
  
  // Percentual mínimo de aprovação configurado (padrão: 10 = 50% de 20)
  const percentualMinimoAprovacao = parametrosSistema?.percentualMinimoAprovacao 
    ? Number(parametrosSistema.percentualMinimoAprovacao) 
    : 10;
  
  // Tipo de média configurado (simples ou ponderada)
  const tipoMedia = parametrosSistema?.tipoMedia || 'simples';
  
  // Permitir exame/recurso configurado
  const permitirExameRecurso = parametrosSistema?.permitirExameRecurso ?? false;

  for (const nota of notas) {
    const v = nota.valor;
    if (v != null && (v < notaMinima || v > notaMaxima)) {
      throw new AppError(`Nota inválida: ${v}. Valores devem estar entre ${notaMinima} e ${notaMaxima}.`, 400);
    }
  }

  // Calcular baseado no tipo, passando configurações
  if (tipoAcademico === TipoAcademico.SUPERIOR) {
    return await calcularSuperior(notas, percentualMinimoAprovacao, tipoMedia, permitirExameRecurso);
  } else if (tipoAcademico === TipoAcademico.SECUNDARIO) {
    return await calcularSecundario(notas, dados.instituicaoId, dados.trimestre, percentualMinimoAprovacao, tipoMedia, permitirExameRecurso);
  } else {
    throw new AppError('Tipo acadêmico não suportado para cálculo de notas', 400);
  }
}

/**
 * Calcular média para múltiplos alunos (lote)
 */
export async function calcularMediaLote(
  dados: Array<DadosCalculoNota>
): Promise<Array<{ alunoId: string; resultado: ResultadoCalculo }>> {
  const resultados = await Promise.all(
    dados.map(async (dado) => {
      try {
        const resultado = await calcularMedia(dado);
        return { alunoId: dado.alunoId, resultado };
      } catch (error: any) {
        // Em caso de erro, retornar erro específico para esse aluno
        return {
          alunoId: dado.alunoId,
          resultado: {
            media_final: 0,
            status: 'REPROVADO' as const,
            detalhes_calculo: {
              notas_utilizadas: [],
              formula_aplicada: 'Erro no cálculo',
              observacoes: [error.message || 'Erro desconhecido'],
            },
          },
        };
      }
    })
  );

  return resultados;
}

