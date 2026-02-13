/**
 * PADRÃO SIGAE — Rotas de listagem de estudantes
 * GET /estudantes — paginação server-side + filtros + busca
 */

import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validateLicense } from '../middlewares/license.middleware.js';
import { requireInstitution } from '../middlewares/rbac.middleware.js';
import * as estudanteController from '../controllers/estudante.controller.js';

const router = Router();

router.use(authenticate);
router.use(validateLicense);
router.use(requireInstitution);

router.get(
  '/',
  authorize('ADMIN', 'SECRETARIA', 'DIRECAO', 'COORDENADOR', 'SUPER_ADMIN'),
  estudanteController.listarEstudantes
);

export default router;
