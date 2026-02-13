import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter, getInstituicaoIdFromFilter, requireTenantScope } from '../middlewares/auth.js';
import { Decimal } from '@prisma/client/runtime/library';
import { Mensalidade, Pagamento } from '@prisma/client';
import { emitirReciboAoConfirmarPagamento } from '../services/recibo.service.js';

/**
 * Buscar configurações de multa e juros
 * Prioridade: ConfiguracaoMulta > Curso > Instituição > Padrão
 */
async function buscarConfigMultaJuros(
  cursoId: string | null,
  instituicaoId: string | null
): Promise<{ multaPercentual: Decimal; jurosDia: Decimal; diasTolerancia: number }> {
  // Valores padrão
  const multaPadrao = new Decimal(2); // 2%
  const jurosPadrao = new Decimal(0.033); // 0.033% ao dia (≈1% ao mês)
  const diasToleranciaPadrao = 5; // 5 dias de tolerância

  // Prioridade 1: Buscar ConfiguracaoMulta da instituição (mais específico)
  if (instituicaoId) {
    const configMulta = await prisma.configuracaoMulta.findUnique({
      where: { instituicaoId },
    });

    if (configMulta) {
      return {
        multaPercentual: configMulta.multaPercentual,
        jurosDia: configMulta.jurosDiaPercentual,
        diasTolerancia: configMulta.diasTolerancia,
      };
    }
  }

  // Prioridade 2: Tentar buscar do curso
  if (cursoId) {
    const curso = await prisma.curso.findUnique({
      where: { id: cursoId },
      select: { multaPercentual: true, jurosDia: true },
    });

    if (curso && (curso.multaPercentual || curso.jurosDia)) {
      return {
        multaPercentual: curso.multaPercentual || multaPadrao,
        jurosDia: curso.jurosDia || jurosPadrao,
        diasTolerancia: diasToleranciaPadrao, // Curso não tem dias_tolerancia, usar padrão
      };
    }
  }

  // Prioridade 3: Buscar da instituição (campos legados)
  if (instituicaoId) {
    const instituicao = await prisma.instituicao.findUnique({
      where: { id: instituicaoId },
      select: { multaPercentual: true, jurosDia: true },
    });

    if (instituicao && (instituicao.multaPercentual || instituicao.jurosDia)) {
      return {
        multaPercentual: instituicao.multaPercentual || multaPadrao,
        jurosDia: instituicao.jurosDia || jurosPadrao,
        diasTolerancia: diasToleranciaPadrao, // Instituição não tem dias_tolerancia, usar padrão
      };
    }
  }

  // Retornar valores padrão
  return { multaPercentual: multaPadrao, jurosDia: jurosPadrao, diasTolerancia: diasToleranciaPadrao };
}

/**
 * Calcular multa e juros automaticamente para mensalidade vencida
 * Aplica apenas se:
 * - Mensalidade está vencida (dataVencimento < hoje)
 * - Status não é Pago ou Cancelado
 * - Não foi paga ainda (dataPagamento é null)
 * - Dias de atraso > dias_tolerancia
 */
async function calcularMultaJuros(
  mensalidade: Mensalidade & { aluno?: any; curso?: any }
): Promise<{ valorMulta: Decimal; valorJuros: Decimal; diasAtraso: number }> {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dataVenc = new Date(mensalidade.dataVencimento);
  dataVenc.setHours(0, 0, 0, 0);

  // Se não está vencida ou já foi paga, não calcular
  if (dataVenc >= hoje || mensalidade.dataPagamento || mensalidade.status === 'Pago' || mensalidade.status === 'Cancelado') {
    return { valorMulta: new Decimal(0), valorJuros: new Decimal(0), diasAtraso: 0 };
  }

  // Calcular dias de atraso
  const diffTime = hoje.getTime() - dataVenc.getTime();
  const diasAtraso = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diasAtraso <= 0) {
    return { valorMulta: new Decimal(0), valorJuros: new Decimal(0), diasAtraso: 0 };
  }

  // Buscar configurações (incluindo dias_tolerancia)
  const instituicaoId = mensalidade.aluno?.instituicaoId || null;
  const config = await buscarConfigMultaJuros(mensalidade.cursoId || null, instituicaoId);

  // Se está dentro da tolerância, não aplicar multa/juros
  if (diasAtraso <= config.diasTolerancia) {
    return { valorMulta: new Decimal(0), valorJuros: new Decimal(0), diasAtraso };
  }

  // Calcular multa (percentual sobre valor base)
  const valorBase = mensalidade.valor.minus(mensalidade.valorDesconto || 0);
  const valorMulta = valorBase.mul(config.multaPercentual).div(100);

  // Calcular juros (percentual por dia sobre valor base)
  // Aplicar apenas nos dias além da tolerância
  const diasComJuros = diasAtraso - config.diasTolerancia;
  const jurosPorDia = valorBase.mul(config.jurosDia).div(100);
  const valorJuros = jurosPorDia.mul(diasComJuros);

  return { valorMulta, valorJuros, diasAtraso };
}

/**
 * Aplicar multa e juros automaticamente em uma mensalidade
 * Atualiza o banco de dados se necessário
 */
async function aplicarMultaJurosAutomatica(
  mensalidade: Mensalidade & { aluno?: any; curso?: any }
): Promise<Mensalidade> {
  const { valorMulta, valorJuros, diasAtraso } = await calcularMultaJuros(mensalidade);

  // Se não há multa/juros para aplicar, retornar sem alterar
  if (valorMulta.eq(0) && valorJuros.eq(0)) {
    return mensalidade;
  }

  // Buscar configurações para atualizar campos
  const instituicaoId = mensalidade.aluno?.instituicaoId || null;
  const config = await buscarConfigMultaJuros(mensalidade.cursoId || null, instituicaoId);

  // Atualizar mensalidade no banco
  const updated = await prisma.mensalidade.update({
    where: { id: mensalidade.id },
    data: {
      valorMulta,
      valorJuros,
      multa: valorMulta.gt(0),
      percentualMulta: config.multaPercentual,
      jurosDia: config.jurosDia,
      // Atualizar status para Atrasado se ainda não estiver
      status: mensalidade.status === 'Pendente' ? 'Atrasado' : mensalidade.status,
    },
    include: {
      aluno: true,
      curso: true,
      pagamentos: true,
    },
  });

  return updated;
}

// Helper function to convert mensalidade to snake_case format
function formatMensalidade(m: Mensalidade & { aluno?: any; pagamentos?: Pagamento[]; curso?: any }) {
  // Safely parse mesReferencia (it's stored as String in DB)
  const mesRef = typeof m.mesReferencia === 'string' 
    ? parseInt(m.mesReferencia, 10) 
    : (typeof m.mesReferencia === 'number' ? m.mesReferencia : 0);
  
  return {
    id: m.id,
    aluno_id: m.alunoId,
    curso_id: m.cursoId || null,
    valor: parseFloat(m.valor.toString()),
    valor_desconto: m.valorDesconto ? parseFloat(m.valorDesconto.toString()) : 0,
    valor_multa: m.valorMulta ? parseFloat(m.valorMulta.toString()) : 0,
    valor_juros: m.valorJuros ? parseFloat(m.valorJuros.toString()) : 0,
    percentual_multa: m.percentualMulta ? parseFloat(m.percentualMulta.toString()) : 2,
    juros_dia: m.jurosDia ? parseFloat(m.jurosDia.toString()) : 0.033,
    multa: m.multa,
    data_vencimento: m.dataVencimento.toISOString().split('T')[0],
    data_pagamento: m.dataPagamento ? m.dataPagamento.toISOString().split('T')[0] : null,
    mes_referencia: isNaN(mesRef) ? 0 : mesRef,
    ano_referencia: m.anoReferencia,
    status: m.status,
    forma_pagamento: m.metodoPagamento || null,
    recibo_numero: m.comprovativo || null, // Store reciboNumero in comprovativo field
    observacoes: m.observacoes || null,
    created_at: m.createdAt,
    updated_at: m.updatedAt,
    aluno: m.aluno ? {
      id: m.aluno.id,
      nome_completo: m.aluno.nomeCompleto,
      email: m.aluno.email,
      numero_identificacao: m.aluno.numeroIdentificacao,
      numero_identificacao_publica: m.aluno.numeroIdentificacaoPublica,
    } : null,
    curso: m.curso ? {
      id: m.curso.id,
      nome: m.curso.nome,
      codigo: m.curso.codigo,
      valor_mensalidade: parseFloat(m.curso.valorMensalidade?.toString() || '0'),
    } : null,
    pagamentos: m.pagamentos?.map(p => ({
      id: p.id,
      mensalidade_id: p.mensalidadeId,
      valor: parseFloat(p.valor.toString()),
      metodo_pagamento: p.metodoPagamento,
      data_pagamento: p.dataPagamento.toISOString().split('T')[0],
      registrado_por: p.registradoPor,
      observacoes: p.observacoes,
      created_at: p.createdAt,
      updated_at: p.updatedAt,
    })) || [],
  };
}

export const getMensalidades = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Debug: Log request details
    console.log('[getMensalidades] ===== INÍCIO DA REQUISIÇÃO =====');
    console.log('[getMensalidades] Query params:', req.query);
    console.log('[getMensalidades] Headers:', {
      authorization: req.headers.authorization ? 'present' : 'missing',
      'content-type': req.headers['content-type']
    });
    
    const filter = addInstitutionFilter(req);
    const { alunoId, status, mesReferencia, anoReferencia } = req.query;

    // Debug: Log user info
    console.log('[getMensalidades] User info:', {
      userId: req.user?.userId,
      email: req.user?.email,
      instituicaoId: req.user?.instituicaoId,
      roles: req.user?.roles,
      filter: filter
    });

    const where: any = {};
    
    // CRITICAL: Multi-tenant security - instituicaoId ALWAYS comes from token, NEVER from frontend
    // SUPER_ADMIN can optionally filter by instituicaoId via query param (for admin purposes)
    if (req.user && req.user.roles.includes('SUPER_ADMIN')) {
      // SUPER_ADMIN can optionally filter by instituicaoId if provided in query
      const queryInstId = req.query.instituicaoId as string;
      if (queryInstId) {
        where.aluno = { instituicaoId: queryInstId };
      }
      // If no query param, SUPER_ADMIN sees all (no filter)
    } else {
      // Non-SUPER_ADMIN users MUST filter by their instituicaoId from token
      if (!filter.instituicaoId) {
        console.warn('[getMensalidades] User without instituicaoId attempting to access mensalidades');
        console.warn('[getMensalidades] User details:', {
          userId: req.user?.userId,
          email: req.user?.email,
          instituicaoId: req.user?.instituicaoId,
          roles: req.user?.roles
        });
        return res.json([]);
      }
      where.aluno = { instituicaoId: filter.instituicaoId };
    }
    
    // Add alunoId filter if provided (will be combined with instituicaoId filter above)
    if (alunoId && typeof alunoId === 'string') {
      if (where.aluno) {
        where.aluno = { ...where.aluno, id: alunoId };
      } else {
        where.alunoId = alunoId;
      }
    }
    
    // Validate and add status filter
    if (status && typeof status === 'string') {
      const validStatuses = ['Pendente', 'Pago', 'Parcial', 'Atrasado', 'Cancelado'];
      if (validStatuses.includes(status)) {
        where.status = status;
      }
    }
    
    // Validate and add mesReferencia filter (must be string 1-12)
    if (mesReferencia) {
      const mesNum = typeof mesReferencia === 'string' ? parseInt(mesReferencia) : mesReferencia;
      if (!isNaN(mesNum) && mesNum >= 1 && mesNum <= 12) {
        where.mesReferencia = String(mesNum);
      }
    }
    
    // Validate and add anoReferencia filter (must be valid year)
    if (anoReferencia) {
      const anoNum = typeof anoReferencia === 'string' ? parseInt(anoReferencia) : anoReferencia;
      if (!isNaN(anoNum) && anoNum >= 2000 && anoNum <= 2100) {
        where.anoReferencia = anoNum;
      }
    }

    // Debug log (sempre logar para diagnóstico)
    console.log('[getMensalidades] Query filter:', JSON.stringify(where, null, 2));

    const mensalidades = await prisma.mensalidade.findMany({
      where,
      include: {
        aluno: { 
          select: { 
            id: true, 
            nomeCompleto: true, 
            email: true, 
            numeroIdentificacao: true,
            numeroIdentificacaoPublica: true,
            instituicaoId: true,
          } 
        },
        curso: {
          select: {
            id: true,
            nome: true,
            codigo: true,
            valorMensalidade: true,
          },
        },
        pagamentos: {
          orderBy: { dataPagamento: 'desc' },
        },
      },
      orderBy: [
        { anoReferencia: 'desc' },
        { mesReferencia: 'desc' }
      ]
    });

    // Aplicar cálculo automático de multa e juros para mensalidades vencidas
    const mensalidadesAtualizadas = await Promise.all(
      mensalidades.map(m => aplicarMultaJurosAutomatica(m))
    );

    // Convert to snake_case for frontend compatibility
    const formatted = mensalidadesAtualizadas.map(formatMensalidade);

    // Debug log (sempre logar para diagnóstico)
    console.log(`[getMensalidades] Found ${formatted.length} mensalidades`);
    if (formatted.length > 0) {
      console.log('[getMensalidades] Mensalidades IDs:', formatted.map(m => m.id).join(', '));
      console.log('[getMensalidades] Mensalidades alunos:', formatted.map(m => `${m.aluno?.nome_completo || 'N/A'} (${m.aluno?.id || 'N/A'})`).join(', '));
    } else {
      console.log('[getMensalidades] ⚠️  NENHUMA MENSALIDADE RETORNADA!');
      console.log('[getMensalidades] Possíveis causas:');
      console.log('[getMensalidades]   1. Usuário sem instituicaoId no token');
      console.log('[getMensalidades]   2. InstituicaoId do usuário diferente das mensalidades');
      console.log('[getMensalidades]   3. Não há mensalidades para esta instituição');
    }
    console.log('[getMensalidades] ===== FIM DA REQUISIÇÃO =====\n');

    res.json(formatted);
  } catch (error) {
    console.error('[getMensalidades] Error:', error);
    next(error);
  }
};

export const getMensalidadeById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);

    const where: any = { id };
    if (filter.instituicaoId) {
      where.aluno = { instituicaoId: filter.instituicaoId };
    }

    const mensalidade = await prisma.mensalidade.findFirst({
      where,
      include: {
        aluno: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
            numeroIdentificacao: true,
            numeroIdentificacaoPublica: true,
            instituicaoId: true,
          },
        },
        curso: {
          select: {
            id: true,
            nome: true,
            codigo: true,
            valorMensalidade: true,
          },
        },
        pagamentos: {
          orderBy: { dataPagamento: 'desc' },
        },
      }
    });

    if (!mensalidade) {
      throw new AppError('Mensalidade não encontrada', 404);
    }

    // Aplicar cálculo automático de multa e juros se necessário
    const mensalidadeAtualizada = await aplicarMultaJurosAutomatica(mensalidade);

    // Convert to snake_case for frontend compatibility
    const formatted = formatMensalidade(mensalidadeAtualizada);

    res.json(formatted);
  } catch (error) {
    next(error);
  }
};

/**
 * Aplicar bolsa de desconto a uma mensalidade
 */
async function aplicarBolsaDesconto(alunoId: string, valorBase: Decimal, mesReferencia: string, anoReferencia: number): Promise<Decimal> {
  // Buscar bolsa ativa do aluno
  const alunoBolsa = await prisma.alunoBolsa.findFirst({
    where: {
      alunoId,
      ativo: true,
      OR: [
        { dataFim: null },
        { dataFim: { gte: new Date(`${anoReferencia}-${mesReferencia.padStart(2, '0')}-01`) } },
      ],
    },
    include: {
      bolsa: true,
    },
  });

  if (!alunoBolsa || !alunoBolsa.bolsa.ativo) {
    return new Decimal(0);
  }

  const bolsa = alunoBolsa.bolsa;
  
  if (bolsa.tipo === 'percentual') {
    // Desconto percentual
    return valorBase.mul(bolsa.valor).div(100);
  } else {
    // Desconto em valor fixo
    return bolsa.valor.gt(valorBase) ? valorBase : bolsa.valor;
  }
}

/**
 * Buscar valor da mensalidade do curso/classe do aluno
 * Retorna { valor: Decimal, cursoId: string | null, classeId: string | null }
 * CRITICAL: Multi-tenant - sempre filtrar por instituicaoId
 * 
 * Lógica:
 * - Ensino Secundário: busca valor da Classe
 * - Ensino Superior: busca valor do Curso
 */
async function buscarValorMensalidadeAluno(
  alunoId: string, 
  valorPadrao: Decimal = new Decimal(50000),
  instituicaoId?: string | null
): Promise<{ valor: Decimal; cursoId: string | null; classeId: string | null }> {
  // CRITICAL: Multi-tenant security - sempre filtrar por instituicaoId
  const whereClause: any = {
    alunoId,
    status: 'Ativa',
  };

  // Se instituicaoId fornecido, garantir que aluno e curso/classe pertencem à mesma instituição
  if (instituicaoId) {
    whereClause.aluno = {
      id: alunoId,
      instituicaoId: instituicaoId,
    };
  }

  // Buscar matrícula ativa do aluno
  const matricula = await prisma.matricula.findFirst({
    where: whereClause,
    include: {
      turma: {
        include: {
          curso: {
            select: {
              id: true,
              valorMensalidade: true,
              instituicaoId: true,
            },
          },
          classe: {
            select: {
              id: true,
              valorMensalidade: true,
              instituicaoId: true,
            },
          },
        },
      },
      aluno: {
        select: {
          id: true,
          instituicaoId: true,
        },
      },
    },
    orderBy: {
      dataMatricula: 'desc', // Pegar a matrícula mais recente
    },
  });

  if (!matricula || !matricula.turma) {
    // Aluno sem matrícula, usar valor padrão
    return { valor: valorPadrao, cursoId: null, classeId: null };
  }

  const turma = matricula.turma;
  const alunoInstituicaoId = matricula.aluno?.instituicaoId;

  // CRITICAL: Verificar tipoAcademico da instituição para garantir lógica correta
  let tipoAcademico: 'SECUNDARIO' | 'SUPERIOR' | null = null;
  if (instituicaoId || alunoInstituicaoId) {
    const instId = instituicaoId || alunoInstituicaoId;
    if (instId) {
      const instituicao = await prisma.instituicao.findUnique({
        where: { id: instId },
        select: { tipoAcademico: true }
      });
      tipoAcademico = instituicao?.tipoAcademico || null;
    }
  }

  // REGRA OBRIGATÓRIA: Ensino Secundário SEMPRE usa Classe (nunca Curso)
  if (tipoAcademico === 'SECUNDARIO') {
    if (turma.classe) {
      // Ensino Secundário: usar APENAS Classe
      const classe = turma.classe;
      
      if (instituicaoId && classe.instituicaoId !== instituicaoId) {
        console.warn(`[buscarValorMensalidadeAluno] Classe ${classe.id} não pertence à instituição ${instituicaoId}`);
        return { valor: valorPadrao, cursoId: null, classeId: null };
      }

      if (alunoInstituicaoId && classe.instituicaoId && classe.instituicaoId !== alunoInstituicaoId) {
        console.warn(`[buscarValorMensalidadeAluno] Classe ${classe.id} não pertence à mesma instituição do aluno`);
        return { valor: valorPadrao, cursoId: null, classeId: null };
      }

      const valorMensalidade = classe.valorMensalidade;
      const valor = valorMensalidade.gt(0) ? valorMensalidade : valorPadrao;

      // CRITICAL: Ensino Secundário - cursoId sempre null (Curso não tem mensalidade)
      return { valor, cursoId: null, classeId: classe.id };
    } else {
      // Ensino Secundário sem Classe - erro de configuração
      console.warn(`[buscarValorMensalidadeAluno] Ensino Secundário: Turma ${turma.id} não possui Classe vinculada`);
      return { valor: valorPadrao, cursoId: null, classeId: null };
    }
  }

  // REGRA OBRIGATÓRIA: Ensino Superior SEMPRE usa Curso (nunca Classe)
  if (tipoAcademico === 'SUPERIOR') {
    if (turma.curso) {
      // Ensino Superior: usar APENAS Curso
      const curso = turma.curso;
      
      if (instituicaoId && curso.instituicaoId !== instituicaoId) {
        console.warn(`[buscarValorMensalidadeAluno] Curso ${curso.id} não pertence à instituição ${instituicaoId}`);
        return { valor: valorPadrao, cursoId: null, classeId: null };
      }

      if (alunoInstituicaoId && curso.instituicaoId && curso.instituicaoId !== alunoInstituicaoId) {
        console.warn(`[buscarValorMensalidadeAluno] Curso ${curso.id} não pertence à mesma instituição do aluno`);
        return { valor: valorPadrao, cursoId: null, classeId: null };
      }

      const valorMensalidade = curso.valorMensalidade;
      const valor = valorMensalidade.gt(0) ? valorMensalidade : valorPadrao;

      // CRITICAL: Ensino Superior - classeId sempre null (não usa Classe)
      return { valor, cursoId: curso.id, classeId: null };
    } else {
      // Ensino Superior sem Curso - erro de configuração
      console.warn(`[buscarValorMensalidadeAluno] Ensino Superior: Turma ${turma.id} não possui Curso vinculado`);
      return { valor: valorPadrao, cursoId: null, classeId: null };
    }
  }

  // Fallback: Se tipoAcademico não identificado, usar lógica antiga (compatibilidade)
  // Mas priorizar Classe se existir (pode ser Ensino Secundário não configurado)
  if (turma.classe) {
    const classe = turma.classe;
    const valorMensalidade = classe.valorMensalidade;
    const valor = valorMensalidade.gt(0) ? valorMensalidade : valorPadrao;
    return { valor, cursoId: null, classeId: classe.id };
  } else if (turma.curso) {
    const curso = turma.curso;
    const valorMensalidade = curso.valorMensalidade;
    const valor = valorMensalidade.gt(0) ? valorMensalidade : valorPadrao;
    return { valor, cursoId: curso.id, classeId: null };
  }

  // Aluno sem curso/classe, usar valor padrão
  return { valor: valorPadrao, cursoId: null, classeId: null };
}

/**
 * Gerar mensalidade automaticamente para um aluno matriculado
 * Esta função é chamada quando um aluno é matriculado em uma turma
 * matriculaId opcional: vínculo quando criada pela matrícula
 */
export async function gerarMensalidadeAutomatica(
  alunoId: string,
  turmaId: string,
  instituicaoId?: string,
  matriculaId?: string
): Promise<void> {
  try {
    // CRITICAL: Multi-tenant security - filtrar por instituicaoId
    const whereClause: any = { id: turmaId };
    if (instituicaoId) {
      whereClause.instituicaoId = instituicaoId;
    }

    // Buscar turma com curso/classe para obter valorMensalidade
    const turma = await prisma.turma.findFirst({
      where: whereClause,
      include: {
        curso: {
          select: {
            id: true,
            valorMensalidade: true,
            instituicaoId: true,
          },
        },
        classe: {
          select: {
            id: true,
            valorMensalidade: true,
            instituicaoId: true,
          },
        },
        instituicao: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!turma) {
      console.warn(`[gerarMensalidadeAutomatica] Turma não encontrada para turmaId: ${turmaId}`);
      return;
    }

    // CRITICAL: Verificar tipoAcademico da instituição
    let tipoAcademico: 'SECUNDARIO' | 'SUPERIOR' | null = null;
    if (instituicaoId || turma.instituicao?.id) {
      const instId = instituicaoId || turma.instituicao?.id;
      if (instId) {
        const instituicao = await prisma.instituicao.findUnique({
          where: { id: instId },
          select: { tipoAcademico: true }
        });
        tipoAcademico = instituicao?.tipoAcademico || null;
      }
    }

    let valorBase: Decimal;
    let cursoId: string | null = null;
    let classeId: string | null = null;

    // REGRA OBRIGATÓRIA: Ensino Secundário SEMPRE usa Classe (nunca Curso)
    if (tipoAcademico === 'SECUNDARIO') {
      if (!turma.classe) {
        console.warn(`[gerarMensalidadeAutomatica] Ensino Secundário: Turma ${turmaId} não possui Classe vinculada`);
        return;
      }

      // Ensino Secundário: usar APENAS Classe
      if (instituicaoId && turma.classe.instituicaoId !== instituicaoId) {
        console.warn(`[gerarMensalidadeAutomatica] Classe ${turma.classe.id} não pertence à instituição ${instituicaoId}`);
        return;
      }

      const valorMensalidadeClasse = turma.classe.valorMensalidade;
      valorBase = valorMensalidadeClasse.gt(0) 
        ? valorMensalidadeClasse 
        : new Decimal(50000);
      classeId = turma.classe.id;
      // CRITICAL: Ensino Secundário - cursoId sempre null
      cursoId = null;
    } 
    // REGRA OBRIGATÓRIA: Ensino Superior SEMPRE usa Curso (nunca Classe)
    else if (tipoAcademico === 'SUPERIOR') {
      if (!turma.curso) {
        console.warn(`[gerarMensalidadeAutomatica] Ensino Superior: Turma ${turmaId} não possui Curso vinculado`);
        return;
      }

      // Ensino Superior: usar APENAS Curso
      if (instituicaoId && turma.curso.instituicaoId !== instituicaoId) {
        console.warn(`[gerarMensalidadeAutomatica] Curso ${turma.curso.id} não pertence à instituição ${instituicaoId}`);
        return;
      }

      const valorMensalidadeCurso = turma.curso.valorMensalidade;
      valorBase = valorMensalidadeCurso.gt(0) 
        ? valorMensalidadeCurso 
        : new Decimal(50000);
      cursoId = turma.curso.id;
      // CRITICAL: Ensino Superior - classeId sempre null
      classeId = null;
    } 
    // Fallback: Se tipoAcademico não identificado, usar lógica antiga (compatibilidade)
    else {
      if (turma.classe) {
        // Priorizar Classe se existir (pode ser Ensino Secundário não configurado)
        const valorMensalidadeClasse = turma.classe.valorMensalidade;
        valorBase = valorMensalidadeClasse.gt(0) 
          ? valorMensalidadeClasse 
          : new Decimal(50000);
        classeId = turma.classe.id;
        cursoId = null;
      } else if (turma.curso) {
        const valorMensalidadeCurso = turma.curso.valorMensalidade;
        valorBase = valorMensalidadeCurso.gt(0) 
          ? valorMensalidadeCurso 
          : new Decimal(50000);
        cursoId = turma.curso.id;
        classeId = null;
      } else {
        console.warn(`[gerarMensalidadeAutomatica] Turma ${turmaId} não possui curso nem classe`);
        return;
      }
    }

    // Obter mês e ano atual
    const agora = new Date();
    const mesReferencia = String(agora.getMonth() + 1); // 1-12
    const anoReferencia = agora.getFullYear();

    // Verificar se já existe mensalidade para este mês/ano
    const mensalidadeExistente = await prisma.mensalidade.findUnique({
      where: {
        alunoId_mesReferencia_anoReferencia: {
          alunoId,
          mesReferencia,
          anoReferencia,
        },
      },
    });

    if (mensalidadeExistente) {
      // Mensalidade já existe, não criar duplicada
      console.log(`[gerarMensalidadeAutomatica] Mensalidade já existe para aluno ${alunoId}, mês ${mesReferencia}/${anoReferencia}`);
      return;
    }

    // Calcular data de vencimento (último dia do mês atual)
    const ultimoDiaMes = new Date(anoReferencia, agora.getMonth() + 1, 0);
    const dataVencimento = ultimoDiaMes;

    // Aplicar bolsa de desconto se existir
    const valorDesconto = await aplicarBolsaDesconto(
      alunoId,
      valorBase,
      mesReferencia,
      anoReferencia
    );

    // Buscar matriculaId se não fornecido (vínculo lancamento -> matrícula)
    let matriculaIdFinal = matriculaId;
    if (!matriculaIdFinal) {
      const mat = await prisma.matricula.findFirst({
        where: { alunoId, turmaId },
        select: { id: true },
      });
      matriculaIdFinal = mat?.id ?? undefined;
    }

    // Criar mensalidade (lançamento PENDENTE - recibo só ao confirmar pagamento)
    await prisma.mensalidade.create({
      data: {
        alunoId,
        matriculaId: matriculaIdFinal,
        cursoId: cursoId,
        classeId: classeId,
        valor: valorBase,
        valorDesconto: valorDesconto.gt(0) ? valorDesconto : undefined,
        mesReferencia,
        anoReferencia,
        dataVencimento,
        percentualMulta: 2, // 2% padrão
        status: 'Pendente',
      },
    });

    console.log(`[gerarMensalidadeAutomatica] Mensalidade criada para aluno ${alunoId}, mês ${mesReferencia}/${anoReferencia}, valor: ${valorBase}`);
  } catch (error: any) {
    // Log erro mas não interrompe o fluxo de matrícula
    console.error(`[gerarMensalidadeAutomatica] Erro ao gerar mensalidade para aluno ${alunoId}:`, error);
    // Não lançar erro para não quebrar o processo de matrícula
  }
}

export const createMensalidade = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // VALIDAÇÃO MULTI-TENANT: Rejeitar explicitamente instituicaoId do body (segurança)
    if (req.body.instituicaoId !== undefined || req.body.instituicao_id !== undefined) {
      throw new AppError('Não é permitido alterar a instituição. O sistema usa a instituição do usuário autenticado.', 400);
    }

    const { alunoId, valor, dataVencimento, mesReferencia, anoReferencia, percentualMulta } = req.body;
    const filter = addInstitutionFilter(req);

    // CRITICAL: Multi-tenant security - instituicaoId from token only
    if (!filter.instituicaoId && !req.user?.roles.includes('SUPER_ADMIN')) {
      throw new AppError('Instituição não identificada', 403);
    }

    // Verificar se aluno pertence à instituição
    const aluno = await prisma.user.findFirst({
      where: {
        id: alunoId,
        ...(filter.instituicaoId ? { instituicaoId: filter.instituicaoId } : {}),
      },
    });

    if (!aluno) {
      throw new AppError('Aluno não encontrado ou não pertence à sua instituição', 404);
    }

    const valorBase = new Decimal(valor);
    
    // Aplicar bolsa de desconto automaticamente
    const valorDesconto = await aplicarBolsaDesconto(
      alunoId,
      valorBase,
      String(mesReferencia),
      anoReferencia
    );

    const mensalidade = await prisma.mensalidade.create({
      data: {
        alunoId,
        valor: valorBase,
        valorDesconto: valorDesconto.gt(0) ? valorDesconto : undefined,
        dataVencimento: new Date(dataVencimento),
        mesReferencia: String(mesReferencia),
        anoReferencia,
        percentualMulta: percentualMulta || 2,
        status: 'Pendente'
      },
      include: {
        aluno: true,
        curso: {
          select: {
            id: true,
            nome: true,
            codigo: true,
            valorMensalidade: true,
          },
        },
        pagamentos: true,
      }
    });

    // Convert to snake_case for frontend compatibility
    const formatted = formatMensalidade(mensalidade);

    res.status(201).json(formatted);
  } catch (error) {
    next(error);
  }
};

export const updateMensalidade = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    const bodyData = req.body;

    const where: any = { id };
    if (filter.instituicaoId) {
      where.aluno = { instituicaoId: filter.instituicaoId };
    }

    const existing = await prisma.mensalidade.findFirst({
      where
    });

    if (!existing) {
      throw new AppError('Mensalidade não encontrada', 404);
    }

    // Map frontend fields to Prisma schema fields
    const updateData: any = {};

    // Map formaPagamento to metodoPagamento (frontend uses formaPagamento, schema uses metodoPagamento)
    if (bodyData.formaPagamento !== undefined) {
      updateData.metodoPagamento = bodyData.formaPagamento;
    }
    // Also support metodoPagamento directly
    if (bodyData.metodoPagamento !== undefined) {
      updateData.metodoPagamento = bodyData.metodoPagamento;
    }

    // Map other fields
    if (bodyData.status !== undefined) {
      updateData.status = bodyData.status;
    }

    // Process date fields
    if (bodyData.dataVencimento) {
      updateData.dataVencimento = new Date(bodyData.dataVencimento);
    }
    if (bodyData.dataPagamento !== undefined) {
      updateData.dataPagamento = bodyData.dataPagamento ? new Date(bodyData.dataPagamento) : null;
    }

    // Map other optional fields
    if (bodyData.observacoes !== undefined) {
      updateData.observacoes = bodyData.observacoes;
    }

    // SIGAE: Recibo é gerado pelo módulo FINANCEIRO ao confirmar pagamento - não aceitar do frontend
    if (bodyData.reciboNumero !== undefined) {
      throw new AppError(
        'Pagamento pendente: recibo só é emitido após confirmação do pagamento. Use o fluxo de registrar pagamento.',
        400
      );
    }

    const mensalidade = await prisma.mensalidade.update({
      where: { id },
      data: updateData,
      include: {
        aluno: true,
        curso: {
          select: {
            id: true,
            nome: true,
            codigo: true,
            valorMensalidade: true,
          },
        },
        pagamentos: {
          orderBy: { dataPagamento: 'desc' },
        },
      }
    });

    // SIGAE: Se status mudou para Pago e não há pagamentos registrados, criar pagamento e emitir recibo
    if (bodyData.status === 'Pago' && mensalidade.pagamentos.length === 0) {
      const instituicaoId = requireTenantScope(req);
      const valorBase = new Decimal(mensalidade.valor);
      const valorDesconto = mensalidade.valorDesconto || new Decimal(0);
      const valorMulta = mensalidade.valorMulta || new Decimal(0);
      const valorTotal = valorBase.minus(valorDesconto).plus(valorMulta);

      const pagamento = await prisma.pagamento.create({
        data: {
          mensalidadeId: mensalidade.id,
          valor: valorTotal,
          metodoPagamento: mensalidade.metodoPagamento || 'MANUAL',
          registradoPor: req.user?.userId,
          observacoes: 'Pagamento confirmado via atualização de status',
        },
      });

      try {
        await emitirReciboAoConfirmarPagamento(pagamento.id, instituicaoId);
        // Recarregar mensalidade com pagamentos/recibos atualizados
        const atualizada = await prisma.mensalidade.findUnique({
          where: { id },
          include: {
            aluno: true,
            curso: { select: { id: true, nome: true, codigo: true, valorMensalidade: true } },
            pagamentos: { orderBy: { dataPagamento: 'desc' } },
          },
        });
        return res.json(formatMensalidade(atualizada || mensalidade));
      } catch (reciboError: any) {
        console.error('[updateMensalidade] Erro ao emitir recibo:', reciboError?.message);
      }
    }

    // Convert to snake_case for frontend compatibility
    const formatted = formatMensalidade(mensalidade);

    res.json(formatted);
  } catch (error) {
    next(error);
  }
};

export const deleteMensalidade = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);

    const where: any = { id };
    if (filter.instituicaoId) {
      where.aluno = { instituicaoId: filter.instituicaoId };
    }

    const existing = await prisma.mensalidade.findFirst({
      where
    });

    if (!existing) {
      throw new AppError('Mensalidade não encontrada', 404);
    }

    await prisma.mensalidade.delete({ where: { id } });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const getMensalidadesByAluno = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const alunoId = req.user?.userId;
    
    if (!alunoId) {
      return res.json([]);
    }

    // Get institution filter for additional security
    const filter = addInstitutionFilter(req);
    
    // Build where clause with optional institution filter
    const where: any = { alunoId };
    
    // If user has instituicaoId, ensure we only get mensalidades from students of that institution
    // This adds an extra security layer
    if (filter.instituicaoId) {
      where.aluno = {
        id: alunoId,
        instituicaoId: filter.instituicaoId,
      };
    }

    const mensalidades = await prisma.mensalidade.findMany({
      where,
      include: {
        aluno: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
            numeroIdentificacao: true,
            numeroIdentificacaoPublica: true,
            instituicaoId: true,
          }
        },
        curso: {
          select: {
            id: true,
            nome: true,
            codigo: true,
            valorMensalidade: true,
          },
        },
        pagamentos: {
          orderBy: { dataPagamento: 'desc' },
        },
      },
      orderBy: [
        { anoReferencia: 'desc' },
        { mesReferencia: 'desc' }
      ]
    });

    // Aplicar cálculo automático de multa e juros para mensalidades vencidas
    const mensalidadesAtualizadas = await Promise.all(
      mensalidades.map(m => aplicarMultaJurosAutomatica(m))
    );

    // Convert to snake_case for frontend compatibility
    const formatted = mensalidadesAtualizadas.map(formatMensalidade);

    // Debug log (only in development)
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[getMensalidadesByAluno] Found ${formatted.length} mensalidades for aluno ${alunoId}`);
    }

    res.json(formatted);
  } catch (error) {
    next(error);
  }
};

/**
 * Gerar mensalidades em lote para alunos específicos
 * VALORES VÊM AUTOMATICAMENTE DO CURSO - valor é opcional (usado apenas se aluno não tiver curso)
 */
export const gerarMensalidadesEmLote = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { alunoIds, valor, mesReferencia, anoReferencia, dataVencimento, percentualMulta } = req.body;
    const filter = addInstitutionFilter(req);

    if (!Array.isArray(alunoIds) || alunoIds.length === 0) {
      throw new AppError('Lista de alunos inválida', 400);
    }

    // CRITICAL: Multi-tenant security - instituicaoId from token only
    if (!filter.instituicaoId && !req.user?.roles.includes('SUPER_ADMIN')) {
      throw new AppError('Instituição não identificada', 403);
    }

    // Verificar se todos os alunos pertencem à instituição
    const alunos = await prisma.user.findMany({
      where: {
        id: { in: alunoIds },
        ...(filter.instituicaoId ? { instituicaoId: filter.instituicaoId } : {}),
      },
    });

    if (alunos.length !== alunoIds.length) {
      throw new AppError('Alguns alunos não foram encontrados ou não pertencem à sua instituição', 400);
    }

    // Valor padrão se fornecido (caso aluno não tenha curso)
    const valorPadrao = valor ? new Decimal(valor) : new Decimal(50000);
    const mesRefStr = String(mesReferencia);
    const dataVenc = new Date(dataVencimento);

    // Buscar valor da mensalidade de cada aluno (do curso/classe)
    // Agrupar por valor para otimizar criação em lote
    // CRITICAL: Multi-tenant - passar instituicaoId para garantir segurança
    const alunosPorValor = new Map<string, { alunoIds: string[]; cursoId: string | null; classeId: string | null; valor: Decimal }>();
    
    for (const alunoId of alunoIds) {
      const { valor: valorAluno, cursoId, classeId } = await buscarValorMensalidadeAluno(alunoId, valorPadrao, getInstituicaoIdFromFilter(filter) ?? undefined);
      const chave = `${cursoId || classeId || 'sem-curso-classe'}-${valorAluno.toString()}`;
      
      if (!alunosPorValor.has(chave)) {
        alunosPorValor.set(chave, {
          alunoIds: [],
          cursoId,
          classeId,
          valor: valorAluno,
        });
      }
      
      alunosPorValor.get(chave)!.alunoIds.push(alunoId);
    }

    // Criar mensalidades agrupadas por valor (otimização em lote)
    let totalGeradas = 0;
    const erros: string[] = [];

    for (const [chave, grupo] of alunosPorValor.entries()) {
      try {
        const mensalidadesData = await Promise.all(
          grupo.alunoIds.map(async (alunoId) => {
            const valorDesconto = await aplicarBolsaDesconto(alunoId, grupo.valor, mesRefStr, anoReferencia);
            
            return {
              alunoId,
              cursoId: grupo.cursoId,
              classeId: grupo.classeId,
              valor: grupo.valor,
              valorDesconto: valorDesconto.gt(0) ? valorDesconto : undefined,
              mesReferencia: mesRefStr,
              anoReferencia,
              dataVencimento: dataVenc,
              percentualMulta: percentualMulta || 2,
              status: 'Pendente' as const,
            };
          })
        );

        const result = await prisma.mensalidade.createMany({
          data: mensalidadesData,
          skipDuplicates: true
        });

        totalGeradas += result.count;
      } catch (error: any) {
        erros.push(`Erro ao gerar mensalidades para grupo ${chave}: ${error.message}`);
        console.error(`[gerarMensalidadesEmLote] Erro no grupo ${chave}:`, error);
      }
    }

    if (totalGeradas === 0 && erros.length > 0) {
      throw new AppError(`Erro ao gerar mensalidades: ${erros.join('; ')}`, 500);
    }

    res.status(201).json({ 
      count: totalGeradas,
      message: `${totalGeradas} mensalidades geradas com sucesso${erros.length > 0 ? ` (${erros.length} erros)` : ''}`,
      ...(erros.length > 0 ? { erros } : {})
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Gerar mensalidades para todos os alunos ativos da instituição
 * Endpoint profissional para geração em massa
 * VALORES VÊM AUTOMATICAMENTE DO CURSO - NÃO EXIGE VALOR MANUAL
 */
export const gerarMensalidadesParaTodosAlunos = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { mesReferencia, anoReferencia, dataVencimento, percentualMulta, valorPadrao } = req.body;
    const filter = addInstitutionFilter(req);

    // CRITICAL: Multi-tenant security - instituicaoId from token only
    if (!filter.instituicaoId && !req.user?.roles.includes('SUPER_ADMIN')) {
      throw new AppError('Instituição não identificada', 403);
    }

    // Validações - valor NÃO é mais obrigatório
    if (!mesReferencia || !anoReferencia || !dataVencimento) {
      throw new AppError('Campos obrigatórios: mesReferencia, anoReferencia, dataVencimento', 400);
    }

    if (mesReferencia < 1 || mesReferencia > 12) {
      throw new AppError('Mês de referência inválido (deve ser entre 1 e 12)', 400);
    }

    // Valor padrão se não fornecido (50000 Kz)
    const valorPadraoDecimal = valorPadrao ? new Decimal(valorPadrao) : new Decimal(50000);

    // Buscar todos os alunos ativos da instituição
    const alunos = await prisma.user.findMany({
      where: {
        instituicaoId: filter.instituicaoId,
        roles: {
          some: {
            role: 'ALUNO'
          }
        }
      },
      select: {
        id: true,
        nomeCompleto: true,
      }
    });

    if (alunos.length === 0) {
      throw new AppError('Nenhum aluno encontrado para esta instituição', 404);
    }

    const mesRefStr = String(mesReferencia);
    const dataVenc = new Date(dataVencimento);

    // Verificar mensalidades existentes para evitar duplicatas
    const mensalidadesExistentes = await prisma.mensalidade.findMany({
      where: {
        alunoId: { in: alunos.map(a => a.id) },
        mesReferencia: mesRefStr,
        anoReferencia,
      },
      select: {
        alunoId: true,
      }
    });

    const alunosComMensalidade = new Set(mensalidadesExistentes.map(m => m.alunoId));
    const alunosParaGerar = alunos.filter(a => !alunosComMensalidade.has(a.id));

    if (alunosParaGerar.length === 0) {
      return res.json({ 
        count: 0, 
        message: 'Todas as mensalidades já foram geradas para este período',
        totalAlunos: alunos.length,
        jaGeradas: mensalidadesExistentes.length
      });
    }

    // Buscar valor da mensalidade de cada aluno (do curso/classe)
    // Agrupar por valor para otimizar criação em lote
    // CRITICAL: Multi-tenant - passar instituicaoId para garantir segurança
    const alunosPorValor = new Map<string, { alunoIds: string[]; cursoId: string | null; classeId: string | null; valor: Decimal }>();
    
    for (const aluno of alunosParaGerar) {
      const { valor, cursoId, classeId } = await buscarValorMensalidadeAluno(aluno.id, valorPadraoDecimal, getInstituicaoIdFromFilter(filter) ?? undefined);
      const chave = `${cursoId || classeId || 'sem-curso-classe'}-${valor.toString()}`;
      
      if (!alunosPorValor.has(chave)) {
        alunosPorValor.set(chave, {
          alunoIds: [],
          cursoId,
          classeId,
          valor,
        });
      }
      
      alunosPorValor.get(chave)!.alunoIds.push(aluno.id);
    }

    // Criar mensalidades agrupadas por valor (otimização em lote)
    let totalGeradas = 0;
    const erros: string[] = [];

    for (const [chave, grupo] of alunosPorValor.entries()) {
      try {
        const mensalidadesData = await Promise.all(
          grupo.alunoIds.map(async (alunoId) => {
            const valorDesconto = await aplicarBolsaDesconto(alunoId, grupo.valor, mesRefStr, anoReferencia);
            
            return {
              alunoId,
              cursoId: grupo.cursoId,
              classeId: grupo.classeId,
              valor: grupo.valor,
              valorDesconto: valorDesconto.gt(0) ? valorDesconto : undefined,
              mesReferencia: mesRefStr,
              anoReferencia,
              dataVencimento: dataVenc,
              percentualMulta: percentualMulta || 2,
              status: 'Pendente' as const,
            };
          })
        );

        const result = await prisma.mensalidade.createMany({
          data: mensalidadesData,
          skipDuplicates: true
        });

        totalGeradas += result.count;
      } catch (error: any) {
        erros.push(`Erro ao gerar mensalidades para grupo ${chave}: ${error.message}`);
        console.error(`[gerarMensalidadesParaTodosAlunos] Erro no grupo ${chave}:`, error);
      }
    }

    if (totalGeradas === 0 && erros.length > 0) {
      throw new AppError(`Erro ao gerar mensalidades: ${erros.join('; ')}`, 500);
    }

    res.status(201).json({ 
      count: totalGeradas,
      totalAlunos: alunos.length,
      jaGeradas: mensalidadesExistentes.length,
      message: `${totalGeradas} mensalidades geradas com sucesso${erros.length > 0 ? ` (${erros.length} erros)` : ''}`,
      ...(erros.length > 0 ? { erros } : {})
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Aplicar multas e juros a todas as mensalidades em atraso da instituição
 * Endpoint para aplicar multas manualmente
 */
export const aplicarMultas = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    // CRITICAL: Multi-tenant security - IGNORAR instituicaoId do body se fornecido
    // Sempre usar instituicaoId do token (req.user.instituicaoId)
    const targetInstituicaoId = getInstituicaoIdFromFilter(filter);

    if (!targetInstituicaoId && !req.user?.roles.includes('SUPER_ADMIN')) {
      throw new AppError('Instituição não identificada', 403);
    }

    // Buscar todas as mensalidades em atraso da instituição
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const where: any = {
      dataVencimento: { lt: hoje },
      status: { notIn: ['Pago', 'Cancelado'] },
      dataPagamento: null,
      aluno: targetInstituicaoId ? { instituicaoId: targetInstituicaoId } : undefined,
    };

    const mensalidades = await prisma.mensalidade.findMany({
      where,
      include: {
        aluno: {
          select: {
            id: true,
            nomeCompleto: true,
            instituicaoId: true,
          },
        },
        curso: {
          select: {
            id: true,
            nome: true,
            valorMensalidade: true,
          },
        },
        pagamentos: true,
      },
    });

    if (mensalidades.length === 0) {
      return res.json({
        message: 'Nenhuma mensalidade em atraso encontrada',
        count: 0,
        atualizadas: 0,
      });
    }

    // Aplicar multas e juros a cada mensalidade
    let atualizadas = 0;
    const erros: string[] = [];

    for (const mensalidade of mensalidades) {
      try {
        await aplicarMultaJurosAutomatica(mensalidade);
        atualizadas++;
      } catch (error: any) {
        erros.push(`Mensalidade ${mensalidade.id}: ${error.message}`);
        console.error(`[aplicarMultas] Erro ao aplicar multa na mensalidade ${mensalidade.id}:`, error);
      }
    }

    res.json({
      message: `${atualizadas} mensalidade(s) atualizada(s) com multas e juros${erros.length > 0 ? ` (${erros.length} erros)` : ''}`,
      count: mensalidades.length,
      atualizadas,
      ...(erros.length > 0 ? { erros } : {}),
    });
  } catch (error) {
    next(error);
  }
};
