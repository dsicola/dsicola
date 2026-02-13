import { Router } from 'express';
import * as contratoFuncionarioController from '../controllers/contratoFuncionario.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

router.get('/', authenticate, contratoFuncionarioController.getAll);
router.post('/by-funcionarios', authenticate, contratoFuncionarioController.getByFuncionarioIds);
router.get('/:id', authenticate, contratoFuncionarioController.getById);
router.post('/', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), contratoFuncionarioController.create);
router.put('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), contratoFuncionarioController.update);
router.patch('/:id/encerrar', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), contratoFuncionarioController.encerrar);
router.delete('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), contratoFuncionarioController.remove);

export default router;
