import { Router } from 'express';
import * as saftExportController from '../controllers/saftExport.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

router.get('/', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), saftExportController.getAll);
router.get('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), saftExportController.getById);
router.get('/:id/download', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), saftExportController.download);
router.post('/', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), saftExportController.create);
router.post('/generate', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), saftExportController.generate);

export default router;
