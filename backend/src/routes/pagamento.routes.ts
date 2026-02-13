import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import * as pagamentoController from '../controllers/pagamento.controller.js';

const router = Router();

router.use(authenticate);

// Listar todos os pagamentos (ADMIN, SECRETARIA, POS)
router.get(
  '/',
  authorize('ADMIN', 'SECRETARIA', 'POS', 'SUPER_ADMIN'),
  pagamentoController.getAllPagamentos
);

// Obter pagamento por ID
router.get(
  '/:id',
  authorize('ADMIN', 'SECRETARIA', 'POS', 'SUPER_ADMIN'),
  pagamentoController.getPagamentoById
);

// Listar pagamentos de uma mensalidade
router.get(
  '/mensalidade/:mensalidadeId',
  authorize('ADMIN', 'SECRETARIA', 'POS', 'SUPER_ADMIN', 'ALUNO'),
  pagamentoController.getPagamentosByMensalidade
);

// Registrar pagamento em uma mensalidade
// SECRETARIA e POS: Podem registrar pagamentos (conforme padrão SIGA/SIGAE)
// POS: Funcionalidade principal do ponto de venda
router.post(
  '/mensalidade/:mensalidadeId/registrar',
  authorize('ADMIN', 'SECRETARIA', 'POS', 'SUPER_ADMIN'),
  pagamentoController.registrarPagamento
);

// Estornar pagamento (cria registro de estorno - histórico imutável)
// POS: Pode estornar pagamentos (apenas estornar, não registrar)
router.post(
  '/:id/estornar',
  authorize('ADMIN', 'SECRETARIA', 'POS', 'SUPER_ADMIN'),
  pagamentoController.estornarPagamento
);

// Bloquear DELETE de pagamentos - Histórico imutável (apenas estorno permitido)
router.delete(
  '/:id',
  authorize('ADMIN', 'SUPER_ADMIN'),
  pagamentoController.deletePagamento
);

export default router;

