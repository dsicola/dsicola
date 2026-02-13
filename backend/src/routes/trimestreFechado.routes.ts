import { Router } from 'express';
import * as trimestreFechadoController from '../controllers/trimestreFechado.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

router.get('/', authenticate, trimestreFechadoController.getAll);
router.post('/fechar', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), trimestreFechadoController.fechar);
router.post('/reabrir', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), trimestreFechadoController.reabrir);

export default router;
