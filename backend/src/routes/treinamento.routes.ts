import { Router } from 'express';
import * as treinamentoController from '../controllers/treinamento.controller.js';
import { authenticate } from '../middlewares/auth.js';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// Obter trilha atual do usuário
router.get('/trilha-atual', treinamentoController.getTrilhaAtual);

export default router;

