import { Router } from 'express';
import { getConfiguracaoMulta, updateConfiguracaoMulta } from '../controllers/configuracaoMulta.controller.js';
import { authenticate } from '../middlewares/auth.js';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// GET /configuracao-multa - Buscar configuração
router.get('/', getConfiguracaoMulta);

// PUT /configuracao-multa - Atualizar configuração (apenas ADMIN)
router.put('/', updateConfiguracaoMulta);

export default router;

