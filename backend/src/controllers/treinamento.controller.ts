import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';

/**
 * Obter trilha atual do usuário baseada no perfil
 * GET /treinamento/trilha-atual
 */
export const getTrilhaAtual = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user || !user.userId) {
      throw new AppError('Não autenticado', 401);
    }

    // Obter roles do usuário
    const userRoles = user.roles || [];
    if (userRoles.length === 0) {
      throw new AppError('Usuário sem perfil definido', 400);
    }

    // Prioridade: ADMIN > SECRETARIA > PROFESSOR > outros
    const rolePrioridade: Record<string, number> = {
      'ADMIN': 1,
      'SECRETARIA': 2,
      'PROFESSOR': 3,
      'COORDENADOR': 4,
      'DIRECAO': 5,
    };

    // Selecionar role principal (menor número = maior prioridade)
    const rolePrincipal = userRoles
      .map(role => ({ role, prioridade: rolePrioridade[role] || 999 }))
      .sort((a, b) => a.prioridade - b.prioridade)[0]?.role || userRoles[0];

    // Buscar trilha ativa para o perfil
    const trilha = await prisma.treinamentoTrilha.findFirst({
      where: {
        perfil: rolePrincipal as any,
        ativo: true,
      },
      include: {
        aulas: {
          include: {
            videoAula: {
              include: {
                progressos: {
                  where: {
                    userId: user.userId,
                  },
                },
              },
            },
          },
          orderBy: {
            ordem: 'asc',
          },
        },
      },
      orderBy: {
        ordem: 'asc',
      },
    });

    if (!trilha) {
      return res.json({
        trilha: null,
        progresso: {
          totalAulas: 0,
          aulasConcluidas: 0,
          percentualConcluido: 0,
          podeFinalizar: false,
        },
      });
    }

    // Calcular progresso
    const totalAulas = trilha.aulas.length;
    const aulasConcluidas = trilha.aulas.filter(aula => {
      const progresso = aula.videoAula.progressos[0];
      return progresso && progresso.percentualAssistido >= 90;
    }).length;

    const percentualConcluido = totalAulas > 0 
      ? Math.round((aulasConcluidas / totalAulas) * 100)
      : 0;

    const podeFinalizar = percentualConcluido >= 90;

    // Formatar resposta
    const aulasFormatadas = trilha.aulas.map(aula => {
      const progresso = aula.videoAula.progressos[0];
      return {
        id: aula.id,
        ordem: aula.ordem,
        videoAula: {
          id: aula.videoAula.id,
          titulo: aula.videoAula.titulo,
          descricao: aula.videoAula.descricao,
          urlVideo: aula.videoAula.urlVideo,
          tipoVideo: aula.videoAula.tipoVideo,
        },
        progresso: progresso ? {
          assistido: progresso.assistido,
          percentualAssistido: progresso.percentualAssistido,
          ultimaVisualizacao: progresso.ultimaVisualizacao,
        } : null,
      };
    });

    res.json({
      trilha: {
        id: trilha.id,
        nome: trilha.nome,
        descricao: trilha.descricao,
        perfil: trilha.perfil,
      },
      aulas: aulasFormatadas,
      progresso: {
        totalAulas,
        aulasConcluidas,
        percentualConcluido,
        podeFinalizar,
      },
    });
  } catch (error) {
    next(error);
  }
};

