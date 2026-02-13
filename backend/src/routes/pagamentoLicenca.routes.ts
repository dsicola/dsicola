import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import * as pagamentoLicencaController from '../controllers/pagamentoLicenca.controller.js';
import express from 'express';

const router = Router();

// Webhook para gateways (NÃO requer autenticação JWT - usa signature do gateway)
// Deve estar ANTES do middleware de autenticação
router.post(
  '/webhook/:gateway',
  express.raw({ type: 'application/json' }), // Raw body para verificação de signature
  pagamentoLicencaController.webhook
);

// Todas as outras rotas requerem autenticação
router.use(authenticate);

// Criar pagamento de licença manual (Instituição)
router.post(
  '/criar',
  authorize('ADMIN', 'SUPER_ADMIN'), // Instituições podem criar, SUPER_ADMIN também
  pagamentoLicencaController.criarPagamento
);

// Criar pagamento online (via gateway)
router.post(
  '/online',
  authorize('ADMIN', 'SUPER_ADMIN'),
  pagamentoLicencaController.criarPagamentoOnline
);

// Confirmar pagamento manual (apenas SUPER_ADMIN)
router.post(
  '/:pagamentoId/confirmar',
  authorize('SUPER_ADMIN'),
  pagamentoLicencaController.confirmarPagamento
);

// Cancelar/Rejeitar pagamento (Instituição ou SUPER_ADMIN)
router.post(
  '/:pagamentoId/cancelar',
  authorize('ADMIN', 'SUPER_ADMIN'),
  pagamentoLicencaController.cancelarPagamento
);

// Buscar histórico de pagamentos
router.get(
  '/historico',
  authorize('ADMIN', 'SUPER_ADMIN'),
  pagamentoLicencaController.getHistorico
);

// Buscar pagamento por ID
router.get(
  '/:pagamentoId',
  authorize('ADMIN', 'SUPER_ADMIN'),
  pagamentoLicencaController.getById
);

export default router;

