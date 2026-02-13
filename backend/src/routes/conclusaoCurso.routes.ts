import { Router } from 'express';
import {
  validarRequisitos,
  criarSolicitacao,
  concluirCurso,
  criarColacaoGrau,
  criarCertificado,
  listarConclusoes,
  buscarConclusaoPorId,
  updateConclusao,
  deleteConclusao,
} from '../controllers/conclusaoCurso.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

/**
 * Validar requisitos para conclusão
 * GET /conclusoes-cursos/validar
 * Permissões: ADMIN, SECRETARIA, COORDENADOR
 */
router.get(
  '/validar',
  authorize('ADMIN', 'SECRETARIA', 'COORDENADOR', 'SUPER_ADMIN'),
  validarRequisitos
);

/**
 * Listar conclusões
 * GET /conclusoes-cursos
 * Permissões: ADMIN, SECRETARIA, COORDENADOR, PROFESSOR (apenas visualização)
 */
router.get(
  '/',
  authorize('ADMIN', 'SECRETARIA', 'COORDENADOR', 'PROFESSOR', 'ALUNO', 'SUPER_ADMIN'),
  listarConclusoes
);

/**
 * Buscar conclusão por ID
 * GET /conclusoes-cursos/:id
 * Permissões: ADMIN, SECRETARIA, COORDENADOR, PROFESSOR, ALUNO (própria conclusão)
 */
router.get(
  '/:id',
  authorize('ADMIN', 'SECRETARIA', 'COORDENADOR', 'PROFESSOR', 'ALUNO', 'SUPER_ADMIN'),
  buscarConclusaoPorId
);

/**
 * Criar solicitação de conclusão
 * POST /conclusoes-cursos
 * Permissões: ADMIN, SECRETARIA, COORDENADOR
 */
router.post(
  '/',
  authorize('ADMIN', 'SECRETARIA', 'COORDENADOR', 'SUPER_ADMIN'),
  criarSolicitacao
);

/**
 * Concluir curso oficialmente
 * POST /conclusoes-cursos/:id/concluir
 * Permissões: ADMIN, SECRETARIA
 */
router.post(
  '/:id/concluir',
  authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'),
  concluirCurso
);

/**
 * Criar colação de grau (Ensino Superior)
 * POST /conclusoes-cursos/:id/colacao
 * Permissões: ADMIN, SECRETARIA
 */
router.post(
  '/:id/colacao',
  authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'),
  criarColacaoGrau
);

/**
 * Criar certificado (Ensino Secundário)
 * POST /conclusoes-cursos/:id/certificado
 * Permissões: ADMIN, SECRETARIA
 */
router.post(
  '/:id/certificado',
  authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'),
  criarCertificado
);

/**
 * Bloquear UPDATE de conclusão (registro imutável)
 * PUT /conclusoes-cursos/:id ou PATCH /conclusoes-cursos/:id
 * Retorna 403 - Conclusões não podem ser atualizadas diretamente
 */
router.put(
  '/:id',
  authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'),
  updateConclusao
);

router.patch(
  '/:id',
  authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'),
  updateConclusao
);

/**
 * Bloquear DELETE de conclusão (registro imutável)
 * DELETE /conclusoes-cursos/:id
 * Retorna 403 - Conclusões não podem ser deletadas
 */
router.delete(
  '/:id',
  authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'),
  deleteConclusao
);

export default router;

