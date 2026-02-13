import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import * as segurancaController from '../controllers/seguranca.controller.js';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// Tentativas de login
router.get('/login-attempts', segurancaController.getLoginAttempts);

// Resets de senha
router.get('/password-resets', segurancaController.getPasswordResets);

// Painel de segurança consolidado
router.get('/dashboard', segurancaController.getSecurityDashboard);

export default router;

