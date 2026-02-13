import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validateLicense } from '../middlewares/license.middleware.js';
import { requireConfiguracaoEnsino, requireInstitution } from '../middlewares/rbac.middleware.js';
import { resolveProfessorOptional } from '../middlewares/resolveProfessor.middleware.js';
import * as professorVinculoController from '../controllers/professorVinculo.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);
// Validate license for all routes (SUPER_ADMIN is exempt in middleware)
router.use(validateLicense);
// Garantir que usuário tem instituição (exceto SUPER_ADMIN)
router.use(requireInstitution);

// ============== GET /professores - ANTES de requireConfiguracaoEnsino ==============
// PROFESSOR precisa listar professores para Avaliações e Notas (vê apenas seu registro)
// ADMIN/SECRETARIA/etc listam todos
// REGRA SIGA/SIGAE: Retorna professores.id (tabela professores)
router.get('/', resolveProfessorOptional, authorize('ADMIN', 'COORDENADOR', 'SECRETARIA', 'DIRECAO', 'SUPER_ADMIN', 'PROFESSOR'), professorVinculoController.listarProfessores);

// Comprovativo — aceita professores.id (evita erro 400 ao usar professor.id do frontend)
router.get('/:professorId/comprovativo', authorize('ADMIN', 'COORDENADOR', 'SECRETARIA', 'DIRECAO', 'SUPER_ADMIN', 'PROFESSOR'), professorVinculoController.getComprovativo);

// RBAC: Bloquear SUPER_ADMIN e PROFESSOR das demais rotas (Configuração de Ensinos)
router.use(requireConfiguracaoEnsino);

// ============== VÍNCULOS PROFESSOR-CURSO ==============
// Vincular professor a curso
router.post('/:professorId/cursos', authorize('ADMIN'), professorVinculoController.vincularProfessorCurso);

// Listar cursos de um professor
router.get('/:professorId/cursos', authorize('ADMIN', 'COORDENADOR', 'SECRETARIA', 'DIRECAO', 'SUPER_ADMIN'), professorVinculoController.listarCursosProfessor);

// Desvincular professor de curso
router.delete('/:professorId/cursos/:cursoId', authorize('ADMIN'), professorVinculoController.desvincularProfessorCurso);

// ============== VÍNCULOS PROFESSOR-DISCIPLINA ==============
// Vincular professor a disciplina
router.post('/:professorId/disciplinas', authorize('ADMIN'), professorVinculoController.vincularProfessorDisciplina);

// Listar disciplinas de um professor
router.get('/:professorId/disciplinas', authorize('ADMIN', 'COORDENADOR', 'SECRETARIA', 'DIRECAO', 'SUPER_ADMIN'), professorVinculoController.listarDisciplinasProfessor);

// Desvincular professor de disciplina
router.delete('/:professorId/disciplinas/:disciplinaId', authorize('ADMIN'), professorVinculoController.desvincularProfessorDisciplina);

export default router;

