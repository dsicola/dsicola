import { Router } from 'express';
import * as configuracaoInstituicaoController from '../controllers/configuracaoInstituicao.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

// NOTA: instituicaoId vem SEMPRE do token (requireTenantScope)
// A rota não recebe instituicaoId no path - o controller extrai do JWT automaticamente
router.get('/', authenticate, configuracaoInstituicaoController.get);
router.put('/', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), configuracaoInstituicaoController.update);

export default router;
