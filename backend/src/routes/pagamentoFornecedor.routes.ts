import { Router } from 'express';
import * as pagamentoFornecedorController from '../controllers/pagamentoFornecedor.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validateLicense } from '../middlewares/license.middleware.js';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);
router.use(validateLicense);

// Listar pagamentos (ADMIN pode ver todos da sua instituição, SUPER_ADMIN pode ver todos para auditoria)
// FUNCIONARIO NÃO pode ver pagamentos (separação RH ≠ Financeiro)
router.get('/', authorize('ADMIN', 'SUPER_ADMIN'), pagamentoFornecedorController.list);

// Obter pagamento por ID (ADMIN, SUPER_ADMIN)
// FUNCIONARIO NÃO pode ver pagamentos (separação RH ≠ Financeiro)
router.get('/:id', authorize('ADMIN', 'SUPER_ADMIN'), pagamentoFornecedorController.getById);

// Criar pagamento (apenas ADMIN)
router.post('/', authorize('ADMIN'), pagamentoFornecedorController.create);

// Autorizar e executar pagamento (apenas ADMIN)
router.post('/:id/autorizar', authorize('ADMIN'), pagamentoFornecedorController.autorizarEPagar);

// Cancelar pagamento (apenas ADMIN)
router.post('/:id/cancelar', authorize('ADMIN'), pagamentoFornecedorController.cancelar);

export default router;

