import { Router } from 'express';
import * as estatisticaController from '../controllers/estatistica.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validateLicense, validatePlanFeature } from '../middlewares/license.middleware.js';

const router = Router();

router.use(authenticate);
router.use(validateLicense);

router.get('/aluno/:alunoId', estatisticaController.getAlunoEstatisticas);
// IMPORTANTE: Multi-tenant - instituicaoId vem APENAS do JWT, não do path
// Estatísticas da instituição (dashboard) exigem plano com analytics
router.get('/instituicao', validatePlanFeature('analytics'), authorize('ADMIN', 'SUPER_ADMIN'), estatisticaController.getInstituicaoEstatisticas);

export default router;
