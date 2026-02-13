import { Router } from 'express';
import * as alocacaoAlojamentoController from '../controllers/alocacaoAlojamento.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

router.get('/', authenticate, alocacaoAlojamentoController.getAll);
router.get('/:id', authenticate, alocacaoAlojamentoController.getById);
router.post('/', authenticate, authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), alocacaoAlojamentoController.create);
router.put('/:id', authenticate, authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), alocacaoAlojamentoController.update);
router.delete('/:id', authenticate, authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), alocacaoAlojamentoController.remove);

export default router;
