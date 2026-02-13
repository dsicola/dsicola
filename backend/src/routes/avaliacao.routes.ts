import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validateLicense } from '../middlewares/license.middleware.js';
import { bloquearAnoLetivoEncerrado } from '../middlewares/bloquearAnoLetivoEncerrado.middleware.js';
import { resolveProfessor, resolveProfessorOptional } from '../middlewares/resolveProfessor.middleware.js';
// requireAnoLetivoAtivo removido - Ano Letivo é contexto, não dependência técnica
import * as avaliacaoController from '../controllers/avaliacao.controller.js';

const router = Router();

router.use(authenticate);
// Validate license for all routes (SUPER_ADMIN is exempt in middleware)
router.use(validateLicense);

// Criar avaliação
// REGRA INSTITUCIONAL: Bloquear se ano letivo estiver ENCERRADO
// SECRETARIA: Removida - apenas consulta permitida
// PROFESSOR: Requer middleware resolveProfessor para garantir req.professor.id
router.post(
  '/',
  authorize('ADMIN', 'PROFESSOR', 'SUPER_ADMIN'),
  resolveProfessor, // Resolver professor institucional (req.professor.id) - OBRIGATÓRIO
  bloquearAnoLetivoEncerrado, // Bloquear mutations em ano letivo encerrado
  avaliacaoController.createAvaliacao
);

// Listar avaliações (pode filtrar por turmaId, planoEnsinoId)
// PROFESSOR: resolveProfessorOptional para filtrar por req.professor.id
router.get(
  '/',
  authorize('ADMIN', 'SECRETARIA', 'PROFESSOR', 'SUPER_ADMIN'),
  resolveProfessorOptional, // Professor: anexa req.professor para filtrar apenas suas avaliações
  avaliacaoController.getAvaliacoes
);

// Listar avaliações por turma
// GET /avaliacoes/turma/:turmaId
router.get(
  '/turma/:turmaId',
  authorize('ADMIN', 'SECRETARIA', 'PROFESSOR', 'SUPER_ADMIN'),
  resolveProfessorOptional,
  avaliacaoController.getAvaliacoes
);

// Buscar avaliação por ID
// SECRETARIA: Pode consultar (apenas leitura)
router.get(
  '/:id',
  authorize('ADMIN', 'SECRETARIA', 'PROFESSOR', 'SUPER_ADMIN'),
  avaliacaoController.getAvaliacaoById
);

// Atualizar avaliação
// REGRA INSTITUCIONAL: Bloquear se ano letivo estiver ENCERRADO
// SECRETARIA: Removida - apenas consulta permitida
// PROFESSOR: Requer middleware resolveProfessor para garantir req.professor.id
router.put(
  '/:id',
  authorize('ADMIN', 'PROFESSOR', 'SUPER_ADMIN'),
  resolveProfessor, // Resolver professor institucional (req.professor.id) - OBRIGATÓRIO
  bloquearAnoLetivoEncerrado, // Bloquear mutations em ano letivo encerrado
  avaliacaoController.updateAvaliacao
);

// Fechar avaliação (apenas ADMIN)
// REGRA INSTITUCIONAL: Bloquear se ano letivo estiver ENCERRADO
router.post(
  '/:id/fechar',
  authorize('ADMIN', 'SUPER_ADMIN'),
  bloquearAnoLetivoEncerrado, // Bloquear mutations em ano letivo encerrado
  avaliacaoController.fecharAvaliacao
);

// Deletar avaliação
// REGRA INSTITUCIONAL: Bloquear se ano letivo estiver ENCERRADO
router.delete(
  '/:id',
  authorize('ADMIN', 'SUPER_ADMIN'),
  bloquearAnoLetivoEncerrado, // Bloquear mutations em ano letivo encerrado
  avaliacaoController.deleteAvaliacao
);

export default router;

