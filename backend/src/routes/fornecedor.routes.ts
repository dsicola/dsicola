import { Router } from 'express';
import * as fornecedorController from '../controllers/fornecedor.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validateLicense } from '../middlewares/license.middleware.js';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);
router.use(validateLicense);

// Listar fornecedores (ADMIN, SUPER_ADMIN)
router.get('/', authorize('ADMIN', 'SUPER_ADMIN'), fornecedorController.list);

// Obter fornecedor por ID (ADMIN, SUPER_ADMIN)
router.get('/:id', authorize('ADMIN', 'SUPER_ADMIN'), fornecedorController.getById);

// Criar fornecedor (apenas ADMIN)
// SUPER_ADMIN NÃO pode criar fornecedores (apenas auditar)
router.post('/', authorize('ADMIN'), fornecedorController.create);

// Atualizar fornecedor (apenas ADMIN)
// SUPER_ADMIN NÃO pode editar fornecedores (apenas auditar)
router.put('/:id', authorize('ADMIN'), fornecedorController.update);

// Deletar fornecedor (apenas ADMIN)
// SUPER_ADMIN NÃO pode deletar fornecedores (apenas auditar)
router.delete('/:id', authorize('ADMIN'), fornecedorController.remove);

export default router;

