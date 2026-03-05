import { Router } from 'express';
import * as alocacaoAlojamentoController from '../controllers/alocacaoAlojamento.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validateLicense, validatePlanFeature } from '../middlewares/license.middleware.js';

const router = Router();

router.use(authenticate);
router.use(validateLicense);
router.use(validatePlanFeature('alojamentos'));

router.get('/', alocacaoAlojamentoController.getAll);
router.get('/:id', alocacaoAlojamentoController.getById);
router.post('/', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), alocacaoAlojamentoController.create);
router.put('/:id', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), alocacaoAlojamentoController.update);
router.delete('/:id', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), alocacaoAlojamentoController.remove);

export default router;
