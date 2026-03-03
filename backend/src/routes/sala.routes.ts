import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import * as salaController from '../controllers/sala.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', salaController.getSalas);
router.get('/:id', salaController.getSalaById);
router.post('/', authorize('ADMIN', 'SUPER_ADMIN', 'SECRETARIA'), salaController.createSala);
router.put('/:id', authorize('ADMIN', 'SUPER_ADMIN', 'SECRETARIA'), salaController.updateSala);
router.delete('/:id', authorize('ADMIN', 'SUPER_ADMIN'), salaController.deleteSala);

export default router;
