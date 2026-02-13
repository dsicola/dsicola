import { Router } from 'express';
import * as tipoDocumentoController from '../controllers/tipoDocumento.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

router.get('/', authenticate, tipoDocumentoController.getAll);
router.get('/:id', authenticate, tipoDocumentoController.getById);
router.post('/', authenticate, authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), tipoDocumentoController.create);
router.put('/:id', authenticate, authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), tipoDocumentoController.update);
router.delete('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), tipoDocumentoController.remove);

export default router;
