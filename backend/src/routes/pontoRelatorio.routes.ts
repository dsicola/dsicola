import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import * as pontoRelatorioController from '../controllers/pontoRelatorio.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Apenas ADMIN, RH ou SECRETARIA podem gerar relatórios de ponto
router.use(authorize('ADMIN', 'RH', 'SECRETARIA', 'SUPER_ADMIN'));

// Gerar relatório diário
router.post('/diario', pontoRelatorioController.gerarRelatorioDiario);

// Gerar relatório mensal
router.post('/mensal', pontoRelatorioController.gerarRelatorioMensal);

// Gerar relatório individual
router.post('/individual', pontoRelatorioController.gerarRelatorioIndividual);

// Verificar integridade
router.get('/:id/verificar-integridade', pontoRelatorioController.verificarIntegridade);

export default router;

