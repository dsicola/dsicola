import { Router, type Request } from 'express';
import multer from 'multer';
import * as configuracaoInstituicaoController from '../controllers/configuracaoInstituicao.controller.js';
import * as modeloDocumentoController from '../controllers/modeloDocumento.controller.js';
import * as templateController from '../controllers/template.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();
const uploadAssets = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 }, // 1MB por arquivo
}).fields([
  { name: 'logo', maxCount: 1 },
  { name: 'capa', maxCount: 1 },
  { name: 'favicon', maxCount: 1 },
  { name: 'imagemFundoDocumento', maxCount: 1 },
  { name: 'carimboCertificadoSecundario', maxCount: 1 },
  { name: 'carimboCertificadoSuperior', maxCount: 1 },
]);

const landingPublicMime = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) cb(null, true);
  else cb(new Error('Apenas JPG, PNG ou WebP'));
};

const uploadLandingHeroPublic = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: landingPublicMime,
}).single('file');

const uploadLandingPublicExtraImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Math.floor(2.5 * 1024 * 1024) },
  fileFilter: landingPublicMime,
}).single('file');

const uploadPdf = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB para PDF
}).single('pdf');

const uploadDocx = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB para DOCX
}).single('file');

// NOTA: instituicaoId vem SEMPRE do token (requireTenantScope)
router.get('/', authenticate, authorize('ADMIN', 'SUPER_ADMIN', 'DIRECAO', 'COORDENADOR', 'SECRETARIA', 'POS', 'FINANCEIRO', 'RH', 'PROFESSOR', 'ALUNO', 'RESPONSAVEL'), configuracaoInstituicaoController.get);
router.put('/', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), configuracaoInstituicaoController.update);
router.post('/preview-documento', authenticate, authorize('ADMIN', 'SUPER_ADMIN', 'SECRETARIA', 'COORDENADOR', 'DIRECAO'), configuracaoInstituicaoController.previewDocumento);
router.post('/convert-pdf-to-html', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), uploadPdf, configuracaoInstituicaoController.convertPdfToHtml);
router.post('/preview-pauta', authenticate, authorize('ADMIN', 'SUPER_ADMIN', 'SECRETARIA', 'COORDENADOR', 'DIRECAO'), configuracaoInstituicaoController.previewPauta);
router.post('/preview-pauta-conclusao-saude', authenticate, authorize('ADMIN', 'SUPER_ADMIN', 'SECRETARIA', 'COORDENADOR', 'DIRECAO'), configuracaoInstituicaoController.previewPautaConclusaoSaude);
router.get('/pauta-conclusao-saude-dados', authenticate, authorize('ADMIN', 'SUPER_ADMIN', 'SECRETARIA', 'COORDENADOR', 'DIRECAO'), configuracaoInstituicaoController.getPautaConclusaoSaudeDados);
router.get('/pauta-conclusao-saude-export-excel', authenticate, authorize('ADMIN', 'SUPER_ADMIN', 'SECRETARIA', 'COORDENADOR', 'DIRECAO'), configuracaoInstituicaoController.getPautaConclusaoSaudeExcelExport);
// Modelos de documentos oficiais (importar modelos do governo)
router.get('/modelos-documento', authenticate, authorize('ADMIN', 'SUPER_ADMIN', 'SECRETARIA', 'COORDENADOR', 'DIRECAO'), modeloDocumentoController.listar);
router.get('/modelos-documento/placeholders', authenticate, authorize('ADMIN', 'SUPER_ADMIN', 'SECRETARIA', 'COORDENADOR', 'DIRECAO'), modeloDocumentoController.listarPlaceholders);
router.get('/modelos-documento/:id/placeholders', authenticate, authorize('ADMIN', 'SUPER_ADMIN', 'SECRETARIA', 'COORDENADOR', 'DIRECAO'), modeloDocumentoController.getModeloPlaceholders);
router.get('/modelos-documento/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN', 'SECRETARIA', 'COORDENADOR', 'DIRECAO'), modeloDocumentoController.obter);
router.post('/modelos-documento/extract-pdf-fields', authenticate, authorize('ADMIN', 'SUPER_ADMIN', 'SECRETARIA'), modeloDocumentoController.extractPdfFields);
router.post('/modelos-documento/extract-excel-placeholders', authenticate, authorize('ADMIN', 'SUPER_ADMIN', 'SECRETARIA'), modeloDocumentoController.extractExcelPlaceholders);
router.post('/modelos-documento/analyze-excel-template', authenticate, authorize('ADMIN', 'SUPER_ADMIN', 'SECRETARIA'), modeloDocumentoController.analyzeExcelTemplateController);
router.post('/modelos-documento/validate-cell-mapping', authenticate, authorize('ADMIN', 'SUPER_ADMIN', 'SECRETARIA'), modeloDocumentoController.validateCellMappingController);
router.post('/modelos-documento/preview-excel-cell-mapping', authenticate, authorize('ADMIN', 'SUPER_ADMIN', 'SECRETARIA', 'COORDENADOR', 'DIRECAO'), modeloDocumentoController.previewExcelCellMappingController);
router.post('/modelos-documento', authenticate, authorize('ADMIN', 'SUPER_ADMIN', 'SECRETARIA'), modeloDocumentoController.criar);
router.put('/modelos-documento/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN', 'SECRETARIA'), modeloDocumentoController.atualizar);
router.delete('/modelos-documento/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN', 'SECRETARIA'), modeloDocumentoController.remover);
// Templates dinâmicos (DOCX + mapeamento)
router.post('/templates/upload', authenticate, authorize('ADMIN', 'SUPER_ADMIN', 'SECRETARIA'), uploadDocx, templateController.uploadTemplate);
router.get('/templates/available-fields', authenticate, authorize('ADMIN', 'SUPER_ADMIN', 'SECRETARIA', 'COORDENADOR', 'DIRECAO'), templateController.getAvailableFields);
router.post('/modelos-documento/:id/mapping', authenticate, authorize('ADMIN', 'SUPER_ADMIN', 'SECRETARIA'), templateController.saveMapping);
router.post('/modelos-documento/:id/render', authenticate, authorize('ADMIN', 'SUPER_ADMIN', 'SECRETARIA', 'COORDENADOR', 'DIRECAO'), templateController.renderDocument);
// Upload logo/capa/favicon para o banco (sem volume/S3) - Railway, Vercel
router.post('/upload-assets', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), uploadAssets, configuracaoInstituicaoController.uploadAssets);
// Imagens do site público (hero / eventos): servir antes de /assets/:tipo
router.get('/landing-public-image/:imageId', configuracaoInstituicaoController.serveLandingPublicImage);
router.post(
  '/upload-landing-hero-public',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  uploadLandingHeroPublic,
  configuracaoInstituicaoController.uploadLandingHeroPublic
);
router.post(
  '/upload-landing-public-image',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  uploadLandingPublicExtraImage,
  configuracaoInstituicaoController.uploadLandingPublicExtraImage
);
// Servir assets do banco - rota pública (login, favicon)
router.get('/assets/:tipo', configuracaoInstituicaoController.serveAsset);

export default router;
