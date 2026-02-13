import { Router } from 'express';
import * as backupController from '../controllers/backup.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { uploadBackup } from '../middlewares/upload.middleware.js';
import { checkAceiteTermo } from '../middlewares/termoLegal.middleware.js';
import { TipoAcaoTermoLegal } from '../services/termoLegal.service.js';

const router = Router();

// Rotas para ADMIN (instituição)
// ADMIN: instituicao_id SEMPRE vem do token
// NÃO permite SUPER_ADMIN - SUPER_ADMIN deve usar /admin/backups
router.get('/history', authenticate, authorize('ADMIN'), backupController.getHistory);
router.get('/schedules', authenticate, authorize('ADMIN'), backupController.getSchedules);
router.post('/schedules', authenticate, authorize('ADMIN'), backupController.createSchedule);
router.put('/schedules/:id', authenticate, authorize('ADMIN'), backupController.updateSchedule);
router.delete('/schedules/:id', authenticate, authorize('ADMIN'), backupController.deleteSchedule);
router.post('/generate', authenticate, authorize('ADMIN'), backupController.generate);
router.post('/upload', authenticate, authorize('ADMIN'), checkAceiteTermo(TipoAcaoTermoLegal.RESTORE_BACKUP), uploadBackup.single('backup'), backupController.upload);
router.post('/restore', authenticate, authorize('ADMIN'), checkAceiteTermo(TipoAcaoTermoLegal.RESTORE_BACKUP), backupController.restore);
router.get('/audit/export', authenticate, authorize('ADMIN'), backupController.exportAuditReport);
router.get('/:id/download', authenticate, authorize('ADMIN'), backupController.download);

export default router;
