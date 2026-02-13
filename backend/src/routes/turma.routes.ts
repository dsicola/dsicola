import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validateLicense } from '../middlewares/license.middleware.js';
import { requireConfiguracaoEnsino, requireInstitution, blockSuperAdminFromAcademic } from '../middlewares/rbac.middleware.js';
import { bloquearAnoLetivoEncerrado } from '../middlewares/bloquearAnoLetivoEncerrado.middleware.js';
import { requireAcademicoContext, validateAcademicoFields } from '../middlewares/academico.middleware.js';
import { resolveProfessor } from '../middlewares/resolveProfessor.middleware.js';
// requireAnoLetivoAtivo removido - Ano Letivo é contexto, não dependência técnica
import * as turmaController from '../controllers/turma.controller.js';

const router = Router();

router.use(authenticate);
// Validate license for all routes (SUPER_ADMIN is exempt in middleware)
router.use(validateLicense);

// Rota especial para professor ver suas turmas (não requer ConfiguracaoEnsino nem tipoAcademico)
// IMPORTANTE: Esta rota deve vir ANTES de requireAcademicoContext para não exigir tipoAcademico
// Professores precisam ver suas turmas mesmo se a instituição ainda não tiver tipoAcademico configurado
// REGRA ARQUITETURAL: Usar middleware resolveProfessor para garantir req.professor.id
router.get('/professor', authorize('PROFESSOR'), requireInstitution, resolveProfessor, turmaController.getTurmasByProfessor);

// Validate academic context for all academic routes (após a rota especial do professor)
router.use(requireAcademicoContext);
// Validate academic fields according to institution type
router.use(validateAcademicoFields);

// Demais rotas requerem Configuração de Ensinos
router.use(requireConfiguracaoEnsino);
router.use(requireInstitution);

// SECRETARIA: Pode consultar (apenas leitura)
router.get('/', authorize('ADMIN', 'COORDENADOR', 'SECRETARIA', 'DIRECAO', 'SUPER_ADMIN'), turmaController.getTurmas);
// SECRETARIA: Pode consultar (apenas leitura)
router.get('/:id', authorize('ADMIN', 'COORDENADOR', 'SECRETARIA', 'DIRECAO', 'SUPER_ADMIN'), turmaController.getTurmaById);
// REGRA INSTITUCIONAL: Bloquear se ano letivo estiver ENCERRADO
// SECRETARIA: Removida - apenas consulta permitida
router.post('/', authorize('ADMIN'), bloquearAnoLetivoEncerrado, turmaController.createTurma);
// REGRA INSTITUCIONAL: Bloquear se ano letivo estiver ENCERRADO
// SECRETARIA: Removida - apenas consulta permitida
router.put('/:id', authorize('ADMIN'), bloquearAnoLetivoEncerrado, turmaController.updateTurma);
// REGRA INSTITUCIONAL: Bloquear se ano letivo estiver ENCERRADO
router.delete('/:id', authorize('ADMIN'), bloquearAnoLetivoEncerrado, turmaController.deleteTurma);

export default router;
