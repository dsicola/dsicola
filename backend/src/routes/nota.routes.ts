import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validateLicense } from '../middlewares/license.middleware.js';
import { validarProfessorAtivo } from '../middlewares/rh-status.middleware.js';
import { bloquearAnoLetivoEncerrado } from '../middlewares/bloquearAnoLetivoEncerrado.middleware.js';
import { requireAcademicoContext, validateAcademicoFields } from '../middlewares/academico.middleware.js';
import { resolveProfessor, resolveProfessorOptional } from '../middlewares/resolveProfessor.middleware.js';
// requireAnoLetivoAtivo removido - Ano Letivo é contexto, não dependência técnica
import * as notaController from '../controllers/nota.controller.js';

const router = Router();

router.use(authenticate);
// Validate license for all routes (SUPER_ADMIN is exempt in middleware)
router.use(validateLicense);
// Validate academic context for all academic routes
router.use(requireAcademicoContext);
// Validate academic fields according to institution type
router.use(validateAcademicoFields);

// PROFESSOR: resolveProfessorOptional garante req.professor.id para filtrar notas só da sua disciplina (SIGAE)
router.get('/', authorize('ADMIN', 'SECRETARIA', 'PROFESSOR', 'SUPER_ADMIN'), resolveProfessorOptional, notaController.getNotas);
router.get('/aluno', authorize('ALUNO'), notaController.getNotasByAluno);
// PROFESSOR: resolveProfessorOptional garante req.professor.id para validar acesso à turma
router.get('/turma/alunos', authorize('ADMIN', 'SECRETARIA', 'PROFESSOR', 'SUPER_ADMIN'), resolveProfessorOptional, notaController.getAlunosNotasByTurma);
router.get('/:id', notaController.getNotaById);
// REGRA INSTITUCIONAL: Bloquear se ano letivo estiver ENCERRADO
// SECRETARIA: Removida - apenas consulta permitida
// PROFESSOR: Requer middleware resolveProfessor para garantir req.professor.id
router.post('/', authorize('ADMIN', 'PROFESSOR', 'SUPER_ADMIN'), resolveProfessor, validarProfessorAtivo, bloquearAnoLetivoEncerrado, notaController.createNota);
router.post('/batch', authorize('ADMIN', 'PROFESSOR', 'SUPER_ADMIN'), resolveProfessor, validarProfessorAtivo, bloquearAnoLetivoEncerrado, notaController.createNotasEmLote);
router.post('/lote', authorize('ADMIN', 'PROFESSOR', 'SUPER_ADMIN'), resolveProfessor, validarProfessorAtivo, bloquearAnoLetivoEncerrado, notaController.createNotasEmLote);
router.post('/avaliacao/lote', authorize('ADMIN', 'PROFESSOR', 'SUPER_ADMIN'), resolveProfessor, validarProfessorAtivo, bloquearAnoLetivoEncerrado, notaController.createNotasAvaliacaoEmLote);
router.get('/avaliacao/:avaliacaoId/alunos', authorize('ADMIN', 'SECRETARIA', 'PROFESSOR', 'SUPER_ADMIN'), notaController.getAlunosParaLancarNotas);
router.get('/boletim/aluno/:alunoId', authorize('ADMIN', 'SECRETARIA', 'PROFESSOR', 'ALUNO', 'SUPER_ADMIN'), notaController.getBoletimAluno);
router.post('/calcular', authorize('ADMIN', 'SECRETARIA', 'PROFESSOR', 'SUPER_ADMIN'), notaController.calcularMediaNota);
router.post('/calcular/lote', authorize('ADMIN', 'SECRETARIA', 'PROFESSOR', 'SUPER_ADMIN'), notaController.calcularMediaNotaLote);
// REGRA INSTITUCIONAL: Bloquear se ano letivo estiver ENCERRADO
// SECRETARIA: Removida - apenas consulta permitida
// PROFESSOR: Requer middleware resolveProfessor para garantir req.professor.id
router.put('/:id', authorize('ADMIN', 'PROFESSOR', 'SUPER_ADMIN'), resolveProfessor, validarProfessorAtivo, bloquearAnoLetivoEncerrado, notaController.updateNota);

// Corrigir nota (método oficial - cria histórico obrigatório)
// REGRA INSTITUCIONAL: Bloquear se ano letivo estiver ENCERRADO
// SECRETARIA: NÃO pode corrigir notas (apenas consulta)
// PROFESSOR: Requer middleware resolveProfessor para garantir req.professor.id
router.put('/:id/corrigir', authorize('ADMIN', 'PROFESSOR', 'SUPER_ADMIN'), resolveProfessor, validarProfessorAtivo, bloquearAnoLetivoEncerrado, notaController.corrigirNota);

// Obter histórico de correções de uma nota
router.get('/:id/historico', authorize('ADMIN', 'SECRETARIA', 'PROFESSOR', 'ALUNO', 'SUPER_ADMIN'), notaController.getHistoricoNota);

// Bloquear DELETE de notas - Histórico imutável (conforme SIGA/SIGAE)
// REGRA INSTITUCIONAL: Bloquear se ano letivo estiver ENCERRADO
router.delete('/:id', authorize('ADMIN', 'SUPER_ADMIN'), bloquearAnoLetivoEncerrado, notaController.deleteNota);

export default router;
