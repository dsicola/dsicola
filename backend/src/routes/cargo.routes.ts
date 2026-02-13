import { Router } from 'express';
import * as cargoController from '../controllers/cargo.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

router.get('/', authenticate, cargoController.getAll);
router.get('/:id', authenticate, cargoController.getById);
router.post('/', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), cargoController.create);
router.put('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), cargoController.update);
router.delete('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), cargoController.remove);

export default router;
