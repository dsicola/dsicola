import { Router } from 'express';
import * as alunoDisciplinaController from '../controllers/alunoDisciplina.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';
// requireAnoLetivoAtivo removido - Ano Letivo é contexto, não dependência técnica

const router = Router();

router.get('/', authenticate, alunoDisciplinaController.getAll);
// REGRA MESTRA: Ano Letivo é CONTEXTO, não dependência técnica - não bloquear CRUD
router.post('/', authenticate, authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), alunoDisciplinaController.create);
router.post('/bulk', authenticate, authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), alunoDisciplinaController.createBulk);
router.put('/:id', authenticate, authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), alunoDisciplinaController.update);
router.delete('/:id', authenticate, authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), alunoDisciplinaController.remove);

export default router;
