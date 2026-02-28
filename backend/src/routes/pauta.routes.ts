import { Router } from 'express';
import * as pautaController from '../controllers/pauta.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { resolveProfessor, resolveProfessorOptional } from '../middlewares/resolveProfessor.middleware.js';

const router = Router();

router.get('/notas', authenticate, resolveProfessorOptional, pautaController.getNotas);
router.get('/frequencias', authenticate, pautaController.getFrequencias);
router.get('/boletim/:alunoId', authenticate, pautaController.getBoletim);

// Impressão e fechamento de pauta
router.get(
  '/:planoEnsinoId/imprimir',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN', 'SECRETARIA', 'PROFESSOR'),
  resolveProfessor,
  pautaController.imprimirPauta
);
router.patch(
  '/:planoEnsinoId/fechar',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN', 'SECRETARIA'),
  pautaController.fecharPauta
);

router.patch(
  '/:planoEnsinoId/provisoria',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN', 'SECRETARIA', 'PROFESSOR'),
  resolveProfessor,
  pautaController.gerarProvisoria
);

export default router;
