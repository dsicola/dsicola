import { Router } from 'express';
import * as professorDisciplinaController from '../controllers/professorDisciplina.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { resolveProfessor } from '../middlewares/resolveProfessor.middleware.js';

const router = Router();

// ============== ATRIBUIÇÕES (PLANOS DE ENSINO) ==============
// Estes endpoints gerenciam atribuições que dependem de ano letivo
router.get('/', authenticate, professorDisciplinaController.getAll);
// REGRA SIGA/SIGAE: Professor obtém suas próprias atribuições (usa req.professor.id)
// DEVE vir antes de /professor/:professorId para não conflitar
router.get('/me', authenticate, authorize('PROFESSOR'), resolveProfessor, professorDisciplinaController.getMyDisciplinas);
router.get('/:id', authenticate, professorDisciplinaController.getById);
router.get('/professor/:professorId', authenticate, professorDisciplinaController.getByProfessor);
router.post('/', authenticate, authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), professorDisciplinaController.create);
router.delete('/:id', authenticate, authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), professorDisciplinaController.remove);

// ============== VÍNCULOS ESTRUTURAIS PROFESSOR-DISCIPLINA ==============
// Estes endpoints gerenciam vínculos estruturais (não dependem de ano letivo)
// Vincular professor a disciplina (estrutural)
router.post('/professor/:professorId/disciplinas', authenticate, authorize('ADMIN'), professorDisciplinaController.vincularProfessorDisciplina);

// Listar disciplinas de um professor (vínculos estruturais)
router.get('/professor/:professorId/disciplinas-vinculos', authenticate, professorDisciplinaController.listarDisciplinasProfessor);

// Desvincular professor de disciplina (estrutural)
router.delete('/professor/:professorId/disciplinas/:disciplinaId', authenticate, authorize('ADMIN'), professorDisciplinaController.desvincularProfessorDisciplina);

export default router;
