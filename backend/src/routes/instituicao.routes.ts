import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import * as instituicaoController from '../controllers/instituicao.controller.js';

const router = Router();

// Public routes
router.get('/subdominio/:subdominio', instituicaoController.getInstituicaoBySubdominio);
router.get('/subdominio/:subdominio/opcoes-inscricao', instituicaoController.getOpcoesInscricao);

// Protected routes
router.use(authenticate);

// Listar: ADMIN vê a própria; SUPER_ADMIN e COMERCIAL veem todas
router.get('/', authorize('ADMIN', 'SUPER_ADMIN', 'COMERCIAL'), instituicaoController.getInstituicoes);

// Get current user's institution (using JWT token)
// Qualquer usuário autenticado pode ver sua própria instituição
// IMPORTANTE: Esta rota deve vir antes de /:id para evitar conflitos
router.get('/me', instituicaoController.getInstituicaoMe);

// Get institution by ID
// ADMIN vê a própria; SUPER_ADMIN e COMERCIAL veem qualquer (validação no controller)
router.get('/:id', instituicaoController.getInstituicaoById);

// Criar instituição (via onboarding normalmente; esta rota alternativa)
router.post('/', authorize('SUPER_ADMIN', 'COMERCIAL'), instituicaoController.createInstituicao);

// Atualizar instituição (ADMIN da instituição, SUPER_ADMIN ou COMERCIAL)
router.put('/:id', authorize('ADMIN', 'SUPER_ADMIN', 'COMERCIAL'), instituicaoController.updateInstituicao);

// Toggle 2FA (apenas ADMIN da instituição ou SUPER_ADMIN - COMERCIAL não altera 2FA)
router.put('/:id/two-factor', authorize('ADMIN', 'SUPER_ADMIN'), instituicaoController.toggleTwoFactor);

// Excluir instituição (apenas SUPER_ADMIN - operação irreversível)
router.delete('/:id', authorize('SUPER_ADMIN'), instituicaoController.deleteInstituicao);

export default router;
