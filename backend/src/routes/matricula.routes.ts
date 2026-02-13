import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validateLicense } from '../middlewares/license.middleware.js';
import { bloquearAnoLetivoEncerrado } from '../middlewares/bloquearAnoLetivoEncerrado.middleware.js';
import { requireAcademicoContext, validateAcademicoFields } from '../middlewares/academico.middleware.js';
import { resolveProfessor } from '../middlewares/resolveProfessor.middleware.js';
// requireAnoLetivoAtivo removido - Ano Letivo é contexto, não dependência técnica
import * as matriculaController from '../controllers/matricula.controller.js';

const router = Router();

router.use(authenticate);
// Validate license for all routes (SUPER_ADMIN is exempt in middleware)
router.use(validateLicense);
// Validate academic context for all academic routes
router.use(requireAcademicoContext);
// Validate academic fields according to institution type
router.use(validateAcademicoFields);

router.get('/', authorize('ADMIN', 'SECRETARIA', 'PROFESSOR', 'SUPER_ADMIN'), matriculaController.getMatriculas);
router.get('/aluno', authorize('ALUNO'), matriculaController.getMatriculasByAluno);
// IMPORTANTE: Rotas específicas devem vir ANTES das rotas com parâmetros dinâmicos
// PROFESSOR: Requer middleware resolveProfessor para garantir req.professor.id
router.get('/professor/turma/:turmaId/alunos', authorize('PROFESSOR'), resolveProfessor, matriculaController.getAlunosByTurmaProfessor);
router.get('/:id', authorize('ADMIN', 'SECRETARIA', 'PROFESSOR', 'ALUNO', 'SUPER_ADMIN'), matriculaController.getMatriculaById);
// REGRA INSTITUCIONAL: Bloquear se ano letivo estiver ENCERRADO
router.post('/', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), bloquearAnoLetivoEncerrado, matriculaController.createMatricula);
// REGRA INSTITUCIONAL: Bloquear se ano letivo estiver ENCERRADO
router.put('/:id', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), bloquearAnoLetivoEncerrado, matriculaController.updateMatricula);
// REGRA INSTITUCIONAL: Bloquear se ano letivo estiver ENCERRADO
router.delete('/:id', authorize('ADMIN', 'SUPER_ADMIN'), bloquearAnoLetivoEncerrado, matriculaController.deleteMatricula);

export default router;
