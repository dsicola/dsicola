import { Router } from 'express';
import * as logsRedefinicaoSenhaController from '../controllers/logsRedefinicaoSenha.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

router.get('/', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), logsRedefinicaoSenhaController.getAll);
router.get('/recent', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), logsRedefinicaoSenhaController.getRecent);
router.post('/', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), logsRedefinicaoSenhaController.create);

export default router;
