/**
 * Rotas de geração de documentos (DOCX, PDF).
 * POST /documents/generate-docx, generate-pdf-form, generate-pdf-coordinates, extract-docx-placeholders, preview-docx
 */
import { Router } from 'express';
import multer from 'multer';
import * as documentsController from '../controllers/documents.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();
const uploadDocx = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
}).single('file');

const uploadPdf = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
}).single('file');

router.post(
  '/generate-docx',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN', 'SECRETARIA', 'COORDENADOR', 'DIRECAO'),
  documentsController.generateDocx
);
router.post(
  '/generate-pdf-form',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN', 'SECRETARIA', 'COORDENADOR', 'DIRECAO'),
  documentsController.generatePdfForm
);
router.post(
  '/generate-pdf-coordinates',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN', 'SECRETARIA', 'COORDENADOR', 'DIRECAO'),
  documentsController.generatePdfCoordinates
);
router.get(
  '/modelo-certificado-blank',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  documentsController.getModeloCertificadoBlank
);
router.post(
  '/extract-docx-placeholders',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  documentsController.extractDocxPlaceholders
);
router.post(
  '/extract-docx-placeholders-upload',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  uploadDocx,
  documentsController.extractDocxPlaceholders
);
router.post(
  '/preview-docx',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN', 'SECRETARIA', 'COORDENADOR', 'DIRECAO'),
  documentsController.previewDocx
);
router.post(
  '/extract-pdf-fields',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  documentsController.extractPdfFields
);
router.post(
  '/extract-pdf-fields-upload',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  uploadPdf,
  documentsController.extractPdfFields
);

export default router;
