import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { resolveProfessor } from '../middlewares/resolveProfessor.middleware.js';
import * as relatoriosController from '../controllers/relatorios.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Gerar relatório
router.post(
  '/gerar',
  authorize('ADMIN', 'PROFESSOR', 'SECRETARIA', 'SUPER_ADMIN'),
  relatoriosController.gerarRelatorio
);

// Listar relatórios gerados
router.get(
  '/',
  authorize('ADMIN', 'PROFESSOR', 'SECRETARIA', 'SUPER_ADMIN'),
  relatoriosController.listarRelatorios
);

// Rotas com path fixo DEVEM vir ANTES de /:id para não serem capturadas como id
// Gerar Pauta Final (endpoint específico)
router.post(
  '/pauta-final',
  authorize('ADMIN', 'SECRETARIA'),
  relatoriosController.gerarPautaFinal
);

// Gerar dados da Pauta por Plano de Ensino (base para relatórios SIGA)
// REGRA: PROFESSOR só pode ver pautas dos seus próprios planos de ensino
// ADMIN/COORDENADOR/DIRETOR podem ver qualquer pauta
router.get(
  '/pauta/:planoEnsinoId',
  authorize('ADMIN', 'PROFESSOR', 'SECRETARIA', 'SUPER_ADMIN'),
  resolveProfessor, // OBRIGATÓRIO para PROFESSOR - valida que só vê suas próprias pautas
  relatoriosController.getPautaPlanoEnsino
);

// Gerar dados do Boletim por Aluno (base para relatórios SIGA)
router.get(
  '/boletim/:alunoId',
  authorize('ADMIN', 'PROFESSOR', 'SECRETARIA', 'ALUNO', 'SUPER_ADMIN'),
  relatoriosController.getBoletimAluno
);

// Gerar dados do Histórico Escolar por Aluno (base para relatórios SIGA)
router.get(
  '/historico/:alunoId',
  authorize('ADMIN', 'PROFESSOR', 'SECRETARIA', 'ALUNO', 'SUPER_ADMIN'),
  relatoriosController.getHistoricoEscolar
);

// Buscar relatório por ID (deve vir DEPOIS das rotas com path fixo)
router.get(
  '/:id',
  authorize('ADMIN', 'PROFESSOR', 'SECRETARIA', 'SUPER_ADMIN'),
  relatoriosController.buscarRelatorio
);

// Download do relatório (PDF)
router.get(
  '/:id/download',
  authorize('ADMIN', 'PROFESSOR', 'SECRETARIA', 'SUPER_ADMIN'),
  relatoriosController.downloadRelatorio
);

// Visualizar relatório (inline)
router.get(
  '/:id/visualizar',
  authorize('ADMIN', 'PROFESSOR', 'SECRETARIA', 'SUPER_ADMIN'),
  relatoriosController.visualizarRelatorio
);

export default router;

