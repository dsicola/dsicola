/**
 * Rotas de Documentos Oficiais - Padrão SIGAE
 * Admin → emissão total; Secretaria → acadêmico parcial (sem certificado); Professor → só sua turma; Aluno → só consulta/baixa própria; Finanças → sem acesso.
 */

import { Router } from 'express';
import * as documentoOficialController from '../controllers/documentoOficial.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

// Verificação pública - SEM autenticação
router.get('/verificar', documentoOficialController.verificar);

// Rotas autenticadas
router.use(authenticate);

// Emissão: Admin total; Secretaria acadêmico (certificado só Admin); Professor só sua turma
router.post('/emitir', authorize('ADMIN', 'SECRETARIA', 'PROFESSOR', 'SUPER_ADMIN'), documentoOficialController.emitir);
router.post('/emitir-json', authorize('ADMIN', 'SECRETARIA', 'PROFESSOR', 'SUPER_ADMIN'), documentoOficialController.emitirJson);
router.get('/pre-validar', authorize('ADMIN', 'SECRETARIA', 'PROFESSOR', 'SUPER_ADMIN'), documentoOficialController.preValidar);

// Listagem/consulta/PDF: Admin/Secretaria todos; Professor só sua turma; Aluno só próprios
router.get('/', authorize('ADMIN', 'SECRETARIA', 'PROFESSOR', 'ALUNO', 'SUPER_ADMIN'), documentoOficialController.listar);
router.get('/:id', authorize('ADMIN', 'SECRETARIA', 'PROFESSOR', 'ALUNO', 'SUPER_ADMIN'), documentoOficialController.getById);
router.get('/:id/pdf', authorize('ADMIN', 'SECRETARIA', 'PROFESSOR', 'ALUNO', 'SUPER_ADMIN'), documentoOficialController.downloadPdf);

// Anulação: ADMIN e SECRETARIA
router.post('/:id/anular', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), documentoOficialController.anular);

export default router;
