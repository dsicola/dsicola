import { Router } from 'express';
import * as exameController from '../controllers/exame.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { resolveProfessor } from '../middlewares/resolveProfessor.middleware.js';

const router = Router();

// SECRETARIA: Pode consultar (apenas leitura)
router.get('/', authenticate, exameController.getAll);
// SECRETARIA: Pode consultar (apenas leitura)
router.get('/:id', authenticate, exameController.getById);
// SECRETARIA: Removida - apenas consulta permitida
// PROFESSOR: Requer middleware resolveProfessor para garantir req.professor.id
router.post('/', authenticate, authorize('ADMIN', 'PROFESSOR', 'SUPER_ADMIN'), resolveProfessor, exameController.create);
// SECRETARIA: Removida - apenas consulta permitida
// PROFESSOR: Requer middleware resolveProfessor para garantir req.professor.id
router.put('/:id', authenticate, authorize('ADMIN', 'PROFESSOR', 'SUPER_ADMIN'), resolveProfessor, exameController.update);
// SECRETARIA: Removida - apenas consulta permitida
router.delete('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), exameController.remove);

export default router;
