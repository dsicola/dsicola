import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validateLicense } from '../middlewares/license.middleware.js';
import { requireConfiguracaoEnsino, requireInstitution } from '../middlewares/rbac.middleware.js';
import { requireAcademicoContext } from '../middlewares/academico.middleware.js';
// requireAnoLetivoAtivo removido - Curso não depende de Ano Letivo
import * as cursoController from '../controllers/curso.controller.js';
import * as cursoDisciplinaController from '../controllers/cursoDisciplina.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);
// Validate license for all routes (SUPER_ADMIN is exempt in middleware)
router.use(validateLicense);
// RBAC: Bloquear SUPER_ADMIN e PROFESSOR de Configuração de Ensinos
router.use(requireConfiguracaoEnsino);
// Garantir que usuário tem instituição (exceto SUPER_ADMIN)
router.use(requireInstitution);
// Validar contexto acadêmico (tipoAcademico deve estar presente no JWT)
router.use(requireAcademicoContext);

// Get all cursos
// SECRETARIA: Pode consultar (apenas leitura)
router.get('/', cursoController.getCursos);

// Get curso by ID
// SECRETARIA: Pode consultar (apenas leitura)
router.get('/:id', cursoController.getCursoById);

// Create curso
// REGRA MESTRA: Curso NÃO depende de Ano Letivo - é uma entidade estrutural permanente
// SECRETARIA: Removida - apenas consulta permitida
router.post('/', authorize('ADMIN'), cursoController.createCurso);

// Update curso
// REGRA MESTRA: Curso NÃO depende de Ano Letivo - é uma entidade estrutural permanente
// SECRETARIA: Removida - apenas consulta permitida
router.put('/:id', authorize('ADMIN'), cursoController.updateCurso);

// Delete curso (apenas ADMIN)
router.delete('/:id', authorize('ADMIN'), cursoController.deleteCurso);

// ============== VÍNCULOS CURSO-DISCIPLINA ==============
// Vincular disciplina a curso
router.post('/:cursoId/disciplinas', authorize('ADMIN'), cursoDisciplinaController.vincularDisciplina);

// Listar disciplinas de um curso
router.get('/:cursoId/disciplinas', cursoDisciplinaController.listarDisciplinas);

// Desvincular disciplina de curso
router.delete('/:cursoId/disciplinas/:disciplinaId', authorize('ADMIN'), cursoDisciplinaController.desvincularDisciplina);

// ============== VÍNCULOS CURSO-PROFESSOR ==============
// Listar professores de um curso
import * as professorCursoController from '../controllers/professorCurso.controller.js';
router.get('/:cursoId/professores', professorCursoController.listarProfessoresCurso);

export default router;
