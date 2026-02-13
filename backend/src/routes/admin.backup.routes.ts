import { Router } from 'express';
import * as backupController from '../controllers/backup.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { checkAceiteTermo } from '../middlewares/termoLegal.middleware.js';
import { TipoAcaoTermoLegal } from '../services/termoLegal.service.js';

const router = Router();

// Rotas para SUPER_ADMIN - Ações Excepcionais
// GET /admin/backups - Listar backups de todas as instituições
router.get('/backups', authenticate, authorize('SUPER_ADMIN'), backupController.getGlobalBackups);

// POST /admin/backups/forcar - Forçar backup para uma instituição
router.post('/backups/forcar', authenticate, authorize('SUPER_ADMIN'), backupController.forcarBackup);

// POST /admin/backups/:id/restaurar - Restaurar backup específico
// NOTA: Verificação de termo é feita no controller para SUPER_ADMIN (precisa do backupId primeiro)
router.post('/backups/:id/restaurar', authenticate, authorize('SUPER_ADMIN'), backupController.restaurarBackupExcepcional);

export default router;

