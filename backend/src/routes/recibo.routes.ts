import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import * as reciboController from '../controllers/recibo.controller.js';

const router = Router();

router.use(authenticate);

// GET /recibos - lista (filtro matriculaId opcional)
router.get(
  '/',
  authorize('ADMIN', 'SECRETARIA', 'POS', 'FINANCEIRO', 'SUPER_ADMIN'),
  reciboController.getRecibos
);

// GET /recibos/:id
router.get(
  '/:id',
  authorize('ADMIN', 'SECRETARIA', 'POS', 'FINANCEIRO', 'SUPER_ADMIN'),
  reciboController.getReciboById
);

// SIGAE: Recibo imutável - não permitir DELETE (apenas estorno via status)
router.delete(
  '*',
  (_req, res) => {
    res.status(403).json({
      message: 'Recibos não podem ser deletados. O histórico é imutável. Use o fluxo de estorno de pagamento.',
    });
  }
);

export default router;
