import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validateLicense } from '../middlewares/license.middleware.js';
import * as eventoGovernamentalController from '../controllers/eventoGovernamental.controller.js';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);
router.use(validateLicense);

// Apenas ADMIN e SUPER_ADMIN podem acessar eventos governamentais
// ALUNO, PROFESSOR, SECRETARIA não têm acesso

/**
 * Verificar status da integração governamental
 * GET /eventos-governamentais/status-integracao
 */
router.get(
  '/status-integracao',
  authorize('ADMIN', 'SUPER_ADMIN'),
  eventoGovernamentalController.verificarStatusIntegracao
);

/**
 * Processar eventos pendentes manualmente
 * POST /eventos-governamentais/processar-pendentes
 */
router.post(
  '/processar-pendentes',
  authorize('ADMIN', 'SUPER_ADMIN'),
  eventoGovernamentalController.processarPendentes
);

/**
 * Processar eventos com erro manualmente (retry)
 * POST /eventos-governamentais/processar-erros
 */
router.post(
  '/processar-erros',
  authorize('ADMIN', 'SUPER_ADMIN'),
  eventoGovernamentalController.processarErros
);

/**
 * Obter estatísticas de eventos
 * GET /eventos-governamentais/estatisticas
 */
router.get(
  '/estatisticas',
  authorize('ADMIN', 'SUPER_ADMIN'),
  eventoGovernamentalController.obterEstatisticas
);

/**
 * Listar eventos governamentais
 * GET /eventos-governamentais
 */
router.get(
  '/',
  authorize('ADMIN', 'SUPER_ADMIN'),
  eventoGovernamentalController.listarEventos
);

/**
 * Buscar evento por ID
 * GET /eventos-governamentais/:id
 */
router.get(
  '/:id',
  authorize('ADMIN', 'SUPER_ADMIN'),
  eventoGovernamentalController.buscarEventoPorId
);

/**
 * Criar evento governamental
 * POST /eventos-governamentais
 */
router.post(
  '/',
  authorize('ADMIN', 'SUPER_ADMIN'),
  eventoGovernamentalController.criarEvento
);

/**
 * Enviar evento governamental
 * POST /eventos-governamentais/:id/enviar
 */
router.post(
  '/:id/enviar',
  authorize('ADMIN', 'SUPER_ADMIN'),
  eventoGovernamentalController.enviarEvento
);

/**
 * Cancelar evento governamental
 * POST /eventos-governamentais/:id/cancelar
 */
router.post(
  '/:id/cancelar',
  authorize('ADMIN', 'SUPER_ADMIN'),
  eventoGovernamentalController.cancelarEventoController
);

export default router;
