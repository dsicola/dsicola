import { Router } from 'express';
import * as eventoController from '../controllers/evento.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

router.get('/', authenticate, eventoController.getAll);
router.get('/:id', authenticate, eventoController.getById);
// SECRETARIA: Removida - apenas consulta permitida (não pode editar calendário)
router.post('/', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), eventoController.create);
router.put('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), eventoController.update);
router.delete('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), eventoController.remove);

export default router;
