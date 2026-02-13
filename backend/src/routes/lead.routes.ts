import { Router } from 'express';
import * as leadController from '../controllers/lead.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

router.get('/', authenticate, authorize('SUPER_ADMIN'), leadController.getAll);
router.get('/:id', authenticate, authorize('SUPER_ADMIN'), leadController.getById);
router.post('/', leadController.create); // Public - for lead capture
router.put('/:id', authenticate, authorize('SUPER_ADMIN'), leadController.update);
router.delete('/:id', authenticate, authorize('SUPER_ADMIN'), leadController.remove);

export default router;
