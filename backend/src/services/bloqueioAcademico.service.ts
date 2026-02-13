import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { AuditService, ModuloAuditoria, EntidadeAuditoria, AcaoAuditoria } from './audit.service.js';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Configurações avançadas de bloqueio acadêmico por instituição
 */
export interface ConfiguracaoBloqueioAcademico {
  // Bloqueios por situação financeira
  bloquearMatriculaPorFinanceiro: boolean;
  bloquearDocumentosPorFinanceiro: boolean;
  bloquearCertificadosPorFinanceiro: boolean;
  
  // Permissões mesmo com bloqueio financeiro
  permitirAulasComBloqueioFinanceiro: boolean;
  permitirAvaliacoesComBloqueioFinanceiro: boolean;
  
  // Mensagens institucionais
  mensagemBloqueioMatricula: string | null;
  mensagemBloqueioDocumentos: string | null;
  mensagemBloqueioCertificados: string | null;
}

/**
 * Situação financeira do aluno
 */
export interface SituacaoFinanceiraAluno {
  alunoId: string;
  instituicaoId: string;
  temMensalidadesPendentes: boolean;
  mensalidadesPendentes: number;
  valorTotalDevido: Decimal;
  diasMaiorAtraso: number;
  situacaoRegular: boolean;
}

/**
 * Tipo de operação que pode ser bloqueada
 */
export enum TipoOperacaoBloqueada {
  MATRICULA = 'MATRICULA',
  DOCUMENTOS = 'DOCUMENTOS',
  CERTIFICADOS = 'CERTIFICADOS',
  AULAS = 'AULAS',
  AVALIACOES = 'AVALIACOES',
}

/**
 * Resultado da verificação de bloqueio
 */
export interface ResultadoBloqueio {
  bloqueado: boolean;
  motivo: string | null;
  tipoOperacao: TipoOperacaoBloqueada;
  configuracao: ConfiguracaoBloqueioAcademico | null;
  situacaoFinanceira: SituacaoFinanceiraAluno | null;
}

/**
 * Buscar configuração de bloqueio acadêmico da instituição
 * Se não existir, retorna configuração padrão (sem bloqueios)
 */
export async function buscarConfiguracaoBloqueioAcademico(
  instituicaoId: string
): Promise<ConfiguracaoBloqueioAcademico> {
  // Buscar configuração no banco
  const configuracao = await prisma.configuracaoInstituicao.findUnique({
    where: { instituicaoId },
    select: {
      bloquearMatriculaPorFinanceiro: true,
      bloquearDocumentosPorFinanceiro: true,
      bloquearCertificadosPorFinanceiro: true,
      permitirAulasComBloqueioFinanceiro: true,
      permitirAvaliacoesComBloqueioFinanceiro: true,
      mensagemBloqueioMatricula: true,
      mensagemBloqueioDocumentos: true,
      mensagemBloqueioCertificados: true,
    }
  });

  // Se não existe configuração, retornar padrão (sem bloqueios por padrão)
  // Configuração padrão: bloqueios desativados, permitir aulas e avaliações
  if (!configuracao) {
    return {
      bloquearMatriculaPorFinanceiro: false,
      bloquearDocumentosPorFinanceiro: false,
      bloquearCertificadosPorFinanceiro: false,
      permitirAulasComBloqueioFinanceiro: true,
      permitirAvaliacoesComBloqueioFinanceiro: true,
      mensagemBloqueioMatricula: null,
      mensagemBloqueioDocumentos: null,
      mensagemBloqueioCertificados: null,
    };
  }

  // Retornar configuração do banco (valores padrão se null)
  return {
    bloquearMatriculaPorFinanceiro: configuracao.bloquearMatriculaPorFinanceiro ?? false,
    bloquearDocumentosPorFinanceiro: configuracao.bloquearDocumentosPorFinanceiro ?? false,
    bloquearCertificadosPorFinanceiro: configuracao.bloquearCertificadosPorFinanceiro ?? false,
    permitirAulasComBloqueioFinanceiro: configuracao.permitirAulasComBloqueioFinanceiro ?? true,
    permitirAvaliacoesComBloqueioFinanceiro: configuracao.permitirAvaliacoesComBloqueioFinanceiro ?? true,
    mensagemBloqueioMatricula: configuracao.mensagemBloqueioMatricula ?? null,
    mensagemBloqueioDocumentos: configuracao.mensagemBloqueioDocumentos ?? null,
    mensagemBloqueioCertificados: configuracao.mensagemBloqueioCertificados ?? null,
  };
}

/**
 * Verificar situação financeira do aluno
 * REGRA: Verifica mensalidades pendentes e em atraso
 */
export async function verificarSituacaoFinanceira(
  alunoId: string,
  instituicaoId: string
): Promise<SituacaoFinanceiraAluno> {
  // Buscar todas as mensalidades do aluno na instituição
  const mensalidades = await prisma.mensalidade.findMany({
    where: {
      alunoId,
      aluno: {
        instituicaoId,
      },
      status: {
        notIn: ['Pago', 'Cancelado']
      }
    }
  });

  // Filtrar mensalidades vencidas (pendentes)
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const mensalidadesPendentes = mensalidades.filter(m => {
    const dataVenc = new Date(m.dataVencimento);
    dataVenc.setHours(0, 0, 0, 0);
    return dataVenc < hoje;
  });

  // Calcular valor total devido (incluindo multa e juros se aplicável)
  let valorTotalDevido = new Decimal(0);
  let maiorAtraso = 0;

  for (const mensalidade of mensalidadesPendentes) {
    // Valor base
    let valorDevido = mensalidade.valor || new Decimal(0);

    // Adicionar multa e juros se aplicável
    if (mensalidade.valorMulta) {
      valorDevido = valorDevido.plus(mensalidade.valorMulta);
    }
    if (mensalidade.valorJuros) {
      valorDevido = valorDevido.plus(mensalidade.valorJuros);
    }

    valorTotalDevido = valorTotalDevido.plus(valorDevido);

    // Calcular dias de atraso
    const dataVenc = new Date(mensalidade.dataVencimento);
    dataVenc.setHours(0, 0, 0, 0);
    const diasAtraso = Math.floor((hoje.getTime() - dataVenc.getTime()) / (1000 * 60 * 60 * 24));
    if (diasAtraso > maiorAtraso) {
      maiorAtraso = diasAtraso;
    }
  }

  return {
    alunoId,
    instituicaoId,
    temMensalidadesPendentes: mensalidadesPendentes.length > 0,
    mensalidadesPendentes: mensalidadesPendentes.length,
    valorTotalDevido,
    diasMaiorAtraso: maiorAtraso,
    situacaoRegular: mensalidadesPendentes.length === 0,
  };
}

/**
 * Verificar se operação está bloqueada para o aluno
 * REGRA ABSOLUTA: Todas as decisões são tomadas no backend
 */
export async function verificarBloqueioAcademico(
  alunoId: string,
  instituicaoId: string,
  tipoOperacao: TipoOperacaoBloqueada
): Promise<ResultadoBloqueio> {
  // 1. Buscar configuração da instituição
  const configuracao = await buscarConfiguracaoBloqueioAcademico(instituicaoId);

  // 2. Verificar situação financeira
  const situacaoFinanceira = await verificarSituacaoFinanceira(alunoId, instituicaoId);

  // 3. Aplicar regras de bloqueio conforme configuração
  let bloqueado = false;
  let motivo: string | null = null;

  switch (tipoOperacao) {
    case TipoOperacaoBloqueada.MATRICULA:
      if (configuracao.bloquearMatriculaPorFinanceiro && !situacaoFinanceira.situacaoRegular) {
        bloqueado = true;
        motivo = configuracao.mensagemBloqueioMatricula || 
          `Matrícula bloqueada devido a situação financeira irregular. ` +
          `Existem ${situacaoFinanceira.mensalidadesPendentes} mensalidade(s) pendente(s) ` +
          `no valor total de R$ ${situacaoFinanceira.valorTotalDevido.toFixed(2)}.`;
      }
      break;

    case TipoOperacaoBloqueada.DOCUMENTOS:
      if (configuracao.bloquearDocumentosPorFinanceiro && !situacaoFinanceira.situacaoRegular) {
        bloqueado = true;
        motivo = configuracao.mensagemBloqueioDocumentos || 
          `Emissão de documentos bloqueada devido a situação financeira irregular. ` +
          `Regularize sua situação financeira para emitir documentos.`;
      }
      break;

    case TipoOperacaoBloqueada.CERTIFICADOS:
      // REGRA ESPECIAL: Certificados exigem situação acadêmica E financeira regular
      if (configuracao.bloquearCertificadosPorFinanceiro && !situacaoFinanceira.situacaoRegular) {
        bloqueado = true;
        motivo = configuracao.mensagemBloqueioCertificados || 
          `Emissão de certificados bloqueada. ` +
          `É necessário que a situação acadêmica e financeira estejam regulares. ` +
          `Sua situação financeira está irregular.`;
      }
      break;

    case TipoOperacaoBloqueada.AULAS:
      // Se configurado para permitir aulas mesmo com bloqueio financeiro, não bloquear
      if (!configuracao.permitirAulasComBloqueioFinanceiro && !situacaoFinanceira.situacaoRegular) {
        bloqueado = true;
        motivo = `Participação em aulas bloqueada devido a situação financeira irregular.`;
      }
      break;

    case TipoOperacaoBloqueada.AVALIACOES:
      // Se configurado para permitir avaliações mesmo com bloqueio financeiro, não bloquear
      if (!configuracao.permitirAvaliacoesComBloqueioFinanceiro && !situacaoFinanceira.situacaoRegular) {
        bloqueado = true;
        motivo = `Participação em avaliações bloqueada devido a situação financeira irregular.`;
      }
      break;
  }

  return {
    bloqueado,
    motivo,
    tipoOperacao,
    configuracao,
    situacaoFinanceira,
  };
}

/**
 * Registrar tentativa de geração bloqueada no log de auditoria
 * REGRA DE SEGURANÇA: Toda tentativa bloqueada deve ser registrada
 */
export async function registrarTentativaBloqueada(
  usuarioId: string,
  instituicaoId: string,
  alunoId: string,
  tipoOperacao: TipoOperacaoBloqueada,
  motivo: string,
  detalhes?: any
): Promise<void> {
  try {
    // Usar AuditService.log com req=null pois não temos acesso ao Request aqui
    // O AuditService.log aceita req: Request | null
    await AuditService.log(null, {
      modulo: ModuloAuditoria.RELATORIOS_OFICIAIS,
      entidade: EntidadeAuditoria.RELATORIO_GERADO,
      acao: AcaoAuditoria.BLOCK,
      entidadeId: alunoId,
      instituicaoId,
      dadosNovos: {
        tipoOperacao,
        alunoId,
        motivo,
        bloqueado: true,
        ...detalhes,
      },
      observacao: `Bloqueio financeiro: ${motivo}`,
    });
  } catch (error) {
    // Log de erro, mas não falhar a operação
    console.error('[BloqueioAcademico] Erro ao registrar tentativa bloqueada:', error);
  }
}

/**
 * ============================================================================
 * BLOQUEIO ACADÊMICO INSTITUCIONAL (SIGA/SIGAE)
 * ============================================================================
 * 
 * REGRAS ABSOLUTAS:
 * - Ensino Superior: SEM CURSO → SEM AÇÃO ACADÊMICA
 * - Ensino Secundário: SEM CLASSE → SEM AÇÃO ACADÊMICA
 * - Todas as validações no backend (não confiar no frontend)
 * - Usar req.user.tipoAcademico para decidir regras
 */

/**
 * Resultado da validação de bloqueio acadêmico institucional
 */
export interface ResultadoBloqueioInstitucional {
  bloqueado: boolean;
  motivo: string | null;
  tipoAcademico: 'SUPERIOR' | 'SECUNDARIO' | null;
  matriculaAnualAtiva: boolean;
  cursoId: string | null;
  classeId: string | null;
}

/**
 * Validar bloqueio acadêmico institucional
 * 
 * REGRAS:
 * 1. Ensino Superior: aluno DEVE ter cursoId na MatriculaAnual ATIVA
 * 2. Ensino Secundário: aluno DEVE ter classeId na MatriculaAnual ATIVA
 * 3. MatriculaAnual DEVE estar ATIVA (status = ATIVA)
 * 4. Aluno DEVE estar matriculado na disciplina (AlunoDisciplina) se disciplinaId fornecido
 * 
 * @param alunoId ID do aluno
 * @param instituicaoId ID da instituição
 * @param tipoAcademico Tipo acadêmico da instituição (SUPERIOR ou SECUNDARIO)
 * @param disciplinaId ID da disciplina (opcional, para validar matrícula na disciplina)
 * @param anoLetivoId ID do ano letivo (opcional, para validar matrícula no ano)
 * @returns ResultadoBloqueioInstitucional
 */
export async function validarBloqueioAcademicoInstitucional(
  alunoId: string,
  instituicaoId: string,
  tipoAcademico: 'SUPERIOR' | 'SECUNDARIO' | null,
  disciplinaId?: string,
  anoLetivoId?: string
): Promise<ResultadoBloqueioInstitucional> {
  // 1. Buscar aluno e validar multi-tenant
  const aluno = await prisma.user.findFirst({
    where: {
      id: alunoId,
      instituicaoId: instituicaoId,
    },
    select: {
      id: true,
      nomeCompleto: true,
      instituicaoId: true,
    },
  });

  if (!aluno) {
    throw new AppError('Aluno não encontrado ou não pertence à instituição', 404);
  }

  // 2. Buscar MatriculaAnual ATIVA do aluno
  const whereMatricula: any = {
    alunoId,
    instituicaoId,
    status: 'ATIVA',
  };

  // Se anoLetivoId fornecido, filtrar por ele
  if (anoLetivoId) {
    whereMatricula.anoLetivoId = anoLetivoId;
  }

  const matriculaAnual = await prisma.matriculaAnual.findFirst({
    where: whereMatricula,
    select: {
      id: true,
      status: true,
      cursoId: true,
      classeId: true,
      anoLetivoId: true,
    },
    orderBy: {
      createdAt: 'desc', // Pegar a mais recente
    },
  });

  // 3. Validar MatriculaAnual ATIVA
  if (!matriculaAnual || matriculaAnual.status !== 'ATIVA') {
    return {
      bloqueado: true,
      motivo: 'Aluno não possui matrícula anual ativa. Operação acadêmica bloqueada.',
      tipoAcademico,
      matriculaAnualAtiva: false,
      cursoId: null,
      classeId: null,
    };
  }

  // 4. Validar conforme tipo acadêmico
  if (tipoAcademico === 'SUPERIOR') {
    // ENSINO SUPERIOR: DEVE ter cursoId
    if (!matriculaAnual.cursoId) {
      return {
        bloqueado: true,
        motivo: 'Aluno não possui curso definido. Operação acadêmica bloqueada.',
        tipoAcademico: 'SUPERIOR',
        matriculaAnualAtiva: true,
        cursoId: null,
        classeId: matriculaAnual.classeId,
      };
    }

    // Se classeId estiver preenchido, é inconsistência (Ensino Superior não deve ter classe)
    if (matriculaAnual.classeId) {
      console.warn(
        `[BloqueioAcademico] Inconsistência: Aluno ${alunoId} em Ensino Superior possui classeId: ${matriculaAnual.classeId}`
      );
    }
  } else if (tipoAcademico === 'SECUNDARIO') {
    // ENSINO SECUNDÁRIO: DEVE ter classeId
    if (!matriculaAnual.classeId) {
      return {
        bloqueado: true,
        motivo: 'Aluno não possui classe definida. Operação acadêmica bloqueada.',
        tipoAcademico: 'SECUNDARIO',
        matriculaAnualAtiva: true,
        cursoId: matriculaAnual.cursoId,
        classeId: null,
      };
    }

    // Se cursoId estiver preenchido, é inconsistência (Ensino Secundário não deve ter curso)
    if (matriculaAnual.cursoId) {
      console.warn(
        `[BloqueioAcademico] Inconsistência: Aluno ${alunoId} em Ensino Secundário possui cursoId: ${matriculaAnual.cursoId}`
      );
    }
  } else {
    // Tipo acadêmico não identificado - NÃO bloquear
    // ALUNO pode visualizar boletim/histórico mesmo sem tipoAcademico configurado na instituição
    // A validação curso/classe só é necessária quando tipoAcademico está definido
    return {
      bloqueado: false,
      motivo: null,
      tipoAcademico: null,
      matriculaAnualAtiva: true,
      cursoId: matriculaAnual.cursoId,
      classeId: matriculaAnual.classeId,
    };
  }

  // 5. Se disciplinaId fornecido, validar matrícula na disciplina
  if (disciplinaId) {
    const alunoDisciplina = await prisma.alunoDisciplina.findFirst({
      where: {
        alunoId,
        disciplinaId,
        matriculaAnualId: matriculaAnual.id,
        status: {
          in: ['Cursando', 'Matriculado'], // Status válidos
        },
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!alunoDisciplina) {
      return {
        bloqueado: true,
        motivo: 'Aluno não está matriculado nesta disciplina. Operação acadêmica bloqueada.',
        tipoAcademico,
        matriculaAnualAtiva: true,
        cursoId: matriculaAnual.cursoId,
        classeId: matriculaAnual.classeId,
      };
    }
  }

  // 6. Tudo válido - não bloqueado
  return {
    bloqueado: false,
    motivo: null,
    tipoAcademico,
    matriculaAnualAtiva: true,
    cursoId: matriculaAnual.cursoId,
    classeId: matriculaAnual.classeId,
  };
}

/**
 * Validar e lançar erro se bloqueado
 * Função helper para facilitar uso nos controllers
 * 
 * @param alunoId ID do aluno
 * @param instituicaoId ID da instituição
 * @param tipoAcademico Tipo acadêmico da instituição
 * @param disciplinaId ID da disciplina (opcional)
 * @param anoLetivoId ID do ano letivo (opcional)
 * @throws AppError se bloqueado
 */
export async function validarBloqueioAcademicoInstitucionalOuErro(
  alunoId: string,
  instituicaoId: string,
  tipoAcademico: 'SUPERIOR' | 'SECUNDARIO' | null,
  disciplinaId?: string,
  anoLetivoId?: string
): Promise<void> {
  const resultado = await validarBloqueioAcademicoInstitucional(
    alunoId,
    instituicaoId,
    tipoAcademico,
    disciplinaId,
    anoLetivoId
  );

  if (resultado.bloqueado) {
    throw new AppError(resultado.motivo || 'Operação acadêmica bloqueada', 403);
  }
}

