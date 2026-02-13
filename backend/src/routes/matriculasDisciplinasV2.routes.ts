import { Router } from 'express';
import * as matriculasDisciplinasV2Controller from '../controllers/matriculasDisciplinasV2.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { Request, Response, NextFunction } from 'express';

const router = Router();

/**
 * Middleware de autenticação opcional
 * Tenta autenticar, mas não falha se não houver token (ambiente local)
 */
const optionalAuthenticate = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  // Se não houver header de autenticação, continuar sem autenticar
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  
  // Se houver token, tentar autenticar
  try {
    await authenticate(req, res, next);
  } catch (error) {
    // Se falhar autenticação, continuar mesmo assim (controller decide)
    next();
  }
};

/**
 * GET /v2/matriculas-disciplinas
 * Listagem de matrículas em disciplinas (versão 2)
 * 
 * - Sempre retorna 200 com array (vazio ou com dados)
 * - Não exige query params
 * - Filtros opcionais: instituicao_id, ano_letivo, aluno_id, turma_id, curso_id, status
 * - Multi-tenant automático via JWT (se autenticado)
 * - Permite acesso sem autenticação em ambiente local
 */
router.get('/', optionalAuthenticate, matriculasDisciplinasV2Controller.getAll);

export default router;

