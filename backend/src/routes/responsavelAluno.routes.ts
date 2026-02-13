import { Router } from 'express';
import * as responsavelAlunoController from '../controllers/responsavelAluno.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

router.get('/', authenticate, responsavelAlunoController.getAll);
router.get('/responsavel/:responsavelId', authenticate, responsavelAlunoController.getAlunosVinculados);
router.post('/', authenticate, authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), responsavelAlunoController.create);
router.put('/:id', authenticate, authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), responsavelAlunoController.update);
router.delete('/:id', authenticate, authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), responsavelAlunoController.remove);

export default router;
