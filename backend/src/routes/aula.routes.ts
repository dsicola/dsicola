import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { requireAcademicoContext, validateAcademicoFields } from '../middlewares/academico.middleware.js';
import * as aulaController from '../controllers/aula.controller.js';

const router = Router();

router.use(authenticate);
// Validate academic context for all academic routes
router.use(requireAcademicoContext);
// Validate academic fields according to institution type
router.use(validateAcademicoFields);

router.get('/', authorize('ADMIN', 'SECRETARIA', 'PROFESSOR', 'SUPER_ADMIN'), aulaController.getAulas);
router.get('/:id', aulaController.getAulaById);
router.post('/', authorize('ADMIN', 'SECRETARIA', 'PROFESSOR', 'SUPER_ADMIN'), aulaController.createAula);
router.put('/:id', authorize('ADMIN', 'SECRETARIA', 'PROFESSOR', 'SUPER_ADMIN'), aulaController.updateAula);
router.delete('/:id', authorize('ADMIN', 'SUPER_ADMIN', 'PROFESSOR'), aulaController.deleteAula);

export default router;
