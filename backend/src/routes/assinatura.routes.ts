import { Router } from 'express';
import * as assinaturaController from '../controllers/assinatura.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';
// Note: Assinatura routes do NOT use validateLicense middleware
// because SUPER_ADMIN needs to manage licenses, and institutions
// need to check their own license status

const router = Router();

router.get('/', authenticate, assinaturaController.getAll);
router.get('/:id', authenticate, assinaturaController.getById);
// Assinatura da instituição do token (usuários com instituição)
router.get('/instituicao/current', authenticate, assinaturaController.getByInstituicao);
// SUPER_ADMIN e COMERCIAL podem consultar assinatura por instituicaoId
router.get('/instituicao/:instituicaoId', authenticate, authorize('SUPER_ADMIN', 'COMERCIAL'), assinaturaController.getByInstituicao);
router.post('/', authenticate, authorize('SUPER_ADMIN', 'COMERCIAL'), assinaturaController.create);
router.put('/:id', authenticate, authorize('SUPER_ADMIN', 'COMERCIAL'), assinaturaController.update);
router.delete('/:id', authenticate, authorize('SUPER_ADMIN'), assinaturaController.remove); // Exclusão apenas SUPER_ADMIN

export default router;
