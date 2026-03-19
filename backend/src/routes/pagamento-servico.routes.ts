import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import * as pagamentoServicoController from '../controllers/pagamento-servico.controller.js';

const router = Router();

router.use(authenticate);

// Valores disponíveis (bata/passe) para um aluno - para preencher o formulário
router.get(
  '/valores-disponiveis/:alunoId',
  authorize('ADMIN', 'SECRETARIA', 'POS', 'FINANCEIRO', 'SUPER_ADMIN'),
  pagamentoServicoController.getValoresDisponiveis
);

// Registrar pagamento avulso de bata ou passe
router.post(
  '/',
  authorize('ADMIN', 'SECRETARIA', 'POS', 'FINANCEIRO', 'SUPER_ADMIN'),
  pagamentoServicoController.registrarPagamentoServico
);

// Listar pagamentos de serviço (com filtros)
router.get(
  '/',
  authorize('ADMIN', 'SECRETARIA', 'POS', 'FINANCEIRO', 'SUPER_ADMIN'),
  pagamentoServicoController.getAllPagamentosServico
);

// Obter um pagamento de serviço por ID
router.get(
  '/:id',
  authorize('ADMIN', 'SECRETARIA', 'POS', 'FINANCEIRO', 'SUPER_ADMIN'),
  pagamentoServicoController.getPagamentoServicoById
);

export default router;
