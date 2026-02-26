import { Router } from 'express';
import * as relatoriosOficiaisController from '../controllers/relatoriosOficiais.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { resolveProfessor } from '../middlewares/resolveProfessor.middleware.js';

const router = Router();

/**
 * Rotas para Relatórios Oficiais
 * REGRA ABSOLUTA: Relatórios são SOMENTE leitura e derivados
 * Nenhum relatório pode ser editado manualmente
 */

// Histórico Acadêmico
router.get(
  '/historico/:alunoId',
  authenticate,
  authorize('ADMIN', 'PROFESSOR', 'COORDENADOR', 'DIRECAO', 'SECRETARIA', 'ALUNO'),
  relatoriosOficiaisController.gerarHistoricoAcademicoController
);

// Boletim do Aluno (documento somente leitura, derivado de dados reais)
router.get(
  '/boletim/:alunoId',
  authenticate,
  authorize('ADMIN', 'PROFESSOR', 'COORDENADOR', 'DIRECAO', 'SECRETARIA', 'ALUNO'),
  relatoriosOficiaisController.gerarBoletimAlunoController
);

// Pauta (apenas após fechamento do plano de ensino)
// REGRA: PROFESSOR só pode ver pautas dos seus próprios planos de ensino
// ADMIN/COORDENADOR/DIRECAO/SECRETARIA podem ver qualquer pauta
router.get(
  '/pauta/:planoEnsinoId',
  authenticate,
  authorize('ADMIN', 'PROFESSOR', 'COORDENADOR', 'DIRECAO', 'SECRETARIA'),
  resolveProfessor, // OBRIGATÓRIO para PROFESSOR - valida que só vê suas próprias pautas
  relatoriosOficiaisController.gerarPautaController
);

// Certificado (apenas ADMIN; com verificação de bloqueio acadêmico)
router.post(
  '/certificado',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  relatoriosOficiaisController.gerarCertificadoController
);

// Verificar bloqueio acadêmico do aluno
router.get(
  '/bloqueio/:alunoId',
  authenticate,
  authorize('ADMIN', 'PROFESSOR', 'COORDENADOR', 'DIRECAO', 'SECRETARIA', 'ALUNO'),
  relatoriosOficiaisController.verificarBloqueioController
);

// Obter situação financeira do aluno
router.get(
  '/situacao-financeira/:alunoId',
  authenticate,
  authorize('ADMIN', 'PROFESSOR', 'COORDENADOR', 'DIRECAO', 'SECRETARIA', 'ALUNO'),
  relatoriosOficiaisController.obterSituacaoFinanceiraController
);

export default router;

