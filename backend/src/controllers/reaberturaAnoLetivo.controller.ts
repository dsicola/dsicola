import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { requireTenantScope } from '../middlewares/auth.js';
import { AuditService, ModuloAuditoria, AcaoAuditoria, EntidadeAuditoria } from '../services/audit.service.js';
import { encerrarReaberturasExpiradas, EscopoReabertura } from '../services/reaberturaAnoLetivo.service.js';

/**
 * ========================================
 * CONTROLLER: REABERTURA EXCEPCIONAL DO ANO LETIVO
 * ========================================
 * 
 * REGRA INSTITUCIONAL (SIGA/SIGAE):
 * - Reabertura é EXCEÇÃO administrativa
 * - TEMPORÁRIA (com prazo)
 * - JUSTIFICADA (motivo obrigatório)
 * - TOTALMENTE AUDITADA
 * - NÃO permite UPDATE ou DELETE após criação
 */

/**
 * Criar reabertura excepcional do ano letivo
 */
export const criarReabertura = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { anoLetivoId, motivo, escopo, dataInicio, dataFim, observacoes } = req.body;
    const instituicaoId = requireTenantScope(req);
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('Usuário não autenticado', 401);
    }

    // Verificar permissões (apenas ADMIN, DIRECAO, SUPER_ADMIN)
    const userRoles = req.user?.roles || [];
    const podeCriar = ['ADMIN', 'DIRECAO', 'SUPER_ADMIN'].some(role => userRoles.includes(role as any));

    if (!podeCriar) {
      throw new AppError('Você não tem permissão para criar reaberturas excepcionais', 403);
    }

    // Validações obrigatórias
    if (!anoLetivoId || !motivo || !escopo || !dataInicio || !dataFim) {
      throw new AppError('Ano Letivo, Motivo, Escopo, Data Início e Data Fim são obrigatórios', 400);
    }

    // Validar escopo
    const escoposValidos: EscopoReabertura[] = ['NOTAS', 'PRESENCAS', 'AVALIACOES', 'MATRICULAS', 'GERAL'];
    if (!escoposValidos.includes(escopo)) {
      throw new AppError(`Escopo inválido. Escopos válidos: ${escoposValidos.join(', ')}`, 400);
    }

    // Validar datas
    const dataInicioDate = new Date(dataInicio);
    const dataFimDate = new Date(dataFim);
    const agora = new Date();

    if (dataFimDate <= dataInicioDate) {
      throw new AppError('Data de término deve ser posterior à data de início', 400);
    }

    if (dataFimDate < agora) {
      throw new AppError('Data de término não pode ser no passado', 400);
    }

    // Verificar se ano letivo existe e está encerrado
    const anoLetivo = await prisma.anoLetivo.findFirst({
      where: {
        id: anoLetivoId,
        instituicaoId,
      },
    });

    if (!anoLetivo) {
      throw new AppError('Ano letivo não encontrado', 404);
    }

    if (anoLetivo.status !== 'ENCERRADO') {
      throw new AppError('Apenas anos letivos ENCERRADOS podem ter reabertura excepcional', 400);
    }

    // Verificar se já existe reabertura ativa
    const reaberturaExistente = await prisma.reaberturaAnoLetivo.findFirst({
      where: {
        anoLetivoId,
        instituicaoId,
        ativo: true,
        dataFim: { gte: agora },
      },
    });

    if (reaberturaExistente) {
      throw new AppError(
        `Já existe uma reabertura ativa para este ano letivo até ${new Date(reaberturaExistente.dataFim).toLocaleDateString('pt-BR')}`,
        400
      );
    }

    // Criar reabertura
    const reabertura = await prisma.reaberturaAnoLetivo.create({
      data: {
        instituicaoId,
        anoLetivoId,
        motivo: motivo.trim(),
        escopo: escopo as EscopoReabertura,
        dataInicio: dataInicioDate,
        dataFim: dataFimDate,
        autorizadoPor: userId,
        ativo: true,
        observacoes: observacoes?.trim() || null,
      },
      include: {
        autorizador: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
          },
        },
        anoLetivo: {
          select: {
            id: true,
            ano: true,
            status: true,
          },
        },
      },
    });

    // Auditoria obrigatória
    await AuditService.log(req, {
      modulo: ModuloAuditoria.ANO_LETIVO,
      acao: AcaoAuditoria.REOPEN,
      entidade: EntidadeAuditoria.ANO_LETIVO,
      entidadeId: anoLetivoId,
      instituicaoId,
      dadosNovos: {
        reaberturaId: reabertura.id,
        motivo: reabertura.motivo,
        escopo: reabertura.escopo,
        dataInicio: reabertura.dataInicio,
        dataFim: reabertura.dataFim,
      },
      observacao: `⚠️ REABERTURA EXCEPCIONAL criada para ano letivo ${anoLetivo.ano}. Motivo: ${motivo}. Escopo: ${escopo}. Prazo: ${new Date(dataInicioDate).toLocaleDateString('pt-BR')} até ${new Date(dataFimDate).toLocaleDateString('pt-BR')}.`,
    });

    // Enviar e-mail de reabertura de ano letivo para ADMINs da instituição (não abortar se falhar)
    try {
      const { EmailService } = await import('../services/email.service.js');
      
      // Buscar todos os ADMINs da instituição
      const admins = await prisma.user.findMany({
        where: {
          instituicaoId,
          roles: {
            some: { role: 'ADMIN' },
          },
        },
        select: {
          id: true,
          email: true,
          nomeCompleto: true,
        },
      });

      // Enviar e-mail para cada ADMIN
      for (const admin of admins) {
        if (admin.email) {
          try {
            await EmailService.sendEmail(
              req,
              admin.email,
              'REABERTURA_ANO_LETIVO',
              {
                nomeDestinatario: admin.nomeCompleto || 'Administrador',
                anoLetivo: anoLetivo.ano.toString(),
                dataInicio: new Date(dataInicioDate).toLocaleDateString('pt-BR'),
                dataFim: new Date(dataFimDate).toLocaleDateString('pt-BR'),
                escopo: escopo,
                motivo: motivo,
                autorizador: reabertura.autorizador?.nomeCompleto || 'N/A',
              },
              {
                destinatarioNome: admin.nomeCompleto || undefined,
                instituicaoId: instituicaoId || undefined,
              }
            );
          } catch (emailError: any) {
            console.error(`[criarReabertura] Erro ao enviar e-mail para ${admin.email} (não crítico):`, emailError.message);
          }
        }
      }

      // Notificar SUPER_ADMIN sobre reabertura excepcional
      try {
        const instituicao = await prisma.instituicao.findUnique({
          where: { id: instituicaoId },
          select: { nome: true }
        });

        await EmailService.notificarSuperAdmins(
          req,
          'NOTIFICACAO_GERAL',
          {
            titulo: 'Reabertura Excepcional de Ano Letivo',
            mensagem: `
              <p>Uma reabertura excepcional de ano letivo foi solicitada:</p>
              <div class="info-box">
                <p><strong>Instituição:</strong> ${instituicao?.nome || 'N/A'}</p>
                <p><strong>Ano Letivo:</strong> ${anoLetivo.ano}</p>
                <p><strong>Período:</strong> ${new Date(dataInicioDate).toLocaleDateString('pt-BR')} até ${new Date(dataFimDate).toLocaleDateString('pt-BR')}</p>
                <p><strong>Escopo:</strong> ${escopo}</p>
                <p><strong>Motivo:</strong> ${motivo}</p>
                <p><strong>Autorizado por:</strong> ${reabertura.autorizador?.nomeCompleto || 'N/A'}</p>
              </div>
            `,
          },
          `Reabertura Excepcional - ${instituicao?.nome || 'Instituição'} - Ano ${anoLetivo.ano}`
        );
      } catch (error: any) {
        console.error('[criarReabertura] Erro ao notificar SUPER_ADMIN (não crítico):', error.message);
      }
    } catch (emailError: any) {
      // Log do erro mas não abortar criação de reabertura
      console.error('[criarReabertura] Erro ao enviar e-mails (não crítico):', emailError.message);
    }

    res.status(201).json({
      ...reabertura,
      mensagem: 'Reabertura excepcional criada com sucesso. Todas as operações durante este período serão auditadas.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Listar reaberturas (ativas e históricas)
 */
export const listarReaberturas = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { anoLetivoId, ativo } = req.query;
    const instituicaoId = requireTenantScope(req);

    const where: any = {
      instituicaoId,
    };

    if (anoLetivoId) {
      where.anoLetivoId = anoLetivoId as string;
    }

    if (ativo !== undefined) {
      where.ativo = ativo === 'true';
    }

    const reaberturas = await prisma.reaberturaAnoLetivo.findMany({
      where,
      include: {
        autorizador: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
          },
        },
        encerrador: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
          },
        },
        anoLetivo: {
          select: {
            id: true,
            ano: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json(reaberturas);
  } catch (error) {
    next(error);
  }
};

/**
 * Obter reabertura por ID
 */
export const obterReabertura = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const instituicaoId = requireTenantScope(req);

    const reabertura = await prisma.reaberturaAnoLetivo.findFirst({
      where: {
        id,
        instituicaoId,
      },
      include: {
        autorizador: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
          },
        },
        encerrador: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
          },
        },
        anoLetivo: {
          select: {
            id: true,
            ano: true,
            status: true,
          },
        },
      },
    });

    if (!reabertura) {
      throw new AppError('Reabertura não encontrada', 404);
    }

    res.json(reabertura);
  } catch (error) {
    next(error);
  }
};

/**
 * Encerrar reabertura manualmente (antes do prazo)
 */
export const encerrarReabertura = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { observacoes } = req.body;
    const instituicaoId = requireTenantScope(req);
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('Usuário não autenticado', 401);
    }

    // Verificar permissões (apenas ADMIN, DIRECAO, SUPER_ADMIN)
    const userRoles = req.user?.roles || [];
    const podeEncerrar = ['ADMIN', 'DIRECAO', 'SUPER_ADMIN'].some(role => userRoles.includes(role as any));

    if (!podeEncerrar) {
      throw new AppError('Você não tem permissão para encerrar reaberturas', 403);
    }

    const reabertura = await prisma.reaberturaAnoLetivo.findFirst({
      where: {
        id,
        instituicaoId,
      },
      include: {
        anoLetivo: {
          select: {
            id: true,
            ano: true,
          },
        },
      },
    });

    if (!reabertura) {
      throw new AppError('Reabertura não encontrada', 404);
    }

    if (!reabertura.ativo) {
      throw new AppError('Reabertura já está encerrada', 400);
    }

    // Encerrar reabertura
    const reaberturaEncerrada = await prisma.reaberturaAnoLetivo.update({
      where: { id },
      data: {
        ativo: false,
        encerradoEm: new Date(),
        encerradoPor: userId,
        observacoes: observacoes?.trim() || reabertura.observacoes,
      },
      include: {
        autorizador: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
          },
        },
        encerrador: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
          },
        },
        anoLetivo: {
          select: {
            id: true,
            ano: true,
            status: true,
          },
        },
      },
    });

    // Auditoria obrigatória
    await AuditService.log(req, {
      modulo: ModuloAuditoria.ANO_LETIVO,
      acao: AcaoAuditoria.CLOSE,
      entidade: EntidadeAuditoria.ANO_LETIVO,
      entidadeId: reabertura.anoLetivoId,
      instituicaoId,
      dadosAnteriores: reabertura,
      dadosNovos: reaberturaEncerrada,
      observacao: `Reabertura excepcional encerrada manualmente antes do prazo. Observações: ${observacoes || 'Nenhuma'}.`,
    });

    res.json({
      ...reaberturaEncerrada,
      mensagem: 'Reabertura encerrada com sucesso. Ano letivo voltou ao estado de bloqueio.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Encerrar reaberturas expiradas (chamado por cron/scheduler)
 */
export const encerrarReaberturasExpiradasEndpoint = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // MULTI-TENANT: instituicaoId SEMPRE vem do JWT (req.user.instituicaoId)
    // SUPER_ADMIN pode opcionalmente filtrar por instituicaoId via query (para operações administrativas)
    // MULTI-TENANT: instituicaoId SEMPRE vem do JWT (req.user.instituicaoId)
    // NUNCA aceitar instituicaoId do query - violação de segurança multi-tenant
    // SUPER_ADMIN também deve usar instituicaoId do token para garantir isolamento
    const instituicaoId = req.user?.instituicaoId || undefined;
    
    const encerradas = await encerrarReaberturasExpiradas(instituicaoId);

    res.json({
      mensagem: `${encerradas} reabertura(s) expirada(s) encerrada(s) automaticamente`,
      totalEncerradas: encerradas,
    });
  } catch (error) {
    next(error);
  }
};

