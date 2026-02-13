import { Router } from 'express';
import * as onboardingController from '../controllers/onboarding.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

// Only SUPER_ADMIN can create institutions via onboarding
router.post('/instituicao', authenticate, authorize('SUPER_ADMIN'), onboardingController.criarInstituicao);

// Create admin for existing institution (SUPER_ADMIN only)
router.post('/instituicao/admin', authenticate, authorize('SUPER_ADMIN'), onboardingController.criarAdminInstituicao);

// Status e finalização de onboarding (para todos os usuários autenticados)
router.get('/status', authenticate, onboardingController.getStatus);
router.post('/finalizar', authenticate, onboardingController.finalizar);

export default router;
