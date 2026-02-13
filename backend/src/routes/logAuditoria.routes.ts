import { Router } from 'express';
import * as logAuditoriaController from '../controllers/logAuditoria.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

// AUDITOR, ADMIN, SUPER_ADMIN e SECRETARIA podem ler logs (apenas leitura)
// SECRETARIA tem acesso limitado apenas ao domínio ACADEMICO (filtrado no controller)
router.get('/', authenticate, authorize('AUDITOR', 'ADMIN', 'SUPER_ADMIN', 'SECRETARIA'), logAuditoriaController.getAll);
router.get('/stats', authenticate, authorize('AUDITOR', 'ADMIN', 'SUPER_ADMIN'), logAuditoriaController.getStats);
router.get('/:id/detalhes', authenticate, authorize('AUDITOR', 'ADMIN', 'SUPER_ADMIN', 'SECRETARIA'), logAuditoriaController.getDetalhes);
router.get('/:id', authenticate, authorize('AUDITOR', 'ADMIN', 'SUPER_ADMIN', 'SECRETARIA'), logAuditoriaController.getById);

// Logs não podem ser criados manualmente - apenas via AuditService
// Este endpoint retorna erro 403
router.post('/', authenticate, logAuditoriaController.create);

export default router;
