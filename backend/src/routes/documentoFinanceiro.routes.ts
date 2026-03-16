/**
 * Rotas para DocumentoFinanceiro (PF, GR, NC, FT baseada em PF)
 * Conformidade AGT - emissão de documentos fiscais
 */

import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { requireInstitution } from '../middlewares/rbac.middleware.js';
import * as documentoFinanceiroController from '../controllers/documentoFinanceiro.controller.js';

const router = Router();

router.use(authenticate);
router.use(requireInstitution);

// Listar documentos (FT, PF, GR, NC)
router.get(
  '/',
  authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN', 'FINANCEIRO'),
  documentoFinanceiroController.listar
);

// Criar Pró-forma
router.post(
  '/proforma',
  authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN', 'FINANCEIRO'),
  documentoFinanceiroController.criarProformaAction
);

// Criar Guia de Remessa
router.post(
  '/guia-remessa',
  authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN', 'FINANCEIRO'),
  documentoFinanceiroController.criarGuiaRemessaAction
);

// Gerar Fatura a partir de Pró-forma
router.post(
  '/fatura-de-proforma',
  authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN', 'FINANCEIRO'),
  documentoFinanceiroController.criarFaturaDeProformaAction
);

// Criar Nota de Crédito
router.post(
  '/nota-credito',
  authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN', 'FINANCEIRO'),
  documentoFinanceiroController.criarNotaCreditoAction
);

// Rotas com :id (/:id/pdf antes de /:id para não capturar "pdf" como id)
router.get(
  '/:id/pdf',
  authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN', 'FINANCEIRO'),
  documentoFinanceiroController.downloadPdf
);
router.get(
  '/:id',
  authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN', 'FINANCEIRO'),
  documentoFinanceiroController.getById
);
router.post(
  '/:id/anular',
  authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN', 'FINANCEIRO'),
  documentoFinanceiroController.anularDocumentoFinanceiroAction
);

export default router;
