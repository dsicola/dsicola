import { Router } from 'express';
import multer from 'multer';
import * as configuracaoInstituicaoController from '../controllers/configuracaoInstituicao.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();
const uploadAssets = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 }, // 1MB por arquivo
}).fields([{ name: 'logo', maxCount: 1 }, { name: 'capa', maxCount: 1 }, { name: 'favicon', maxCount: 1 }]);

// NOTA: instituicaoId vem SEMPRE do token (requireTenantScope)
router.get('/', authenticate, configuracaoInstituicaoController.get);
router.put('/', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), configuracaoInstituicaoController.update);
// Upload logo/capa/favicon para o banco (sem volume/S3) - Railway, Vercel
router.post('/upload-assets', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), uploadAssets, configuracaoInstituicaoController.uploadAssets);
// Servir assets do banco - rota pública (login, favicon)
router.get('/assets/:tipo', configuracaoInstituicaoController.serveAsset);

export default router;
