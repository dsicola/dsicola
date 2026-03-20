/**
 * Rotas para geração de documentos fiscais (certificação AGT).
 */
import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import * as agtController from '../controllers/agt.controller.js';

const router = Router();

router.use(authenticate);

const roles = authorize('ADMIN', 'FINANCEIRO', 'SUPER_ADMIN');

router.post('/gerar-certificacao-completo', roles, agtController.gerarCertificacaoAgtCompleto);
router.post('/gerar-certificacao-minimo', roles, agtController.gerarCertificacaoAgtMinimo);

/** @deprecated Use /gerar-certificacao-completo */
router.post('/gerar-testes-completo', roles, agtController.gerarCertificacaoAgtCompleto);
/** @deprecated Use /gerar-certificacao-minimo */
router.post('/gerar-testes-minimo', roles, agtController.gerarCertificacaoAgtMinimo);

export default router;
