import { Router } from 'express';
import * as configuracaoLandingController from '../controllers/configuracaoLanding.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

router.get('/', configuracaoLandingController.getAll);
router.get('/:chave', configuracaoLandingController.getByChave);
router.put('/:chave', authenticate, authorize('SUPER_ADMIN'), configuracaoLandingController.update);

export default router;
