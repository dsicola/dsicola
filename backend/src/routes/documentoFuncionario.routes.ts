import { Router } from 'express';
import * as documentoFuncionarioController from '../controllers/documentoFuncionario.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

router.get('/', authenticate, documentoFuncionarioController.getAll);
router.get('/:id', authenticate, documentoFuncionarioController.getById);
router.post('/', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), documentoFuncionarioController.create);
router.delete('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), documentoFuncionarioController.remove);

export default router;
