import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validateLicense } from '../middlewares/license.middleware.js';
import * as mensalidadeController from '../controllers/mensalidade.controller.js';

const router = Router();

router.use(authenticate);
// Validate license for all routes (SUPER_ADMIN is exempt in middleware)
router.use(validateLicense);

// GET /mensalidades - Listar mensalidades (POS pode visualizar para processar pagamentos)
router.get('/', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN', 'POS'), mensalidadeController.getMensalidades);
router.get('/aluno', authorize('ALUNO'), mensalidadeController.getMensalidadesByAluno);
router.get('/:id', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN', 'POS', 'ALUNO'), mensalidadeController.getMensalidadeById);
// POST /mensalidades - Criar mensalidades (apenas ADMIN/SECRETARIA)
router.post('/', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), mensalidadeController.createMensalidade);
router.post('/lote', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), mensalidadeController.gerarMensalidadesEmLote);
router.post('/gerar', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), mensalidadeController.gerarMensalidadesParaTodosAlunos);
router.post('/aplicar-multas', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), mensalidadeController.aplicarMultas);
// PUT /mensalidades/:id - Atualizar mensalidade (SECRETARIA pode atualizar para registrar pagamentos)
// POS: NÃO pode atualizar mensalidades (apenas registrar pagamentos e estornar)
router.put('/:id', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), mensalidadeController.updateMensalidade);
router.delete('/:id', authorize('ADMIN', 'SUPER_ADMIN'), mensalidadeController.deleteMensalidade);

export default router;
