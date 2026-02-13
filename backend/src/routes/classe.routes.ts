import { Router } from 'express';
import * as classeController from '../controllers/classe.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validateLicense } from '../middlewares/license.middleware.js';
import { requireConfiguracaoEnsino, requireInstitution } from '../middlewares/rbac.middleware.js';
import { requireAcademicoContext, validateAcademicoFields } from '../middlewares/academico.middleware.js';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);
// Validate license for all routes (SUPER_ADMIN is exempt in middleware)
router.use(validateLicense);
// RBAC: Bloquear SUPER_ADMIN e PROFESSOR de Configuração de Ensinos
router.use(requireConfiguracaoEnsino);
// Garantir que usuário tem instituição (exceto SUPER_ADMIN)
router.use(requireInstitution);
// Validar contexto acadêmico (tipoAcademico deve estar presente no JWT)
router.use(requireAcademicoContext);
// Validar campos acadêmicos (Classe só é válida para ENSINO_SECUNDARIO)
router.use(validateAcademicoFields);

// GET /classes - Listar classes (requer SECRETARIA ou superior)
router.get('/', authorize('ADMIN', 'SECRETARIA', 'DIRECAO', 'COORDENADOR'), classeController.getClasses);

// GET /classes/:id - Obter classe específica (requer SECRETARIA ou superior)
router.get('/:id', authorize('ADMIN', 'SECRETARIA', 'DIRECAO', 'COORDENADOR'), classeController.getClasseById);

// POST /classes - Criar classe (requer ADMIN)
router.post('/', authorize('ADMIN'), classeController.createClasse);

// PUT /classes/:id - Atualizar classe (requer ADMIN)
router.put('/:id', authorize('ADMIN'), classeController.updateClasse);

// DELETE /classes/:id - Remover classe (requer ADMIN)
router.delete('/:id', authorize('ADMIN'), classeController.deleteClasse);

export default router;

