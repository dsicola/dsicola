import { Router } from 'express';
import multer from 'multer';
import * as configuracaoInstituicaoController from '../controllers/configuracaoInstituicao.controller.js';
import * as modeloDocumentoController from '../controllers/modeloDocumento.controller.js';
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
]);

// NOTA: instituicaoId vem SEMPRE do token (requireTenantScope)
router.get('/', authenticate, authorize('ADMIN', 'SUPER_ADMIN', 'DIRECAO', 'COORDENADOR', 'SECRETARIA', 'POS', 'FINANCEIRO', 'RH', 'PROFESSOR', 'ALUNO'), configuracaoInstituicaoController.get);
router.put('/', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), configuracaoInstituicaoController.update);
router.post('/preview-documento', authenticate, authorize('ADMIN', 'SUPER_ADMIN', 'SECRETARIA', 'COORDENADOR', 'DIRECAO'), configuracaoInstituicaoController.previewDocumento);
router.post('/preview-pauta', authenticate, authorize('ADMIN', 'SUPER_ADMIN', 'SECRETARIA', 'COORDENADOR', 'DIRECAO'), configuracaoInstituicaoController.previewPauta);
router.post('/preview-pauta-conclusao-saude', authenticate, authorize('ADMIN', 'SUPER_ADMIN', 'SECRETARIA', 'COORDENADOR', 'DIRECAO'), configuracaoInstituicaoController.previewPautaConclusaoSaude);
router.get('/pauta-conclusao-saude-dados', authenticate, authorize('ADMIN', 'SUPER_ADMIN', 'SECRETARIA', 'COORDENADOR', 'DIRECAO'), configuracaoInstituicaoController.getPautaConclusaoSaudeDados);
// Modelos de documentos oficiais (importar modelos do governo)
router.get('/modelos-documento', authenticate, authorize('ADMIN', 'SUPER_ADMIN', 'SECRETARIA', 'COORDENADOR', 'DIRECAO'), modeloDocumentoController.listar);
router.get('/modelos-documento/placeholders', authenticate, authorize('ADMIN', 'SUPER_ADMIN', 'SECRETARIA', 'COORDENADOR', 'DIRECAO'), modeloDocumentoController.listarPlaceholders);
router.post('/modelos-documento', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), modeloDocumentoController.criar);
router.put('/modelos-documento/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), modeloDocumentoController.atualizar);
router.delete('/modelos-documento/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), modeloDocumentoController.remover);
// Upload logo/capa/favicon para o banco (sem volume/S3) - Railway, Vercel
router.post('/upload-assets', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), uploadAssets, configuracaoInstituicaoController.uploadAssets);
// Servir assets do banco - rota pública (login, favicon)
router.get('/assets/:tipo', configuracaoInstituicaoController.serveAsset);

export default router;
