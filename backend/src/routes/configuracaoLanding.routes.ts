import { Router } from 'express';
import * as configuracaoLandingController from '../controllers/configuracaoLanding.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { publicLandingReadLimiter } from '../middlewares/publicEndpointsRateLimit.middleware.js';

const router = Router();

// Ordem: rotas estáticas antes de /:chave
router.get('/public', publicLandingReadLimiter, configuracaoLandingController.getAllPublic);
router.get('/coordenadas-bancarias', authenticate, configuracaoLandingController.getCoordenadasBancariasEndpoint);
router.get('/', authenticate, authorize('SUPER_ADMIN'), configuracaoLandingController.getAllAdmin);
router.get('/:chave', publicLandingReadLimiter, configuracaoLandingController.getByChave);
router.put('/:chave', authenticate, authorize('SUPER_ADMIN'), configuracaoLandingController.update);

export default router;
