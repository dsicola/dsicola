import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validateLicense } from '../middlewares/license.middleware.js';
import { requireInstitution } from '../middlewares/rbac.middleware.js';
import * as importacaoEstudantesController from '../controllers/importacaoEstudantes.controller.js';

/** Evita abuso de importações em massa (por IP). */
const importacaoEstudantesLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Muitas importações neste intervalo. Aguarde alguns minutos e tente novamente.' },
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      /\.xlsx?$/i.test(file.originalname || '');
    if (ok) cb(null, true);
    else cb(new Error('Use um ficheiro Excel (.xlsx ou .xls).'));
  },
});

const router = Router();

router.use(authenticate);
router.use(validateLicense);
router.use(requireInstitution);

router.post(
  '/estudantes/simples',
  importacaoEstudantesLimiter,
  authorize('ADMIN', 'SECRETARIA', 'DIRECAO', 'COORDENADOR', 'SUPER_ADMIN'),
  upload.single('file'),
  importacaoEstudantesController.previewImportacaoEstudantes
);

router.post(
  '/estudantes/confirmar',
  importacaoEstudantesLimiter,
  authorize('ADMIN', 'SECRETARIA', 'DIRECAO', 'COORDENADOR', 'SUPER_ADMIN'),
  importacaoEstudantesController.confirmarImportacaoEstudantes
);

export default router;
