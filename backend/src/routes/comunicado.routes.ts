import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { resolveProfessorOptional } from '../middlewares/resolveProfessor.middleware.js';
import { validateLicense } from '../middlewares/license.middleware.js';
import { enforceTenant } from '../middlewares/auth.js';
import { comunicadoUpload } from '../middlewares/comunicadoUpload.middleware.js';
import * as comunicadoController from '../controllers/comunicado.controller.js';

const router = Router();

router.use(authenticate);
router.use(validateLicense);
router.use(enforceTenant);

router.post('/upload', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN', 'PROFESSOR'), comunicadoUpload.single('file'), comunicadoController.uploadComunicadoAnexo);
router.get('/', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), comunicadoController.getComunicados);
router.get('/publicos', comunicadoController.getComunicadosPublicos);
router.get('/:id/anexo/:filename', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN', 'PROFESSOR', 'ALUNO', 'POS'), comunicadoController.downloadComunicadoAnexo);
router.get('/:id', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN', 'PROFESSOR', 'ALUNO', 'POS'), comunicadoController.getComunicadoById);
router.post('/', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN', 'PROFESSOR'), resolveProfessorOptional, comunicadoController.createComunicado);
router.put('/:id', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), comunicadoController.updateComunicado);
router.delete('/:id', authorize('ADMIN', 'SUPER_ADMIN'), comunicadoController.deleteComunicado);
router.post('/:id/marcar-lido', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN', 'PROFESSOR', 'ALUNO', 'POS'), comunicadoController.markComunicadoAsRead);

export default router;
