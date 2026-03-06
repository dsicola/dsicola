import { Router } from 'express';
import * as contabilidadeController from '../controllers/contabilidade.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validateLicense } from '../middlewares/license.middleware.js';

const router = Router();

router.use(authenticate);
router.use(validateLicense);

// Plano de contas
router.get('/plano-contas', authorize('ADMIN', 'SUPER_ADMIN', 'FINANCEIRO'), contabilidadeController.listPlanoContas);
router.get('/plano-contas/:id', authorize('ADMIN', 'SUPER_ADMIN', 'FINANCEIRO'), contabilidadeController.getPlanoContaById);
router.post('/plano-contas', authorize('ADMIN', 'SUPER_ADMIN', 'FINANCEIRO'), contabilidadeController.createPlanoConta);
router.put('/plano-contas/:id', authorize('ADMIN', 'SUPER_ADMIN', 'FINANCEIRO'), contabilidadeController.updatePlanoConta);
router.delete('/plano-contas/:id', authorize('ADMIN', 'SUPER_ADMIN'), contabilidadeController.deletePlanoConta);

// Lançamentos
router.get('/lancamentos', authorize('ADMIN', 'SUPER_ADMIN', 'FINANCEIRO'), contabilidadeController.listLancamentos);
router.get('/lancamentos/:id', authorize('ADMIN', 'SUPER_ADMIN', 'FINANCEIRO'), contabilidadeController.getLancamentoById);
router.post('/lancamentos', authorize('ADMIN', 'SUPER_ADMIN', 'FINANCEIRO'), contabilidadeController.createLancamento);
router.put('/lancamentos/:id', authorize('ADMIN', 'SUPER_ADMIN', 'FINANCEIRO'), contabilidadeController.updateLancamento);
router.post('/lancamentos/:id/fechar', authorize('ADMIN', 'SUPER_ADMIN', 'FINANCEIRO'), contabilidadeController.fecharLancamento);
router.delete('/lancamentos/:id', authorize('ADMIN', 'SUPER_ADMIN', 'FINANCEIRO'), contabilidadeController.deleteLancamento);

// Balancete
router.get('/balancete', authorize('ADMIN', 'SUPER_ADMIN', 'FINANCEIRO'), contabilidadeController.getBalancete);

export default router;
