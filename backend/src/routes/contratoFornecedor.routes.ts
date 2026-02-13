import { Router } from 'express';
import * as contratoFornecedorController from '../controllers/contratoFornecedor.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validateLicense } from '../middlewares/license.middleware.js';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);
router.use(validateLicense);

// Listar contratos (ADMIN, SUPER_ADMIN)
router.get('/', authorize('ADMIN', 'SUPER_ADMIN'), contratoFornecedorController.list);

// Obter contrato por ID (ADMIN, SUPER_ADMIN)
router.get('/:id', authorize('ADMIN', 'SUPER_ADMIN'), contratoFornecedorController.getById);

// Criar contrato (apenas ADMIN)
router.post('/', authorize('ADMIN'), contratoFornecedorController.create);

// Atualizar contrato (apenas ADMIN)
router.put('/:id', authorize('ADMIN'), contratoFornecedorController.update);

export default router;

