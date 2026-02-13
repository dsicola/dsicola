import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import * as planosPrecosController from '../controllers/planosPrecos.controller.js';

const router = Router();

// Buscar preço (público para autenticados)
router.get(
  '/',
  authenticate,
  planosPrecosController.getPreco
);

// Listar preços de um plano (público para autenticados)
router.get(
  '/plano/:planoId',
  authenticate,
  planosPrecosController.getPrecosByPlano
);

// Criar ou atualizar preço (apenas SUPER_ADMIN)
router.post(
  '/',
  authenticate,
  authorize('SUPER_ADMIN'),
  planosPrecosController.createOrUpdatePreco
);

router.put(
  '/',
  authenticate,
  authorize('SUPER_ADMIN'),
  planosPrecosController.createOrUpdatePreco
);

export default router;

