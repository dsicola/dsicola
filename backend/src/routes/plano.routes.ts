import { Router } from 'express';
import * as planoController from '../controllers/plano.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

router.get('/', planoController.getAll); // Public for pricing page
router.get('/:id', planoController.getById);
router.post('/', authenticate, authorize('SUPER_ADMIN'), planoController.create);
router.put('/:id', authenticate, authorize('SUPER_ADMIN'), planoController.update);
router.delete('/:id', authenticate, authorize('SUPER_ADMIN'), planoController.remove);

export default router;
