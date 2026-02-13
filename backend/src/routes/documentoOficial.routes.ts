/**
 * Rotas de Documentos Oficiais - Padrão SIGAE
 *
 * POST /documentos/emitir - Emitir documento (ADMIN/SECRETARIA)
 * POST /documentos/emitir-json - Emitir e retornar JSON (para UI)
 * GET /documentos/pre-validar - Pré-validar emissão (ADMIN/SECRETARIA)
 * GET /documentos - Listar documentos (tenant)
 * GET /documentos/verificar - Verificar código (PÚBLICO)
 * GET /documentos/:id - Obter documento por ID (tenant)
 * GET /documentos/:id/pdf - Download PDF (tenant)
 * POST /documentos/:id/anular - Anular documento (ADMIN/SECRETARIA)
 */

import { Router } from 'express';
import * as documentoOficialController from '../controllers/documentoOficial.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

// Verificação pública - SEM autenticação
router.get('/verificar', documentoOficialController.verificar);

// Rotas autenticadas
router.use(authenticate);

// Emissão: ADMIN e SECRETARIA (professor NÃO emite)
router.post('/emitir', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), documentoOficialController.emitir);
router.post('/emitir-json', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), documentoOficialController.emitirJson);
router.get('/pre-validar', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), documentoOficialController.preValidar);

// Listagem e consulta (SECRETARIA emite, ADMIN gestão)
router.get('/', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), documentoOficialController.listar);
router.get('/:id', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), documentoOficialController.getById);
router.get('/:id/pdf', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), documentoOficialController.downloadPdf);

// Anulação: ADMIN e SECRETARIA
router.post('/:id/anular', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), documentoOficialController.anular);

export default router;
