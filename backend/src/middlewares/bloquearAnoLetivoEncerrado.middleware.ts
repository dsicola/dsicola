import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler.js';
import { requireTenantScope } from './auth.js';
import prisma from '../lib/prisma.js';
import { AuditService } from '../services/audit.service.js';
import { ModuloAuditoria, AcaoAuditoria, EntidadeAuditoria } from '../services/audit.service.js';
import { verificarReaberturaAtiva, verificarPermissaoReabertura, EscopoReabertura } from '../services/reaberturaAnoLetivo.service.js';

/**
 * ========================================
 * MIDDLEWARE: BLOQUEAR MUTATIONS EM ANO LETIVO ENCERRADO
 * ========================================
 * 
 * REGRA INSTITUCIONAL (SIGA/SIGAE):
 * - Ano Letivo ENCERRADO = MARCO HISTÓRICO
 * - Dados NÃO podem ser alterados após encerramento
 * - Apenas VISUALIZAÇÃO e RELATÓRIOS são permitidos
 * 
 * EXCEÇÕES:
 * - SUPER_ADMIN pode usar override_encerramento = true
 * - Todas as exceções são LOGADAS em auditoria
 */

/**
 * Verificar se ano letivo está encerrado
 * Retorna true se encerrado, false caso contrário
 */
export const verificarAnoLetivoEncerrado = async (
  anoLetivoId: string | null | undefined,
  instituicaoId: string
): Promise<{ encerrado: boolean; anoLetivo: any | null; mensagem?: string }> => {
  if (!anoLetivoId) {
    // Se não há anoLetivoId, verificar se há algum ano letivo encerrado ativo
    const anoLetivoEncerrado = await prisma.anoLetivo.findFirst({
      where: {
        instituicaoId,
        status: 'ENCERRADO',
      },
      orderBy: {
        ano: 'desc',
      },
    });

    if (anoLetivoEncerrado) {
      return {
        encerrado: true,
        anoLetivo: anoLetivoEncerrado,
        mensagem: `Ano letivo ${anoLetivoEncerrado.ano} está encerrado. Operações acadêmicas não são permitidas.`,
      };
    }

    return { encerrado: false, anoLetivo: null };
  }

  // Buscar ano letivo específico
  const anoLetivo = await prisma.anoLetivo.findFirst({
    where: {
      id: anoLetivoId,
      instituicaoId,
    },
  });

  if (!anoLetivo) {
    return { encerrado: false, anoLetivo: null };
  }

  if (anoLetivo.status === 'ENCERRADO') {
    // CRÍTICO: Verificar se existe reabertura ATIVA antes de bloquear
    const reaberturaInfo = await verificarReaberturaAtiva(anoLetivo.id, instituicaoId);

    if (reaberturaInfo.reaberturaAtiva && reaberturaInfo.reabertura) {
      // Reabertura ativa encontrada - permitir operações dentro do escopo
      return {
        encerrado: false, // Não bloquear se houver reabertura ativa
        anoLetivo,
        reabertura: reaberturaInfo.reabertura,
        escopoPermitido: reaberturaInfo.escopoPermitido,
      };
    }

    return {
      encerrado: true,
      anoLetivo,
      mensagem: `Ano letivo ${anoLetivo.ano} está encerrado desde ${anoLetivo.encerradoEm ? new Date(anoLetivo.encerradoEm).toLocaleDateString('pt-BR') : 'data desconhecida'}. Operações acadêmicas não são permitidas.`,
    };
  }

  return { encerrado: false, anoLetivo };
};

/**
 * Middleware para bloquear mutations em ano letivo encerrado
 * 
 * Detecta automaticamente anoLetivoId de:
 * - req.body.anoLetivoId
 * - req.body.anoLetivo (busca o ID correspondente)
 * - req.params.anoLetivoId
 * - req.query.anoLetivoId
 * - req.body.planoEnsinoId (busca o plano e pega anoLetivoId)
 * - req.body.turmaId (busca a turma e pega anoLetivoId)
 * - req.body.aulaLancadaId (busca a aula e pega anoLetivoId do planoEnsino)
 * - req.body.avaliacaoId (busca a avaliação e pega anoLetivoId do planoEnsino)
 * 
 * Rotas acadêmicas que devem usar:
 * - POST/PUT/DELETE /aulas
 * - POST/PUT/DELETE /presencas
 * - POST/PUT/DELETE /avaliacoes
 * - POST/PUT/DELETE /notas
 * - POST/PUT/DELETE /matriculas
 * - POST/PUT/DELETE /plano-ensino
 * - POST/PUT/DELETE /turmas
 */
export const bloquearAnoLetivoEncerrado = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // SUPER_ADMIN pode usar override_encerramento = true
    const overrideEncerramento = req.body?.override_encerramento === true || req.query?.override_encerramento === 'true';
    const isSuperAdmin = req.user?.roles?.includes('SUPER_ADMIN');

    if (overrideEncerramento && isSuperAdmin) {
      // Registrar log de auditoria obrigatório para exceção
      const instituicaoId = requireTenantScope(req);
      
      // Tentar obter anoLetivoId para auditoria
      let anoLetivoId: string | null | undefined = 
        req.body?.anoLetivoId || 
        req.params?.anoLetivoId || 
        req.query?.anoLetivoId;

      // Registrar auditoria (assíncrono - não bloqueia)
      AuditService.log(req, {
        modulo: ModuloAuditoria.ANO_LETIVO,
        acao: AcaoAuditoria.ENCERRAMENTO_OVERRIDE,
        entidade: EntidadeAuditoria.ANO_LETIVO,
        entidadeId: anoLetivoId || undefined,
        instituicaoId,
        dadosNovos: {
          override: true,
          route: `${req.method} ${req.path}`,
          body: req.body ? Object.keys(req.body) : [],
        },
        observacao: `⚠️ SUPER_ADMIN usando override_encerramento para bypassar bloqueio de ano letivo encerrado. Rota: ${req.method} ${req.path}`,
      }).catch((error) => {
        console.error('[BLOQUEIO_ENCERRAMENTO] Erro ao registrar auditoria de override:', error);
      });

      console.warn(`[BLOQUEIO_ENCERRAMENTO] ⚠️ SUPER_ADMIN usando override_encerramento:`, {
        userId: req.user?.userId,
        route: `${req.method} ${req.path}`,
        timestamp: new Date().toISOString(),
      });

      return next();
    }

    const instituicaoId = requireTenantScope(req);

    // Tentar obter anoLetivoId de várias fontes
    let anoLetivoId: string | null | undefined = 
      req.body?.anoLetivoId || 
      req.params?.anoLetivoId || 
      req.query?.anoLetivoId;

    // Se não encontrou diretamente, tentar buscar de entidades relacionadas
    if (!anoLetivoId) {
      // 1. Tentar buscar de planoEnsinoId
      if (req.body?.planoEnsinoId) {
        const planoEnsino = await prisma.planoEnsino.findFirst({
          where: {
            id: req.body.planoEnsinoId,
            instituicaoId,
          },
          select: {
            anoLetivoId: true,
          },
        });
        if (planoEnsino) {
          anoLetivoId = planoEnsino.anoLetivoId;
        }
      }

      // 2. Tentar buscar de turmaId
      if (!anoLetivoId && req.body?.turmaId) {
        const turma = await prisma.turma.findFirst({
          where: {
            id: req.body.turmaId,
            instituicaoId,
          },
          select: {
            anoLetivoId: true,
          },
        });
        if (turma) {
          anoLetivoId = turma.anoLetivoId;
        }
      }

      // 3. Tentar buscar de aulaLancadaId
      if (!anoLetivoId && (req.body?.aulaLancadaId || req.params?.aulaLancadaId)) {
        const aulaId = req.body?.aulaLancadaId || req.params?.aulaLancadaId;
        const aula = await prisma.aulaLancada.findFirst({
          where: {
            id: aulaId,
            instituicaoId,
          },
          include: {
            planoEnsino: {
              select: {
                anoLetivoId: true,
              },
            },
          },
        });
        if (aula?.planoEnsino) {
          anoLetivoId = aula.planoEnsino.anoLetivoId;
        }
      }

      // 4. Tentar buscar de avaliacaoId
      if (!anoLetivoId && (req.body?.avaliacaoId || req.params?.avaliacaoId)) {
        const avaliacaoId = req.body?.avaliacaoId || req.params?.avaliacaoId;
        const avaliacao = await prisma.avaliacao.findFirst({
          where: {
            id: avaliacaoId,
            instituicaoId,
          },
          include: {
            planoEnsino: {
              select: {
                anoLetivoId: true,
              },
            },
          },
        });
        if (avaliacao?.planoEnsino) {
          anoLetivoId = avaliacao.planoEnsino.anoLetivoId;
        }
      }

      // 5. Tentar buscar de matriculaId
      if (!anoLetivoId && (req.body?.matriculaId || req.params?.matriculaId)) {
        const matriculaId = req.body?.matriculaId || req.params?.matriculaId;
        const matricula = await prisma.matriculaAnual.findFirst({
          where: {
            id: matriculaId,
            instituicaoId,
          },
          select: {
            anoLetivoId: true,
          },
        });
        if (matricula) {
          anoLetivoId = matricula.anoLetivoId;
        }
      }

      // 6. Tentar buscar de notaId (nota pertence a avaliação que pertence a planoEnsino)
      if (!anoLetivoId && (req.body?.notaId || req.params?.notaId)) {
        const notaId = req.body?.notaId || req.params?.notaId;
        const nota = await prisma.nota.findFirst({
          where: {
            id: notaId,
            instituicaoId,
          },
          include: {
            avaliacao: {
              include: {
                planoEnsino: {
                  select: {
                    anoLetivoId: true,
                  },
                },
              },
            },
          },
        });
        if (nota?.avaliacao?.planoEnsino) {
          anoLetivoId = nota.avaliacao.planoEnsino.anoLetivoId;
        }
      }
    }

    // Verificar se ano letivo está encerrado
    const verificacao = await verificarAnoLetivoEncerrado(anoLetivoId, instituicaoId);

    if (verificacao.encerrado) {
      // Se encerrado, verificar se há reabertura ativa
      if (anoLetivoId) {
        const reaberturaInfo = await verificarReaberturaAtiva(anoLetivoId, instituicaoId);

        if (reaberturaInfo.reaberturaAtiva && reaberturaInfo.reabertura) {
          // Verificar se a rota está dentro do escopo permitido
          const rota = req.path;
          const metodo = req.method;
          const escopoPermitido = reaberturaInfo.escopoPermitido;
          
          // Obter tipo de instituição para validação específica
          const instituicao = await prisma.instituicao.findUnique({
            where: { id: instituicaoId },
            select: { tipoAcademico: true },
          });
          
          const tipoInstituicao = instituicao?.tipoAcademico === 'SUPERIOR' ? 'SUPERIOR' : 
                                  instituicao?.tipoAcademico === 'SECUNDARIO' ? 'SECUNDARIO' : undefined;
          
          const permitido = verificarPermissaoReabertura(rota, metodo, escopoPermitido, tipoInstituicao);

          if (!permitido) {
            throw new AppError(
              `Ano letivo encerrado. Reabertura ativa permite apenas: ${escopoPermitido.join(', ')}. Esta operação não está no escopo autorizado.`,
              403
            );
          }

          // Registrar auditoria obrigatória para ação durante reabertura
          AuditService.log(req, {
            modulo: ModuloAuditoria.ANO_LETIVO,
            acao: metodo === 'POST' ? AcaoAuditoria.CREATE : metodo === 'PUT' ? AcaoAuditoria.UPDATE : metodo === 'DELETE' ? AcaoAuditoria.DELETE : AcaoAuditoria.UPDATE,
            entidade: EntidadeAuditoria.ANO_LETIVO,
            entidadeId: anoLetivoId,
            instituicaoId,
            dadosNovos: {
              reaberturaId: reaberturaInfo.reabertura.id,
              reaberturaMotivo: reaberturaInfo.reabertura.motivo,
              escopo: reaberturaInfo.reabertura.escopo,
              route: `${metodo} ${rota}`,
              operacao: 'Operação realizada durante reabertura excepcional',
            },
            observacao: `⚠️ Operação realizada durante REABERTURA EXCEPCIONAL do ano letivo ${verificacao.anoLetivo?.ano}. Reabertura ID: ${reaberturaInfo.reabertura.id}. Escopo: ${reaberturaInfo.reabertura.escopo}.`,
          }).catch((error) => {
            console.error('[BLOQUEIO_ENCERRAMENTO] Erro ao registrar auditoria de reabertura:', error);
          });

          // Adicionar informações de reabertura ao request
          (req as any).reaberturaAtiva = reaberturaInfo.reabertura;
          (req as any).anoLetivoVerificado = verificacao.anoLetivo;

          return next();
        }
      }

      throw new AppError(
        verificacao.mensagem || 'Ano letivo encerrado. Operação não permitida.',
        403
      );
    }

    // Adicionar ano letivo ao request para uso nos controllers
    if (verificacao.anoLetivo) {
      (req as any).anoLetivoVerificado = verificacao.anoLetivo;
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware específico para rotas de leitura (GET)
 * Permite acesso mesmo se ano letivo estiver encerrado
 * (apenas para visualização e relatórios)
 */
export const permitirLeituraAnoEncerrado = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Rotas GET sempre permitidas (visualização)
  if (req.method === 'GET') {
    return next();
  }

  // Para outros métodos, aplicar bloqueio normal
  return bloquearAnoLetivoEncerrado(req, res, next);
};

