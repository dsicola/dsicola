import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validateLicense } from '../middlewares/license.middleware.js';
import * as equivalenciaController from '../controllers/equivalencia.controller.js';

const router = Router();

router.use(authenticate);
// Validate license for all routes (SUPER_ADMIN is exempt in middleware)
router.use(validateLicense);

// Criar solicitação de equivalência (ADMIN, SECRETARIA)
router.post(
  '/',
  authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'),
  equivalenciaController.createEquivalencia
);

// Listar equivalências (filtrado por instituição)
router.get(
  '/',
  authorize('ADMIN', 'SECRETARIA', 'PROFESSOR', 'SUPER_ADMIN'),
  equivalenciaController.getEquivalencias
);

// Listar equivalências de um aluno (ALUNO pode ver apenas as próprias)
router.get(
  '/aluno/:alunoId',
  authorize('ADMIN', 'SECRETARIA', 'PROFESSOR', 'ALUNO', 'SUPER_ADMIN'),
  equivalenciaController.getEquivalenciasByAluno
);

// Obter equivalência por ID
router.get(
  '/:id',
  authorize('ADMIN', 'SECRETARIA', 'PROFESSOR', 'ALUNO', 'SUPER_ADMIN'),
  equivalenciaController.getEquivalenciaById
);

// Atualizar equivalência (apenas se não deferida - ADMIN, SECRETARIA)
router.put(
  '/:id',
  authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'),
  equivalenciaController.updateEquivalencia
);

// Deferir equivalência (ADMIN apenas)
router.post(
  '/:id/deferir',
  authorize('ADMIN', 'SUPER_ADMIN'),
  equivalenciaController.deferirEquivalencia
);

// Indeferir equivalência (ADMIN apenas - apenas se não deferida)
router.post(
  '/:id/indeferir',
  authorize('ADMIN', 'SUPER_ADMIN'),
  equivalenciaController.indeferirEquivalencia
);

// Deletar equivalência (apenas se não deferida - ADMIN, SECRETARIA)
router.delete(
  '/:id',
  authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'),
  equivalenciaController.deleteEquivalencia
);

export default router;

