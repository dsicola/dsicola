import { Router } from 'express';
import * as fornecedorController from '../controllers/fornecedor.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validateLicense } from '../middlewares/license.middleware.js';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);
router.use(validateLicense);

// Listar fornecedores (ADMIN, SUPER_ADMIN, RH, FINANCEIRO - RBAC FORNECEDORES)
router.get('/', authorize('ADMIN', 'SUPER_ADMIN', 'RH', 'FINANCEIRO'), fornecedorController.list);

// Obter fornecedor por ID
router.get('/:id', authorize('ADMIN', 'SUPER_ADMIN', 'RH', 'FINANCEIRO'), fornecedorController.getById);

// Criar fornecedor (ADMIN, RH)
router.post('/', authorize('ADMIN', 'RH'), fornecedorController.create);

// Atualizar fornecedor (ADMIN, RH)
router.put('/:id', authorize('ADMIN', 'RH'), fornecedorController.update);

// Deletar fornecedor (ADMIN apenas)
router.delete('/:id', authorize('ADMIN'), fornecedorController.remove);

export default router;

