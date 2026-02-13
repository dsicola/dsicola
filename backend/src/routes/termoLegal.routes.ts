import { Router } from 'express';
import * as termoLegalController from '../controllers/termoLegal.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

// Rotas para ADMIN e SUPER_ADMIN
// Verificar termo legal antes de ação crítica
router.get('/verificar/:tipoAcao', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), termoLegalController.verificarTermo);

// Aceitar termo legal
router.post('/aceitar', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), termoLegalController.aceitarTermo);

// Obter termo legal ativo
router.get('/:tipoAcao', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), termoLegalController.obterTermo);

export default router;

