import { Router } from 'express';
import * as matriculaAnualController from '../controllers/matriculaAnual.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validateLicense } from '../middlewares/license.middleware.js';
import { bloquearAnoLetivoEncerrado } from '../middlewares/bloquearAnoLetivoEncerrado.middleware.js';
// requireAnoLetivoAtivo removido - Ano Letivo é contexto, não dependência técnica

const router = Router();

router.use(authenticate);
// Validate license for all routes (SUPER_ADMIN is exempt in middleware)
router.use(validateLicense);

router.get('/', matriculaAnualController.getAll);
// ALUNO: Pode consultar suas próprias matrículas anuais
// IMPORTANTE: Esta rota deve vir ANTES de /:id para não ser capturada como parâmetro
router.get('/meus-anos-letivos', authorize('ALUNO'), matriculaAnualController.getMeusAnosLetivos);
router.get('/sugestao/:alunoId', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), matriculaAnualController.getSugestaoClasse);
router.get('/aluno/:alunoId', matriculaAnualController.getByAluno);
router.get('/aluno/:alunoId/ativa', matriculaAnualController.getAtivaByAluno);
router.get('/:id', matriculaAnualController.getById);
// REGRA INSTITUCIONAL: Bloquear se ano letivo estiver ENCERRADO
router.post('/', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), bloquearAnoLetivoEncerrado, matriculaAnualController.create);
// REGRA INSTITUCIONAL: Bloquear se ano letivo estiver ENCERRADO
router.put('/:id', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), bloquearAnoLetivoEncerrado, matriculaAnualController.update);
// REGRA INSTITUCIONAL: Bloquear se ano letivo estiver ENCERRADO
// SECRETARIA: Removida - não pode apagar histórico acadêmico
router.delete('/:id', authorize('ADMIN', 'SUPER_ADMIN'), bloquearAnoLetivoEncerrado, matriculaAnualController.remove);

export default router;

