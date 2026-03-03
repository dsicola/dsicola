import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validateLicense } from '../middlewares/license.middleware.js';
import { uploadBiblioteca } from '../middlewares/upload.middleware.js';
import * as bibliotecaController from '../controllers/biblioteca.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);
// Validate license for all routes (SUPER_ADMIN is exempt in middleware)
router.use(validateLicense);

// Listar itens da biblioteca (consulta)
router.get('/itens', authorize('ADMIN', 'PROFESSOR', 'ALUNO', 'SECRETARIA', 'SUPER_ADMIN'), bibliotecaController.getItens);

// Criar item (ADMIN/SECRETARIA)
router.post(
  '/itens',
  authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'),
  uploadBiblioteca.fields([{ name: 'arquivo', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]),
  bibliotecaController.createItem
);

// Download/visualização de arquivo (deve vir antes de /itens/:id)
router.get('/itens/:id/download', authorize('ADMIN', 'PROFESSOR', 'ALUNO', 'SECRETARIA', 'SUPER_ADMIN'), bibliotecaController.downloadItem);

// Obter item por ID
router.get('/itens/:id', authorize('ADMIN', 'PROFESSOR', 'ALUNO', 'SECRETARIA', 'SUPER_ADMIN'), bibliotecaController.getItemById);

// Atualizar item (ADMIN/SECRETARIA)
router.put(
  '/itens/:id',
  authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'),
  uploadBiblioteca.fields([{ name: 'arquivo', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]),
  bibliotecaController.updateItem
);

// Excluir item (ADMIN/SECRETARIA)
router.delete('/itens/:id', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), bibliotecaController.deleteItem);

// Listar meus empréstimos
router.get('/meus-emprestimos', authorize('ADMIN', 'PROFESSOR', 'ALUNO', 'SUPER_ADMIN'), bibliotecaController.getMeusEmprestimos);

// Listar todos os empréstimos (ADMIN/SECRETARIA)
router.get('/emprestimos', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), bibliotecaController.getEmprestimos);

// Solicitar empréstimo (PROFESSOR/ALUNO) ou criar em nome de terceiros (ADMIN/SECRETARIA)
router.post('/emprestimos', authorize('ADMIN', 'PROFESSOR', 'ALUNO', 'SECRETARIA', 'SUPER_ADMIN'), bibliotecaController.solicitarEmprestimo);

// Devolver empréstimo (ADMIN/SECRETARIA)
router.put('/emprestimos/:id/devolucao', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), bibliotecaController.devolverEmprestimo);

// Renovar empréstimo (ADMIN/SECRETARIA)
router.put('/emprestimos/:id/renovar', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), bibliotecaController.renovarEmprestimo);

// Acessar item digital
router.get('/itens/:itemId/acessar-digital', authorize('ADMIN', 'PROFESSOR', 'ALUNO', 'SUPER_ADMIN'), bibliotecaController.acessarItemDigital);

// Configuração da biblioteca (ADMIN/SECRETARIA)
router.get('/config', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), bibliotecaController.getConfig);
router.put('/config', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), bibliotecaController.updateConfig);

// Reservas
router.post('/reservas', authorize('ADMIN', 'PROFESSOR', 'ALUNO', 'SECRETARIA', 'SUPER_ADMIN'), bibliotecaController.criarReserva);
router.get('/reservas', authorize('ADMIN', 'PROFESSOR', 'ALUNO', 'SECRETARIA', 'SUPER_ADMIN'), bibliotecaController.getReservas);
router.put('/reservas/:id/cancelar', authorize('ADMIN', 'PROFESSOR', 'ALUNO', 'SECRETARIA', 'SUPER_ADMIN'), bibliotecaController.cancelarReserva);

// Multas
router.get('/multas', authorize('ADMIN', 'PROFESSOR', 'ALUNO', 'SECRETARIA', 'SUPER_ADMIN'), bibliotecaController.getMultas);
router.put('/multas/:id/pagar', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), bibliotecaController.pagarMulta);

// Relatórios (ADMIN/SECRETARIA)
router.get('/relatorios', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), bibliotecaController.getRelatorios);

export default router;

