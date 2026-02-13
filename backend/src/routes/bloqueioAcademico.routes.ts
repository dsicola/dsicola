import { Router } from 'express';
import * as bloqueioAcademicoController from '../controllers/bloqueioAcademico.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

/**
 * Rotas para Configurações de Bloqueio Acadêmico
 * REGRA: Configurações avançadas por instituição
 */

// Obter configuração de bloqueio acadêmico
router.get(
  '/configuracao',
  authenticate,
  authorize('ADMIN', 'COORDENADOR', 'DIRECAO'),
  bloqueioAcademicoController.obterConfiguracaoController
);

// Atualizar configuração de bloqueio acadêmico (apenas administradores)
router.put(
  '/configuracao',
  authenticate,
  authorize('ADMIN', 'DIRECAO'),
  bloqueioAcademicoController.atualizarConfiguracaoController
);

// Verificar bloqueio para operação específica
router.post(
  '/verificar',
  authenticate,
  authorize('ADMIN', 'PROFESSOR', 'COORDENADOR', 'DIRECAO', 'ALUNO'),
  bloqueioAcademicoController.verificarBloqueioOperacaoController
);

export default router;

