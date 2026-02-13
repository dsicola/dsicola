import { Router } from 'express';
import * as estatisticaController from '../controllers/estatistica.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

router.get('/aluno/:alunoId', authenticate, estatisticaController.getAlunoEstatisticas);
// IMPORTANTE: Multi-tenant - instituicaoId vem APENAS do JWT, não do path
router.get('/instituicao', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), estatisticaController.getInstituicaoEstatisticas);

export default router;
