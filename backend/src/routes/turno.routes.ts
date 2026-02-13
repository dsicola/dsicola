import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import * as turnoController from '../controllers/turno.controller.js';

const router = Router();

router.use(authenticate);

// SECRETARIA: Pode consultar (apenas leitura)
router.get('/', turnoController.getTurnos);
// SECRETARIA: Pode consultar (apenas leitura)
router.get('/:id', turnoController.getTurnoById);
// SECRETARIA: Removida - apenas consulta permitida
router.post('/', authorize('ADMIN', 'SUPER_ADMIN'), turnoController.createTurno);
// SECRETARIA: Removida - apenas consulta permitida
router.put('/:id', authorize('ADMIN', 'SUPER_ADMIN'), turnoController.updateTurno);
router.delete('/:id', authorize('ADMIN', 'SUPER_ADMIN'), turnoController.deleteTurno);

export default router;
