import { Router } from 'express';
import * as pagamentoInstituicaoController from '../controllers/pagamentoInstituicao.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

router.get('/', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), pagamentoInstituicaoController.getAll);
router.get('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), pagamentoInstituicaoController.getById);
router.post('/', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), pagamentoInstituicaoController.create);
router.put('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), pagamentoInstituicaoController.update);
router.delete('/:id', authenticate, authorize('SUPER_ADMIN'), pagamentoInstituicaoController.remove);

export default router;
