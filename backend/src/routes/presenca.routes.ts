import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validateLicense } from '../middlewares/license.middleware.js';
import { validarProfessorAtivo } from '../middlewares/rh-status.middleware.js';
import { bloquearAnoLetivoEncerrado } from '../middlewares/bloquearAnoLetivoEncerrado.middleware.js';
import { resolveProfessor } from '../middlewares/resolveProfessor.middleware.js';
// requireAnoLetivoAtivo removido - Ano Letivo é contexto, não dependência técnica
import * as presencaController from '../controllers/presenca.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);
// Validate license for all routes (SUPER_ADMIN is exempt in middleware)
router.use(validateLicense);

// Listar presenças de uma aula lançada
router.get(
  '/presencas/aula/:aula_id',
  authorize('ADMIN', 'PROFESSOR', 'SECRETARIA', 'SUPER_ADMIN'),
  presencaController.getPresencasByAula
);

// Criar ou atualizar presenças em lote
// REGRA INSTITUCIONAL: Bloquear se ano letivo estiver ENCERRADO
// SECRETARIA: Removida - apenas consulta permitida
// PROFESSOR: Requer middleware resolveProfessor para garantir req.professor.id
router.post(
  '/presencas',
  authorize('ADMIN', 'PROFESSOR', 'SUPER_ADMIN'),
  resolveProfessor, // Resolver professor institucional (req.professor.id)
  validarProfessorAtivo, // Validar se professor está ativo no RH
  bloquearAnoLetivoEncerrado, // Bloquear mutations em ano letivo encerrado
  presencaController.createOrUpdatePresencas
);

// Buscar frequência de um aluno (método legado - mantido para compatibilidade)
router.get(
  '/frequencia/aluno',
  authorize('ADMIN', 'PROFESSOR', 'SECRETARIA', 'ALUNO', 'SUPER_ADMIN'),
  presencaController.getFrequenciaAluno
);

// Calcular frequência de um aluno em um Plano de Ensino (usando serviço dedicado)
router.get(
  '/frequencia/:planoEnsinoId/:alunoId',
  authorize('ADMIN', 'PROFESSOR', 'SECRETARIA', 'ALUNO', 'SUPER_ADMIN'),
  presencaController.calcularFrequenciaAlunoPlano
);

// Consolidar dados do Plano de Ensino (frequência + notas)
router.get(
  '/consolidar/:planoEnsinoId',
  authorize('ADMIN', 'COORDENADOR', 'PROFESSOR', 'SUPER_ADMIN'),
  presencaController.consolidarPlanoEnsinoEndpoint
);

export default router;

