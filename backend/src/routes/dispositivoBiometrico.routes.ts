import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import * as dispositivoBiometricoController from '../controllers/dispositivoBiometrico.controller.js';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// Listar dispositivos
router.get(
  '/',
  authorize('ADMIN', 'RH', 'SUPER_ADMIN'),
  dispositivoBiometricoController.getAll
);

// Buscar dispositivo por ID
router.get(
  '/:id',
  authorize('ADMIN', 'RH', 'SUPER_ADMIN'),
  dispositivoBiometricoController.getById
);

// Criar dispositivo
router.post(
  '/',
  authorize('ADMIN', 'SUPER_ADMIN'),
  dispositivoBiometricoController.create
);

// Atualizar dispositivo
router.put(
  '/:id',
  authorize('ADMIN', 'SUPER_ADMIN'),
  dispositivoBiometricoController.update
);

// Deletar dispositivo
router.delete(
  '/:id',
  authorize('ADMIN', 'SUPER_ADMIN'),
  dispositivoBiometricoController.remove
);

// Regenerar token
router.post(
  '/:id/regenerate-token',
  authorize('ADMIN', 'SUPER_ADMIN'),
  dispositivoBiometricoController.regenerateToken
);

// Testar conexão
router.post(
  '/:id/test-connection',
  authorize('ADMIN', 'RH', 'SUPER_ADMIN'),
  dispositivoBiometricoController.testConnection
);

export default router;

