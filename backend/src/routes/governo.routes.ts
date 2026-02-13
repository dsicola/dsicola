import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validateLicense } from '../middlewares/license.middleware.js';
import * as governoController from '../controllers/governo.controller.js';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// Validate license for all routes (SUPER_ADMIN is exempt in middleware)
router.use(validateLicense);

// Todas as rotas são exclusivas para ADMIN e SUPER_ADMIN
// NUNCA expor ao aluno ou outros perfis

/**
 * GET /governo/eventos
 * Listar eventos governamentais
 * Apenas ADMIN e SUPER_ADMIN
 */
router.get(
  '/eventos',
  authorize('ADMIN', 'SUPER_ADMIN'),
  governoController.listarEventos
);

/**
 * GET /governo/eventos/:id
 * Obter evento por ID
 * Apenas ADMIN e SUPER_ADMIN
 */
router.get(
  '/eventos/:id',
  authorize('ADMIN', 'SUPER_ADMIN'),
  governoController.obterEventoPorId
);

/**
 * POST /governo/eventos
 * Criar evento governamental
 * Apenas ADMIN e SUPER_ADMIN
 */
router.post(
  '/eventos',
  authorize('ADMIN', 'SUPER_ADMIN'),
  governoController.criarEvento
);

/**
 * POST /governo/eventos/:id/enviar
 * Enviar evento ao órgão governamental
 * Apenas ADMIN e SUPER_ADMIN
 */
router.post(
  '/eventos/:id/enviar',
  authorize('ADMIN', 'SUPER_ADMIN'),
  governoController.enviarEvento
);

/**
 * POST /governo/eventos/:id/cancelar
 * Cancelar evento governamental
 * Apenas ADMIN e SUPER_ADMIN
 */
router.post(
  '/eventos/:id/cancelar',
  authorize('ADMIN', 'SUPER_ADMIN'),
  governoController.cancelarEvento
);

/**
 * POST /governo/eventos/:id/retentar
 * Retentar envio de evento com erro
 * Apenas ADMIN e SUPER_ADMIN
 */
router.post(
  '/eventos/:id/retentar',
  authorize('ADMIN', 'SUPER_ADMIN'),
  governoController.retentarEnvio
);

/**
 * GET /governo/estatisticas
 * Obter estatísticas de eventos
 * Apenas ADMIN e SUPER_ADMIN
 */
router.get(
  '/estatisticas',
  authorize('ADMIN', 'SUPER_ADMIN'),
  governoController.obterEstatisticas
);

export default router;
