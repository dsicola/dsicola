import { Router } from 'express';
import * as utilsController from '../controllers/utils.controller.js';
import { authenticate } from '../middlewares/auth.js';

const router = Router();

router.get('/verificar-inadimplencia/:alunoId', authenticate, utilsController.verificarInadimplencia);
// IMPORTANTE: Multi-tenant - instituicaoId vem APENAS do JWT, não do path
router.get('/verificar-assinatura', authenticate, utilsController.verificarAssinaturaExpirada);

export default router;
