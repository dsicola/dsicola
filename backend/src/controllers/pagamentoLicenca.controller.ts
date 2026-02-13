import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter, requireTenantScope } from '../middlewares/auth.js';
import { AuditService, AcaoAuditoria } from '../services/audit.service.js';
import { renovarLicencaAutomatica, verificarPagamentoPendente } from '../services/pagamentoLicenca.service.js';
import { createGateway, GatewayType, getGatewayConfig } from '../services/gateway.service.js';
import { criarDocumentoFiscalAutomatico } from '../services/documentoFiscal.service.js';
import { EmailService } from '../services/email.service.js';

/**
 * Criar pagamento de licença
 * Instituição cria um pagamento PENDING
 */
export const criarPagamento = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    // FASE 3: Receber apenas plano_id e periodo (não valor do frontend!)
    const { planoId, plano, periodo, metodo, referencia, comprovativoUrl, observacoes } = req.body;

    // Validações básicas
    if (!periodo) {
      throw new AppError('Período é obrigatório', 400);
    }

    if (!['MENSAL', 'ANUAL'].includes(periodo)) {
      throw new AppError('Período deve ser MENSAL ou ANUAL', 400);
    }

    // Priorizar planoId, mas manter compatibilidade com plano (nome)
    let planoDb;
    if (planoId) {
      // Buscar por ID (PREFERIDO)
      planoDb = await prisma.plano.findUnique({
        where: { id: planoId },
      });
    } else if (plano) {
      // Buscar por nome (compatibilidade retroativa)
      planoDb = await prisma.plano.findFirst({
        where: {
          nome: {
            equals: plano,
            mode: 'insensitive',
          },
          ativo: true,
        },
      });
    } else {
      throw new AppError('Plano (ID ou nome) é obrigatório', 400);
    }

    // Validar método de pagamento (não permitir ONLINE via este endpoint)
    if (metodo === 'ONLINE') {
      throw new AppError(
        'Pagamento online deve ser feito através do endpoint específico. ' +
        'Por enquanto, utilize métodos manuais: TRANSFERENCIA, DEPOSITO, MULTICAIXA, AIRTM, RODETPAY.',
        400
      );
    }

    // Validar métodos manuais permitidos
    const metodosManuais = ['TRANSFERENCIA', 'DEPOSITO', 'MULTICAIXA', 'AIRTM', 'RODETPAY', 'CASH', 'MOBILE_MONEY'];
    if (metodo && !metodosManuais.includes(metodo)) {
      throw new AppError(
        `Método inválido. Métodos manuais disponíveis: ${metodosManuais.join(', ')}`,
        400
      );
    }

    if (!planoDb) {
      throw new AppError('Plano não encontrado ou inativo', 404);
    }

    if (!planoDb.ativo) {
      throw new AppError('Plano não está ativo', 400);
    }

    // Buscar assinatura da instituição
    const assinatura = await prisma.assinatura.findUnique({
      where: { instituicaoId },
      include: { plano: true },
    });

    if (!assinatura) {
      throw new AppError('Instituição não possui assinatura. Entre em contato com o suporte.', 404);
    }

    // FASE 3: Buscar preço REAL do banco (nunca do frontend!)
    // Determinar valor baseado no período e tipo de instituição
    let valor: Decimal;
    
    if (periodo === 'MENSAL') {
      valor = planoDb.valorMensal;
    } else {
      // ANUAL
      valor = planoDb.valorAnual || new Decimal(planoDb.valorMensal.toNumber() * 12);
    }

    // IMPORTANTE: Se a instituição tem tipo definido, usar preços específicos
    const instituicao = await prisma.instituicao.findUnique({
      where: { id: instituicaoId },
      select: { tipoAcademico: true },
    });

    // Se é Ensino Secundário e tem preço específico, usar
    if (instituicao?.tipoAcademico === 'SECUNDARIO' && planoDb.precoSecundario && periodo === 'MENSAL') {
      valor = planoDb.precoSecundario;
    }
    // Se é Ensino Superior e tem preço específico, usar
    else if (instituicao?.tipoAcademico === 'SUPERIOR' && planoDb.precoUniversitario && periodo === 'MENSAL') {
      valor = planoDb.precoUniversitario;
    }

    if (!valor || valor.toNumber() <= 0) {
      throw new AppError(`Valor do plano não configurado corretamente`, 400);
    }

    // Verificar se já existe pagamento PENDING para evitar duplicatas
    const existePendente = await verificarPagamentoPendente(
      instituicaoId,
      planoDb.nome.toUpperCase(),
      periodo
    );

    if (existePendente) {
      throw new AppError(
        'Já existe um pagamento pendente para este plano e período. ' +
        'Aguarde a confirmação ou cancele o pagamento anterior.',
        400
      );
    }

    // FASE 3: Criar pagamento com SNAPSHOT do plano e valor
    const pagamento = await prisma.pagamentoLicenca.create({
      data: {
        instituicaoId,
        assinaturaId: assinatura.id,
        planoId: planoDb.id, // SNAPSHOT do plano_id
        plano: planoDb.nome.toUpperCase(), // Mantido para compatibilidade/auditoria
        valor, // SNAPSHOT do valor no momento da criação
        periodo,
        metodo: (metodo || 'TRANSFERENCIA') as any,
        referencia: referencia || null,
        comprovativoUrl: comprovativoUrl || null,
        observacoes: observacoes || null,
        status: 'PENDING',
      },
      include: {
        instituicao: {
          select: { id: true, nome: true },
        },
        assinatura: {
          include: {
            plano: true,
          },
        },
      },
    });

    // Auditoria: Log PAYMENT_CREATED
    await AuditService.log(req, {
      modulo: 'LICENCIAMENTO',
      acao: 'PAYMENT_CREATED' as any,
      entidade: 'ASSINATURA',
      entidadeId: assinatura.id,
      observacao: `Pagamento de licença criado: ${planoDb.nome} ${periodo} - Valor (snapshot): ${valor.toNumber()} - Plano ID: ${planoDb.id}`,
    }).catch((error) => {
      console.error('[criarPagamento] Erro ao gerar audit log:', error);
    });

    res.status(201).json(pagamento);
  } catch (error) {
    next(error);
  }
};

/**
 * Confirmar pagamento de licença (apenas SUPER_ADMIN)
 * Quando confirmado, renova automaticamente a licença
 */
export const confirmarPagamento = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pagamentoId } = req.params;
    const { observacoes } = req.body;

    // Verificar se é SUPER_ADMIN
    if (!req.user?.roles.includes('SUPER_ADMIN')) {
      throw new AppError('Apenas SUPER_ADMIN pode confirmar pagamentos', 403);
    }

    const confirmadoPor = req.user.userId;

    // Buscar pagamento
    const pagamento = await prisma.pagamentoLicenca.findUnique({
      where: { id: pagamentoId },
      include: {
        instituicao: {
          select: { id: true, nome: true },
        },
        assinatura: {
          include: {
            plano: true,
          },
        },
      },
    });

    if (!pagamento) {
      throw new AppError('Pagamento não encontrado', 404);
    }

    if (pagamento.status !== 'PENDING') {
      throw new AppError(
        `Pagamento não pode ser confirmado. Status atual: ${pagamento.status}`,
        400
      );
    }

    // VALIDAÇÃO: Pagamentos ONLINE não podem ser confirmados manualmente
    if (pagamento.metodo === 'ONLINE') {
      throw new AppError(
        'Pagamentos online são confirmados automaticamente via webhook. ' +
        'Não é possível confirmar manualmente.',
        400
      );
    }

    // Atualizar pagamento para PAID
    const agora = new Date();
    const pagamentoAtualizado = await prisma.pagamentoLicenca.update({
      where: { id: pagamentoId },
      data: {
        status: 'PAID',
        pagoEm: agora,
        confirmadoPor,
        observacoes: observacoes || pagamento.observacoes,
        // Garantir que confirmadoPor e pagoEm são preenchidos
      },
      include: {
        instituicao: {
          select: { id: true, nome: true },
        },
        assinatura: {
          include: {
            plano: true,
          },
        },
      },
    });

    // RENOVAÇÃO AUTOMÁTICA DA LICENÇA
    let novaDataFim: Date | null = null;
    if (pagamento.assinaturaId) {
      try {
        novaDataFim = await renovarLicencaAutomatica(
          pagamento.assinaturaId,
          pagamento.periodo
        );

        // Auditoria: Log RENEW_LICENSE
        await AuditService.log(req, {
          modulo: 'LICENCIAMENTO',
          acao: 'RENEW_LICENSE' as any,
          entidade: 'ASSINATURA',
          entidadeId: pagamento.assinaturaId,
          observacao: `Licença renovada automaticamente. Nova data fim: ${novaDataFim.toLocaleDateString('pt-BR')}. Período: ${pagamento.periodo}`,
        }).catch((error) => {
          console.error('[confirmarPagamento] Erro ao gerar audit log:', error);
        });
      } catch (error) {
        console.error('[confirmarPagamento] Erro ao renovar licença:', error);
        // Continuar mesmo se a renovação falhar (já está PAID)
      }
    }

    // GERAÇÃO AUTOMÁTICA DE DOCUMENTO FISCAL
    // REGRA: Só gera se status for PAID e não existir documento ainda
    let documentoFiscalId: string | null = null;
    try {
      documentoFiscalId = await criarDocumentoFiscalAutomatico(
        pagamentoAtualizado.id,
        'RECIBO' // Por padrão, gerar RECIBO. Pode ser configurável no futuro.
      );

      // Auditoria: Log DOCUMENT_CREATED
      await AuditService.log(req, {
        modulo: 'LICENCIAMENTO',
        acao: 'DOCUMENT_CREATED' as any,
        entidade: 'DOCUMENTO_FISCAL',
        entidadeId: documentoFiscalId,
        observacao: `Documento fiscal criado automaticamente para pagamento ${pagamentoAtualizado.id} - Tipo: RECIBO`,
      }).catch((error) => {
        console.error('[confirmarPagamento] Erro ao gerar audit log:', error);
      });
    } catch (error: any) {
      // Log erro mas não bloqueia a confirmação do pagamento
      console.error('[confirmarPagamento] Erro ao criar documento fiscal:', error);
      // Não rejeitar o pagamento se a geração do documento falhar
    }

    // Auditoria: Log CONFIRM_PAYMENT (com informações completas)
    await AuditService.log(req, {
      modulo: 'LICENCIAMENTO',
      acao: 'CONFIRM_PAYMENT' as any,
      entidade: 'ASSINATURA',
      entidadeId: pagamento.assinaturaId || '',
      observacao: `Pagamento confirmado manualmente: ${pagamento.plano} ${pagamento.periodo} - Valor: ${pagamento.valor.toNumber()} - Método: ${pagamento.metodo} - Instituição: ${pagamento.instituicao?.nome || pagamento.instituicaoId} - Confirmado por: ${confirmadoPor}`,
    }).catch((error) => {
      console.error('[confirmarPagamento] Erro ao gerar audit log:', error);
    });

    res.json({
      ...pagamentoAtualizado,
      renovacaoAutomatica: true,
      novaDataFim: pagamento.assinaturaId ? novaDataFim.toISOString() : null,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Rejeitar/Cancelar pagamento
 * 
 * MULTI-TENANT: Instituições só podem cancelar seus próprios pagamentos
 * SUPER_ADMIN pode cancelar qualquer pagamento
 */
export const cancelarPagamento = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pagamentoId } = req.params;
    const { motivo } = req.body;

    const isSuperAdmin = req.user?.roles.includes('SUPER_ADMIN');
    
    // MULTI-TENANT: instituicaoId vem EXCLUSIVAMENTE do JWT
    const instituicaoId = isSuperAdmin ? null : requireTenantScope(req);

    // Buscar pagamento com filtro de instituição
    const filter = isSuperAdmin ? {} : { instituicaoId };
    const pagamento = await prisma.pagamentoLicenca.findFirst({
      where: {
        id: pagamentoId,
        ...filter,
      },
    });

    if (!pagamento) {
      throw new AppError('Pagamento não encontrado ou você não tem permissão', 404);
    }

    // Só pode cancelar PENDING
    if (pagamento.status !== 'PENDING') {
      throw new AppError(
        `Pagamento não pode ser cancelado. Status atual: ${pagamento.status}`,
        400
      );
    }

    // Atualizar status
    const pagamentoAtualizado = await prisma.pagamentoLicenca.update({
      where: { id: pagamentoId },
      data: {
        status: 'CANCELLED',
        observacoes: motivo || pagamento.observacoes,
      },
    });

    // Auditoria com informações completas
    await AuditService.log(req, {
      modulo: 'LICENCIAMENTO',
      acao: 'CANCEL_PAYMENT' as any,
      entidade: 'ASSINATURA',
      entidadeId: pagamento.assinaturaId || '',
      observacao: `Pagamento cancelado - ID: ${pagamento.id} - Plano: ${pagamento.plano} ${pagamento.periodo} - Método: ${pagamento.metodo} - Instituição: ${pagamento.instituicaoId}${motivo ? ' - Motivo: ' + motivo : ''}`,
    }).catch((error) => {
      console.error('[cancelarPagamento] Erro ao gerar audit log:', error);
    });

    res.json(pagamentoAtualizado);
  } catch (error) {
    next(error);
  }
};

/**
 * Buscar histórico de pagamentos
 * 
 * MULTI-TENANT: Instituições só veem seus pagamentos
 * SUPER_ADMIN vê todos, mas nunca aceita instituicaoId do frontend
 */
export const getHistorico = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isSuperAdmin = req.user?.roles.includes('SUPER_ADMIN');
    const { status } = req.query;

    // MULTI-TENANT: instituicaoId vem EXCLUSIVAMENTE do JWT
    const filter = addInstitutionFilter(req);

    // Construir filtro
    const whereFilter: any = {
      ...filter, // Já inclui filtro de instituição baseado no JWT
      ...(status && { status: status as any }),
      // NUNCA aceitar instituicaoId do query - segurança multi-tenant
      // SUPER_ADMIN vê todos através do filter vazio quando não há instituicaoId no JWT
    };

    const pagamentos = await prisma.pagamentoLicenca.findMany({
      where: whereFilter,
      include: {
        instituicao: {
          select: { id: true, nome: true, subdominio: true },
        },
        assinatura: {
          include: {
            plano: true,
          },
        },
      },
      orderBy: { criadoEm: 'desc' },
    });

    res.json(pagamentos);
  } catch (error) {
    next(error);
  }
};

/**
 * Buscar pagamento por ID
 */
export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pagamentoId } = req.params;
    const filter = addInstitutionFilter(req);

    const pagamento = await prisma.pagamentoLicenca.findFirst({
      where: {
        id: pagamentoId,
        ...filter,
      },
      include: {
        instituicao: {
          select: { id: true, nome: true, subdominio: true },
        },
        assinatura: {
          include: {
            plano: true,
          },
        },
      },
    });

    if (!pagamento) {
      throw new AppError('Pagamento não encontrado', 404);
    }

    res.json(pagamento);
  } catch (error) {
    next(error);
  }
};

/**
 * Criar pagamento online (via gateway)
 * 
 * DESATIVADO TEMPORARIAMENTE - Preparado para integração futura
 * Retorna erro informando que está disponível em breve
 */
export const criarPagamentoOnline = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // PAGAMENTO ONLINE DESATIVADO - RETORNAR MENSAGEM
    throw new AppError(
      'Pagamento automático (cartão/online) estará disponível em breve. ' +
      'Por favor, utilize os métodos de pagamento manual disponíveis.',
      503 // Service Unavailable
    );
    
    /* CÓDIGO PREPARADO PARA INTEGRAÇÃO FUTURA - MANTER COMENTADO
    const instituicaoId = requireTenantScope(req);
    const { plano, periodo, gateway } = req.body;

    // Validações básicas
    if (!plano || !periodo || !gateway) {
      throw new AppError('Plano, período e gateway são obrigatórios', 400);
    }

    if (!['MENSAL', 'ANUAL'].includes(periodo)) {
      throw new AppError('Período deve ser MENSAL ou ANUAL', 400);
    }

    if (!['BASIC', 'PRO', 'ENTERPRISE'].includes(plano)) {
      throw new AppError('Plano deve ser BASIC, PRO ou ENTERPRISE', 400);
    }

    // Validar gateway
    if (!Object.values(GatewayType).includes(gateway as GatewayType)) {
      throw new AppError(`Gateway inválido. Gateways suportados: ${Object.values(GatewayType).join(', ')}`, 400);
    }

    // Buscar assinatura da instituição
    const assinatura = await prisma.assinatura.findUnique({
      where: { instituicaoId },
      include: { plano: true },
    });

    if (!assinatura) {
      throw new AppError('Instituição não possui assinatura. Entre em contato com o suporte.', 404);
    }

    // Buscar valor do plano
    const planoDb = await prisma.plano.findFirst({
      where: {
        nome: {
          equals: plano,
          mode: 'insensitive',
        },
        ativo: true,
      },
    });

    if (!planoDb) {
      throw new AppError(`Plano ${plano} não encontrado ou inativo`, 404);
    }

    // Calcular valor baseado no período
    const valor = periodo === 'MENSAL' 
      ? planoDb.valorMensal 
      : (planoDb.valorAnual || planoDb.valorMensal * 12);

    if (!valor || valor.toNumber() <= 0) {
      throw new AppError(`Valor do plano ${plano} não configurado corretamente`, 400);
    }

    // Verificar se já existe pagamento PENDING
    const existePendente = await verificarPagamentoPendente(
      instituicaoId,
      plano.toUpperCase(),
      periodo
    );

    if (existePendente) {
      throw new AppError(
        'Já existe um pagamento pendente para este plano e período. ' +
        'Aguarde a confirmação ou cancele o pagamento anterior.',
        400
      );
    }

    // Obter configuração do gateway
    const gatewayConfig = getGatewayConfig();
    let gatewayInstance;
    try {
      gatewayInstance = createGateway(gateway as GatewayType, gatewayConfig);
    } catch (error: any) {
      throw new AppError(`Gateway ${gateway} não configurado: ${error.message}`, 400);
    }

    // Criar payment intent no gateway
    const paymentIntent = await gatewayInstance.createPaymentIntent(
      valor.toNumber(),
      'USD', // Moeda padrão - pode ser configurável
      {
        instituicaoId,
        assinaturaId: assinatura.id,
        plano: plano.toUpperCase(),
        periodo,
      }
    );

    // Criar pagamento no banco com status PENDING
    const pagamento = await prisma.pagamentoLicenca.create({
      data: {
        instituicaoId,
        assinaturaId: assinatura.id,
        plano: plano.toUpperCase(),
        valor,
        periodo,
        metodo: 'ONLINE',
        status: 'PENDING',
        gateway: gateway as string,
        gatewayId: paymentIntent.id,
        gatewayData: paymentIntent.data,
      },
      include: {
        instituicao: {
          select: { id: true, nome: true },
        },
        assinatura: {
          include: {
            plano: true,
          },
        },
      },
    });

    // Auditoria
    await AuditService.log(req, {
      modulo: 'LICENCIAMENTO',
      acao: 'CREATE_PAYMENT' as any,
      entidade: 'ASSINATURA',
      entidadeId: assinatura.id,
      observacao: `Pagamento online criado: ${plano} ${periodo} - Valor: ${valor.toNumber()} - Gateway: ${gateway}`,
    }).catch((error) => {
      console.error('[criarPagamentoOnline] Erro ao gerar audit log:', error);
    });

    res.status(201).json({
      ...pagamento,
      clientSecret: paymentIntent.clientSecret,
      redirectUrl: paymentIntent.redirectUrl,
    });
    */
  } catch (error) {
    next(error);
  }
};

/**
 * Webhook para receber notificações dos gateways
 */
export const webhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { gateway } = req.params;
    const signature = req.headers['stripe-signature'] || req.headers['x-paypal-signature'] || req.headers['x-tazapay-signature'] || '';

    // Validar gateway
    if (!Object.values(GatewayType).includes(gateway as GatewayType)) {
      throw new AppError(`Gateway inválido: ${gateway}`, 400);
    }

    // Obter configuração do gateway
    const gatewayConfig = getGatewayConfig();
    let gatewayInstance;
    try {
      gatewayInstance = createGateway(gateway as GatewayType, gatewayConfig);
    } catch (error: any) {
      throw new AppError(`Gateway ${gateway} não configurado: ${error.message}`, 400);
    }

    // Verificar assinatura do webhook
    const isValid = await gatewayInstance.verifyWebhook(req.body, signature as string);
    if (!isValid) {
      throw new AppError('Webhook signature inválida', 401);
    }

    // Parse do evento do webhook
    const event = await gatewayInstance.parseWebhookEvent(req.body);

    // Buscar pagamento pelo gatewayId
    const pagamento = await prisma.pagamentoLicenca.findFirst({
      where: {
        gatewayId: event.paymentId,
        gateway: gateway,
      },
      include: {
        instituicao: {
          select: { id: true, nome: true },
        },
        assinatura: true,
      },
    });

    if (!pagamento) {
      throw new AppError('Pagamento não encontrado para este webhook', 404);
    }

    // Atualizar status do pagamento
    if (event.status === 'PAID') {
      // Atualizar para PAID
      await prisma.pagamentoLicenca.update({
        where: { id: pagamento.id },
        data: {
          status: 'PAID',
          pagoEm: new Date(),
          gatewayData: event.gatewayData,
        },
      });

          // Renovar licença automaticamente
          if (pagamento.assinaturaId) {
            try {
              const novaDataFim = await renovarLicencaAutomatica(
                pagamento.assinaturaId,
                pagamento.periodo
              );

              // Buscar dados da assinatura e instituição para e-mail
              const assinaturaCompleta = await prisma.assinatura.findUnique({
                where: { id: pagamento.assinaturaId },
                include: {
                  plano: { select: { nome: true } },
                  instituicao: { 
                    select: { 
                      id: true, 
                      nome: true, 
                      emailContato: true 
                    } 
                  },
                },
              });

              // Enviar e-mail de assinatura ativada (não abortar se falhar)
              if (assinaturaCompleta?.instituicao?.emailContato) {
                try {
                  await EmailService.sendEmail(
                    req,
                    assinaturaCompleta.instituicao.emailContato,
                    'ASSINATURA_ATIVADA',
                    {
                      planoNome: assinaturaCompleta.plano?.nome || 'N/A',
                      dataFim: novaDataFim.toLocaleDateString('pt-BR'),
                      periodo: pagamento.periodo,
                    },
                    {
                      instituicaoId: assinaturaCompleta.instituicaoId || undefined,
                    }
                  );
                } catch (emailError: any) {
                  console.error('[webhook] Erro ao enviar e-mail (não crítico):', emailError.message);
                }
              }

              // Auditoria
              await AuditService.log(req, {
                modulo: 'LICENCIAMENTO',
                acao: 'PAYMENT_SUCCESS' as any,
                entidade: 'ASSINATURA',
                entidadeId: pagamento.assinaturaId,
                observacao: `Pagamento confirmado via webhook (${gateway}). Licença renovada até ${novaDataFim.toLocaleDateString('pt-BR')}`,
              }).catch((error) => {
                console.error('[webhook] Erro ao gerar audit log:', error);
              });

              await AuditService.log(req, {
                modulo: 'LICENCIAMENTO',
                acao: 'RENEW_LICENSE' as any,
                entidade: 'ASSINATURA',
                entidadeId: pagamento.assinaturaId,
                observacao: `Licença renovada automaticamente via webhook. Nova data fim: ${novaDataFim.toLocaleDateString('pt-BR')}`,
              }).catch((error) => {
                console.error('[webhook] Erro ao gerar audit log:', error);
              });
            } catch (error) {
              console.error('[webhook] Erro ao renovar licença:', error);
            }
          }

          // GERAÇÃO AUTOMÁTICA DE DOCUMENTO FISCAL
          try {
            const documentoFiscalId = await criarDocumentoFiscalAutomatico(
              pagamento.id,
              'RECIBO'
            );

            await AuditService.log(req, {
              modulo: 'LICENCIAMENTO',
              acao: 'DOCUMENT_CREATED' as any,
              entidade: 'DOCUMENTO_FISCAL',
              entidadeId: documentoFiscalId,
              observacao: `Documento fiscal criado automaticamente via webhook para pagamento ${pagamento.id}`,
            }).catch((error) => {
              console.error('[webhook] Erro ao gerar audit log:', error);
            });
          } catch (error: any) {
            console.error('[webhook] Erro ao criar documento fiscal:', error);
          }
    } else if (event.status === 'FAILED') {
      // Atualizar para FAILED
      await prisma.pagamentoLicenca.update({
        where: { id: pagamento.id },
        data: {
          status: 'FAILED',
          gatewayData: event.gatewayData,
        },
      });

      // Auditoria
      await AuditService.log(req, {
        modulo: 'LICENCIAMENTO',
        acao: 'PAYMENT_FAILED' as any,
        entidade: 'ASSINATURA',
        entidadeId: pagamento.assinaturaId || '',
        observacao: `Pagamento falhou via webhook (${gateway})`,
      }).catch((error) => {
        console.error('[webhook] Erro ao gerar audit log:', error);
      });
    }

    // Responder ao gateway (200 OK)
    res.status(200).json({ received: true });
  } catch (error) {
    next(error);
  }
};

