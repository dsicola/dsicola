import { Router } from 'express';
import * as alunoDisciplinaController from '../controllers/alunoDisciplina.controller.js';
import { authenticate } from '../middlewares/auth.js';

const router = Router();

/**
 * GET /matriculas-disciplinas
 * Listagem geral de todas as matrículas em disciplinas
 * Não exige parâmetros obrigatórios - usado para tabelas e dashboards
 */
router.get('/', authenticate, alunoDisciplinaController.getAllMatriculasDisciplinas);

export default router;

