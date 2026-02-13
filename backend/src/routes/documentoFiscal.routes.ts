import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import * as documentoFiscalController from '../controllers/documentoFiscal.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Buscar documento fiscal por pagamento
router.get(
  '/pagamento/:pagamentoId',
  authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'),
  documentoFiscalController.getByPagamento
);

// Listar documentos fiscais
router.get(
  '/',
  authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'),
  documentoFiscalController.getAll
);

export default router;

