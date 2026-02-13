import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler.js';
import { requireTenantScope } from './auth.js';
import { TermoLegalService, TipoAcaoTermoLegal } from '../services/termoLegal.service.js';

/**
 * Middleware para verificar aceite de termo legal antes de ações críticas
 * 
 * @param acaoCritica Tipo de ação que exige aceite
 * 
 * @example
 * router.post('/restore',
 *   authenticate,
 *   authorize('ADMIN'),
 *   checkAceiteTermo(TipoAcaoTermoLegal.RESTORE_BACKUP),
 *   controller.restore
 * );
 */
export const checkAceiteTermo = (acaoCritica: TipoAcaoTermoLegal) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.userId) {
        throw new AppError('Usuário não autenticado', 401);
      }

      // REGRA P0: instituicaoId SEMPRE vem do JWT - nunca de headers
      // Para SUPER_ADMIN, aceitar instituicaoId via query (operacional) ou do token
      let instituicaoId: string;
      if (req.user?.roles.includes('SUPER_ADMIN')) {
        instituicaoId = (req.query.instituicaoId as string) || 
                        requireTenantScope(req);
      } else {
        instituicaoId = requireTenantScope(req);
      }

      // Verificar se usuário já aceitou o termo
      const verificarAceite = await TermoLegalService.verificarAceite(
        req.user.userId,
        instituicaoId,
        acaoCritica
      );

      if (!verificarAceite.aceito) {
        // Retornar erro especial para o frontend exibir modal
        const error = new AppError(
          'É necessário aceitar o termo legal antes de executar esta ação',
          403
        );
        (error as any).code = 'TERMO_NAO_ACEITO';
        (error as any).termo = verificarAceite.termo;
        (error as any).termoId = verificarAceite.termoId;
        return next(error);
      }

      // Se aceitou, prosseguir normalmente
      next();
    } catch (error) {
      next(error);
    }
  };
};

