import { Router } from 'express';
import * as boletimController from '../controllers/boletim.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

router.post('/enviar-email', authenticate, authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), boletimController.enviarBoletimEmail);

export default router;

