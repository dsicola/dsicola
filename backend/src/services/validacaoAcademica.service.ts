import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';

/**
 * Serviço de validação acadêmica
 * Implementa bloqueios rigorosos baseados em status e datas
 */

export interface PeriodoAcademico {
  id: string;
  anoLetivo: number;
  numero: number;
  dataInicio: Date;
  dataFim: Date | null;
  dataInicioNotas: Date | null;
  dataFimNotas: Date | null;
  status: 'PLANEJADO' | 'ATIVO' | 'ENCERRADO' | 'CANCELADO';
}

/**
 * Buscar período acadêmico (semestre ou trimestre) por contexto
 */
export async function buscarPeriodoAcademico(
  instituicaoId: string,
  anoLetivo: number,
  tipoAcademico: 'SUPERIOR' | 'SECUNDARIO',
  data?: Date
): Promise<PeriodoAcademico | null> {
  const dataReferencia = data || new Date();

  if (tipoAcademico === 'SUPERIOR') {
    // Buscar semestre
    const semestre = await prisma.semestre.findFirst({
      where: {
        instituicaoId,
        anoLetivo,
        dataInicio: {
          lte: dataReferencia,
        },
        OR: [
          { dataFim: null },
          { dataFim: { gte: dataReferencia } },
        ],
      },
      orderBy: {
        numero: 'desc',
      },
    });

    if (!semestre) {
      return null;
    }

    return {
      id: semestre.id,
      anoLetivo: semestre.anoLetivo,
      numero: semestre.numero,
      dataInicio: semestre.dataInicio,
      dataFim: semestre.dataFim,
      dataInicioNotas: semestre.dataInicioNotas,
      dataFimNotas: semestre.dataFimNotas,
      status: semestre.status as any,
    };
  } else {
    // Buscar trimestre
    const trimestre = await prisma.trimestre.findFirst({
      where: {
        instituicaoId,
        anoLetivo,
        dataInicio: {
          lte: dataReferencia,
        },
        OR: [
          { dataFim: null },
          { dataFim: { gte: dataReferencia } },
        ],
      },
      orderBy: {
        numero: 'desc',
      },
    });

    if (!trimestre) {
      return null;
    }

    return {
      id: trimestre.id,
      anoLetivo: trimestre.anoLetivo,
      numero: trimestre.numero,
      dataInicio: trimestre.dataInicio,
      dataFim: trimestre.dataFim,
      dataInicioNotas: trimestre.dataInicioNotas,
      dataFimNotas: trimestre.dataFimNotas,
      status: trimestre.status as any,
    };
  }
}

/**
 * Validar se período está ATIVO para lançamento de aulas
 */
export function validarPeriodoAtivoParaAulas(periodo: PeriodoAcademico | null, dataAula: Date): void {
  if (!periodo) {
    throw new AppError(
      'Período acadêmico não encontrado para esta data. Verifique se o período foi criado e está configurado corretamente.',
      400
    );
  }

  if (periodo.status !== 'ATIVO') {
    throw new AppError(
      `Período acadêmico ainda não está ativo. Status atual: ${periodo.status}. É necessário ativar o período antes de lançar aulas.`,
      400
    );
  }

  // Validar se a data da aula está dentro do período
  const dataAulaInicio = new Date(dataAula);
  dataAulaInicio.setHours(0, 0, 0, 0);

  const periodoInicio = new Date(periodo.dataInicio);
  periodoInicio.setHours(0, 0, 0, 0);

  if (dataAulaInicio < periodoInicio) {
    throw new AppError(
      `A data da aula (${dataAulaInicio.toLocaleDateString('pt-BR')}) está antes do início do período (${periodoInicio.toLocaleDateString('pt-BR')}).`,
      400
    );
  }

  if (periodo.dataFim) {
    const periodoFim = new Date(periodo.dataFim);
    periodoFim.setHours(23, 59, 59, 999);

    if (dataAulaInicio > periodoFim) {
      throw new AppError(
        `A data da aula (${dataAulaInicio.toLocaleDateString('pt-BR')}) está após o fim do período (${periodoFim.toLocaleDateString('pt-BR')}).`,
        400
      );
    }
  }
}

/**
 * Validar se período está ATIVO e dentro do prazo para lançamento de notas
 */
export function validarPeriodoAtivoParaNotas(periodo: PeriodoAcademico | null, dataNota?: Date): void {
  if (!periodo) {
    throw new AppError(
      'Período acadêmico não encontrado. Verifique se o período foi criado e está configurado corretamente.',
      400
    );
  }

  if (periodo.status !== 'ATIVO') {
    throw new AppError(
      `Período acadêmico ainda não está ativo. Status atual: ${periodo.status}. É necessário ativar o período antes de lançar notas.`,
      400
    );
  }

  // Se há datas específicas para notas, validar
  if (periodo.dataInicioNotas || periodo.dataFimNotas) {
    const hoje = dataNota || new Date();
    hoje.setHours(0, 0, 0, 0);

    if (periodo.dataInicioNotas) {
      const inicioNotas = new Date(periodo.dataInicioNotas);
      inicioNotas.setHours(0, 0, 0, 0);

      if (hoje < inicioNotas) {
        throw new AppError(
          `Período ainda não iniciado para lançamento de notas. Data de início: ${inicioNotas.toLocaleDateString('pt-BR')}.`,
          400
        );
      }
    }

    if (periodo.dataFimNotas) {
      const fimNotas = new Date(periodo.dataFimNotas);
      fimNotas.setHours(23, 59, 59, 999);

      if (hoje > fimNotas) {
        throw new AppError(
          `Prazo de lançamento de notas encerrado. Data de fim: ${fimNotas.toLocaleDateString('pt-BR')}.`,
          400
        );
      }
    }
  }
}

/**
 * Validar se período está ENCERRADO (bloqueia edições)
 */
export function validarPeriodoNaoEncerrado(periodo: PeriodoAcademico | null, acao: string): void {
  if (!periodo) {
    throw new AppError('Período acadêmico não encontrado.', 400);
  }

  if (periodo.status === 'ENCERRADO') {
    throw new AppError(
      `Período encerrado. A ação "${acao}" não é permitida após o encerramento do período.`,
      400
    );
  }
}

/**
 * Validar se ano letivo está ATIVO (por número do ano)
 */
export async function validarAnoLetivoAtivo(
  instituicaoId: string,
  anoLetivo: number
): Promise<void> {
  const anoLetivoRecord = await prisma.anoLetivo.findFirst({
    where: {
      instituicaoId,
      ano: anoLetivo,
    },
  });

  if (!anoLetivoRecord) {
    throw new AppError(
      `Ano letivo ${anoLetivo} não encontrado. É necessário criar o ano letivo primeiro.`,
      400
    );
  }

  if (anoLetivoRecord.status !== 'ATIVO') {
    throw new AppError(
      `Ano letivo ${anoLetivo} ainda não está ativo. Status atual: ${anoLetivoRecord.status}. É necessário ativar o ano letivo antes de executar operações acadêmicas.`,
      400
    );
  }
}

/**
 * REGRA MESTRA: Validar ano letivo por ID
 * Valida que:
 * 1. O ano letivo existe
 * 2. Pertence à instituição do token
 * 3. Está ATIVO (não pode ser PLANEJADO ou ENCERRADO)
 * 
 * Esta é a validação central que deve ser usada em TODAS as operações acadêmicas.
 */
export async function validarAnoLetivoIdAtivo(
  instituicaoId: string,
  anoLetivoId: string | null | undefined,
  operacao: string = 'operar'
): Promise<{ id: string; ano: number; status: string }> {
  // 1. Validar que anoLetivoId foi fornecido
  if (!anoLetivoId) {
    throw new AppError(
      `Ano letivo é obrigatório para ${operacao}. Nenhuma operação acadêmica pode existir fora de um Ano Letivo ATIVO.`,
      400
    );
  }

  // 2. Buscar ano letivo
  const anoLetivoRecord = await prisma.anoLetivo.findFirst({
    where: {
      id: anoLetivoId,
      instituicaoId, // CRÍTICO: Validar multi-tenant
    },
  });

  // 3. Validar que existe
  if (!anoLetivoRecord) {
    throw new AppError(
      `Ano letivo não encontrado ou não pertence à sua instituição. Nenhuma operação acadêmica pode existir fora de um Ano Letivo ATIVO.`,
      404
    );
  }

  // 4. Validar que está ATIVO
  if (anoLetivoRecord.status !== 'ATIVO') {
    throw new AppError(
      `Não é possível ${operacao}. O ano letivo ${anoLetivoRecord.ano} está com status "${anoLetivoRecord.status}". Apenas anos letivos ATIVOS permitem operações acadêmicas.`,
      400
    );
  }

  return {
    id: anoLetivoRecord.id,
    ano: anoLetivoRecord.ano,
    status: anoLetivoRecord.status,
  };
}

/**
 * Buscar ano letivo ativo da instituição
 * Retorna null se não houver ano letivo ativo
 */
export async function buscarAnoLetivoAtivo(
  instituicaoId: string
): Promise<{ id: string; ano: number; status: string } | null> {
  const anoLetivoAtivo = await prisma.anoLetivo.findFirst({
    where: {
      instituicaoId,
      status: 'ATIVO',
    },
    orderBy: {
      ano: 'desc',
    },
  });

  if (!anoLetivoAtivo) {
    return null;
  }

  return {
    id: anoLetivoAtivo.id,
    ano: anoLetivoAtivo.ano,
    status: anoLetivoAtivo.status,
  };
}

/**
 * REGRA MESTRA SIGA/SIGAE: Validar Plano de Ensino ATIVO
 * 
 * NADA acadêmico pode existir sem um PLANO DE ENSINO válido e ATIVO.
 * 
 * Valida que:
 * 1. O Plano de Ensino existe
 * 2. Pertence à instituição do token (multi-tenant)
 * 3. Está APROVADO (estado = 'APROVADO') - apenas planos aprovados permitem operações acadêmicas
 * 4. Não está bloqueado
 * 
 * Esta validação DEVE ser aplicada em:
 * - Criação de Aulas (AulaLancada)
 * - Criação de Presenças
 * - Criação de Avaliações
 * - Criação de Notas
 * 
 * @param instituicaoId - ID da instituição (do token)
 * @param planoEnsinoId - ID do Plano de Ensino
 * @param operacao - Descrição da operação (para mensagens de erro)
 * @returns Dados do Plano de Ensino validado
 */
export async function validarPlanoEnsinoAtivo(
  instituicaoId: string,
  planoEnsinoId: string | null | undefined,
  operacao: string = 'executar operação acadêmica'
): Promise<{ id: string; estado: string; bloqueado: boolean; disciplinaId: string; professorId: string }> {
  // 1. Validar que planoEnsinoId foi fornecido
  if (!planoEnsinoId) {
    throw new AppError(
      `Plano de Ensino é obrigatório para ${operacao}. Nenhuma operação acadêmica pode existir sem um Plano de Ensino válido e ATIVO.`,
      400
    );
  }

  // 2. Buscar plano de ensino
  const planoEnsino = await prisma.planoEnsino.findFirst({
    where: {
      id: planoEnsinoId,
      instituicaoId, // CRÍTICO: Validar multi-tenant
    },
    select: {
      id: true,
      estado: true,
      bloqueado: true,
      disciplinaId: true,
      professorId: true,
      disciplina: {
        select: {
          nome: true,
        },
      },
    },
  });

  // 3. Validar que existe
  if (!planoEnsino) {
    throw new AppError(
      `Plano de Ensino não encontrado ou não pertence à sua instituição. Nenhuma operação acadêmica pode existir sem um Plano de Ensino válido e ATIVO.`,
      404
    );
  }

  // 4. Validar que não está bloqueado
  if (planoEnsino.bloqueado) {
    throw new AppError(
      `Não é possível ${operacao}. O Plano de Ensino está bloqueado e não permite operações acadêmicas. Entre em contato com a administração para desbloquear o plano.`,
      400
    );
  }

  // 5. Validar que está APROVADO (estado = 'APROVADO')
  // REGRA MESTRA: Apenas planos APROVADOS permitem operações acadêmicas
  if (planoEnsino.estado !== 'APROVADO') {
    const estadoDescricao = {
      'RASCUNHO': 'em RASCUNHO',
      'EM_REVISAO': 'em REVISÃO',
      'ENCERRADO': 'ENCERRADO',
    }[planoEnsino.estado] || planoEnsino.estado;

    throw new AppError(
      `Não é possível ${operacao}. O Plano de Ensino está ${estadoDescricao}. Apenas planos APROVADOS permitem operações acadêmicas (Aulas, Presenças, Avaliações, Notas). É necessário aprovar o Plano de Ensino antes de executar operações acadêmicas.`,
      400
    );
  }

  return {
    id: planoEnsino.id,
    estado: planoEnsino.estado,
    bloqueado: planoEnsino.bloqueado,
    disciplinaId: planoEnsino.disciplinaId,
    professorId: planoEnsino.professorId,
  };
}

/**
 * REGRA MESTRA SIGA/SIGAE: Validar Vínculo Professor-Disciplina-Turma via Plano de Ensino ATIVO
 * 
 * Garante que professores só possam atuar em disciplinas e turmas vinculadas
 * a um Plano de Ensino ATIVO (APROVADO e não bloqueado).
 * 
 * Valida que:
 * 1. Existe um Plano de Ensino vinculando professor → disciplina → turma
 * 2. O Plano de Ensino está ATIVO (APROVADO e não bloqueado)
 * 3. O professor do plano corresponde ao professor autenticado
 * 4. A disciplina do plano corresponde à disciplina fornecida
 * 5. A turma do plano corresponde à turma fornecida (se fornecida)
 * 
 * Esta validação DEVE ser aplicada em:
 * - Busca de turmas do professor (filtrar apenas turmas com plano ativo)
 * - Criação de Aulas (AulaLancada)
 * - Criação de Presenças
 * - Criação de Avaliações
 * - Criação de Notas
 * 
 * @param instituicaoId - ID da instituição (do token)
 * @param professorId - ID do professor (do token ou fornecido)
 * @param disciplinaId - ID da disciplina
 * @param turmaId - ID da turma (opcional, mas recomendado)
 * @param operacao - Descrição da operação (para mensagens de erro)
 * @returns Dados do Plano de Ensino validado
 */
export async function validarVinculoProfessorDisciplinaTurma(
  instituicaoId: string,
  professorId: string,
  disciplinaId: string,
  turmaId: string | null | undefined,
  operacao: string = 'executar operação acadêmica'
): Promise<{ 
  planoEnsinoId: string; 
  estado: string; 
  bloqueado: boolean; 
  disciplinaId: string; 
  professorId: string;
  turmaId: string | null;
}> {
  // 1. Validar que professorId foi fornecido
  if (!professorId) {
    throw new AppError(
      `Professor é obrigatório para ${operacao}. Nenhuma operação acadêmica pode existir sem um vínculo válido via Plano de Ensino.`,
      400
    );
  }

  // 2. Validar que disciplinaId foi fornecido
  if (!disciplinaId) {
    throw new AppError(
      `Disciplina é obrigatória para ${operacao}. Nenhuma operação acadêmica pode existir sem um vínculo válido via Plano de Ensino.`,
      400
    );
  }

  // 3. Buscar Plano de Ensino que vincula professor → disciplina → turma
  const where: any = {
    instituicaoId, // CRÍTICO: Validar multi-tenant
    professorId,
    disciplinaId,
    estado: 'APROVADO', // REGRA: Apenas planos APROVADOS permitem operações
    bloqueado: false, // REGRA: Planos bloqueados não permitem operações
  };

  // Se turmaId foi fornecido, validar que o plano está vinculado a essa turma
  if (turmaId) {
    where.turmaId = turmaId;
  }

  // Log de diagnóstico para debug
  if (process.env.NODE_ENV !== 'production') {
    console.log('[validarVinculoProfessorDisciplinaTurma] Buscando plano com critérios:', {
      instituicaoId,
      professorId,
      disciplinaId,
      turmaId,
      estado: 'APROVADO',
      bloqueado: false,
      operacao,
    });
  }

  const planoEnsino = await prisma.planoEnsino.findFirst({
    where,
    select: {
      id: true,
      estado: true,
      bloqueado: true,
      disciplinaId: true,
      professorId: true,
      turmaId: true,
      disciplina: {
        select: {
          nome: true,
        },
      },
      turma: turmaId ? {
        select: {
          id: true,
          nome: true,
        },
      } : undefined,
    },
    orderBy: {
      updatedAt: 'desc', // Pegar o mais recente se houver múltiplos
    },
  });

  // Log de diagnóstico: verificar se encontrou plano
  if (process.env.NODE_ENV !== 'production') {
    if (planoEnsino) {
      console.log('[validarVinculoProfessorDisciplinaTurma] ✅ Plano encontrado:', {
        planoId: planoEnsino.id,
        estado: planoEnsino.estado,
        bloqueado: planoEnsino.bloqueado,
        disciplinaId: planoEnsino.disciplinaId,
        professorId: planoEnsino.professorId,
        turmaId: planoEnsino.turmaId,
        disciplinaNome: planoEnsino.disciplina?.nome,
      });
    } else {
      console.log('[validarVinculoProfessorDisciplinaTurma] ❌ Plano NÃO encontrado com os critérios especificados');
      
      // Buscar planos relacionados para diagnóstico (sem filtros restritivos)
      const planosRelacionados = await prisma.planoEnsino.findMany({
        where: {
          instituicaoId,
          disciplinaId,
          ...(turmaId ? { turmaId } : {}),
        },
        select: {
          id: true,
          estado: true,
          bloqueado: true,
          professorId: true,
          turmaId: true,
        },
        take: 5,
      });
      
      console.log('[validarVinculoProfessorDisciplinaTurma] Planos relacionados encontrados (para diagnóstico):', planosRelacionados);
    }
  }

  // 4. Validar que existe
  if (!planoEnsino) {
    const mensagem = turmaId
      ? `Não é possível ${operacao}. Não existe um Plano de Ensino ATIVO vinculando você (professor) à disciplina e turma especificadas. É necessário que a coordenação atribua um Plano de Ensino APROVADO vinculando você à disciplina e turma antes de executar operações acadêmicas.`
      : `Não é possível ${operacao}. Não existe um Plano de Ensino ATIVO vinculando você (professor) à disciplina especificada. É necessário que a coordenação atribua um Plano de Ensino APROVADO vinculando você à disciplina antes de executar operações acadêmicas.`;
    
    throw new AppError(mensagem, 403);
  }

  // 5. Validar que não está bloqueado (dupla verificação)
  if (planoEnsino.bloqueado) {
    throw new AppError(
      `Não é possível ${operacao}. O Plano de Ensino está bloqueado e não permite operações acadêmicas. Entre em contato com a administração para desbloquear o plano.`,
      403
    );
  }

  // 6. Validar que está APROVADO (dupla verificação)
  if (planoEnsino.estado !== 'APROVADO') {
    const estadoDescricao = {
      'RASCUNHO': 'em RASCUNHO',
      'EM_REVISAO': 'em REVISÃO',
      'ENCERRADO': 'ENCERRADO',
    }[planoEnsino.estado] || planoEnsino.estado;

    throw new AppError(
      `Não é possível ${operacao}. O Plano de Ensino está ${estadoDescricao}. Apenas planos APROVADOS permitem operações acadêmicas (Aulas, Presenças, Avaliações, Notas). É necessário aprovar o Plano de Ensino antes de executar operações acadêmicas.`,
      403
    );
  }

  // 7. REGRA CRÍTICA: Para ações pedagógicas, o plano DEVE ter turma vinculada
  // Disciplinas sem turma não permitem ações pedagógicas (aulas, presenças, avaliações, notas)
  // Esta validação garante que apenas planos com turma vinculada permitem operações acadêmicas
  if (!planoEnsino.turmaId) {
    throw new AppError(
      `Não é possível ${operacao}. O Plano de Ensino não possui turma vinculada. Ações pedagógicas (aulas, presenças, avaliações, notas) só podem ser executadas quando a disciplina está vinculada a uma turma. Contacte a coordenação para vincular a disciplina a uma turma.`,
      403
    );
  }

  // Se turmaId foi fornecido, validar que corresponde ao plano
  if (turmaId && planoEnsino.turmaId !== turmaId) {
    throw new AppError(
      `Não é possível ${operacao}. A turma especificada não corresponde à turma vinculada ao Plano de Ensino ATIVO. Verifique se está utilizando a turma correta.`,
      403
    );
  }

  return {
    planoEnsinoId: planoEnsino.id,
    estado: planoEnsino.estado,
    bloqueado: planoEnsino.bloqueado,
    disciplinaId: planoEnsino.disciplinaId,
    professorId: planoEnsino.professorId,
    turmaId: planoEnsino.turmaId,
  };
}

/**
 * Buscar turmas do professor que possuem Plano de Ensino
 * 
 * REGRA ABSOLUTA: Plano de Ensino é a FONTE DA VERDADE
 * Esta função DEVE começar a query a partir de PlanoEnsino (não em Turma)
 * 
 * Retorna TODAS as turmas vinculadas a um Plano de Ensino do professor,
 * independentemente do estado (RASCUNHO, EM_REVISAO, APROVADO, ENCERRADO).
 * O estado do plano controla apenas as ações (podeRegistrarAula, podeLancarNota),
 * não a visibilidade.
 * 
 * @param instituicaoId - ID da instituição (SEMPRE do JWT)
 * @param professorId - ID do professor (professores.id, NÃO users.id)
 * @param anoLetivoId - ID do ano letivo (opcional, filtra por ano letivo)
 * @returns Array de turmas com plano de ensino (incluindo estado e bloqueado)
 */
export async function buscarTurmasProfessorComPlanoAtivo(
  instituicaoId: string,
  professorId: string,
  anoLetivoId?: string | null
): Promise<Array<{
  id: string;
  nome: string;
  codigo: string;
  disciplinaId: string;
  disciplinaNome: string;
  planoEnsinoId: string;
  planoEstado: string;
  planoBloqueado: boolean;
  turma: any;
  curso?: any;
}>> {
  // REGRA ABSOLUTA 1: Filtros obrigatórios vêm SOMENTE do JWT
  // instituicaoId e professorId são garantidos pelo controller
  // IMPORTANTE: professorId é professores.id (não users.id)
  // O controller já resolveu users.id → professores.id usando resolveProfessorId
  
  // REGRA ABSOLUTA 2: Query DEVE começar no PlanoEnsino (FONTE DA VERDADE)
  // JOIN explícito com: disciplina, turma (LEFT JOIN)
  // NÃO exigir turma para retornar plano
  // NÃO filtrar por estado ou bloqueado - buscar TODOS os planos válidos
  
  // CORREÇÃO CRÍTICA: Normalizar professorId para garantir comparação correta
  // IMPORTANTE: O professorId agora é professores.id (não users.id)
  // O controller já fez a resolução: users.id → professores.id
  const professorIdString = String(professorId || '').trim();
  
  if (!professorIdString || professorIdString === '') {
    console.error(`[buscarTurmasProfessorComPlanoAtivo] ⚠️ ERRO CRÍTICO: professorId está vazio após normalização!`);
    return [];
  }
  
  const where: any = {
    AND: [
      {
        professorId: professorIdString,
      },
      {
        disciplinaId: { not: null },
      },
      {
        instituicaoId: instituicaoId,
      },
    ],
    // NÃO filtrar por estado - buscar TODOS (RASCUNHO, EM_REVISAO, APROVADO, ENCERRADO)
    // NÃO filtrar por bloqueado - buscar TODOS (bloqueados e não bloqueados)
  };
  
  // REGRA ABSOLUTA 3: Filtro de ano letivo (opcional)
  if (anoLetivoId) {
    where.AND.push({
      anoLetivoId: anoLetivoId,
    });
  }

  console.log(`[buscarTurmasProfessorComPlanoAtivo] Buscando planos com where:`, JSON.stringify(where, null, 2));
  console.log(`[buscarTurmasProfessorComPlanoAtivo] Parâmetros: instituicaoId=${instituicaoId}, professorId=${professorIdString}, anoLetivoId=${anoLetivoId || 'N/A'}`);

  // REGRA ABSOLUTA 4: Query a partir de PlanoEnsino com JOINs explícitos
  // Usar include para garantir que todas as relações sejam carregadas
  const planosEnsino = await prisma.planoEnsino.findMany({
    where,
    include: {
      // JOIN explícito com Disciplina (obrigatório)
      disciplina: {
        select: {
          id: true,
          nome: true,
          codigo: true,
          instituicaoId: true,
          cargaHoraria: true,
        },
      },
      // JOIN explícito com Curso (opcional)
      curso: {
        select: {
          id: true,
          nome: true,
          codigo: true,
        },
      },
      // LEFT JOIN com Turma (opcional - plano pode não ter turma)
      turma: {
        select: {
          id: true,
          nome: true,
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
          turno: {
            select: {
              id: true,
              nome: true,
            },
          },
          ano: true,
          semestre: true,
          sala: true,
          capacidade: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc', // Planos mais recentes primeiro
    },
  });

  console.log(`[buscarTurmasProfessorComPlanoAtivo] Encontrados ${planosEnsino.length} planos de ensino`);

  // Validação: Verificar se há planos sem disciplina (não deve acontecer)
  const planosComDisciplina = planosEnsino.filter(p => p.disciplina !== null);
  const planosSemDisciplina = planosEnsino.filter(p => p.disciplina === null);
  
  if (planosSemDisciplina.length > 0) {
    console.error(`[buscarTurmasProfessorComPlanoAtivo] ⚠️ ERRO: ${planosSemDisciplina.length} planos SEM DISCIPLINA!`);
    console.error(`[buscarTurmasProfessorComPlanoAtivo] IDs:`, planosSemDisciplina.map(p => p.id));
  }

  if (planosEnsino.length > 0) {
    console.log(`[buscarTurmasProfessorComPlanoAtivo] Detalhes dos planos:`, planosEnsino.map(p => ({
      id: p.id,
      estado: p.estado,
      bloqueado: p.bloqueado,
      turmaId: p.turmaId,
      disciplinaId: p.disciplinaId,
      disciplinaNome: p.disciplina?.nome || 'SEM DISCIPLINA',
      temTurma: !!p.turma,
      instituicaoId: p.instituicaoId,
    })));
  }

  // REGRA ABSOLUTA 5: Filtrar apenas planos COM turma vinculada
  // Planos sem turma são tratados pela função buscarTurmasEDisciplinasProfessorComPlanoAtivo
  const turmasMap = new Map<string, {
    id: string;
    nome: string;
    codigo: string; // Turma não tem codigo, usar nome como fallback
    disciplinaId: string;
    disciplinaNome: string;
    planoEnsinoId: string;
    planoEstado: string;
    planoBloqueado: boolean;
    turma: any;
    curso?: any;
    cargaHorariaTotal?: number;
    cargaHorariaPlanejada?: number;
    cargaHorariaRealizada?: number;
  }>();

  for (const plano of planosComDisciplina) {
    if (plano.disciplina.instituicaoId !== instituicaoId) {
      throw new AppError(
        `Plano de ensino ${plano.id} com disciplina de outra instituição (${plano.disciplina.instituicaoId} vs ${instituicaoId}). Violação de multi-tenant.`,
        403
      );
    }

    // Filtrar apenas planos COM turma vinculada
    if (plano.turmaId && plano.turma) {
      // Se já existe a turma no mapa, manter apenas uma (usar o plano mais recente)
      if (!turmasMap.has(plano.turmaId)) {
        turmasMap.set(plano.turmaId, {
          id: plano.turma.id,
          nome: plano.turma.nome,
          codigo: plano.turma.nome, // Turma não tem codigo, usar nome como fallback
          disciplinaId: plano.disciplinaId,
          disciplinaNome: plano.disciplina.nome,
          planoEnsinoId: plano.id,
          planoEstado: plano.estado,
          planoBloqueado: plano.bloqueado,
          turma: plano.turma,
          curso: plano.curso || plano.turma.curso || null,
        });
        console.log(`[buscarTurmasProfessorComPlanoAtivo] ✅ Turma: ${plano.turma.id} - Plano: ${plano.id} - Estado: ${plano.estado} - Bloqueado: ${plano.bloqueado}`);
      }
    }
  }

  console.log(`[buscarTurmasProfessorComPlanoAtivo] Resultado: ${turmasMap.size} turmas encontradas`);

  return Array.from(turmasMap.values());
}

/**
 * Buscar turmas e disciplinas sem turma do professor que possuem Plano de Ensino
 * 
 * REGRA ABSOLUTA: Plano de Ensino é a FONTE DA VERDADE
 * Esta função DEVE começar a query a partir de PlanoEnsino (não em Turma)
 * 
 * Retorna:
 * - Turmas vinculadas a um Plano de Ensino do professor (qualquer estado)
 * - Disciplinas atribuídas sem turma (quando turmaId for null) com Plano de Ensino
 * 
 * Esta função permite que o professor veja todas as suas atribuições (com e sem turma),
 * independentemente do estado do plano (RASCUNHO, EM_REVISAO, APROVADO, ENCERRADO).
 * O estado do plano controla apenas as ações (podeRegistrarAula, podeLancarNota),
 * não a visibilidade.
 * 
 * @param instituicaoId - ID da instituição (SEMPRE do JWT)
 * @param professorId - ID do professor (professores.id, NÃO users.id)
 * @param anoLetivoId - ID do ano letivo (opcional, filtra por ano letivo)
 * @param userIdForFallback - IDs do user (users.id) para fallback quando planos foram criados com users.id em vez de professors.id (legacy)
 * @returns Array de turmas e disciplinas sem turma com plano de ensino (incluindo estado)
 */
export async function buscarTurmasEDisciplinasProfessorComPlanoAtivo(
  instituicaoId: string,
  professorId: string,
  anoLetivoId?: string | null,
  userIdForFallback?: string | null
): Promise<Array<{
  id: string;
  nome: string;
  codigo: string;
  disciplinaId: string;
  disciplinaNome: string;
  planoEnsinoId: string;
  planoEstado: string;
  planoBloqueado: boolean;
  turma: any;
  curso?: any; // Curso do plano (pode existir mesmo sem turma)
  cargaHorariaTotal?: number;
  cargaHorariaPlanejada?: number;
  cargaHorariaRealizada?: number;
}>> {
  // REGRA ABSOLUTA 1: Filtros obrigatórios vêm SOMENTE do JWT
  // instituicaoId e professorId são garantidos pelo controller
  // IMPORTANTE: professorId é professores.id (não users.id)
  // O controller já resolveu users.id → professores.id usando resolveProfessorId
  
  // REGRA ABSOLUTA 2: Query DEVE começar no PlanoEnsino (FONTE DA VERDADE)
  // JOIN explícito com: disciplina, turma (LEFT JOIN)
  // NÃO exigir turma para retornar plano
  // NÃO filtrar por estado ou bloqueado - buscar TODOS os planos válidos
  
  // CORREÇÃO CRÍTICA: Normalizar professorId e instituicaoId para garantir comparação correta
  // O professorId deve ser sempre uma string sem espaços
  // IMPORTANTE: O professorId agora é professores.id (não users.id)
  // O controller já fez a resolução: users.id → professores.id
  // CORREÇÃO: Garantir que professorId seja sempre tratado como string para comparação correta
  // REGRA ABSOLUTA: Normalizar para string e remover espaços para evitar problemas de comparação
  const professorIdString = String(professorId || '').trim();
  const instituicaoIdString = String(instituicaoId || '').trim();
  
  // VALIDAÇÃO CRÍTICA: Garantir que os IDs não estão vazios após normalização
  if (!professorIdString || professorIdString === '') {
    console.error(`[buscarTurmasEDisciplinasProfessorComPlanoAtivo] ⚠️ ERRO CRÍTICO: professorId está vazio após normalização! Original: ${professorId} (tipo: ${typeof professorId})`);
    return [];
  }
  
  if (!instituicaoIdString || instituicaoIdString === '') {
    console.error(`[buscarTurmasEDisciplinasProfessorComPlanoAtivo] ⚠️ ERRO CRÍTICO: instituicaoId está vazio após normalização! Original: ${instituicaoId} (tipo: ${typeof instituicaoId})`);
    return [];
  }
  
  const where: any = {
    AND: [
      { professorId: professorIdString },
      { instituicaoId: instituicaoIdString },
    ],
    // REGRA ABSOLUTA: NÃO filtrar por estado - buscar TODOS (RASCUNHO, EM_REVISAO, APROVADO, ENCERRADO)
    // REGRA ABSOLUTA: NÃO filtrar por bloqueado - buscar TODOS (bloqueados e não bloqueados)
    // O estado e bloqueio controlam apenas as ações (podeRegistrarAula, podeLancarNota), não a visibilidade
  };
  
  // REGRA ABSOLUTA 3: Filtro de ano letivo (opcional)
  // Se anoLetivoId for fornecido, filtrar apenas planos daquele ano letivo
  // Se não for fornecido, buscar planos de TODOS os anos letivos
  // IMPORTANTE: anoLetivoId é opcional - se não fornecido, busca TODOS os planos (qualquer ano letivo)
  // Isso permite que o professor veja atribuições de anos letivos anteriores ou futuros
  // AJUSTE: Normalizar anoLetivoId antes de usar no filtro
  if (anoLetivoId && String(anoLetivoId).trim() !== '') {
    const anoLetivoIdNormalizado = String(anoLetivoId).trim();
    where.AND.push({
      anoLetivoId: anoLetivoIdNormalizado,
    });
    console.log(`[buscarTurmasEDisciplinasProfessorComPlanoAtivo] 🔍 Filtro de ano letivo aplicado: ${anoLetivoIdNormalizado}`);
  } else {
    console.log(`[buscarTurmasEDisciplinasProfessorComPlanoAtivo] ℹ️ Sem filtro de ano letivo - buscando TODOS os planos (qualquer ano letivo)`);
  }
  // Se anoLetivoId não for fornecido, NÃO adicionar filtro - busca TODOS os planos

  console.log(`[buscarTurmasEDisciplinasProfessorComPlanoAtivo] 🔍 Buscando planos com where:`, JSON.stringify(where, null, 2));
  console.log(`[buscarTurmasEDisciplinasProfessorComPlanoAtivo] 📋 Parâmetros normalizados: instituicaoId="${instituicaoIdString}" (original: ${instituicaoId}, tipo: ${typeof instituicaoId}), professorId="${professorIdString}" (original: ${professorId}, tipo: ${typeof professorId}), anoLetivoId=${anoLetivoId || 'N/A'}`);
  console.log(`[buscarTurmasEDisciplinasProfessorComPlanoAtivo] 🔍 Filtro WHERE construído:`, {
    professorIdFilter: where.AND[0],
    instituicaoIdFilter: where.AND[1],
    anoLetivoFilter: anoLetivoId ? where.AND[2] : 'N/A (sem filtro)',
  });

  // Query a partir de PlanoEnsino com JOINs explícitos
  // Usar include para garantir que todas as relações sejam carregadas
  let planosEnsino = await prisma.planoEnsino.findMany({
    where,
    include: {
      // JOIN explícito com Disciplina (obrigatório)
      disciplina: {
        select: {
          id: true,
          nome: true,
          codigo: true,
          instituicaoId: true,
          cargaHoraria: true,
        },
      },
      // JOIN explícito com Curso (opcional)
      curso: {
        select: {
          id: true,
          nome: true,
          codigo: true,
        },
      },
      // LEFT JOIN com Turma (opcional - plano pode não ter turma)
      turma: {
        select: {
          id: true,
          nome: true,
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
          turno: {
            select: {
              id: true,
              nome: true,
            },
          },
          ano: true,
          semestre: true,
          sala: true,
          capacidade: true,
        },
      },
      // Aulas lançadas para calcular carga horária realizada (SIGAE)
      aulasLancadas: {
        select: { cargaHoraria: true },
      },
    },
    orderBy: {
      createdAt: 'desc', // Planos mais recentes primeiro
    },
  });

  // FALLBACK: Planos criados com users.id em vez de professors.id (legacy/corrupção)
  // Se não encontrou planos e userIdForFallback foi fornecido, tentar busca por users.id
  const userIdFallback = userIdForFallback ? String(userIdForFallback).trim() : '';
  if (planosEnsino.length === 0 && userIdFallback && userIdFallback !== professorIdString) {
    console.warn(`[buscarTurmasEDisciplinasProfessorComPlanoAtivo] ⚠️ Nenhum plano com professors.id - tentando fallback com users.id (legacy)`);
    const whereFallback: any = {
      AND: [
        { professorId: userIdFallback },
        { instituicaoId: instituicaoIdString },
      ],
    };
    if (anoLetivoId && String(anoLetivoId).trim() !== '') {
      whereFallback.AND.push({ anoLetivoId: String(anoLetivoId).trim() });
    }
    const planosFallback = await prisma.planoEnsino.findMany({
      where: whereFallback,
      include: {
        disciplina: { select: { id: true, nome: true, codigo: true, instituicaoId: true, cargaHoraria: true } },
        curso: { select: { id: true, nome: true, codigo: true } },
        turma: {
          select: {
            id: true, nome: true,
            curso: { select: { id: true, nome: true, codigo: true } },
            classe: { select: { id: true, nome: true, codigo: true } },
            turno: { select: { id: true, nome: true } },
            ano: true, semestre: true, sala: true, capacidade: true,
          },
        },
        aulasLancadas: { select: { cargaHoraria: true } },
      },
      orderBy: { createdAt: 'desc' as const },
    });
    if (planosFallback.length > 0) {
      console.warn(`[buscarTurmasEDisciplinasProfessorComPlanoAtivo] ⚠️ Encontrados ${planosFallback.length} planos com professorId=users.id (LEGACY). Corrija com: UPDATE plano_ensino SET professor_id = '${professorIdString}' WHERE professor_id = '${userIdFallback}';`);
      planosEnsino = planosFallback;
    }
  }

  console.log(`[buscarTurmasEDisciplinasProfessorComPlanoAtivo] ✅ Encontrados ${planosEnsino.length} planos de ensino`);

  if (planosEnsino.length === 0) {
    console.warn(`[buscarTurmasEDisciplinasProfessorComPlanoAtivo] ⚠️ NENHUM plano encontrado para professor ${professorIdString} na instituição ${instituicaoIdString}`);
  }

  // DEBUG CRÍTICO: Verificar se os planos encontrados realmente correspondem ao professor
  // CORREÇÃO: Usar comparação de string normalizada para evitar problemas de tipo
  const planosComProfessorIdCorreto = planosEnsino.filter(p => String(p.professorId).trim() === professorIdString);
  const planosComProfessorIdDiferente = planosEnsino.filter(p => String(p.professorId).trim() !== professorIdString);
  
  if (planosComProfessorIdDiferente.length > 0) {
    console.error(`[buscarTurmasEDisciplinasProfessorComPlanoAtivo] ⚠️ ERRO CRÍTICO: ${planosComProfessorIdDiferente.length} planos com professorId diferente!`);
    console.error(`[buscarTurmasEDisciplinasProfessorComPlanoAtivo] Esperado: ${professorIdString} (tipo: ${typeof professorIdString}), Encontrados:`, planosComProfessorIdDiferente.map(p => ({
      planoId: p.id,
      professorId: p.professorId,
      professorIdTipo: typeof p.professorId,
      professorIdNormalizado: String(p.professorId).trim(),
      instituicaoId: p.instituicaoId,
      saoIguais: String(p.professorId).trim() === professorIdString,
    })));
  } else if (planosEnsino.length > 0) {
    console.log(`[buscarTurmasEDisciplinasProfessorComPlanoAtivo] ✅ Todos os ${planosEnsino.length} planos têm professorId correto: ${professorIdString}`);
  }
  
  console.log(`[buscarTurmasEDisciplinasProfessorComPlanoAtivo] 📊 DEBUG - Planos com professorId correto: ${planosComProfessorIdCorreto.length} de ${planosEnsino.length}`);

  // Validação: Verificar se há planos sem disciplina (não deve acontecer)
  const planosComDisciplina = planosEnsino.filter(p => p.disciplina !== null);
  const planosSemDisciplina = planosEnsino.filter(p => p.disciplina === null);
  
  if (planosSemDisciplina.length > 0) {
    console.error(`[buscarTurmasEDisciplinasProfessorComPlanoAtivo] ⚠️ ERRO: ${planosSemDisciplina.length} planos SEM DISCIPLINA!`);
    console.error(`[buscarTurmasEDisciplinasProfessorComPlanoAtivo] IDs:`, planosSemDisciplina.map(p => p.id));
  }

  if (planosEnsino.length > 0) {
    console.log(`[buscarTurmasEDisciplinasProfessorComPlanoAtivo] 📝 Detalhes dos planos:`, planosEnsino.map(p => ({
      id: p.id,
      estado: p.estado,
      bloqueado: p.bloqueado,
      turmaId: p.turmaId,
      disciplinaId: p.disciplinaId,
      disciplinaNome: p.disciplina?.nome || 'SEM DISCIPLINA',
      temTurma: !!p.turma,
      instituicaoId: p.instituicaoId,
      professorId: p.professorId,
      anoLetivoId: p.anoLetivoId,
    })));
  } else {
    console.warn(`[buscarTurmasEDisciplinasProfessorComPlanoAtivo] ⚠️ NENHUM plano encontrado para professor ${professorIdString} na instituição ${instituicaoIdString}`);
    console.warn(`[buscarTurmasEDisciplinasProfessorComPlanoAtivo] ⚠️ Verifique se o Plano de Ensino foi criado com o professorId correto: ${professorIdString}`);
    console.warn(`[buscarTurmasEDisciplinasProfessorComPlanoAtivo] ⚠️ Verifique se o Plano de Ensino tem instituicaoId: ${instituicaoIdString} (obrigatório - legacy removido)`);
    console.warn(`[buscarTurmasEDisciplinasProfessorComPlanoAtivo] ⚠️ Verifique se o Plano de Ensino tem disciplinaId (não pode ser null)`);
    if (anoLetivoId) {
      console.warn(`[buscarTurmasEDisciplinasProfessorComPlanoAtivo] ⚠️ Verifique se o Plano de Ensino tem anoLetivoId: ${anoLetivoId}`);
    }
  }

  // REGRA ABSOLUTA 5: Separar planos COM turma e planos SEM turma
  // Incluir TODOS os planos válidos (qualquer estado)
  const turmasMap = new Map<string, {
    id: string;
    nome: string;
    codigo: string; // Turma não tem codigo, usar nome como fallback
    disciplinaId: string;
    disciplinaNome: string;
    planoEnsinoId: string;
    planoEstado: string;
    planoBloqueado: boolean;
    turma: any;
    curso?: any;
    cargaHorariaTotal?: number;
    cargaHorariaPlanejada?: number;
    cargaHorariaRealizada?: number;
  }>();

  let planosComTurma = 0;
  let planosSemTurma = 0;
  let planosIgnoradosPorInstituicao = 0;

  // CORREÇÃO CRÍTICA: Processar TODOS os planos encontrados
  // PlanoEnsino é a FONTE DA VERDADE
  // A validação multi-tenant já foi feita no filtro WHERE (instituicaoId do plano)
  // A validação do professorId já foi feita no filtro WHERE (professorId do plano)
  
  console.log(`[buscarTurmasEDisciplinasProfessorComPlanoAtivo] 🔄 Processando ${planosComDisciplina.length} planos com disciplina (de ${planosEnsino.length} total)`);
  
  for (const plano of planosComDisciplina) {
    // REGRA ABSOLUTA: Todos os planos retornados pela query JÁ foram filtrados pelo professorId
    // Não é necessário validar novamente - isso pode causar problemas de comparação de tipos
    // A query WHERE garante que apenas planos do professor correto são retornados
    // DEBUG: Log do plano sendo processado
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[buscarTurmasEDisciplinasProfessorComPlanoAtivo] 🔍 Processando plano ${plano.id}:`, {
        professorId: plano.professorId,
        professorIdNormalizado: String(plano.professorId).trim(),
        professorIdEsperado: professorIdString,
        match: String(plano.professorId).trim() === professorIdString,
        disciplinaId: plano.disciplinaId,
        disciplinaNome: plano.disciplina?.nome || 'SEM DISCIPLINA',
        turmaId: plano.turmaId || 'null',
        estado: plano.estado,
        bloqueado: plano.bloqueado,
        instituicaoId: plano.instituicaoId,
      });
    }
    
    // Separar por presença de turma
    // CORREÇÃO CRÍTICA: Verificar se turmaId existe (não null/undefined) E se turma foi carregada no JOIN
    // Se turmaId existe mas turma não foi carregada, buscar a turma separadamente
    const temTurmaId = !!(plano.turmaId && typeof plano.turmaId === 'string' && plano.turmaId.trim() !== '');
    const temTurmaCarregada = !!(plano.turma && plano.turma.id);
    
    if (temTurmaId && temTurmaCarregada) {
      // Plano COM turma → adicionar em turmas
      planosComTurma++;
      // CORREÇÃO: Usar chave única que inclui disciplinaId para permitir múltiplas disciplinas na mesma turma
      // IMPORTANTE: Um professor pode ter múltiplas disciplinas na mesma turma
      const chaveTurma = `${plano.turmaId}-${plano.disciplinaId}`;
      
      if (!turmasMap.has(chaveTurma) && plano.turma) {
        const cargaHorariaRealizada = (plano.aulasLancadas || []).reduce((s: number, a: any) => s + (a.cargaHoraria || 0), 0);
        turmasMap.set(chaveTurma, {
          id: plano.turma.id,
          nome: plano.turma.nome,
          codigo: plano.turma.nome, // Turma não tem codigo, usar nome como fallback
          disciplinaId: plano.disciplinaId,
          disciplinaNome: plano.disciplina.nome,
          planoEnsinoId: plano.id,
          planoEstado: plano.estado,
          planoBloqueado: plano.bloqueado,
          turma: plano.turma,
          curso: plano.curso || (plano.turma?.curso || null),
          cargaHorariaTotal: plano.cargaHorariaTotal ?? plano.disciplina?.cargaHoraria ?? 0,
          cargaHorariaPlanejada: plano.cargaHorariaPlanejada ?? 0,
          cargaHorariaRealizada,
        });
        console.log(`[buscarTurmasEDisciplinasProfessorComPlanoAtivo] ✅ Turma: ${plano.turma.id} - Disciplina: ${plano.disciplina.nome} - Plano: ${plano.id} - Estado: ${plano.estado} - Bloqueado: ${plano.bloqueado}`);
      } else if (plano.turma) {
        console.log(`[buscarTurmasEDisciplinasProfessorComPlanoAtivo] ⚠️ Turma ${plano.turma.id} com disciplina ${plano.disciplina.nome} já existe no mapa - usando plano mais recente`);
      }
    } else if (temTurmaId && !temTurmaCarregada) {
      // CORREÇÃO CRÍTICA: Se turmaId existe mas turma não foi carregada, buscar a turma separadamente
      // Isso pode acontecer se a turma foi deletada ou se há problema no JOIN
      console.warn(`[buscarTurmasEDisciplinasProfessorComPlanoAtivo] ⚠️ Plano ${plano.id} tem turmaId ${plano.turmaId} mas turma não foi carregada - buscando turma separadamente`);
      
      try {
        const turmaCarregada = await prisma.turma.findFirst({
          where: {
            id: plano.turmaId || undefined,
            instituicaoId: instituicaoIdString,
          },
          select: {
            id: true,
            nome: true,
            ano: true,
            semestre: true,
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
            turno: {
              select: {
                id: true,
                nome: true,
              },
            },
            sala: true,
            capacidade: true,
          },
        });
        
        if (turmaCarregada) {
          planosComTurma++;
          const chaveTurma = `${plano.turmaId}-${plano.disciplinaId}`;
          const cargaHorariaRealizada = (plano.aulasLancadas || []).reduce((s: number, a: any) => s + (a.cargaHoraria || 0), 0);
          
          if (!turmasMap.has(chaveTurma)) {
            turmasMap.set(chaveTurma, {
              id: turmaCarregada.id,
              nome: turmaCarregada.nome,
              codigo: turmaCarregada.nome, // Turma não tem codigo, usar nome como fallback
              disciplinaId: plano.disciplinaId,
              disciplinaNome: plano.disciplina.nome,
              planoEnsinoId: plano.id,
              planoEstado: plano.estado,
              planoBloqueado: plano.bloqueado,
              turma: turmaCarregada,
              curso: plano.curso || (turmaCarregada.curso || null),
              cargaHorariaTotal: plano.cargaHorariaTotal ?? (plano.disciplina as any)?.cargaHoraria ?? 0,
              cargaHorariaPlanejada: plano.cargaHorariaPlanejada ?? 0,
              cargaHorariaRealizada,
            });
            console.log(`[buscarTurmasEDisciplinasProfessorComPlanoAtivo] ✅ Turma carregada separadamente: ${turmaCarregada.id} - Disciplina: ${plano.disciplina.nome} - Plano: ${plano.id}`);
          }
        } else {
          // Turma não encontrada - tratar como disciplina sem turma
          console.warn(`[buscarTurmasEDisciplinasProfessorComPlanoAtivo] ⚠️ Turma ${plano.turmaId} não encontrada - tratando como disciplina sem turma`);
          planosSemTurma++;
          const chaveVirtual = `plano-${plano.id}`;
          
      if (!turmasMap.has(chaveVirtual)) {
        const cargaHorariaRealizada = (plano.aulasLancadas || []).reduce((s: number, a: any) => s + (a.cargaHoraria || 0), 0);
        turmasMap.set(chaveVirtual, {
          id: chaveVirtual,
          nome: plano.disciplina.nome,
          codigo: plano.disciplina.codigo || `DISC-${plano.disciplinaId.substring(0, 8)}`,
          disciplinaId: plano.disciplinaId,
          disciplinaNome: plano.disciplina.nome,
          planoEnsinoId: plano.id,
          planoEstado: plano.estado,
          planoBloqueado: plano.bloqueado,
          turma: null,
          curso: plano.curso || null,
          cargaHorariaTotal: plano.cargaHorariaTotal ?? (plano.disciplina as any)?.cargaHoraria ?? 0,
          cargaHorariaPlanejada: plano.cargaHorariaPlanejada ?? 0,
          cargaHorariaRealizada,
        });
        console.log(`[buscarTurmasEDisciplinasProfessorComPlanoAtivo] ✅ Disciplina sem turma (turma não encontrada): ${plano.disciplina.nome} - Plano: ${plano.id}`);
          }
        }
      } catch (error) {
        console.error(`[buscarTurmasEDisciplinasProfessorComPlanoAtivo] ⚠️ Erro ao buscar turma ${plano.turmaId}:`, error);
        // Em caso de erro, tratar como disciplina sem turma
        planosSemTurma++;
        const chaveVirtual = `plano-${plano.id}`;
        
        if (!turmasMap.has(chaveVirtual)) {
          const cargaHorariaRealizada = (plano.aulasLancadas || []).reduce((s: number, a: any) => s + (a.cargaHoraria || 0), 0);
          turmasMap.set(chaveVirtual, {
            id: chaveVirtual,
            nome: plano.disciplina.nome,
            codigo: plano.disciplina.codigo || `DISC-${plano.disciplinaId.substring(0, 8)}`,
            disciplinaId: plano.disciplinaId,
            disciplinaNome: plano.disciplina.nome,
            planoEnsinoId: plano.id,
            planoEstado: plano.estado,
            planoBloqueado: plano.bloqueado,
            turma: null,
            curso: plano.curso || null,
            cargaHorariaTotal: plano.cargaHorariaTotal ?? (plano.disciplina as any)?.cargaHoraria ?? 0,
            cargaHorariaPlanejada: plano.cargaHorariaPlanejada ?? 0,
            cargaHorariaRealizada,
          });
        }
      }
    } else {
      // Plano SEM turma → adicionar em disciplinasSemTurma
      planosSemTurma++;
      // CORREÇÃO: Usar chave única baseada no planoId para garantir que cada plano sem turma seja incluído
      const chaveVirtual = `plano-${plano.id}`;
      
      if (!turmasMap.has(chaveVirtual)) {
        const cargaHorariaRealizada = (plano.aulasLancadas || []).reduce((s: number, a: any) => s + (a.cargaHoraria || 0), 0);
        turmasMap.set(chaveVirtual, {
          id: chaveVirtual,
          nome: plano.disciplina.nome,
          codigo: plano.disciplina.codigo || `DISC-${plano.disciplinaId.substring(0, 8)}`,
          disciplinaId: plano.disciplinaId,
          disciplinaNome: plano.disciplina.nome,
          planoEnsinoId: plano.id,
          planoEstado: plano.estado,
          planoBloqueado: plano.bloqueado,
          turma: null, // Sem turma vinculada
          curso: plano.curso || null,
          cargaHorariaTotal: plano.cargaHorariaTotal ?? (plano.disciplina as any)?.cargaHoraria ?? 0,
          cargaHorariaPlanejada: plano.cargaHorariaPlanejada ?? 0,
          cargaHorariaRealizada,
        });
        console.log(`[buscarTurmasEDisciplinasProfessorComPlanoAtivo] ✅ Disciplina sem turma: ${plano.disciplina.nome} - Plano: ${plano.id} - Estado: ${plano.estado} - Bloqueado: ${plano.bloqueado}`);
      }
    }
  }

  console.log(`[buscarTurmasEDisciplinasProfessorComPlanoAtivo] 📊 Resultado final: ${planosComTurma} com turma, ${planosSemTurma} sem turma, total no mapa: ${turmasMap.size}`);

  const resultado = Array.from(turmasMap.values());
  
  // DEBUG CRÍTICO: Verificar estrutura dos dados retornados
  const turmasNoResultado = resultado.filter(r => r.turma !== null && r.turma !== undefined);
  const disciplinasNoResultado = resultado.filter(r => r.turma === null || r.turma === undefined);
  
  console.log(`[buscarTurmasEDisciplinasProfessorComPlanoAtivo] ✅ Retornando ${resultado.length} entradas:`);
  console.log(`[buscarTurmasEDisciplinasProfessorComPlanoAtivo]   - ${turmasNoResultado.length} turmas (com turma vinculada)`);
  console.log(`[buscarTurmasEDisciplinasProfessorComPlanoAtivo]   - ${disciplinasNoResultado.length} disciplinas (sem turma)`);
  
  if (resultado.length > 0) {
    console.log(`[buscarTurmasEDisciplinasProfessorComPlanoAtivo] 📝 Amostra do resultado (primeiros 3):`, resultado.slice(0, 3).map(r => ({
      id: r.id,
      nome: r.nome,
      disciplinaNome: r.disciplinaNome,
      temTurma: !!r.turma,
      planoEstado: r.planoEstado,
      planoBloqueado: r.planoBloqueado,
    })));
  }
  
  return resultado;
}

/**
 * Buscar TODAS as turmas do professor (incluindo planos em qualquer estado)
 * 
 * Retorna turmas vinculadas a planos de ensino em QUALQUER estado (RASCUNHO, EM_REVISAO, APROVADO, ENCERRADO).
 * Útil para o dashboard do professor ver todas as suas atribuições, mesmo que pendentes de aprovação.
 * 
 * @param instituicaoId - ID da instituição
 * @param professorId - ID do professor
 * @param anoLetivoId - ID do ano letivo (opcional, filtra por ano letivo)
 * @returns Array de turmas com informações do plano de ensino (incluindo estado)
 */
/**
 * Buscar TODAS as turmas e disciplinas do professor (incluindo planos em qualquer estado)
 * 
 * REGRA ABSOLUTA: Plano de Ensino é a FONTE DA VERDADE
 * Esta função DEVE começar a query a partir de PlanoEnsino (não em Turma)
 * 
 * Retorna turmas e disciplinas vinculadas a planos de ensino em QUALQUER estado:
 * - RASCUNHO, EM_REVISAO, APROVADO, ENCERRADO
 * - Bloqueados ou não bloqueados
 * - Com ou sem turma vinculada
 * 
 * @param instituicaoId - ID da instituição (SEMPRE do JWT)
 * @param professorId - ID do professor (professores.id, NÃO users.id)
 * @param anoLetivoId - ID do ano letivo (opcional, se não fornecido busca automaticamente o ATIVO)
 * @returns Array de turmas e disciplinas sem turma com informações do plano de ensino
 */
export async function buscarTurmasProfessorComPlanos(
  instituicaoId: string,
  professorId: string,
  anoLetivoId?: string | null
): Promise<Array<{
  id: string;
  nome: string;
  codigo: string;
  disciplinaId: string;
  disciplinaNome: string;
  planoEnsinoId: string;
  planoEstado: string;
  planoBloqueado: boolean;
  turma: any;
  curso?: any; // Curso do plano (pode existir mesmo sem turma)
}>> {
  // REGRA ABSOLUTA 1: Filtros obrigatórios vêm SOMENTE do JWT
  // instituicaoId e professorId são garantidos pelo controller
  // IMPORTANTE: professorId é professores.id (não users.id)
  // O controller já resolveu users.id → professores.id usando resolveProfessorId
  
  // REGRA ABSOLUTA 2: Se anoLetivoId não foi fornecido, buscar automaticamente o ano letivo ATIVO
  // MAS: Não eliminar planos de outros anos (visíveis em leitura)
  // O filtro de ano letivo é apenas para priorizar, não para ocultar
  let anoLetivoIdFinal = anoLetivoId;
  if (!anoLetivoIdFinal) {
    const anoLetivoAtivo = await buscarAnoLetivoAtivo(instituicaoId);
    if (anoLetivoAtivo) {
      anoLetivoIdFinal = anoLetivoAtivo.id;
      console.log(`[buscarTurmasProfessorComPlanos] anoLetivoId não fornecido - usando ano letivo ATIVO: ${anoLetivoIdFinal} (ano: ${anoLetivoAtivo.ano})`);
    } else {
      console.log(`[buscarTurmasProfessorComPlanos] Nenhum ano letivo ATIVO encontrado - buscando planos sem filtro de ano letivo`);
    }
  }

  // REGRA ABSOLUTA 3: Query DEVE começar no PlanoEnsino (FONTE DA VERDADE)
  // JOIN explícito com: disciplina, professor, turma (LEFT JOIN)
  // NÃO exigir turma para retornar plano
  // NÃO filtrar por estado ou bloqueado - buscar TODOS os planos válidos
  
  const professorIdString = String(professorId);
  
  const where: any = {
    AND: [
      {
        professorId: professorIdString,
      },
      {
        disciplinaId: { not: null },
      },
      {
        instituicaoId: instituicaoId,
      },
    ],
    // NÃO filtrar por estado - buscar TODOS (RASCUNHO, EM_REVISAO, APROVADO, ENCERRADO)
    // NÃO filtrar por bloqueado - buscar TODOS (bloqueados e não bloqueados)
  };

  // REGRA ABSOLUTA 4: Filtro de ano letivo NÃO elimina planos de outros anos
  // CORREÇÃO CRÍTICA: Se anoLetivoId foi fornecido, filtrar por ele
  // MAS: Se não houver resultados, retornar array vazio (não erro)
  // IMPORTANTE: Não filtrar por ano letivo se não fornecido - mostrar TODOS os planos
  if (anoLetivoIdFinal) {
    where.AND.push({
      anoLetivoId: anoLetivoIdFinal,
    });
    console.log(`[buscarTurmasProfessorComPlanos] Filtrando por anoLetivoId: ${anoLetivoIdFinal}`);
  } else {
    console.log(`[buscarTurmasProfessorComPlanos] Sem filtro de ano letivo - buscando em TODOS os anos`);
  }

  console.log(`[buscarTurmasProfessorComPlanos] Buscando planos com where:`, JSON.stringify(where, null, 2));
  console.log(`[buscarTurmasProfessorComPlanos] Parâmetros: instituicaoId=${instituicaoId}, professorId=${professorIdString}, anoLetivoId=${anoLetivoIdFinal || 'N/A'}`);

  // REGRA ABSOLUTA 5: Query a partir de PlanoEnsino com JOINs explícitos
  // Usar include para garantir que todas as relações sejam carregadas
  const planosEnsino = await prisma.planoEnsino.findMany({
    where,
    include: {
      // JOIN explícito com Disciplina (obrigatório)
      disciplina: {
        select: {
          id: true,
          nome: true,
          codigo: true,
          instituicaoId: true,
          cargaHoraria: true,
        },
      },
      // JOIN explícito com Curso (opcional)
      curso: {
        select: {
          id: true,
          nome: true,
          codigo: true,
        },
      },
      // LEFT JOIN com Turma (opcional - plano pode não ter turma)
      turma: {
        select: {
          id: true,
          nome: true,
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
          turno: {
            select: {
              id: true,
              nome: true,
            },
          },
          ano: true,
          semestre: true,
          sala: true,
          capacidade: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc', // Planos mais recentes primeiro
    },
  });

  console.log(`[buscarTurmasProfessorComPlanos] Encontrados ${planosEnsino.length} planos de ensino`);

  // Validação: Verificar se há planos sem disciplina (não deve acontecer)
  const planosComDisciplina = planosEnsino.filter(p => p.disciplina !== null);
  const planosSemDisciplina = planosEnsino.filter(p => p.disciplina === null);
  
  if (planosSemDisciplina.length > 0) {
    console.error(`[buscarTurmasProfessorComPlanos] ⚠️ ERRO: ${planosSemDisciplina.length} planos SEM DISCIPLINA!`);
    console.error(`[buscarTurmasProfessorComPlanos] IDs:`, planosSemDisciplina.map(p => p.id));
  }

  if (planosEnsino.length > 0) {
    console.log(`[buscarTurmasProfessorComPlanos] Detalhes dos planos:`, planosEnsino.map(p => ({
      id: p.id,
      estado: p.estado,
      bloqueado: p.bloqueado,
      turmaId: p.turmaId,
      disciplinaId: p.disciplinaId,
      disciplinaNome: p.disciplina?.nome || 'SEM DISCIPLINA',
      temTurma: !!p.turma,
      instituicaoId: p.instituicaoId,
    })));
  }

  // REGRA ABSOLUTA 6: Separar visibilidade de ação
  // Se plano tem turmaId → adicionar em turmas[]
  // Se plano NÃO tem turmaId → adicionar em disciplinasSemTurma[]
  // Estados são apenas flags de bloqueio (calculadas no controller)
  
  const turmasMap = new Map<string, {
    id: string;
    nome: string;
    codigo: string; // Turma não tem codigo, usar nome como fallback
    disciplinaId: string;
    disciplinaNome: string;
    planoEnsinoId: string;
    planoEstado: string;
    planoBloqueado: boolean;
    turma: any;
    curso?: any;
    cargaHorariaTotal?: number;
    cargaHorariaPlanejada?: number;
    cargaHorariaRealizada?: number;
  }>();

  let planosComTurma = 0;
  let planosSemTurma = 0;

  // Processar TODOS os planos válidos
  for (const plano of planosEnsino) {
    // Validar que plano tem disciplina (obrigatório)
    if (!plano.disciplina || !plano.disciplinaId) {
      console.warn(`[buscarTurmasProfessorComPlanos] Plano ${plano.id} sem disciplina - ignorando`);
      continue;
    }
    if (plano.disciplina.instituicaoId !== instituicaoId) {
      throw new AppError(
        `Plano de ensino ${plano.id} com disciplina de outra instituição (${plano.disciplina.instituicaoId} vs ${instituicaoId}). Violação de multi-tenant.`,
        403
      );
    }

    // Separar por presença de turma
    if (plano.turmaId && plano.turma) {
      // Plano COM turma → adicionar em turmas
      planosComTurma++;
      // Se já existe a turma no mapa, manter apenas uma (usar o plano mais recente)
      if (!turmasMap.has(plano.turmaId)) {
        turmasMap.set(plano.turmaId, {
          id: plano.turma.id,
          nome: plano.turma.nome,
          codigo: plano.turma.nome, // Turma não tem codigo, usar nome como fallback
          disciplinaId: plano.disciplinaId,
          disciplinaNome: plano.disciplina.nome,
          planoEnsinoId: plano.id,
          planoEstado: plano.estado,
          planoBloqueado: plano.bloqueado,
          turma: plano.turma,
          curso: plano.curso || plano.turma.curso || null,
        });
        console.log(`[buscarTurmasProfessorComPlanos] ✅ Turma: ${plano.turma.id} - Plano: ${plano.id} - Estado: ${plano.estado} - Bloqueado: ${plano.bloqueado}`);
      }
    } else {
      // Plano SEM turma → adicionar em disciplinasSemTurma
      planosSemTurma++;
      const chaveVirtual = `plano-${plano.id}`;
      
      if (!turmasMap.has(chaveVirtual)) {
        turmasMap.set(chaveVirtual, {
          id: chaveVirtual,
          nome: plano.disciplina.nome,
          codigo: plano.disciplina.codigo || `DISC-${plano.disciplinaId.substring(0, 8)}`,
          disciplinaId: plano.disciplinaId,
          disciplinaNome: plano.disciplina.nome,
          planoEnsinoId: plano.id,
          planoEstado: plano.estado,
          planoBloqueado: plano.bloqueado,
          turma: null,
          curso: plano.curso || null,
        });
        console.log(`[buscarTurmasProfessorComPlanos] ✅ Disciplina sem turma: ${plano.disciplina.nome} - Plano: ${plano.id} - Estado: ${plano.estado} - Bloqueado: ${plano.bloqueado}`);
      }
    }
  }

  console.log(`[buscarTurmasProfessorComPlanos] Resultado: ${planosComTurma} com turma, ${planosSemTurma} sem turma, total: ${turmasMap.size}`);

  const resultado = Array.from(turmasMap.values());
  return resultado;
}

