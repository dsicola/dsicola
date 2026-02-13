import { Router } from 'express';
import * as assinaturaController from '../controllers/assinatura.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';
// Note: Assinatura routes do NOT use validateLicense middleware
// because SUPER_ADMIN needs to manage licenses, and institutions
// need to check their own license status

const router = Router();

router.get('/', authenticate, assinaturaController.getAll);
router.get('/:id', authenticate, assinaturaController.getById);
// Rota para obter assinatura da instituição do token (usuários normais)
router.get('/instituicao/current', authenticate, assinaturaController.getByInstituicao);
// Rota para SUPER_ADMIN especificar instituição (ação excepcional)
router.get('/instituicao/:instituicaoId', authenticate, authorize('SUPER_ADMIN'), assinaturaController.getByInstituicao);
router.post('/', authenticate, authorize('SUPER_ADMIN'), assinaturaController.create);
router.put('/:id', authenticate, authorize('SUPER_ADMIN'), assinaturaController.update); // Only SUPER_ADMIN can update
router.delete('/:id', authenticate, authorize('SUPER_ADMIN'), assinaturaController.remove);

export default router;
