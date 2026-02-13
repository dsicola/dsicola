import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validateLicense } from '../middlewares/license.middleware.js';
import { requireAcademicoContext, validateAcademicoFields } from '../middlewares/academico.middleware.js';
import * as trimestreController from '../controllers/trimestre.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);
// Validate license for all routes (SUPER_ADMIN is exempt in middleware)
router.use(validateLicense);
// Validar contexto acadêmico (tipoAcademico deve estar presente no JWT)
router.use(requireAcademicoContext);
// Validar campos acadêmicos (Trimestre só é válido para ENSINO_SECUNDARIO)
router.use(validateAcademicoFields);

// Listar trimestres
router.get('/', authorize('ADMIN', 'PROFESSOR', 'SECRETARIA', 'SUPER_ADMIN'), trimestreController.listTrimestres);

// Buscar trimestre por ano letivo e número (query params)
router.get('/buscar', authorize('ADMIN', 'PROFESSOR', 'SECRETARIA', 'SUPER_ADMIN'), trimestreController.getTrimestre);

// Buscar trimestre atual (mais recente) por ano letivo
router.get('/atual', authorize('ADMIN', 'PROFESSOR', 'SECRETARIA', 'SUPER_ADMIN'), trimestreController.getTrimestreAtual);

// Criar trimestre
router.post('/', authorize('ADMIN', 'DIRECAO', 'SUPER_ADMIN'), trimestreController.createTrimestre);

// Atualizar trimestre
router.put('/:id', authorize('ADMIN', 'DIRECAO', 'SUPER_ADMIN'), trimestreController.updateTrimestre);

// Ativar trimestre manualmente
router.post('/ativar', authorize('ADMIN', 'DIRECAO', 'SUPER_ADMIN'), trimestreController.ativarTrimestre);

export default router;

