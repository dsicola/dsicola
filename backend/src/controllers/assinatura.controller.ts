import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter, getInstituicaoIdFromFilter } from '../middlewares/auth.js';
import { AuditService, AcaoAuditoria } from '../services/audit.service.js';
import { EmailService } from '../services/email.service.js';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // SUPER_ADMIN vê todas, outras roles só vêem sua própria instituição
    const filter = addInstitutionFilter(req);
    const { status } = req.query;
    
    const assinaturas = await prisma.assinatura.findMany({
      where: {
        ...(filter.instituicaoId ? { instituicaoId: filter.instituicaoId } : {}),
        ...(status && { status: status as any }),
      },
      include: { instituicao: true, plano: true },
      orderBy: { createdAt: 'desc' },
    });
    
    res.json(assinaturas);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const assinatura = await prisma.assinatura.findUnique({
      where: { id },
      include: { instituicao: true, plano: true },
    });
    
    if (!assinatura) {
      throw new AppError('Assinatura não encontrada', 404);
    }
    
    res.json(assinatura);
  } catch (error) {
    next(error);
  }
};

export const getByInstituicao = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // CRITICAL: Multi-tenant security - usar instituicaoId do token, não do parâmetro
    // Para SUPER_ADMIN, pode aceitar instituicaoId via parâmetro (ação excepcional)
    // Para outros usuários, sempre usar do token
    const isSuperAdmin = req.user?.roles.includes('SUPER_ADMIN');
    let targetInstituicaoId: string;
    
    // Se rota é /current ou não tem parâmetro, usar do token
    if (req.params.instituicaoId === 'current' || !req.params.instituicaoId) {
      // Usuários normais: sempre usar do token
      const filter = addInstitutionFilter(req);
      const instId = getInstituicaoIdFromFilter(filter);
      if (!instId) {
        throw new AppError('Usuário não possui instituição vinculada', 403);
      }
      targetInstituicaoId = instId;
    } else if (isSuperAdmin && req.params.instituicaoId) {
      // SUPER_ADMIN pode especificar instituição via parâmetro
      targetInstituicaoId = req.params.instituicaoId;
    } else {
      // Tentativa de acessar outra instituição sem permissão
      throw new AppError('Acesso negado: você só pode acessar sua própria instituição', 403);
    }
    
    const assinatura = await prisma.assinatura.findUnique({
      where: { instituicaoId: targetInstituicaoId },
      include: { plano: true },
    });
    
    res.json(assinatura);
  } catch (error) {
    next(error);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = req.body;

    // Log para debug (apenas em desenvolvimento)
    if (process.env.NODE_ENV !== 'production') {
      console.log('[AssinaturaController] Dados recebidos:', JSON.stringify(data, null, 2));
    }

    // EXCEÇÃO CONTROLADA: Esta rota é SUPER_ADMIN only. SUPER_ADMIN cria assinaturas para
    // instituições específicas - por isso instituicaoId vem do body aqui.
    // REGRA: Para qualquer outra rota, instituicaoId SEMPRE vem do JWT.
    if (!data.instituicaoId || !data.planoId) {
      throw new AppError('Instituição e Plano são obrigatórios', 400);
    }

    // Validar que instituicaoId é UUID válido
    const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!UUID_V4_REGEX.test(String(data.instituicaoId).trim())) {
      throw new AppError('ID de instituição inválido', 400);
    }

    // Validar tipo
    if (data.tipo && data.tipo !== 'DEMO' && data.tipo !== 'PAGA') {
      throw new AppError('Tipo deve ser DEMO ou PAGA', 400);
    }

    // Verificar se instituição já tem assinatura
    const existing = await prisma.assinatura.findUnique({
      where: { instituicaoId: data.instituicaoId },
    });

    if (existing) {
      throw new AppError('Esta instituição já possui uma assinatura. Use a atualização para modificar.', 400);
    }

    // Verificar se plano existe e está ativo
    const plano = await prisma.plano.findUnique({
      where: { id: data.planoId },
    });

    if (!plano) {
      throw new AppError('Plano não encontrado', 404);
    }

    if (!plano.ativo) {
      throw new AppError('Plano não está ativo', 400);
    }

    // Buscar tipo acadêmico da instituição
    const instituicao = await prisma.instituicao.findUnique({
      where: { id: data.instituicaoId },
      select: { tipoAcademico: true },
    });

    if (!instituicao) {
      throw new AppError('Instituição não encontrada', 404);
    }

    // BUSCAR PREÇO AUTOMÁTICO baseado no tipo de instituição e plano
    let valorAtualAutomatico: number = 0;
    let precoOrigem: 'AUTOMATICO' | 'OVERRIDE' = 'AUTOMATICO';
    let justificativaOverride: string | null = null;

    const tipo = data.tipo || 'PAGA';
    
    // Para DEMO/TRIAL, valor é 0
    if (tipo === 'DEMO') {
      valorAtualAutomatico = 0;
    } else if (instituicao.tipoAcademico) {
      // Buscar preço na tabela centralizada
      const precoCentralizado = await prisma.planosPrecos.findUnique({
        where: {
          planoId_tipoInstituicao: {
            planoId: data.planoId,
            tipoInstituicao: instituicao.tipoAcademico,
          },
        },
      });

      if (precoCentralizado && precoCentralizado.ativo) {
        valorAtualAutomatico = Number(precoCentralizado.valorMensal);
      } else {
        // Fallback para preços legacy do plano
        if (instituicao.tipoAcademico === 'SECUNDARIO' && plano.precoSecundario) {
          valorAtualAutomatico = Number(plano.precoSecundario);
        } else if (instituicao.tipoAcademico === 'SUPERIOR' && plano.precoUniversitario) {
          valorAtualAutomatico = Number(plano.precoUniversitario);
        } else {
          valorAtualAutomatico = Number(plano.valorMensal);
        }
      }
    } else {
      // Se não tem tipo acadêmico, usar valor mensal padrão do plano
      valorAtualAutomatico = Number(plano.valorMensal);
    }

    // VERIFICAR OVERRIDE MANUAL
    // Se foi fornecido valorAtual e é diferente do automático, verificar se tem justificativa
    const valorFornecido = data.valorAtual !== undefined && data.valorAtual !== null
      ? (typeof data.valorAtual === 'string' ? parseFloat(data.valorAtual) : Number(data.valorAtual))
      : null;

    if (valorFornecido !== null && !isNaN(valorFornecido) && valorFornecido !== valorAtualAutomatico) {
      // OVERRIDE DETECTADO - Verificar permissão e justificativa
      if (!req.user?.roles.includes('SUPER_ADMIN')) {
        throw new AppError('Apenas SUPER_ADMIN pode fazer override manual de preços', 403);
      }

      if (!data.justificativaOverride || !data.justificativaOverride.trim()) {
        throw new AppError('Justificativa obrigatória para override manual de preço', 400);
      }

      valorAtualAutomatico = valorFornecido;
      precoOrigem = 'OVERRIDE';
      justificativaOverride = data.justificativaOverride.trim();
    }

    // Tratamento especial para licenças DEMO
    // (tipo já foi declarado acima na linha 116)
    let dataInicio = data.dataInicio ? new Date(data.dataInicio) : new Date();
    let dataFim = data.dataFim ? new Date(data.dataFim) : null;

    if (tipo === 'DEMO') {
      // Para DEMO, calcular dataFim baseado na duração (7 ou 14 dias)
      const duracaoDias = data.duracaoDias || 7; // Padrão 7 dias se não especificado
      
      // Validar duração permitida (apenas 7 ou 14 dias)
      if (duracaoDias !== 7 && duracaoDias !== 14) {
        throw new AppError('Duração do DEMO deve ser 7 ou 14 dias', 400);
      }
      
      dataInicio = new Date(); // Sempre começar agora
      const dataFimCalc = new Date(dataInicio);
      dataFimCalc.setDate(dataFimCalc.getDate() + duracaoDias);
      dataFim = dataFimCalc;
    } else if (tipo === 'PAGA') {
      // Para PAGA, dataFim é obrigatória ou calculada com base no período
      if (!dataFim && data.tipoPeriodo) {
        const periodo = data.tipoPeriodo === 'anual' ? 365 : 30;
        const fimCalc = new Date(dataInicio);
        fimCalc.setDate(fimCalc.getDate() + periodo);
        dataFim = fimCalc;
      }
    }

    // Calcular valor original para auditoria (caso seja override)
    let valorOriginalParaAuditoria: number | null = null;
    if (precoOrigem === 'OVERRIDE' && justificativaOverride) {
      // Valor original é o que foi calculado automaticamente antes do override
      // Precisamos recalculá-lo sem considerar o override
      if (tipo === 'DEMO') {
        valorOriginalParaAuditoria = 0; // DEMO sempre 0
      } else if (instituicao.tipoAcademico) {
        const precoCentralizado = await prisma.planosPrecos.findUnique({
          where: {
            planoId_tipoInstituicao: {
              planoId: data.planoId,
              tipoInstituicao: instituicao.tipoAcademico,
            },
          },
        });

        if (precoCentralizado && precoCentralizado.ativo) {
          valorOriginalParaAuditoria = Number(precoCentralizado.valorMensal);
        } else {
          // Fallback para preços legacy
          if (instituicao.tipoAcademico === 'SECUNDARIO' && plano.precoSecundario) {
            valorOriginalParaAuditoria = Number(plano.precoSecundario);
          } else if (instituicao.tipoAcademico === 'SUPERIOR' && plano.precoUniversitario) {
            valorOriginalParaAuditoria = Number(plano.precoUniversitario);
          } else {
            valorOriginalParaAuditoria = Number(plano.valorMensal);
          }
        }
      } else {
        valorOriginalParaAuditoria = Number(plano.valorMensal);
      }
    }

    // Usar valor calculado acima (automático ou override)
    const valorAtual = valorAtualAutomatico;
    
    // Garantir que é um número válido
    if (isNaN(valorAtual) || valorAtual < 0) {
      throw new AppError('Valor mensal inválido', 400);
    }

    // Função helper para limpar strings vazias
    const cleanString = (value: any): string | null => {
      if (!value || typeof value !== 'string' || value.trim() === '') {
        return null;
      }
      return value.trim();
    };

    // Mapear apenas campos válidos do schema
    const assinaturaData: any = {
      instituicaoId: String(data.instituicaoId),
      planoId: String(data.planoId),
      tipo: String(tipo),
      status: (data.status || 'ativa') as any,
      dataInicio,
      valorAtual: valorAtual,
      tipoPeriodo: data.tipoPeriodo || 'mensal',
      diasCarenciaAnalise: data.diasCarenciaAnalise ? parseInt(String(data.diasCarenciaAnalise)) : 3,
    };

    // Campos opcionais (apenas se não vazios)
    if (dataFim) {
      assinaturaData.dataFim = dataFim;
    }

    if (data.dataProximoPagamento) {
      assinaturaData.dataProximoPagamento = new Date(data.dataProximoPagamento);
    }

    assinaturaData.observacoes = cleanString(data.observacoes);
    assinaturaData.iban = cleanString(data.iban);
    assinaturaData.multicaixaNumero = cleanString(data.multicaixaNumero);
    assinaturaData.instrucoesPagamento = cleanString(data.instrucoesPagamento);

    // Validar status
    const statusValido = ['ativa', 'em_analise', 'suspensa', 'cancelada', 'teste', 'expirada'].includes(assinaturaData.status);
    if (!statusValido) {
      throw new AppError(`Status inválido: ${assinaturaData.status}. Status válidos: ativa, em_analise, suspensa, cancelada, teste, expirada`, 400);
    }

    // Log dos dados que serão enviados ao Prisma (apenas em desenvolvimento)
    if (process.env.NODE_ENV !== 'production') {
      console.log('[AssinaturaController] Dados para Prisma:', JSON.stringify(assinaturaData, null, 2));
    }

    const assinatura = await prisma.assinatura.create({ 
      data: assinaturaData,
      include: { plano: true, instituicao: true },
    }).catch((error: any) => {
      // Melhorar mensagem de erro do Prisma
      if (error.code === 'P2002') {
        throw new AppError('Esta instituição já possui uma assinatura', 400);
      }
      if (error.code === 'P2003') {
        throw new AppError('Instituição ou Plano não encontrado', 404);
      }
      
      // Erro de validação do Prisma
      if (error instanceof Error && error.name === 'PrismaClientValidationError') {
        console.error('[AssinaturaController] Erro de validação Prisma:', {
          message: error.message,
          data: assinaturaData,
        });
        throw new AppError(
          `Erro de validação: ${error.message}. Verifique se todos os campos estão no formato correto.`,
          400
        );
      }
      
      console.error('[AssinaturaController] Erro ao criar assinatura:', error);
      throw new AppError(
        process.env.NODE_ENV !== 'production' 
          ? `Erro ao criar assinatura: ${error.message}` 
          : 'Erro ao criar assinatura. Verifique os dados fornecidos.',
        400
      );
    });

    // Auditoria: Log CREATE_LICENSE
    AuditService.log(req, {
      modulo: 'LICENCIAMENTO',
      acao: 'CREATE_LICENSE' as any,
      entidade: 'ASSINATURA',
      entidadeId: assinatura.id,
      dadosNovos: {
        instituicaoId: assinatura.instituicaoId,
        planoId: assinatura.planoId,
        status: assinatura.status,
        dataInicio: assinatura.dataInicio,
        dataFim: assinatura.dataFim,
        valorAtual: assinatura.valorAtual,
        tipo: assinatura.tipo,
      },
      observacao: `Assinatura criada para instituição ${assinatura.instituicao?.nome || assinatura.instituicaoId}. Preço: ${precoOrigem === 'OVERRIDE' ? 'OVERRIDE MANUAL' : 'AUTOMÁTICO'}`,
    }).catch((error) => {
      console.error('[AssinaturaController] Erro ao gerar audit log:', error);
    });

    // Auditoria específica para OVERRIDE de preço
    if (precoOrigem === 'OVERRIDE' && justificativaOverride && valorOriginalParaAuditoria !== null) {
      AuditService.log(req, {
        modulo: 'LICENCIAMENTO',
        acao: 'PRICE_OVERRIDE' as any,
        entidade: 'ASSINATURA',
        entidadeId: assinatura.id,
        dadosAnteriores: {
          valorOriginal: valorOriginalParaAuditoria,
        },
        dadosNovos: {
          valorAlterado: valorAtual,
          justificativa: justificativaOverride,
        },
        observacao: `Override de preço aplicado: ${valorOriginalParaAuditoria} AOA → ${valorAtual} AOA. Justificativa: ${justificativaOverride}`,
      }).catch((error) => {
        console.error('[AssinaturaController] Erro ao gerar audit log de override:', error);
      });
    }

    res.status(201).json(assinatura);
  } catch (error) {
    next(error);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const data = req.body;

    // Buscar assinatura atual (para auditoria e validações)
    const assinaturaAtual = await prisma.assinatura.findUnique({
      where: { id },
      include: { plano: true, instituicao: true },
    });

    if (!assinaturaAtual) {
      throw new AppError('Assinatura não encontrada', 404);
    }

    // REGRA ABSOLUTA: Instituição NÃO pode editar sua própria licença
    // Apenas SUPER_ADMIN pode editar
    if (req.user?.instituicaoId === assinaturaAtual.instituicaoId && 
        !req.user?.roles.includes('SUPER_ADMIN')) {
      throw new AppError('Você não tem permissão para editar a assinatura da sua própria instituição. Entre em contato com o suporte.', 403);
    }

    // Se está alterando o plano, validar que o novo plano existe e está ativo
    if (data.planoId && data.planoId !== assinaturaAtual.planoId) {
      const novoPlano = await prisma.plano.findUnique({
        where: { id: data.planoId },
      });

      if (!novoPlano) {
        throw new AppError('Plano não encontrado', 404);
      }

      if (!novoPlano.ativo) {
        throw new AppError('Plano não está ativo', 400);
      }
    }

    // Preparar dados para atualização (remover campos que não devem ser atualizados diretamente)
    const { instituicaoId, duracaoDias, justificativaOverride, ...updateData } = data;
    
    // Se está alterando o plano, buscar novo preço automático
    const planoFinal = data.planoId && data.planoId !== assinaturaAtual.planoId
      ? await prisma.plano.findUnique({ where: { id: data.planoId } })
      : assinaturaAtual.plano;
    
    // Verificar override de preço na atualização
    let valorFinal: number | null = null;
    let precoOrigemUpdate: 'AUTOMATICO' | 'OVERRIDE' = 'AUTOMATICO';
    let justificativaOverrideUpdate: string | null = null;
    let valorOriginalParaAuditoriaUpdate: number | null = null;

    if (updateData.valorAtual !== undefined && updateData.valorAtual !== null) {
      const valorFornecido = typeof updateData.valorAtual === 'string' 
        ? parseFloat(updateData.valorAtual) 
        : Number(updateData.valorAtual);

      // Se está alterando plano, calcular preço automático do novo plano
      let precoAutomatico: number = Number(assinaturaAtual.valorAtual);
      if (data.planoId && data.planoId !== assinaturaAtual.planoId && planoFinal && assinaturaAtual.instituicao.tipoAcademico) {
        const precoCentralizado = await prisma.planosPrecos.findUnique({
          where: {
            planoId_tipoInstituicao: {
              planoId: data.planoId,
              tipoInstituicao: assinaturaAtual.instituicao.tipoAcademico,
            },
          },
        });

        if (precoCentralizado && precoCentralizado.ativo) {
          precoAutomatico = Number(precoCentralizado.valorMensal);
        } else if (assinaturaAtual.instituicao.tipoAcademico === 'SECUNDARIO' && planoFinal.precoSecundario) {
          precoAutomatico = Number(planoFinal.precoSecundario);
        } else if (assinaturaAtual.instituicao.tipoAcademico === 'SUPERIOR' && planoFinal.precoUniversitario) {
          precoAutomatico = Number(planoFinal.precoUniversitario);
        } else {
          precoAutomatico = Number(planoFinal.valorMensal);
        }
      }

      // Verificar se é override
      const valorFornecidoNum = Number(valorFornecido);
      const precoAutomaticoNum = Number(precoAutomatico);
      if (Math.abs(valorFornecidoNum - precoAutomaticoNum) > 0.01) { // Tolerância para decimais
        if (!req.user?.roles.includes('SUPER_ADMIN')) {
          throw new AppError('Apenas SUPER_ADMIN pode fazer override manual de preços', 403);
        }

        if (!justificativaOverride || !justificativaOverride.trim()) {
          throw new AppError('Justificativa obrigatória para override manual de preço', 400);
        }

        valorFinal = valorFornecidoNum;
        precoOrigemUpdate = 'OVERRIDE';
        justificativaOverrideUpdate = justificativaOverride.trim();
        valorOriginalParaAuditoriaUpdate = precoAutomaticoNum;
      } else {
        valorFinal = precoAutomaticoNum;
      }
    }
    
    // CONVERSÃO DEMO → PAGA: Permitir conversão sem perda de dados
    if (updateData.tipo === 'PAGA' && assinaturaAtual.tipo === 'DEMO') {
      // Conversão de DEMO para PAGA
      // Manter mesma instituição e plano (ou atualizar plano se fornecido)
      // Resetar dataInicio para agora e calcular nova dataFim baseado no período
      updateData.dataInicio = new Date();
      
      if (!updateData.dataFim && updateData.tipoPeriodo) {
        const periodo = updateData.tipoPeriodo === 'anual' ? 365 : 30;
        const dataFimCalc = new Date();
        dataFimCalc.setDate(dataFimCalc.getDate() + periodo);
        updateData.dataFim = dataFimCalc;
      }
      
      // Se não foi especificado valor, calcular automaticamente
      if (!valorFinal && planoFinal && assinaturaAtual.instituicao.tipoAcademico) {
        const precoCentralizado = await prisma.planosPrecos.findUnique({
          where: {
            planoId_tipoInstituicao: {
              planoId: planoFinal.id,
              tipoInstituicao: assinaturaAtual.instituicao.tipoAcademico,
            },
          },
        });

        if (precoCentralizado && precoCentralizado.ativo) {
          valorFinal = Number(precoCentralizado.valorMensal);
        } else if (assinaturaAtual.instituicao.tipoAcademico === 'SECUNDARIO' && planoFinal.precoSecundario) {
          valorFinal = Number(planoFinal.precoSecundario);
        } else if (assinaturaAtual.instituicao.tipoAcademico === 'SUPERIOR' && planoFinal.precoUniversitario) {
          valorFinal = Number(planoFinal.precoUniversitario);
        } else {
          valorFinal = Number(planoFinal.valorMensal);
        }
      }
      
      // Garantir status ativo na conversão
      if (!updateData.status) {
        updateData.status = 'ativa';
      }
    }
    
    // Aplicar valor final se calculado
    if (valorFinal !== null) {
      updateData.valorAtual = valorFinal;
    }
    
    // Tratamento especial para licenças DEMO em atualização
    if (updateData.tipo === 'DEMO' && duracaoDias) {
      // Validar duração permitida
      if (duracaoDias !== 7 && duracaoDias !== 14) {
        throw new AppError('Duração do DEMO deve ser 7 ou 14 dias', 400);
      }
      
      // Se está atualizando para DEMO com nova duração, recalcular datas
      const dataInicio = new Date();
      const dataFimCalc = new Date(dataInicio);
      dataFimCalc.setDate(dataFimCalc.getDate() + duracaoDias);
      updateData.dataInicio = dataInicio;
      updateData.dataFim = dataFimCalc;
    }
    
    // Converter strings de data para Date e limpar campos vazios (evita erro no Prisma)
    const toDateOrNull = (v: unknown): Date | null => {
      if (!v || v === '') return null;
      if (v instanceof Date) return v;
      const d = new Date(String(v));
      return isNaN(d.getTime()) ? null : d;
    };
    if (updateData.dataInicio !== undefined) {
      const d = toDateOrNull(updateData.dataInicio);
      if (d) updateData.dataInicio = d;
    }
    if (updateData.dataFim !== undefined) updateData.dataFim = toDateOrNull(updateData.dataFim);
    if (updateData.dataProximoPagamento !== undefined) updateData.dataProximoPagamento = toDateOrNull(updateData.dataProximoPagamento);
    // Limpar strings vazias para null (campos opcionais)
    if (updateData.observacoes === '') updateData.observacoes = null;
    if (updateData.iban === '') updateData.iban = null;
    if (updateData.multicaixaNumero === '') updateData.multicaixaNumero = null;
    if (updateData.instrucoesPagamento === '') updateData.instrucoesPagamento = null;
    
    const assinatura = await prisma.assinatura.update({
      where: { id },
      data: updateData,
      include: { plano: true, instituicao: true },
    });

    // Determinar tipo de ação para auditoria
    let acao: string = AcaoAuditoria.UPDATE;
    const foiAtivada = data.status === 'ativa' && assinaturaAtual.status !== 'ativa';
    if (foiAtivada) {
      acao = 'RENEW_LICENSE'; // Renovação/reativação
    } else if (data.status === 'suspensa' && assinaturaAtual.status !== 'suspensa') {
      acao = 'SUSPEND_LICENSE'; // Suspensão
    }

    // Auditoria: Log UPDATE_LICENSE / RENEW_LICENSE / SUSPEND_LICENSE
    AuditService.log(req, {
      modulo: 'LICENCIAMENTO',
      acao: acao as any,
      entidade: 'ASSINATURA',
      entidadeId: assinatura.id,
      dadosAnteriores: {
        planoId: assinaturaAtual.planoId,
        status: assinaturaAtual.status,
        dataFim: assinaturaAtual.dataFim,
        valorAtual: assinaturaAtual.valorAtual,
      },
      dadosNovos: {
        planoId: assinatura.planoId,
        status: assinatura.status,
        dataFim: assinatura.dataFim,
        valorAtual: assinatura.valorAtual,
      },
      observacao: `Assinatura atualizada para instituição ${assinatura.instituicao?.nome || assinatura.instituicaoId}`,
    }).catch((error) => {
      console.error('[AssinaturaController] Erro ao gerar audit log:', error);
    });

    // Enviar e-mail quando assinatura é ativada (não abortar se falhar)
    if (foiAtivada && assinatura.instituicao?.emailContato) {
      try {
        await EmailService.sendEmail(
          req,
          assinatura.instituicao.emailContato,
          'ASSINATURA_ATIVADA',
          {
            planoNome: assinatura.plano?.nome || 'N/A',
            dataFim: assinatura.dataFim 
              ? new Date(assinatura.dataFim).toLocaleDateString('pt-BR')
              : 'N/A',
          },
          {
            instituicaoId: assinatura.instituicaoId || undefined,
          }
        );
      } catch (emailError: any) {
        console.error('[update] Erro ao enviar e-mail (não crítico):', emailError.message);
      }
    }

    // Auditoria específica para OVERRIDE de preço na atualização
    if (precoOrigemUpdate === 'OVERRIDE' && justificativaOverrideUpdate && valorOriginalParaAuditoriaUpdate !== null) {
      AuditService.log(req, {
        modulo: 'LICENCIAMENTO',
        acao: 'PRICE_OVERRIDE' as any,
        entidade: 'ASSINATURA',
        entidadeId: assinatura.id,
        dadosAnteriores: {
          valorOriginal: valorOriginalParaAuditoriaUpdate,
          valorAnterior: Number(assinaturaAtual.valorAtual),
        },
        dadosNovos: {
          valorAlterado: valorFinal || assinatura.valorAtual,
          justificativa: justificativaOverrideUpdate,
        },
        observacao: `Override de preço na atualização: ${valorOriginalParaAuditoriaUpdate} AOA → ${valorFinal || assinatura.valorAtual} AOA. Justificativa: ${justificativaOverrideUpdate}`,
      }).catch((error) => {
        console.error('[AssinaturaController] Erro ao gerar audit log de override:', error);
      });
    }
    
    res.json(assinatura);
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    // Buscar assinatura antes de deletar (para auditoria)
    const assinatura = await prisma.assinatura.findUnique({
      where: { id },
      include: { instituicao: true, plano: true },
    });

    if (!assinatura) {
      throw new AppError('Assinatura não encontrada', 404);
    }

    // Deletar assinatura
    await prisma.assinatura.delete({ where: { id } });

    // Auditoria: Log DELETE_LICENSE
    AuditService.log(req, {
      modulo: 'LICENCIAMENTO',
      acao: 'DELETE_LICENSE' as any,
      entidade: 'ASSINATURA',
      entidadeId: assinatura.id,
      dadosAnteriores: {
        instituicaoId: assinatura.instituicaoId,
        planoId: assinatura.planoId,
        status: assinatura.status,
        dataFim: assinatura.dataFim,
      },
      observacao: `Assinatura deletada para instituição ${assinatura.instituicao?.nome || assinatura.instituicaoId}. A instituição será bloqueada imediatamente.`,
    }).catch((error) => {
      console.error('[AssinaturaController] Erro ao gerar audit log:', error);
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
