import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';

/** IDs de utilizadores da instituição do token (ADMIN); SUPER_ADMIN não usa isto para listar tudo. */
async function userIdsNaInstituicao(instituicaoId: string): Promise<string[]> {
  const rows = await prisma.user.findMany({
    where: { instituicaoId },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit } = req.query;
    const take = limit ? parseInt(limit as string, 10) : 100;
    const safeTake = Number.isFinite(take) && take > 0 && take <= 500 ? take : 100;

    const isSuper = req.user?.roles?.includes('SUPER_ADMIN');
    if (isSuper) {
      const logs = await prisma.logRedefinicaoSenha.findMany({
        orderBy: { createdAt: 'desc' },
        take: safeTake,
      });
      return res.json(logs);
    }

    const instituicaoId = req.user?.instituicaoId;
    if (!instituicaoId) {
      throw new AppError('Acesso negado: instituição não identificada', 403);
    }

    const ids = await userIdsNaInstituicao(instituicaoId);
    if (ids.length === 0) {
      return res.json([]);
    }

    const logs = await prisma.logRedefinicaoSenha.findMany({
      where: {
        OR: [{ redefinidoPorId: { in: ids } }, { usuarioAfetadoId: { in: ids } }],
      },
      orderBy: { createdAt: 'desc' },
      take: safeTake,
    });

    res.json(logs);
  } catch (error) {
    next(error);
  }
};

export const getRecent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.query;
    const isSuper = req.user?.roles?.includes('SUPER_ADMIN');

    if (userId && typeof userId === 'string' && userId.trim()) {
      const uid = userId.trim();
      if (!isSuper) {
        const instituicaoId = req.user?.instituicaoId;
        if (!instituicaoId) {
          throw new AppError('Acesso negado: instituição não identificada', 403);
        }
        const permitido = await prisma.user.findFirst({
          where: { id: uid, instituicaoId },
          select: { id: true },
        });
        if (!permitido) {
          throw new AppError('Utilizador não encontrado nesta instituição', 404);
        }
      }

      const logs = await prisma.logRedefinicaoSenha.findMany({
        where: { redefinidoPorId: uid },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
      return res.json(logs);
    }

    if (isSuper) {
      const logs = await prisma.logRedefinicaoSenha.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
      return res.json(logs);
    }

    const instituicaoId = req.user?.instituicaoId;
    if (!instituicaoId) {
      throw new AppError('Acesso negado: instituição não identificada', 403);
    }
    const ids = await userIdsNaInstituicao(instituicaoId);
    if (ids.length === 0) {
      return res.json([]);
    }

    const logs = await prisma.logRedefinicaoSenha.findMany({
      where: {
        OR: [{ redefinidoPorId: { in: ids } }, { usuarioAfetadoId: { in: ids } }],
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    res.json(logs);
  } catch (error) {
    next(error);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = req.body;
    const isSuper = req.user?.roles?.includes('SUPER_ADMIN');

    if (!isSuper) {
      const instituicaoId = req.user?.instituicaoId;
      if (!instituicaoId) {
        throw new AppError('Acesso negado: instituição não identificada', 403);
      }
      const ids = new Set(await userIdsNaInstituicao(instituicaoId));
      const alvo = [data.redefinidoPorId, data.usuarioAfetadoId].filter(Boolean) as string[];
      for (const id of alvo) {
        if (!ids.has(id)) {
          throw new AppError('Só é permitido registar logs envolvendo utilizadores da sua instituição', 403);
        }
      }
    }

    const log = await prisma.logRedefinicaoSenha.create({
      data: {
        redefinidoPorId: data.redefinidoPorId,
        redefinidoPorEmail: data.redefinidoPorEmail,
        redefinidoPorNome: data.redefinidoPorNome,
        usuarioAfetadoId: data.usuarioAfetadoId,
        usuarioAfetadoEmail: data.usuarioAfetadoEmail,
        usuarioAfetadoNome: data.usuarioAfetadoNome,
        enviadoPorEmail: data.enviadoPorEmail || false,
        ipAddress: data.ipAddress,
      },
    });

    res.status(201).json(log);
  } catch (error) {
    next(error);
  }
};
