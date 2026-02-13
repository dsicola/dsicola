import { Router } from 'express';
import * as horarioController from '../controllers/horario.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

// SECRETARIA: Pode consultar (apenas leitura)
router.get('/', authenticate, horarioController.getAll);
// SECRETARIA: Pode consultar (apenas leitura)
router.get('/:id', authenticate, horarioController.getById);
// SECRETARIA: Removida - apenas consulta permitida
router.post('/', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), horarioController.create);
// SECRETARIA: Removida - apenas consulta permitida
router.put('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), horarioController.update);
// SECRETARIA: Removida - apenas consulta permitida
router.delete('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), horarioController.remove);

export default router;
