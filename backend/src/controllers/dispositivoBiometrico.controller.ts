import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter, requireTenantScope } from '../middlewares/auth.js';
import crypto from 'crypto';

/**
 * Listar dispositivos biométricos da instituição
 */
export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);

    const dispositivos = await prisma.dispositivoBiometrico.findMany({
      where: filter,
      include: {
        instituicao: {
          select: {
            id: true,
            nome: true,
          },
        },
        _count: {
          select: {
            eventos: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json(dispositivos);
  } catch (error) {
    next(error);
  }
};

/**
 * Buscar dispositivo por ID
 */
export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);

    const dispositivo = await prisma.dispositivoBiometrico.findFirst({
      where: {
        id,
        ...filter,
      },
      include: {
        instituicao: {
          select: {
            id: true,
            nome: true,
          },
        },
        eventos: {
          take: 10,
          orderBy: {
            timestamp: 'desc',
          },
          include: {
            funcionario: {
              select: {
                id: true,
                nomeCompleto: true,
              },
            },
          },
        },
      },
    });

    if (!dispositivo) {
      throw new AppError('Dispositivo não encontrado', 404);
    }

    res.json(dispositivo);
  } catch (error) {
    next(error);
  }
};

/**
 * Criar dispositivo biométrico
 */
export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // VALIDAÇÃO MULTI-TENANT: Rejeitar explicitamente instituicaoId do body (segurança)
    if (req.body.instituicaoId !== undefined || req.body.instituicao_id !== undefined) {
      throw new AppError('Não é permitido alterar a instituição. O sistema usa a instituição do usuário autenticado.', 400);
    }

    const instituicaoId = requireTenantScope(req);
    const { nome, tipo, ip, porta, ipsPermitidos, observacoes } = req.body;

    if (!nome || !tipo || !ip) {
      throw new AppError('Nome, tipo e IP são obrigatórios', 400);
    }

    // Validar tipo
    const tiposValidos = ['ZKTECO', 'HIKVISION', 'SUPREMA'];
    if (!tiposValidos.includes(tipo)) {
      throw new AppError('Tipo de dispositivo inválido', 400);
    }

    // Verificar se já existe dispositivo com mesmo IP e porta para a instituição
    const existente = await prisma.dispositivoBiometrico.findFirst({
      where: {
        ip,
        porta: porta || 4370,
        instituicaoId,
      },
    });

    if (existente) {
      throw new AppError('Já existe um dispositivo com este IP e porta para sua instituição', 400);
    }

    // Gerar token de autenticação
    const token = crypto.randomBytes(32).toString('hex');

    const dispositivo = await prisma.dispositivoBiometrico.create({
      data: {
        nome,
        tipo,
        ip,
        porta: porta || 4370,
        token,
        ipsPermitidos: ipsPermitidos || [],
        ativo: true,
        instituicaoId,
        observacoes: observacoes || null,
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

    res.status(201).json(dispositivo);
  } catch (error) {
    next(error);
  }
};

/**
 * Atualizar dispositivo
 */
export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    const { nome, tipo, ip, porta, ipsPermitidos, ativo, observacoes, ultimoStatus, ultimaSincronizacao } = req.body;

    // Verificar se dispositivo existe e pertence à instituição
    const dispositivo = await prisma.dispositivoBiometrico.findFirst({
      where: {
        id,
        ...filter,
      },
    });

    if (!dispositivo) {
      throw new AppError('Dispositivo não encontrado', 404);
    }

    // Se estiver alterando IP ou porta, verificar duplicação
    if ((ip && ip !== dispositivo.ip) || (porta && porta !== dispositivo.porta)) {
      const existente = await prisma.dispositivoBiometrico.findFirst({
        where: {
          ip: ip || dispositivo.ip,
          porta: porta || dispositivo.porta,
          instituicaoId: dispositivo.instituicaoId,
          id: {
            not: id,
          },
        },
      });

      if (existente) {
        throw new AppError('Já existe outro dispositivo com este IP e porta', 400);
      }
    }

    const dispositivoAtualizado = await prisma.dispositivoBiometrico.update({
      where: { id },
      data: {
        ...(nome && { nome }),
        ...(tipo && { tipo }),
        ...(ip && { ip }),
        ...(porta && { porta }),
        ...(ipsPermitidos !== undefined && { ipsPermitidos }),
        ...(ativo !== undefined && { ativo }),
        ...(observacoes !== undefined && { observacoes }),
        ...(ultimoStatus !== undefined && { ultimoStatus }),
        ...(ultimaSincronizacao !== undefined && { ultimaSincronizacao }),
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

    res.json(dispositivoAtualizado);
  } catch (error) {
    next(error);
  }
};

/**
 * Deletar dispositivo
 */
export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);

    const dispositivo = await prisma.dispositivoBiometrico.findFirst({
      where: {
        id,
        ...filter,
      },
    });

    if (!dispositivo) {
      throw new AppError('Dispositivo não encontrado', 404);
    }

    await prisma.dispositivoBiometrico.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

/**
 * Regenerar token do dispositivo
 */
export const regenerateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);

    const dispositivo = await prisma.dispositivoBiometrico.findFirst({
      where: {
        id,
        ...filter,
      },
    });

    if (!dispositivo) {
      throw new AppError('Dispositivo não encontrado', 404);
    }

    const novoToken = crypto.randomBytes(32).toString('hex');

    const dispositivoAtualizado = await prisma.dispositivoBiometrico.update({
      where: { id },
      data: {
        token: novoToken,
      },
      select: {
        id: true,
        nome: true,
        token: true,
      },
    });

    res.json(dispositivoAtualizado);
  } catch (error) {
    next(error);
  }
};

/**
 * Testar conexão com dispositivo
 * Para ZKTeco: usa conexão real via SDK.
 * Para Hikvision/Suprema: retorna mensagem informativa (requer serviço de integração).
 */
export const testConnection = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);

    const dispositivo = await prisma.dispositivoBiometrico.findFirst({
      where: {
        id,
        ...filter,
      },
    });

    if (!dispositivo) {
      throw new AppError('Dispositivo não encontrado', 404);
    }

    // ZKTeco: delegar ao controller ZKTeco (conexão TCP direta)
    if (dispositivo.tipo === 'ZKTECO') {
      const { testarConexao } = await import('./zkteco.controller.js');
      return testarConexao(req, res, next);
    }

    // Hikvision e Suprema: requerem o serviço de integração biométrica em execução
    const status = {
      success: false,
      mensagem: `Para dispositivos ${dispositivo.tipo}, o teste de conexão é executado pelo serviço de integração biométrica. Verifique se o serviço está em execução e conectado ao dispositivo ${dispositivo.nome}.`,
      dispositivo: {
        id: dispositivo.id,
        nome: dispositivo.nome,
        ip: dispositivo.ip,
        porta: dispositivo.porta,
        tipo: dispositivo.tipo,
      },
    };

    res.json(status);
  } catch (error) {
    next(error);
  }
};

