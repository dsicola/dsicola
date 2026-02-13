import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';

/**
 * Buscar preço por tipo de instituição e plano
 * Endpoint: GET /planos-precos?planoId=xxx&tipoInstituicao=SECUNDARIO|SUPERIOR
 */
export const getPreco = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { planoId, tipoInstituicao } = req.query;

    if (!planoId || !tipoInstituicao) {
      throw new AppError('planoId e tipoInstituicao são obrigatórios', 400);
    }

    // Validar tipoInstituicao
    if (tipoInstituicao !== 'SECUNDARIO' && tipoInstituicao !== 'SUPERIOR') {
      throw new AppError('tipoInstituicao deve ser SECUNDARIO ou SUPERIOR', 400);
    }

    // Buscar preço na tabela centralizada
    const preco = await prisma.planosPrecos.findUnique({
      where: {
        planoId_tipoInstituicao: {
          planoId: String(planoId),
          tipoInstituicao: tipoInstituicao as 'SECUNDARIO' | 'SUPERIOR',
        },
      },
      include: {
        plano: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
    });

    if (!preco) {
      // Se não encontrou na tabela centralizada, tentar buscar do plano (legacy)
      const plano = await prisma.plano.findUnique({
        where: { id: String(planoId) },
      });

      if (!plano) {
        throw new AppError('Plano não encontrado', 404);
      }

      // Usar preços legacy do plano como fallback
      let valorMensal = plano.valorMensal;
      if (tipoInstituicao === 'SECUNDARIO' && plano.precoSecundario) {
        valorMensal = plano.precoSecundario;
      } else if (tipoInstituicao === 'SUPERIOR' && plano.precoUniversitario) {
        valorMensal = plano.precoUniversitario;
      }

      return res.json({
        planoId: plano.id,
        planoNome: plano.nome,
        tipoInstituicao,
        valorMensal: Number(valorMensal),
        moeda: 'AOA',
        origem: 'LEGACY', // Indica que veio do plano antigo
      });
    }

    if (!preco.ativo) {
      throw new AppError('Preço não está ativo', 400);
    }

    res.json({
      planoId: preco.planoId,
      planoNome: preco.plano.nome,
      tipoInstituicao: preco.tipoInstituicao,
      valorMensal: Number(preco.valorMensal),
      moeda: preco.moeda,
      origem: 'CENTRALIZADO',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Listar todos os preços de um plano
 */
export const getPrecosByPlano = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { planoId } = req.params;

    const precos = await prisma.planosPrecos.findMany({
      where: {
        planoId,
        ativo: true,
      },
      include: {
        plano: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
      orderBy: {
        tipoInstituicao: 'asc',
      },
    });

    res.json(precos);
  } catch (error) {
    next(error);
  }
};

/**
 * Criar ou atualizar preço
 * Apenas SUPER_ADMIN
 */
export const createOrUpdatePreco = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validar que é SUPER_ADMIN (deve estar no middleware, mas garantindo aqui)
    if (!req.user?.roles.includes('SUPER_ADMIN')) {
      throw new AppError('Apenas SUPER_ADMIN pode gerenciar preços', 403);
    }

    const { planoId, tipoInstituicao, valorMensal, moeda = 'AOA', ativo = true } = req.body;

    if (!planoId || !tipoInstituicao || !valorMensal) {
      throw new AppError('planoId, tipoInstituicao e valorMensal são obrigatórios', 400);
    }

    if (tipoInstituicao !== 'SECUNDARIO' && tipoInstituicao !== 'SUPERIOR') {
      throw new AppError('tipoInstituicao deve ser SECUNDARIO ou SUPERIOR', 400);
    }

    // Verificar se plano existe
    const plano = await prisma.plano.findUnique({
      where: { id: planoId },
    });

    if (!plano) {
      throw new AppError('Plano não encontrado', 404);
    }

    // Criar ou atualizar preço
    const preco = await prisma.planosPrecos.upsert({
      where: {
        planoId_tipoInstituicao: {
          planoId,
          tipoInstituicao: tipoInstituicao as 'SECUNDARIO' | 'SUPERIOR',
        },
      },
      update: {
        valorMensal,
        moeda,
        ativo,
        criadoPor: req.user.userId,
      },
      create: {
        planoId,
        tipoInstituicao: tipoInstituicao as 'SECUNDARIO' | 'SUPERIOR',
        valorMensal,
        moeda,
        ativo,
        criadoPor: req.user.userId,
      },
      include: {
        plano: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
    });

    res.json(preco);
  } catch (error) {
    next(error);
  }
};

