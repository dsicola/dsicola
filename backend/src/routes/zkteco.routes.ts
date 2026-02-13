import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import * as zktecoController from '../controllers/zkteco.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Testar conexão com dispositivo ZKTeco
router.post(
  '/:id/testar',
  authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'),
  zktecoController.testarConexao
);

// Sincronizar funcionários com dispositivo
router.post(
  '/:id/sincronizar-funcionarios',
  authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'),
  zktecoController.sincronizarFuncionarios
);

// Sincronizar logs offline
router.post(
  '/:id/sincronizar-logs',
  authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'),
  zktecoController.sincronizarLogs
);

// Obter informações do dispositivo
router.get(
  '/:id/info',
  authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'),
  zktecoController.getDeviceInfo
);

export default router;

