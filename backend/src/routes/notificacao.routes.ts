import { Router } from 'express';
import * as notificacaoController from '../controllers/notificacao.controller.js';
import { authenticate } from '../middlewares/auth.js';

const router = Router();

router.get('/', authenticate, notificacaoController.getAll);
router.get('/:id', authenticate, notificacaoController.getById);
router.patch('/:id/ler', authenticate, notificacaoController.marcarComoLida);
router.post('/', authenticate, notificacaoController.create);
router.put('/:id', authenticate, notificacaoController.update);
router.put('/marcar-lidas/:userId', authenticate, notificacaoController.marcarTodasLidas);
router.delete('/:id', authenticate, notificacaoController.remove);

export default router;
