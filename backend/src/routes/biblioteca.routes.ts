import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validateLicense } from '../middlewares/license.middleware.js';
import * as bibliotecaController from '../controllers/biblioteca.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);
// Validate license for all routes (SUPER_ADMIN is exempt in middleware)
router.use(validateLicense);

// Listar itens da biblioteca (consulta)
// PROFESSOR: Pode consultar todos os itens da sua instituição
router.get('/itens', authorize('ADMIN', 'PROFESSOR', 'ALUNO', 'SECRETARIA', 'SUPER_ADMIN'), bibliotecaController.getItens);

// Obter item por ID
// PROFESSOR: Pode consultar itens da sua instituição
router.get('/itens/:id', authorize('ADMIN', 'PROFESSOR', 'ALUNO', 'SECRETARIA', 'SUPER_ADMIN'), bibliotecaController.getItemById);

// Listar meus empréstimos
// PROFESSOR: Pode consultar seus próprios empréstimos
router.get('/meus-emprestimos', authorize('ADMIN', 'PROFESSOR', 'ALUNO', 'SUPER_ADMIN'), bibliotecaController.getMeusEmprestimos);

// Solicitar empréstimo (PROFESSOR/ALUNO)
// PROFESSOR: Pode solicitar empréstimo de livros físicos e acessar digitais
router.post('/emprestimos', authorize('ADMIN', 'PROFESSOR', 'ALUNO', 'SUPER_ADMIN'), bibliotecaController.solicitarEmprestimo);

// Acessar item digital
// PROFESSOR: Pode acessar itens digitais que solicitou
router.get('/itens/:itemId/acessar-digital', authorize('ADMIN', 'PROFESSOR', 'ALUNO', 'SUPER_ADMIN'), bibliotecaController.acessarItemDigital);

// TODO: Implementar rotas administrativas (criar/editar/deletar itens, gerenciar empréstimos)
// Essas rotas serão apenas para ADMIN/SECRETARIA

export default router;

