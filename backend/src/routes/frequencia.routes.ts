import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import * as frequenciaController from '../controllers/frequencia.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', authorize('ADMIN', 'SECRETARIA', 'PROFESSOR', 'SUPER_ADMIN'), frequenciaController.getFrequencias);
router.get('/aluno', authorize('ALUNO'), frequenciaController.getFrequenciasByAluno);
router.get('/:id', frequenciaController.getFrequenciaById);
router.post('/', authorize('ADMIN', 'SECRETARIA', 'PROFESSOR', 'SUPER_ADMIN'), frequenciaController.createFrequencia);
router.post('/lote', authorize('ADMIN', 'SECRETARIA', 'PROFESSOR', 'SUPER_ADMIN'), frequenciaController.registrarFrequenciasEmLote);
router.put('/:id', authorize('ADMIN', 'SECRETARIA', 'PROFESSOR', 'SUPER_ADMIN'), frequenciaController.updateFrequencia);
router.delete('/:id', authorize('ADMIN', 'SUPER_ADMIN'), frequenciaController.deleteFrequencia);

export default router;
