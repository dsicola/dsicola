import { Router } from 'express';
import * as pautaController from '../controllers/pauta.controller.js';
import { authenticate } from '../middlewares/auth.js';

const router = Router();

router.get('/notas', authenticate, pautaController.getNotas);
router.get('/frequencias', authenticate, pautaController.getFrequencias);
router.get('/boletim/:alunoId', authenticate, pautaController.getBoletim);

export default router;
