import { Router } from 'express';
import * as documentoEmitidoController from '../controllers/documentoEmitido.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

router.get('/', authenticate, documentoEmitidoController.getAll);
router.get('/:id', authenticate, documentoEmitidoController.getById);
router.post('/', authenticate, authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), documentoEmitidoController.create);
router.post('/gerar-numero', authenticate, authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), documentoEmitidoController.gerarNumero);
router.delete('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), documentoEmitidoController.remove);

export default router;
