/**
 * Rotas - Mural da Disciplina (Professor ↔ Estudantes)
 * POST /disciplinas/:id/avisos, GET /disciplinas/:id/avisos
 * Montadas em /disciplinas - permitem acesso a PROFESSOR e ALUNO (sem requireConfiguracaoEnsino)
 */
import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validateLicense } from '../middlewares/license.middleware.js';
import * as disciplinaAvisoController from '../controllers/disciplinaAviso.controller.js';

const router = Router({ mergeParams: true });

router.use(authenticate);
router.use(validateLicense);

// GET /disciplinas/:id/avisos - Professor ou Aluno da disciplina
router.get('/:id/avisos', disciplinaAvisoController.listar);

// POST /disciplinas/:id/avisos - Apenas Professor
router.post('/:id/avisos', authorize('PROFESSOR'), disciplinaAvisoController.criar);

export default router;
