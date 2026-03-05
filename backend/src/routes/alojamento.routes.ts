import { Router } from 'express';
import * as alojamentoController from '../controllers/alojamento.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validateLicense, validatePlanFeature } from '../middlewares/license.middleware.js';

const router = Router();

router.use(authenticate);
router.use(validateLicense);
router.use(validatePlanFeature('alojamentos'));

router.get('/', alojamentoController.getAll);
router.get('/:id', alojamentoController.getById);
router.post('/', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), alojamentoController.create);
router.put('/:id', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), alojamentoController.update);
router.delete('/:id', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), alojamentoController.remove);

export default router;
