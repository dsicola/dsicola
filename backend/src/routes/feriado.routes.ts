import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { authorize } from '../middlewares/auth.js';
import * as feriadoController from '../controllers/feriado.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET routes - SECRETARIA pode consultar (apenas leitura)
router.get('/', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), feriadoController.getAll);
router.get('/:id', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), feriadoController.getById);

// POST/PUT/DELETE routes - SECRETARIA removida (não pode editar calendário)
router.post('/', authorize('ADMIN', 'SUPER_ADMIN'), feriadoController.create);
router.put('/:id', authorize('ADMIN', 'SUPER_ADMIN'), feriadoController.update);
router.delete('/:id', authorize('ADMIN', 'SUPER_ADMIN'), feriadoController.remove);

export default router;

