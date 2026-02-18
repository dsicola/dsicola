import { Router } from 'express';
import * as horarioController from '../controllers/horario.controller.js';
import * as horarioPrintController from '../controllers/horarioPrint.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

// Listagem com filtros e paginação (PROFESSOR: apenas próprios)
router.get('/', authenticate, horarioController.getAll);

// Rotas de impressão e grade (ANTES de /:id)
router.get(
  '/turma/:turmaId/imprimir',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN', 'SECRETARIA'),
  horarioPrintController.imprimirTurma
);
router.get(
  '/professor/:professorId/imprimir',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN', 'SECRETARIA', 'PROFESSOR'),
  horarioPrintController.imprimirProfessor
);
router.get(
  '/grade/turma/:turmaId',
  authenticate,
  horarioController.gradeTurma
);
router.get(
  '/grade/professor/:professorId',
  authenticate,
  horarioController.gradeProfessor
);
router.get(
  '/:id/imprimir',
  authenticate,
  horarioPrintController.imprimirPorId
);

router.get('/:id', authenticate, horarioController.getById);
router.post('/', authenticate, authorize('ADMIN', 'SUPER_ADMIN', 'SECRETARIA'), horarioController.create);
router.put('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN', 'SECRETARIA'), horarioController.update);
router.patch('/:id/aprovar', authenticate, authorize('ADMIN', 'SUPER_ADMIN', 'SECRETARIA'), horarioController.aprovar);
router.delete('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN', 'SECRETARIA'), horarioController.remove);

export default router;
