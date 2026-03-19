/**
 * Rotas para geração de documentos de teste AGT (certificação)
 */
import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import * as agtController from '../controllers/agt.controller.js';

const router = Router();

router.use(authenticate);

router.post(
  '/gerar-testes-completo',
  authorize('ADMIN', 'FINANCEIRO', 'SUPER_ADMIN'),
  agtController.gerarTestesAgtCompleto
);

export default router;
