import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler.js';
import { requireTenantScope } from './auth.js';
import { validarAnoLetivoIdAtivo, buscarAnoLetivoAtivo } from '../services/validacaoAcademica.service.js';

/**
 * Middleware para validar que existe um Ano Letivo ATIVO antes de operações acadêmicas
 * Este middleware verifica se há um ano letivo ativo, mas NÃO exige anoLetivoId no body
 * Use quando apenas precisar garantir que existe um ano letivo ativo na instituição
 */
export const requireAnoLetivoAtivo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    
    const anoLetivoAtivo = await buscarAnoLetivoAtivo(instituicaoId);
    
    if (!anoLetivoAtivo) {
      throw new AppError(
        'Não existe Ano Letivo ativo. Crie ou ative um Ano Letivo antes de realizar operações acadêmicas.',
        400
      );
    }

    // Adiciona ao request para uso nos controllers
    (req as any).anoLetivoAtivo = anoLetivoAtivo;
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware para validar anoLetivoId do body/params/query
 * Exige que anoLetivoId seja fornecido e esteja ATIVO
 * Use quando a operação específica exige um anoLetivoId
 */
export const validateAnoLetivoId = (field: 'body' | 'params' | 'query' = 'body', fieldName: string = 'anoLetivoId') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const instituicaoId = requireTenantScope(req);
      
      const anoLetivoId = (req as any)[field]?.[fieldName];
      
      if (!anoLetivoId) {
        throw new AppError(
          `Campo ${fieldName} é obrigatório. Nenhuma operação acadêmica pode existir fora de um Ano Letivo ATIVO.`,
          400
        );
      }

      const anoLetivoValidado = await validarAnoLetivoIdAtivo(
        instituicaoId,
        anoLetivoId,
        'executar esta operação'
      );

      // Adiciona ao request para uso nos controllers
      (req as any).anoLetivoValidado = anoLetivoValidado;
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

