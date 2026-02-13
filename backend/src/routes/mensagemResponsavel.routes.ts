import { Router } from 'express';
import * as mensagemResponsavelController from '../controllers/mensagemResponsavel.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { resolveProfessor } from '../middlewares/resolveProfessor.middleware.js';

const router = Router();

router.get('/', authenticate, mensagemResponsavelController.getAll);
router.get('/:id', authenticate, mensagemResponsavelController.getById);
router.post('/', authenticate, mensagemResponsavelController.create);
// PROFESSOR: Requer middleware resolveProfessor para garantir req.professor.id
router.put('/:id/responder', authenticate, authorize('PROFESSOR', 'ADMIN', 'SUPER_ADMIN'), resolveProfessor, mensagemResponsavelController.responder);
router.put('/:id/marcar-lida', authenticate, mensagemResponsavelController.marcarLida);
router.delete('/:id', authenticate, mensagemResponsavelController.remove);

export default router;
