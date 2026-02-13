import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validateLicense } from '../middlewares/license.middleware.js';
import { bloquearAnoLetivoEncerrado } from '../middlewares/bloquearAnoLetivoEncerrado.middleware.js';
import * as distribuicaoAulasController from '../controllers/distribuicaoAulas.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);
// Validate license for all routes (SUPER_ADMIN is exempt in middleware)
router.use(validateLicense);

// Gerar distribuição automática
// REGRA INSTITUCIONAL: Bloquear se ano letivo estiver ENCERRADO
// PROFESSOR: Removido - professor NÃO pode distribuir aulas
// SECRETARIA: Removida - apenas consulta permitida
router.post(
  '/gerar',
  authorize('ADMIN', 'SUPER_ADMIN'),
  bloquearAnoLetivoEncerrado, // Bloquear mutations em ano letivo encerrado
  distribuicaoAulasController.gerarDistribuicao
);

// Buscar distribuição por plano
// SECRETARIA: Pode consultar (apenas leitura)
router.get(
  '/plano/:planoEnsinoId',
  authorize('ADMIN', 'PROFESSOR', 'SECRETARIA', 'SUPER_ADMIN'),
  distribuicaoAulasController.getDistribuicaoByPlano
);

// Deletar distribuição por plano
// REGRA INSTITUCIONAL: Bloquear se ano letivo estiver ENCERRADO
// PROFESSOR: Removido - professor NÃO pode deletar distribuições
// SECRETARIA: Removida - apenas consulta permitida
router.delete(
  '/plano/:planoEnsinoId',
  authorize('ADMIN', 'SUPER_ADMIN'),
  bloquearAnoLetivoEncerrado, // Bloquear mutations em ano letivo encerrado
  distribuicaoAulasController.deleteDistribuicao
);

export default router;

