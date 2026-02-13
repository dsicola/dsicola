import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { checkAceiteTermo } from '../middlewares/termoLegal.middleware.js';
import { TipoAcaoTermoLegal } from '../services/termoLegal.service.js';
import * as reaberturaAnoLetivoController from '../controllers/reaberturaAnoLetivo.controller.js';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// Criar reabertura excepcional (apenas ADMIN, DIRECAO, SUPER_ADMIN)
router.post(
  '/',
  authorize('ADMIN', 'DIRECAO', 'SUPER_ADMIN'),
  checkAceiteTermo(TipoAcaoTermoLegal.REABERTURA_ANO),
  reaberturaAnoLetivoController.criarReabertura
);

// Listar reaberturas (ADMIN, DIRECAO, SUPER_ADMIN podem ver todas; outros apenas ativas)
router.get(
  '/',
  authorize('ADMIN', 'DIRECAO', 'SUPER_ADMIN', 'PROFESSOR', 'SECRETARIA'),
  reaberturaAnoLetivoController.listarReaberturas
);

// Obter reabertura por ID
router.get(
  '/:id',
  authorize('ADMIN', 'DIRECAO', 'SUPER_ADMIN', 'PROFESSOR', 'SECRETARIA'),
  reaberturaAnoLetivoController.obterReabertura
);

// Encerrar reabertura manualmente (apenas ADMIN, DIRECAO, SUPER_ADMIN)
router.post(
  '/:id/encerrar',
  authorize('ADMIN', 'DIRECAO', 'SUPER_ADMIN'),
  reaberturaAnoLetivoController.encerrarReabertura
);

// Encerrar reaberturas expiradas (cron/scheduler - apenas SUPER_ADMIN)
router.post(
  '/encerrar-expiradas',
  authorize('SUPER_ADMIN'),
  reaberturaAnoLetivoController.encerrarReaberturasExpiradasEndpoint
);

export default router;

