import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import * as instituicaoController from '../controllers/instituicao.controller.js';

const router = Router();

// Public routes
router.get('/subdominio/:subdominio', instituicaoController.getInstituicaoBySubdominio);
router.get('/subdominio/:subdominio/opcoes-inscricao', instituicaoController.getOpcoesInscricao);

// Protected routes
router.use(authenticate);

// Get all institutions (SUPER_ADMIN) or own institution (ADMIN)
router.get('/', authorize('ADMIN', 'SUPER_ADMIN'), instituicaoController.getInstituicoes);

// Get current user's institution (using JWT token)
// Qualquer usuário autenticado pode ver sua própria instituição
// IMPORTANTE: Esta rota deve vir antes de /:id para evitar conflitos
router.get('/me', instituicaoController.getInstituicaoMe);

// Get institution by ID
// Qualquer usuário autenticado pode ver sua própria instituição
// ADMIN e SUPER_ADMIN podem ver qualquer instituição (validação no controller)
router.get('/:id', instituicaoController.getInstituicaoById);

// Create institution (SUPER_ADMIN only)
router.post('/', authorize('SUPER_ADMIN'), instituicaoController.createInstituicao);

// Update institution
router.put('/:id', authorize('ADMIN', 'SUPER_ADMIN'), instituicaoController.updateInstituicao);

// Toggle 2FA for institution (ADMIN of institution or SUPER_ADMIN)
router.put('/:id/two-factor', authorize('ADMIN', 'SUPER_ADMIN'), instituicaoController.toggleTwoFactor);

// Delete institution (SUPER_ADMIN only)
router.delete('/:id', authorize('SUPER_ADMIN'), instituicaoController.deleteInstituicao);

export default router;
