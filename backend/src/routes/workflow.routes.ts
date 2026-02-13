import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import * as workflowController from '../controllers/workflow.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Submeter para aprovação
router.post(
  '/submeter',
  authorize('PROFESSOR', 'SECRETARIA', 'ADMIN', 'SUPER_ADMIN'),
  workflowController.submeter
);

// Aprovar
router.post(
  '/aprovar',
  authorize('ADMIN', 'SUPER_ADMIN', 'SECRETARIA'),
  workflowController.aprovar
);

// Rejeitar
router.post(
  '/rejeitar',
  authorize('ADMIN', 'SUPER_ADMIN', 'SECRETARIA'),
  workflowController.rejeitar
);

// Bloquear
router.post(
  '/bloquear',
  authorize('ADMIN', 'SUPER_ADMIN'),
  workflowController.bloquear
);

// Obter histórico
router.get(
  '/historico',
  authorize('ADMIN', 'PROFESSOR', 'COORDENADOR', 'SECRETARIA', 'SUPER_ADMIN'),
  workflowController.getHistorico
);

export default router;

