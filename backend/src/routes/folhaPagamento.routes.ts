import { Router } from 'express';
import * as folhaPagamentoController from '../controllers/folhaPagamento.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validateLicense } from '../middlewares/license.middleware.js';

const router = Router();

router.use(authenticate);
// Validate license for all routes (SUPER_ADMIN is exempt in middleware)
router.use(validateLicense);

// Regras de perfil: ADMIN e FINANCEIRO geram/marcam pago/enviam recibo; só ADMIN cancela (reverter/delete). SECRETARIA e PROFESSOR só visualizam (PROFESSOR só própria).
router.get('/', authorize('ADMIN', 'FINANCEIRO', 'RH', 'SECRETARIA', 'PROFESSOR', 'SUPER_ADMIN'), folhaPagamentoController.getAll);
router.get('/salario-base/:funcionarioId', authorize('ADMIN', 'FINANCEIRO', 'RH', 'SUPER_ADMIN'), folhaPagamentoController.getSalarioBase);
router.get('/calcular-descontos', authorize('ADMIN', 'FINANCEIRO', 'RH', 'SUPER_ADMIN'), folhaPagamentoController.calcularDescontos);
router.post('/calcular-automatico', authorize('ADMIN', 'FINANCEIRO', 'RH', 'SUPER_ADMIN'), folhaPagamentoController.calcularAutomatico);
router.post('/:id/fechar', authorize('ADMIN', 'FINANCEIRO', 'RH', 'SUPER_ADMIN'), folhaPagamentoController.fecharFolha);
router.post('/:id/reabrir', authorize('ADMIN', 'SUPER_ADMIN', 'DIRECAO'), folhaPagamentoController.reabrirFolha);
router.post('/:id/pagar', authorize('ADMIN', 'FINANCEIRO', 'SUPER_ADMIN'), folhaPagamentoController.pagarFolha);
router.post('/:id/reverter-pagamento', authorize('ADMIN', 'SUPER_ADMIN'), folhaPagamentoController.reverterPagamento);
router.get('/:id', authorize('ADMIN', 'FINANCEIRO', 'RH', 'SECRETARIA', 'PROFESSOR', 'SUPER_ADMIN'), folhaPagamentoController.getById);
router.post('/', authorize('ADMIN', 'FINANCEIRO', 'SUPER_ADMIN'), folhaPagamentoController.create);
router.put('/:id', authorize('ADMIN', 'FINANCEIRO', 'SUPER_ADMIN'), folhaPagamentoController.update);
router.delete('/:id', authorize('ADMIN', 'SUPER_ADMIN'), folhaPagamentoController.remove);

export default router;
