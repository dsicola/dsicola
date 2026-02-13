import { Router } from 'express';
import * as parametrosSistemaController from '../controllers/parametrosSistema.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

// NOTA: instituicaoId vem SEMPRE do token (requireTenantScope)
// A rota não recebe instituicaoId no path - o controller extrai do JWT automaticamente
router.get('/', authenticate, parametrosSistemaController.get);
router.put('/', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), parametrosSistemaController.update);

export default router;

