import { Router } from 'express';
import * as departamentoController from '../controllers/departamento.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

router.get('/', authenticate, departamentoController.getAll);
router.get('/:id', authenticate, departamentoController.getById);
router.post('/', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), departamentoController.create);
router.put('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), departamentoController.update);
router.delete('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), departamentoController.remove);

export default router;
