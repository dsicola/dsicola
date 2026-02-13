import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validateLicense } from '../middlewares/license.middleware.js';
import { validarProfessorAtivo } from '../middlewares/rh-status.middleware.js';
import { bloquearAnoLetivoEncerrado } from '../middlewares/bloquearAnoLetivoEncerrado.middleware.js';
import { resolveProfessor, resolveProfessorOptional } from '../middlewares/resolveProfessor.middleware.js';
// requireAnoLetivoAtivo removido - Ano Letivo é contexto, não dependência técnica
import * as aulasLancadasController from '../controllers/aulasLancadas.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);
// Validate license for all routes (SUPER_ADMIN is exempt in middleware)
router.use(validateLicense);

// Listar aulas planejadas (filtradas por contexto)
// SECRETARIA: Pode consultar (apenas leitura)
// PROFESSOR: resolveProfessor define req.professor.id para uso quando professorId não é enviado
router.get(
  '/aulas-planejadas',
  authorize('ADMIN', 'PROFESSOR', 'SECRETARIA', 'SUPER_ADMIN'),
  resolveProfessor,
  aulasLancadasController.getAulasPlanejadas
);

// Criar lançamento de aula
// REGRA INSTITUCIONAL: Bloquear se ano letivo estiver ENCERRADO
// SECRETARIA: Removida - apenas consulta permitida
// PROFESSOR: Requer middleware resolveProfessor para garantir req.professor.id
router.post(
  '/aulas-lancadas',
  authorize('ADMIN', 'PROFESSOR', 'SUPER_ADMIN'),
  resolveProfessor, // Resolver professor institucional (req.professor.id)
  validarProfessorAtivo, // Validar se professor está ativo no RH
  bloquearAnoLetivoEncerrado, // Bloquear mutations em ano letivo encerrado
  aulasLancadasController.createAulaLancada
);

// Listar aulas lançadas
// PROFESSOR: resolveProfessorOptional garante req.professor.id para filtrar apenas aulas do próprio plano
// ALUNO: Pode consultar (apenas leitura) - aulas das suas turmas
// SECRETARIA: Pode consultar (apenas leitura)
router.get(
  '/aulas-lancadas',
  authorize('ADMIN', 'PROFESSOR', 'SECRETARIA', 'ALUNO', 'SUPER_ADMIN'),
  resolveProfessorOptional,
  aulasLancadasController.getAulasLancadas
);

// Remover lançamento de aula
// REGRA INSTITUCIONAL: Bloquear se ano letivo estiver ENCERRADO
// SECRETARIA: Removida - apenas consulta permitida
// PROFESSOR: Requer middleware resolveProfessor para garantir req.professor.id
router.delete(
  '/aulas-lancadas/:lancamentoId',
  authorize('ADMIN', 'PROFESSOR', 'SUPER_ADMIN'),
  resolveProfessor, // Resolver professor institucional (req.professor.id)
  validarProfessorAtivo, // Validar se professor está ativo no RH
  bloquearAnoLetivoEncerrado, // Bloquear mutations em ano letivo encerrado
  aulasLancadasController.deleteAulaLancada
);

export default router;

