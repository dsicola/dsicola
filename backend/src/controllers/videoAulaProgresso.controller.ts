import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';

/**
 * Threshold para marcar aula como assistida (90%)
 */
const PROGRESS_THRESHOLD = 90;

/**
 * Atualizar progresso de uma videoaula
 * POST /video-aulas/:id/progresso
 */
export const updateProgress = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user || !user.userId) {
      throw new AppError('Não autenticado', 401);
    }

    const { id: videoAulaId } = req.params;
    const { percentualAssistido } = req.body;

    // Validações
    if (typeof percentualAssistido !== 'number' || percentualAssistido < 0 || percentualAssistido > 100) {
      throw new AppError('Percentual deve ser um número entre 0 e 100', 400);
    }

    // Verificar se a videoaula existe
    const videoAula = await prisma.videoAula.findUnique({
      where: { id: videoAulaId }
    });

    if (!videoAula) {
      throw new AppError('Videoaula não encontrada', 404);
    }

    const userRoles = user.roles || [];
    const userMatchesPerfil = (pa: string | null, roles: string[]): boolean => {
      if (!pa) return false;
      const r = roles.map((x: any) => (typeof x === 'string' ? x : (x as any).role || (x as any).name) || '').filter(Boolean);
      if (pa === 'TODOS') return r.some((x) => ['ADMIN', 'PROFESSOR', 'SECRETARIA', 'DIRECAO', 'COORDENADOR', 'SUPER_ADMIN'].includes(x));
      return r.includes(pa);
    };
    if (!userMatchesPerfil(videoAula.perfilAlvo, userRoles)) {
      throw new AppError('Acesso negado a esta videoaula', 403);
    }
    let tipoInst: 'SECUNDARIO' | 'SUPERIOR' | null = null;
    if (user.instituicaoId) {
      const inst = await prisma.instituicao.findUnique({ where: { id: user.instituicaoId }, select: { tipoAcademico: true } });
      tipoInst = inst?.tipoAcademico || null;
    }
    if (videoAula.tipoInstituicao && videoAula.tipoInstituicao !== tipoInst) {
      throw new AppError('Acesso negado a esta videoaula', 403);
    }

    // Calcular se está assistido (>= 90%)
    const assistido = percentualAssistido >= PROGRESS_THRESHOLD;

    // Upsert progresso
    const progresso = await prisma.videoAulaProgresso.upsert({
      where: {
        userId_videoAulaId: {
          userId: user.userId,
          videoAulaId: videoAulaId
        }
      },
      update: {
        percentualAssistido: Math.round(percentualAssistido),
        assistido,
        ultimaVisualizacao: new Date()
      },
      create: {
        userId: user.userId,
        videoAulaId: videoAulaId,
        percentualAssistido: Math.round(percentualAssistido),
        assistido,
        ultimaVisualizacao: new Date()
      }
    });

    res.json(progresso);
  } catch (error) {
    next(error);
  }
};

/**
 * Listar progresso de todas as videoaulas do usuário
 * GET /video-aulas/progresso
 */
export const getProgress = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user || !user.userId) {
      throw new AppError('Não autenticado', 401);
    }

    // Buscar todos os progressos do usuário
    const progressos = await prisma.videoAulaProgresso.findMany({
      where: {
        userId: user.userId
      },
      include: {
        videoAula: {
          select: {
            id: true,
            titulo: true
          }
        }
      }
    });

    // Formatar resposta como mapa de videoAulaId -> progresso
    const progressoMap = progressos.reduce((acc, progresso) => {
      acc[progresso.videoAulaId] = {
        assistido: progresso.assistido,
        percentualAssistido: progresso.percentualAssistido,
        ultimaVisualizacao: progresso.ultimaVisualizacao
      };
      return acc;
    }, {} as Record<string, { assistido: boolean; percentualAssistido: number; ultimaVisualizacao: Date | null }>);

    res.json(progressoMap);
  } catch (error) {
    next(error);
  }
};

