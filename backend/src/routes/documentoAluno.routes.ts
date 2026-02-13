import { Router } from 'express';
import * as documentoAlunoController from '../controllers/documentoAluno.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

router.get('/', authenticate, documentoAlunoController.getAll);
// This route must come before /:id to avoid conflicts
router.get('/:id/arquivo/signed-url', authenticate, documentoAlunoController.getArquivoSignedUrl);
router.get('/:id/arquivo', authenticate, documentoAlunoController.getArquivo);
router.get('/:id', authenticate, documentoAlunoController.getById);
router.post('/', authenticate, authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), documentoAlunoController.create);
router.delete('/:id', authenticate, authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), documentoAlunoController.remove);

export default router;
