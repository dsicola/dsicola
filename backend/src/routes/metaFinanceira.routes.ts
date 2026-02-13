import { Router } from 'express';
import * as metaFinanceiraController from '../controllers/metaFinanceira.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

router.get('/', authenticate, metaFinanceiraController.getAll);
router.post('/', authenticate, authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), metaFinanceiraController.create);
router.put('/:id', authenticate, authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), metaFinanceiraController.update);
router.delete('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), metaFinanceiraController.remove);

export default router;
