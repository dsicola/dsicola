import { Router } from 'express';
import * as frequenciaFuncionarioController from '../controllers/frequenciaFuncionario.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

router.get('/', authenticate, frequenciaFuncionarioController.getAll);
router.get('/:id', authenticate, frequenciaFuncionarioController.getById);
router.post('/', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), frequenciaFuncionarioController.create);
router.put('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), frequenciaFuncionarioController.update);
router.delete('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), frequenciaFuncionarioController.remove);

export default router;
