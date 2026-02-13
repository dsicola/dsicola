import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { requireInstitution } from '../middlewares/rbac.middleware.js';
import { validateLicense } from '../middlewares/license.middleware.js';
import * as anoLetivoController from '../controllers/anoLetivo.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);
// Validate license for all routes (SUPER_ADMIN is exempt in middleware)
router.use(validateLicense);
// Require instituicaoId (professor sem no JWT: preenche de professores.instituicaoId)
router.use(requireInstitution);

// Listar anos letivos
router.get('/', authorize('ADMIN', 'PROFESSOR', 'SECRETARIA', 'POS', 'SUPER_ADMIN'), anoLetivoController.listAnosLetivos);

// Buscar ano letivo por ano
router.get('/buscar', authorize('ADMIN', 'PROFESSOR', 'SECRETARIA', 'POS', 'SUPER_ADMIN'), anoLetivoController.getAnoLetivo);

// Buscar ano letivo ativo (POS precisa para exibir no header do dashboard)
router.get('/ativo', authorize('ADMIN', 'PROFESSOR', 'SECRETARIA', 'POS', 'SUPER_ADMIN'), anoLetivoController.getAnoLetivoAtivo);

// Verificar se ano letivo está encerrado (endpoint para frontend)
router.get('/verificar-encerrado', authorize('ADMIN', 'PROFESSOR', 'SECRETARIA', 'ALUNO', 'POS', 'SUPER_ADMIN'), anoLetivoController.verificarAnoLetivoEncerradoEndpoint);

// Criar ano letivo
router.post('/', authorize('ADMIN', 'DIRECAO', 'SUPER_ADMIN'), anoLetivoController.createAnoLetivo);

// Atualizar ano letivo
router.put('/:id', authorize('ADMIN', 'DIRECAO', 'SUPER_ADMIN'), anoLetivoController.updateAnoLetivo);

// Ativar ano letivo
router.post('/ativar', authorize('ADMIN', 'DIRECAO', 'SUPER_ADMIN'), anoLetivoController.ativarAnoLetivo);

// Encerrar ano letivo
router.post('/encerrar', authorize('ADMIN', 'DIRECAO', 'SUPER_ADMIN'), anoLetivoController.encerrarAnoLetivo);

export default router;

