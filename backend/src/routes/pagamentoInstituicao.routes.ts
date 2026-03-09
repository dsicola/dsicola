import { Router } from 'express';
import * as pagamentoInstituicaoController from '../controllers/pagamentoInstituicao.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

// Comprovativo: ADMIN e FINANCEIRO da instituição enviam; SUPER_ADMIN e COMERCIAL analisam
router.get('/', authenticate, authorize('ADMIN', 'SUPER_ADMIN', 'COMERCIAL', 'FINANCEIRO'), pagamentoInstituicaoController.getAll);
router.get('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN', 'COMERCIAL', 'FINANCEIRO'), pagamentoInstituicaoController.getById);
router.post('/', authenticate, authorize('ADMIN', 'SUPER_ADMIN', 'FINANCEIRO'), pagamentoInstituicaoController.create);
router.put('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN', 'COMERCIAL', 'FINANCEIRO'), pagamentoInstituicaoController.update);
router.delete('/:id', authenticate, authorize('SUPER_ADMIN'), pagamentoInstituicaoController.remove);

export default router;
