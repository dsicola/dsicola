import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validateLicense } from '../middlewares/license.middleware.js';
import { requireInstitution } from '../middlewares/rbac.middleware.js';
import * as estruturaOrganizacionalController from '../controllers/estruturaOrganizacional.controller.js';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);
// Validate license for all routes (SUPER_ADMIN is exempt in middleware)
router.use(validateLicense);
// NOTA: requireInstitution removido temporariamente - validação feita no controller
// router.use(requireInstitution);

// GET /rh/estrutura-organizacional
// Permissões: 
// - SUPER_ADMIN: leitura global (mas não deve acessar - bloqueado por blockSuperAdminFromAcademic)
// - ADMIN: CRUD completo
// - DIRECAO, COORDENADOR: CRUD completo
// - SECRETARIA, RH: leitura (cadastro de funcionários, estrutura organizacional)
// - PROFESSOR, ALUNO: sem acesso (bloqueado)
router.get(
  '/',
  authorize('SUPER_ADMIN', 'ADMIN', 'SECRETARIA', 'DIRECAO', 'COORDENADOR', 'RH'),
  estruturaOrganizacionalController.getEstruturaOrganizacional
);

export default router;

