import { Router } from 'express';
import * as emailEnviadoController from '../controllers/emailEnviado.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

router.get('/', authenticate, emailEnviadoController.getAll);
router.get('/estatisticas', authenticate, emailEnviadoController.getEstatisticas);
router.post('/retry', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), emailEnviadoController.processarRetry);
router.post('/:id/retry', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), emailEnviadoController.agendarRetry);
router.delete('/failed', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), emailEnviadoController.deleteAllFailed);
router.delete('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), emailEnviadoController.remove);

export default router;
