import { Router } from 'express';
import * as funcionarioController from '../controllers/funcionario.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validateLicense } from '../middlewares/license.middleware.js';

const router = Router();

router.use(authenticate);
// Validate license for all routes (SUPER_ADMIN is exempt in middleware)
router.use(validateLicense);

// Listar/ver funcionários: ADMIN, SECRETARIA, RH, DIRECAO, COORDENADOR (RBAC)
router.get('/', authorize('ADMIN', 'SECRETARIA', 'RH', 'DIRECAO', 'COORDENADOR', 'SUPER_ADMIN'), funcionarioController.getAll);
router.get('/:id', authorize('ADMIN', 'SECRETARIA', 'RH', 'DIRECAO', 'COORDENADOR', 'SUPER_ADMIN'), funcionarioController.getById);
router.post('/', authorize('ADMIN', 'SUPER_ADMIN', 'RH'), funcionarioController.create);
router.post(
  '/with-account',
  authorize('ADMIN', 'SUPER_ADMIN', 'RH'),
  funcionarioController.createWithAccount
);
router.put('/:id', authorize('ADMIN', 'SUPER_ADMIN', 'RH'), funcionarioController.update);
router.delete('/:id', authorize('ADMIN', 'SUPER_ADMIN'), funcionarioController.remove);

export default router;
