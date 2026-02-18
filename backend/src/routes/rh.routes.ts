/**
 * Rotas RH - Comprovante de Admissão
 * GET /rh/funcionarios/:id/admissao/imprimir
 */
import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validateLicense } from '../middlewares/license.middleware.js';
import * as comprovanteAdmissaoController from '../controllers/comprovanteAdmissao.controller.js';

const router = Router();

router.use(authenticate);
router.use(validateLicense);

// ADMIN e RH podem imprimir comprovante de admissão
router.get(
  '/funcionarios/:id/admissao/imprimir',
  authorize('ADMIN', 'SUPER_ADMIN', 'RH'),
  comprovanteAdmissaoController.imprimir
);

export default router;
