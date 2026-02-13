import { Router } from 'express';
import * as alojamentoController from '../controllers/alojamento.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

router.get('/', authenticate, alojamentoController.getAll);
router.get('/:id', authenticate, alojamentoController.getById);
router.post('/', authenticate, authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), alojamentoController.create);
router.put('/:id', authenticate, authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), alojamentoController.update);
router.delete('/:id', authenticate, authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), alojamentoController.remove);

export default router;
