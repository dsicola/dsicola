import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter } from '../middlewares/auth.js';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const { 
      acao, 
      modulo,
      entidade, 
      entidadeId,
      tabela, 
      registroId,
      userId,
      dataInicio,
      dataFim,
      limit 
    } = req.query;
    
    // RBAC: SECRETARIA só pode ver logs do domínio ACADEMICO
    const userRoles = req.user?.roles || [];
    const isSecretaria = userRoles.includes('SECRETARIA') && !userRoles.includes('ADMIN') && !userRoles.includes('SUPER_ADMIN');
    
    const where: any = {
      ...filter,
      ...(acao && { acao: acao as string }),
      ...(modulo && { modulo: modulo as string }),
      ...(entidade && { entidade: entidade as string }),
      ...(entidadeId && { entidadeId: entidadeId as string }),
      // Campos de compatibilidade
      ...(tabela && { tabela: tabela as string }),
      ...(registroId && { registroId: registroId as string }),
      ...(userId && { userId: userId as string }),
      // SECRETARIA: apenas domínio ACADEMICO
      ...(isSecretaria && { dominio: 'ACADEMICO' }),
    };

    // Filtro por período
    if (dataInicio || dataFim) {
      where.createdAt = {};
      if (dataInicio) {
        where.createdAt.gte = new Date(dataInicio as string);
      }
      if (dataFim) {
        // Incluir todo o dia final
        const dataFimObj = new Date(dataFim as string);
        dataFimObj.setHours(23, 59, 59, 999);
        where.createdAt.lte = dataFimObj;
      }
    }
    
    const logs = await prisma.logAuditoria.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit ? parseInt(limit as string) : 500,
      include: {
        instituicao: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
    });
    
    res.json(logs);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    
    const log = await prisma.logAuditoria.findFirst({
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
      },
    });
    
    if (!log) {
      throw new AppError('Log não encontrado ou não pertence à sua instituição', 404);
    }
    
    // Comparação antes/depois se houver
    const comparacao = {
      temAntes: !!log.dadosAnteriores,
      temDepois: !!log.dadosNovos,
      podeComparar: !!(log.dadosAnteriores && log.dadosNovos),
    };
    
    res.json({
      ...log,
      comparacao,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obter detalhes completos de auditoria com antes/depois estruturado
 * GET /logs-auditoria/:id/detalhes
 */
export const getDetalhes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    
    // RBAC: SECRETARIA só pode ver logs do domínio ACADEMICO
    const userRoles = req.user?.roles || [];
    const isSecretaria = userRoles.includes('SECRETARIA') && !userRoles.includes('ADMIN') && !userRoles.includes('SUPER_ADMIN');
    
    const log = await prisma.logAuditoria.findFirst({
      where: {
        id,
        ...filter,
        // SECRETARIA: apenas domínio ACADEMICO
        ...(isSecretaria && { dominio: 'ACADEMICO' }),
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
    
    if (!log) {
      throw new AppError('Log não encontrado ou não pertence à sua instituição', 404);
    }

    // Processar dados antes/depois para visualização estruturada
    const dadosAnteriores = log.dadosAnteriores 
      ? (typeof log.dadosAnteriores === 'string' ? JSON.parse(log.dadosAnteriores) : log.dadosAnteriores)
      : null;
    
    const dadosNovos = log.dadosNovos 
      ? (typeof log.dadosNovos === 'string' ? JSON.parse(log.dadosNovos) : log.dadosNovos)
      : null;

    // Extrair campos alterados
    const camposAlterados = log.camposAlterados 
      ? (Array.isArray(log.camposAlterados) ? log.camposAlterados : JSON.parse(log.camposAlterados as string))
      : [];

    // Mascarar campos sensíveis (padrão SIGA/SIGAE)
    const mascararCamposSensiveis = (obj: any): any => {
      if (!obj || typeof obj !== 'object') return obj;
      
      const camposSensiveis = [
        'senha', 'password', 'senhaHash', 'passwordHash',
        'token', 'accessToken', 'refreshToken', 'apiKey', 'secretKey',
        'biometria', 'biometric', 'biometricData', 'fingerprint',
        'cpf', 'cpfCompleto', 'numeroIdentificacao', // Dados pessoais sensíveis
        'cartaoCredito', 'numeroCartao', 'cvv', 'cvc',
      ];
      
      const mascarado = Array.isArray(obj) ? [...obj] : { ...obj };
      
      // Processar recursivamente objetos aninhados
      for (const key in mascarado) {
        if (mascarado.hasOwnProperty(key)) {
          const keyLower = key.toLowerCase();
          
          // Verificar se o campo é sensível (busca case-insensitive)
          const isSensivel = camposSensiveis.some(campo => 
            keyLower.includes(campo.toLowerCase())
          );
          
          if (isSensivel && mascarado[key] !== null && mascarado[key] !== undefined) {
            // Mascarar valor sensível
            if (typeof mascarado[key] === 'string' && mascarado[key].length > 0) {
              mascarado[key] = '***MASCARADO***';
            } else {
              mascarado[key] = '***MASCARADO***';
            }
          } else if (typeof mascarado[key] === 'object' && mascarado[key] !== null) {
            // Recursão para objetos aninhados
            mascarado[key] = mascararCamposSensiveis(mascarado[key]);
          }
        }
      }
      
      return mascarado;
    };

    const dadosAnterioresMascarados = dadosAnteriores ? mascararCamposSensiveis(dadosAnteriores) : null;
    const dadosNovosMascarados = dadosNovos ? mascararCamposSensiveis(dadosNovos) : null;
    
    res.json({
      id: log.id,
      instituicaoId: log.instituicaoId,
      modulo: log.modulo,
      entidade: log.entidade,
      entidadeId: log.entidadeId,
      acao: log.acao,
      dominio: log.dominio,
      userId: log.userId,
      perfilUsuario: log.perfilUsuario,
      userNome: log.userNome,
      userEmail: log.userEmail,
      rota: log.rota,
      ipOrigem: log.ipOrigem,
      userAgent: log.userAgent,
      observacao: log.observacao,
      createdAt: log.createdAt,
      // Dados estruturados para visualização
      dadosAnteriores: dadosAnterioresMascarados,
      dadosNovos: dadosNovosMascarados,
      camposAlterados: camposAlterados,
      // Metadados
      comparacao: {
        temAntes: !!dadosAnteriores,
        temDepois: !!dadosNovos,
        podeComparar: !!(dadosAnteriores && dadosNovos),
        totalCamposAlterados: camposAlterados.length,
      },
      instituicao: log.instituicao,
    });
  } catch (error) {
    next(error);
  }
};

// Logs não podem ser criados manualmente via API
// Eles são criados automaticamente pelo AuditService
// Este endpoint está DEPRECATED - manter apenas para compatibilidade
export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    throw new AppError('Logs de auditoria não podem ser criados manualmente. Use o AuditService.', 403);
  } catch (error) {
    next(error);
  }
};

/**
 * Obter estatísticas de auditoria
 * GET /logs-auditoria/stats
 */
export const getStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const { dataInicio, dataFim } = req.query;

    const where: any = {
      ...filter,
    };

    if (dataInicio || dataFim) {
      where.createdAt = {};
      if (dataInicio) {
        where.createdAt.gte = new Date(dataInicio as string);
      }
      if (dataFim) {
        const dataFimObj = new Date(dataFim as string);
        dataFimObj.setHours(23, 59, 59, 999);
        where.createdAt.lte = dataFimObj;
      }
    }

    const [total, porAcao, porModulo, porEntidade, porUsuario] = await Promise.all([
      prisma.logAuditoria.count({ where }),
      prisma.logAuditoria.groupBy({
        by: ['acao'],
        where,
        _count: true,
      }),
      prisma.logAuditoria.groupBy({
        by: ['modulo'],
        where: {
          ...where,
          modulo: { not: null },
        },
        _count: true,
      }),
      prisma.logAuditoria.groupBy({
        by: ['entidade'],
        where: {
          ...where,
          entidade: { not: null },
        },
        _count: true,
      }),
      prisma.logAuditoria.groupBy({
        by: ['userId'],
        where: {
          ...where,
          userId: { not: null },
        },
        _count: true,
        _max: {
          createdAt: true,
        },
      }),
    ]);

    res.json({
      total,
      porAcao: porAcao.map((item) => ({
        acao: item.acao,
        quantidade: item._count,
      })),
      porModulo: porModulo
        .filter((item) => item.modulo)
        .map((item) => ({
          modulo: item.modulo,
          quantidade: item._count,
        })),
      porEntidade: porEntidade
        .filter((item) => item.entidade)
        .map((item) => ({
          entidade: item.entidade,
          quantidade: item._count,
        })),
      porUsuario: porUsuario.map((item) => ({
        userId: item.userId,
        quantidade: item._count,
        ultimaAcao: item._max.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
};
