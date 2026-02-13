import { Router } from 'express';
import * as candidaturaController from '../controllers/candidatura.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

router.get('/', authenticate, authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), candidaturaController.getAll);
router.get('/:id', authenticate, authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), candidaturaController.getById);
router.post('/', candidaturaController.create); // Public for applicants
router.put('/:id', authenticate, authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), candidaturaController.update);
router.post('/:id/aprovar', authenticate, authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), candidaturaController.aprovar);
router.post('/:id/rejeitar', authenticate, authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), candidaturaController.rejeitar);

export default router;
