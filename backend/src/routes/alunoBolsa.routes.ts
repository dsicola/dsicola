import { Router } from 'express';
import * as alunoBolsaController from '../controllers/alunoBolsa.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

router.get('/', authenticate, alunoBolsaController.getAll);
router.get('/:id', authenticate, alunoBolsaController.getById);
router.post('/', authenticate, authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), alunoBolsaController.create);
router.put('/:id', authenticate, authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), alunoBolsaController.update);
router.delete('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), alunoBolsaController.remove);

export default router;
