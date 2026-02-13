import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import * as twoFactorController from '../controllers/twoFactor.controller.js';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// Setup: Gerar secret e QR code
router.post('/setup', twoFactorController.setupTwoFactor);

// Verificar código e ativar 2FA
router.post('/verify', twoFactorController.verifyAndEnable);

// Desativar 2FA
router.post('/disable', twoFactorController.disableTwoFactor);

// Resetar 2FA (apenas ADMIN/SUPER_ADMIN)
router.post('/reset', twoFactorController.resetTwoFactor);

// Verificar status de 2FA
router.get('/status', twoFactorController.getTwoFactorStatus);

export default router;
