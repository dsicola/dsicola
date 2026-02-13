import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { requireTenantScope } from '../middlewares/auth.js';
import { TermoLegalService, TipoAcaoTermoLegal } from '../services/termoLegal.service.js';
import { AuditService } from '../services/audit.service.js';

/**
 * Verificar se termo legal precisa ser aceito
 * GET /api/termos-legais/verificar/:tipoAcao
 */
export const verificarTermo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // MULTI-TENANT: instituicaoId SEMPRE vem do JWT (req.user.instituicaoId)
    // NUNCA aceitar instituicaoId do query - violação de segurança multi-tenant
    // SUPER_ADMIN também deve usar instituicaoId do token para garantir isolamento
    const instituicaoId = requireTenantScope(req);

    const { tipoAcao } = req.params;

    if (!req.user?.userId) {
      throw new AppError('Usuário não autenticado', 401);
    }

    const verificarAceite = await TermoLegalService.verificarAceite(
      req.user.userId,
      instituicaoId,
      tipoAcao as TipoAcaoTermoLegal
    );

    res.json({
      aceito: verificarAceite.aceito,
      termoId: verificarAceite.termoId,
      termo: verificarAceite.termo,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Aceitar termo legal
 * POST /api/termos-legais/aceitar
 */
export const aceitarTermo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { termoId } = req.body;

    if (!req.user?.userId) {
      throw new AppError('Usuário não autenticado', 401);
    }

    if (!termoId) {
      throw new AppError('ID do termo é obrigatório', 400);
    }

    const resultado = await TermoLegalService.aceitarTermo(
      req.user.userId,
      instituicaoId,
      termoId,
      req
    );

    res.json({
      success: true,
      message: 'Termo legal aceito com sucesso',
      aceiteId: resultado.aceiteId,
      hashPdf: resultado.hashPdf,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obter termo legal ativo
 * GET /api/termos-legais/:tipoAcao
 */
export const obterTermo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { tipoAcao } = req.params;

    const termo = await prisma.termoLegal.findFirst({
      where: {
        instituicaoId,
        tipoAcao: tipoAcao as TipoAcaoTermoLegal,
        ativo: true,
      },
      orderBy: {
        versao: 'desc',
      },
      include: {
        instituicao: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
    });

    if (!termo) {
      return res.json({
        existe: false,
        termo: null,
      });
    }

    res.json({
      existe: true,
      termo: {
        id: termo.id,
        tipoAcao: termo.tipoAcao,
        titulo: termo.titulo,
        conteudoHtml: termo.conteudoHtml,
        versao: termo.versao,
        instituicao: termo.instituicao,
      },
    });
  } catch (error) {
    next(error);
  }
};

