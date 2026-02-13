import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validateLicense } from '../middlewares/license.middleware.js';
import { requireConfiguracaoEnsino, requireInstitution } from '../middlewares/rbac.middleware.js';
import { requireAcademicoContext } from '../middlewares/academico.middleware.js';
// requireAnoLetivoAtivo removido - Disciplina não depende de Ano Letivo
import * as disciplinaController from '../controllers/disciplina.controller.js';

const router = Router();

router.use(authenticate);
// Validate license for all routes (SUPER_ADMIN is exempt in middleware)
router.use(validateLicense);
// RBAC: Bloquear SUPER_ADMIN e PROFESSOR de Configuração de Ensinos
router.use(requireConfiguracaoEnsino);
// Garantir que usuário tem instituição (exceto SUPER_ADMIN)
router.use(requireInstitution);
// Validar contexto acadêmico (tipoAcademico deve estar presente no JWT)
router.use(requireAcademicoContext);

// SECRETARIA: Pode consultar (apenas leitura)
router.get('/', disciplinaController.getDisciplinas);
// SECRETARIA: Pode consultar (apenas leitura)
router.get('/:id', disciplinaController.getDisciplinaById);
// REGRA MESTRA: Disciplina NÃO depende de Ano Letivo - é uma entidade estrutural permanente
// SECRETARIA: Removida - apenas consulta permitida
router.post('/', authorize('ADMIN'), disciplinaController.createDisciplina);
// REGRA MESTRA: Disciplina NÃO depende de Ano Letivo - é uma entidade estrutural permanente
// SECRETARIA: Removida - apenas consulta permitida
router.put('/:id', authorize('ADMIN'), disciplinaController.updateDisciplina);
router.delete('/:id', authorize('ADMIN'), disciplinaController.deleteDisciplina);

export default router;
