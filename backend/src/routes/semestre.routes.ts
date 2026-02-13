import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validateLicense } from '../middlewares/license.middleware.js';
import { requireAcademicoContext, validateAcademicoFields } from '../middlewares/academico.middleware.js';
import * as semestreController from '../controllers/semestre.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);
// Validate license for all routes (SUPER_ADMIN is exempt in middleware)
router.use(validateLicense);
// Validar contexto acadêmico (tipoAcademico deve estar presente no JWT)
router.use(requireAcademicoContext);
// Validar campos acadêmicos (Semestre só é válido para ENSINO_SUPERIOR)
router.use(validateAcademicoFields);

// Listar semestres
router.get('/', authorize('ADMIN', 'PROFESSOR', 'SECRETARIA', 'SUPER_ADMIN'), semestreController.listSemestres);

// Buscar semestre por ano letivo e número (query params)
router.get('/buscar', authorize('ADMIN', 'PROFESSOR', 'SECRETARIA', 'SUPER_ADMIN'), semestreController.getSemestre);

// Buscar semestre atual (mais recente) por ano letivo
router.get('/atual', authorize('ADMIN', 'PROFESSOR', 'SECRETARIA', 'SUPER_ADMIN'), semestreController.getSemestreAtual);

// Criar semestre
router.post('/', authorize('ADMIN', 'DIRECAO', 'SUPER_ADMIN'), semestreController.createSemestre);

// Atualizar semestre
router.put('/:id', authorize('ADMIN', 'DIRECAO', 'SUPER_ADMIN'), semestreController.updateSemestre);

// Ativar semestre manualmente
router.post('/ativar', authorize('ADMIN', 'DIRECAO', 'SUPER_ADMIN'), semestreController.ativarSemestre);

export default router;

