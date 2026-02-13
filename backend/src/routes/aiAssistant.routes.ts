/**
 * Rotas do Assistente IA
 * POST /ai/assistant - Chat com o assistente virtual
 */
import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import * as aiAssistantController from '../controllers/aiAssistant.controller.js';

const router = Router();

// POST /ai/assistant - Requer autenticação
router.post('/assistant', authenticate, aiAssistantController.chat);

export default router;
