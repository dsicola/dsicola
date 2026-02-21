import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { requireInstitution } from '../middlewares/rbac.middleware.js';
import { validateLicense } from '../middlewares/license.middleware.js';
import * as periodoLancamentoNotasController from '../controllers/periodoLancamentoNotas.controller.js';

const router = Router();

router.use(authenticate);
router.use(validateLicense);
router.use(requireInstitution);

// Listar períodos da instituição (ADMIN, SECRETARIA, PROFESSOR podem ver)
router.get(
  '/',
  authorize('ADMIN', 'SECRETARIA', 'PROFESSOR', 'SUPER_ADMIN'),
  periodoLancamentoNotasController.list
);

// Período ativo atual (para exibir na UI)
router.get(
  '/ativo',
  authorize('ADMIN', 'SECRETARIA', 'PROFESSOR', 'SUPER_ADMIN'),
  periodoLancamentoNotasController.getAtivo
);

// Criar período (ADMIN apenas)
router.post(
  '/',
  authorize('ADMIN', 'SUPER_ADMIN'),
  periodoLancamentoNotasController.create
);

// Atualizar período (ADMIN apenas)
router.put(
  '/:id',
  authorize('ADMIN', 'SUPER_ADMIN'),
  periodoLancamentoNotasController.update
);

// Reabrir período (APENAS ADMIN - com log de auditoria)
router.post(
  '/:id/reabrir',
  authorize('ADMIN', 'SUPER_ADMIN'),
  periodoLancamentoNotasController.reabrir
);

export default router;
