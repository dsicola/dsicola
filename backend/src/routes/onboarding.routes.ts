import { Router } from 'express';
import * as onboardingController from '../controllers/onboarding.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

// SUPER_ADMIN e COMERCIAL podem criar instituições via onboarding
router.post('/instituicao', authenticate, authorize('SUPER_ADMIN', 'COMERCIAL'), onboardingController.criarInstituicao);

// Criar admin para instituição existente (SUPER_ADMIN e COMERCIAL)
router.post('/instituicao/admin', authenticate, authorize('SUPER_ADMIN', 'COMERCIAL'), onboardingController.criarAdminInstituicao);

// Status e finalização de onboarding (para todos os usuários autenticados)
router.get('/status', authenticate, onboardingController.getStatus);
router.post('/finalizar', authenticate, onboardingController.finalizar);

export default router;
