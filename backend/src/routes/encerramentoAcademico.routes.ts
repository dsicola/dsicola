import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { checkAceiteTermo } from '../middlewares/termoLegal.middleware.js';
import { TipoAcaoTermoLegal } from '../services/termoLegal.service.js';
import * as encerramentoAcademicoController from '../controllers/encerramentoAcademico.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Obter status de encerramentos
router.get(
  '/status',
  authorize('ADMIN', 'PROFESSOR', 'SECRETARIA', 'DIRECAO', 'SUPER_ADMIN'),
  encerramentoAcademicoController.getStatus
);

// Iniciar processo de encerramento
router.post(
  '/iniciar',
  authorize('ADMIN', 'DIRECAO', 'SUPER_ADMIN'),
  encerramentoAcademicoController.iniciarEncerramento
);

// Encerrar período
router.post(
  '/encerrar',
  authorize('ADMIN', 'DIRECAO', 'SUPER_ADMIN'),
  checkAceiteTermo(TipoAcaoTermoLegal.ENCERRAMENTO_ANO),
  encerramentoAcademicoController.encerrar
);

// Reabrir período
router.post(
  '/reabrir',
  authorize('ADMIN', 'DIRECAO', 'SUPER_ADMIN'),
  checkAceiteTermo(TipoAcaoTermoLegal.REABERTURA_ANO),
  encerramentoAcademicoController.reabrir
);

export default router;

