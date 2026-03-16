import { Router } from 'express';
import * as contabilidadeController from '../controllers/contabilidade.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validateLicense } from '../middlewares/license.middleware.js';

const router = Router();

router.use(authenticate);
router.use(validateLicense);

// Plano de contas
router.post('/plano-contas/seed-padrao', authorize('ADMIN', 'SUPER_ADMIN', 'FINANCEIRO'), contabilidadeController.seedPlanoPadrao);
router.get('/plano-contas', authorize('ADMIN', 'SUPER_ADMIN', 'FINANCEIRO'), contabilidadeController.listPlanoContas);
router.get('/plano-contas/:id', authorize('ADMIN', 'SUPER_ADMIN', 'FINANCEIRO'), contabilidadeController.getPlanoContaById);
router.post('/plano-contas', authorize('ADMIN', 'SUPER_ADMIN', 'FINANCEIRO'), contabilidadeController.createPlanoConta);
router.put('/plano-contas/:id', authorize('ADMIN', 'SUPER_ADMIN', 'FINANCEIRO'), contabilidadeController.updatePlanoConta);
router.delete('/plano-contas/:id', authorize('ADMIN', 'SUPER_ADMIN'), contabilidadeController.deletePlanoConta);

// Lançamentos
router.get('/lancamentos', authorize('ADMIN', 'SUPER_ADMIN', 'FINANCEIRO'), contabilidadeController.listLancamentos);
router.post('/lancamentos/importar', authorize('ADMIN', 'SUPER_ADMIN', 'FINANCEIRO'), contabilidadeController.importarLancamentos);
router.get('/lancamentos/:id', authorize('ADMIN', 'SUPER_ADMIN', 'FINANCEIRO'), contabilidadeController.getLancamentoById);
router.post('/lancamentos', authorize('ADMIN', 'SUPER_ADMIN', 'FINANCEIRO'), contabilidadeController.createLancamento);
router.put('/lancamentos/:id', authorize('ADMIN', 'SUPER_ADMIN', 'FINANCEIRO'), contabilidadeController.updateLancamento);
router.post('/lancamentos/:id/fechar', authorize('ADMIN', 'SUPER_ADMIN', 'FINANCEIRO'), contabilidadeController.fecharLancamento);
router.delete('/lancamentos/:id', authorize('ADMIN', 'SUPER_ADMIN', 'FINANCEIRO'), contabilidadeController.deleteLancamento);

// Dashboard e Diário
router.get('/dashboard', authorize('ADMIN', 'SUPER_ADMIN', 'FINANCEIRO'), contabilidadeController.getDashboard);
router.get('/diario', authorize('ADMIN', 'SUPER_ADMIN', 'FINANCEIRO'), contabilidadeController.getDiario);

// Balancete
router.get('/balancete', authorize('ADMIN', 'SUPER_ADMIN', 'FINANCEIRO'), contabilidadeController.getBalancete);

// Relatórios
router.get('/balanco', authorize('ADMIN', 'SUPER_ADMIN', 'FINANCEIRO'), contabilidadeController.getBalanco);
router.get('/dre', authorize('ADMIN', 'SUPER_ADMIN', 'FINANCEIRO'), contabilidadeController.getDRE);
router.get('/razao/:contaId', authorize('ADMIN', 'SUPER_ADMIN', 'FINANCEIRO'), contabilidadeController.getRazao);

// Motor Automático de Lançamentos (Regras Contábeis)
router.get('/regras-contabeis', authorize('ADMIN', 'SUPER_ADMIN', 'FINANCEIRO'), contabilidadeController.listRegrasContabeis);
router.post('/regras-contabeis', authorize('ADMIN', 'SUPER_ADMIN'), contabilidadeController.upsertRegraContabil);
router.get('/regras-contabeis/eventos', authorize('ADMIN', 'SUPER_ADMIN', 'FINANCEIRO'), contabilidadeController.getEventosContabeis);

// Configuração de contas por instituição
router.get('/configuracao', authorize('ADMIN', 'SUPER_ADMIN', 'FINANCEIRO'), contabilidadeController.getConfiguracaoContabilidade);
router.put('/configuracao', authorize('ADMIN', 'SUPER_ADMIN'), contabilidadeController.updateConfiguracaoContabilidade);

// Centros de custo
router.get('/centros-custo', authorize('ADMIN', 'SUPER_ADMIN', 'FINANCEIRO'), contabilidadeController.listCentrosCusto);
router.post('/centros-custo', authorize('ADMIN', 'SUPER_ADMIN', 'FINANCEIRO'), contabilidadeController.createCentroCusto);
router.put('/centros-custo/:id', authorize('ADMIN', 'SUPER_ADMIN', 'FINANCEIRO'), contabilidadeController.updateCentroCusto);
router.delete('/centros-custo/:id', authorize('ADMIN', 'SUPER_ADMIN'), contabilidadeController.deleteCentroCusto);

// Fecho de exercício
router.get('/fechos-exercicio', authorize('ADMIN', 'SUPER_ADMIN', 'FINANCEIRO'), contabilidadeController.listFechosExercicio);
router.get('/bloqueio-periodo', authorize('ADMIN', 'SUPER_ADMIN', 'FINANCEIRO'), contabilidadeController.getBloqueioPeriodo);
router.post('/fechar-exercicio', authorize('ADMIN', 'SUPER_ADMIN', 'FINANCEIRO'), contabilidadeController.fecharExercicio);

// Conciliação bancária
router.get('/contas-bancarias', authorize('ADMIN', 'SUPER_ADMIN', 'FINANCEIRO'), contabilidadeController.listContasBancarias);
router.post('/contas-bancarias', authorize('ADMIN', 'SUPER_ADMIN', 'FINANCEIRO'), contabilidadeController.createContaBancaria);
router.put('/contas-bancarias/:id', authorize('ADMIN', 'SUPER_ADMIN', 'FINANCEIRO'), contabilidadeController.updateContaBancaria);
router.get('/contas-bancarias/:contaBancariaId/movimentos', authorize('ADMIN', 'SUPER_ADMIN', 'FINANCEIRO'), contabilidadeController.listMovimentosExtrato);
router.post('/contas-bancarias/:contaBancariaId/movimentos/importar', authorize('ADMIN', 'SUPER_ADMIN', 'FINANCEIRO'), contabilidadeController.importarMovimentosExtrato);
router.get('/contas-bancarias/:contaBancariaId/resumo-conciliacao', authorize('ADMIN', 'SUPER_ADMIN', 'FINANCEIRO'), contabilidadeController.getResumoConciliacao);
router.post('/movimentos-extrato/:movimentoId/conciliar', authorize('ADMIN', 'SUPER_ADMIN', 'FINANCEIRO'), contabilidadeController.conciliarMovimento);
router.post('/movimentos-extrato/:movimentoId/desconciliar', authorize('ADMIN', 'SUPER_ADMIN', 'FINANCEIRO'), contabilidadeController.desconciliarMovimento);

export default router;
