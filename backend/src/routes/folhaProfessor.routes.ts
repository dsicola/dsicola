import { Router } from 'express';
import * as folhaProfessorController from '../controllers/folhaProfessor.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN', 'FINANCEIRO', 'RH', 'SECRETARIA', 'SUPER_ADMIN'));

router.get('/', folhaProfessorController.listar);
router.get('/preview/:professorId', folhaProfessorController.preview);
router.get('/faltas', folhaProfessorController.listarFaltas);
router.post('/calcular', folhaProfessorController.calcular);
router.post('/calcular-todos', folhaProfessorController.calcularTodos);
router.post('/faltas', folhaProfessorController.registarFalta);
router.patch('/faltas/:id', folhaProfessorController.atualizarFalta);
router.delete('/faltas/:id', folhaProfessorController.removerFalta);
router.post('/faltas/processar', folhaProfessorController.processarFaltas);

export default router;
