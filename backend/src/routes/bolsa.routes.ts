import { Router } from 'express';
import * as bolsaController from '../controllers/bolsa.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

router.get('/', authenticate, bolsaController.getAll);
router.get('/:id', authenticate, bolsaController.getById);
router.post('/', authenticate, authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), bolsaController.create);
router.put('/:id', authenticate, authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), bolsaController.update);
router.delete('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), bolsaController.remove);

export default router;
