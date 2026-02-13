import { Router } from 'express';
import * as videoAulaController from '../controllers/videoAula.controller.js';
import * as videoAulaProgressoController from '../controllers/videoAulaProgresso.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

// Listar todas as videoaulas (apenas SUPER_ADMIN, sem filtros) - deve vir antes de '/'
router.get('/admin', authenticate, authorize('SUPER_ADMIN'), videoAulaController.getAllAdmin);

// Listar videoaulas (público para usuários autenticados, com filtros automáticos)
router.get('/', authenticate, videoAulaController.getAll);

// Obter progresso de videoaulas do usuário (deve vir antes de /:id)
router.get('/progresso', authenticate, videoAulaProgressoController.getProgress);

// Obter signed URL para vídeo tipo UPLOAD (deve vir antes de /:id)
router.get('/:id/signed-url', authenticate, videoAulaController.getVideoSignedUrl);

// Atualizar progresso de uma videoaula (deve vir antes de /:id para evitar conflito)
router.post('/:id/progresso', authenticate, videoAulaProgressoController.updateProgress);

// Obter videoaula por ID (público para usuários autenticados)
router.get('/:id', authenticate, videoAulaController.getById);

// Criar videoaula (apenas SUPER_ADMIN)
router.post('/', authenticate, authorize('SUPER_ADMIN'), videoAulaController.create);

// Atualizar videoaula (apenas SUPER_ADMIN)
router.put('/:id', authenticate, authorize('SUPER_ADMIN'), videoAulaController.update);

// Deletar videoaula (apenas SUPER_ADMIN)
router.delete('/:id', authenticate, authorize('SUPER_ADMIN'), videoAulaController.remove);

export default router;
