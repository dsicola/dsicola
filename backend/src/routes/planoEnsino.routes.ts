import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validateLicense } from '../middlewares/license.middleware.js';
import { validarProfessorAtivo } from '../middlewares/rh-status.middleware.js';
import { bloquearAnoLetivoEncerrado } from '../middlewares/bloquearAnoLetivoEncerrado.middleware.js';
import { requireAcademicoContext, validateAcademicoFields } from '../middlewares/academico.middleware.js';
import { resolveProfessor, resolveProfessorOptional } from '../middlewares/resolveProfessor.middleware.js';
// requireAnoLetivoAtivo removido - Ano Letivo é contexto, não dependência técnica
import * as planoEnsinoController from '../controllers/planoEnsino.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);
// Validate license for all routes (SUPER_ADMIN is exempt in middleware)
router.use(validateLicense);
// Validate academic context for all academic routes
router.use(requireAcademicoContext);
// Validate academic fields according to institution type
router.use(validateAcademicoFields);

// Criar ou buscar plano de ensino
// REGRA INSTITUCIONAL: Bloquear se ano letivo estiver ENCERRADO
// REGRA SIGA/SIGAE: ADMIN cria e atribui Plano de Ensino (não precisa estar em professores)
// PROFESSOR: Removido - professor NÃO pode criar plano de ensino, apenas visualizar aprovado
// SECRETARIA: Removida - apenas consulta permitida
// ❌ REMOVIDO resolveProfessorOptional - ADMIN não precisa estar em professores
router.post('/', authorize('ADMIN', 'SUPER_ADMIN', 'COORDENADOR'), bloquearAnoLetivoEncerrado, planoEnsinoController.createOrGetPlanoEnsino);

// Buscar contexto para criação de Plano de Ensino
// Retorna: Cursos, Disciplinas, Professores, Anos Letivos ativos, Semestres/Classes
router.get('/contexto', authorize('ADMIN', 'COORDENADOR', 'SUPER_ADMIN'), planoEnsinoController.getContextoPlanoEnsino);

// Buscar plano de ensino por contexto
// ALUNO: Pode consultar (apenas leitura) - planos aprovados das suas disciplinas
// SECRETARIA: Pode consultar (apenas leitura)
// REGRA: Usar resolveProfessorOptional para permitir que professores vejam seus planos
router.get('/', authorize('ADMIN', 'PROFESSOR', 'SECRETARIA', 'ALUNO', 'SUPER_ADMIN'), resolveProfessorOptional, planoEnsinoController.getPlanoEnsino);

// Calcular estatísticas de carga horária
// SECRETARIA: Pode consultar (apenas leitura)
router.get('/:planoEnsinoId/stats', authorize('ADMIN', 'PROFESSOR', 'SECRETARIA', 'SUPER_ADMIN'), planoEnsinoController.getCargaHorariaStats);

// Obter carga horária detalhada (endpoint específico para carga horária)
// SECRETARIA: Pode consultar (apenas leitura)
router.get('/:planoEnsinoId/carga-horaria', authorize('ADMIN', 'PROFESSOR', 'SECRETARIA', 'SUPER_ADMIN'), planoEnsinoController.getCargaHoraria);

// Criar aula planejada
// REGRA INSTITUCIONAL: Bloquear se ano letivo estiver ENCERRADO
// PROFESSOR: Removido - professor NÃO pode criar/editar aulas planejadas (parte do plano de ensino)
// SECRETARIA: Removida - apenas consulta permitida
router.post('/:planoEnsinoId/aulas', authorize('ADMIN', 'SUPER_ADMIN'), validarProfessorAtivo, bloquearAnoLetivoEncerrado, planoEnsinoController.createAula);

// Reordenar aulas
// REGRA INSTITUCIONAL: Bloquear se ano letivo estiver ENCERRADO
// PROFESSOR: Removido - professor NÃO pode reordenar aulas planejadas
// SECRETARIA: Removida - apenas consulta permitida
router.put('/:planoEnsinoId/aulas/reordenar', authorize('ADMIN', 'SUPER_ADMIN'), validarProfessorAtivo, bloquearAnoLetivoEncerrado, planoEnsinoController.reordenarAulas);

// Marcar aula como ministrada
// REGRA INSTITUCIONAL: Bloquear se ano letivo estiver ENCERRADO
// PROFESSOR: Removido - professor NÃO pode marcar aulas planejadas como ministradas (usa lançamento de aulas)
// SECRETARIA: Removida - apenas consulta permitida
router.put('/aulas/:aulaId/ministrada', authorize('ADMIN', 'SUPER_ADMIN'), validarProfessorAtivo, bloquearAnoLetivoEncerrado, planoEnsinoController.marcarAulaMinistrada);

// Desmarcar aula como ministrada
// REGRA INSTITUCIONAL: Bloquear se ano letivo estiver ENCERRADO
// PROFESSOR: Removido - professor NÃO pode desmarcar aulas planejadas
// SECRETARIA: Removida - apenas consulta permitida
router.put('/aulas/:aulaId/nao-ministrada', authorize('ADMIN', 'SUPER_ADMIN'), validarProfessorAtivo, bloquearAnoLetivoEncerrado, planoEnsinoController.desmarcarAulaMinistrada);

// Atualizar aula
// REGRA INSTITUCIONAL: Bloquear se ano letivo estiver ENCERRADO
// PROFESSOR: Removido - professor NÃO pode editar aulas planejadas
// SECRETARIA: Removida - apenas consulta permitida
router.put('/aulas/:aulaId', authorize('ADMIN', 'SUPER_ADMIN'), validarProfessorAtivo, bloquearAnoLetivoEncerrado, planoEnsinoController.updateAula);

// Deletar aula
// REGRA INSTITUCIONAL: Bloquear se ano letivo estiver ENCERRADO
// PROFESSOR: Removido - professor NÃO pode deletar aulas planejadas
// SECRETARIA: Removida - apenas consulta permitida
router.delete('/aulas/:aulaId', authorize('ADMIN', 'SUPER_ADMIN'), validarProfessorAtivo, bloquearAnoLetivoEncerrado, planoEnsinoController.deleteAula);

// Adicionar bibliografia
// REGRA INSTITUCIONAL: Bloquear se ano letivo estiver ENCERRADO
// PROFESSOR: Removido - professor NÃO pode adicionar bibliografia ao plano de ensino
// SECRETARIA: Removida - apenas consulta permitida
router.post('/:planoEnsinoId/bibliografias', authorize('ADMIN', 'SUPER_ADMIN'), bloquearAnoLetivoEncerrado, planoEnsinoController.addBibliografia);

// Remover bibliografia
// REGRA INSTITUCIONAL: Bloquear se ano letivo estiver ENCERRADO
// PROFESSOR: Removido - professor NÃO pode remover bibliografia do plano de ensino
// SECRETARIA: Removida - apenas consulta permitida
router.delete('/bibliografias/:bibliografiaId', authorize('ADMIN', 'SUPER_ADMIN'), bloquearAnoLetivoEncerrado, planoEnsinoController.removeBibliografia);

// Bloquear plano (apenas ADMIN)
router.put('/:planoEnsinoId/bloquear', authorize('ADMIN', 'SUPER_ADMIN'), planoEnsinoController.bloquearPlano);

// Desbloquear plano (apenas ADMIN)
router.put('/:planoEnsinoId/desbloquear', authorize('ADMIN', 'SUPER_ADMIN'), planoEnsinoController.desbloquearPlano);

// Atualizar dados gerais do plano (Apresentação)
// REGRA INSTITUCIONAL: Bloquear se ano letivo estiver ENCERRADO
// PROFESSOR: Removido - professor NÃO pode editar plano de ensino
// SECRETARIA: Removida - apenas consulta permitida
router.put('/:planoEnsinoId', authorize('ADMIN', 'SUPER_ADMIN'), validarProfessorAtivo, bloquearAnoLetivoEncerrado, planoEnsinoController.updatePlanoEnsino);

// Ajustar carga horária automaticamente
// REGRA INSTITUCIONAL: Bloquear se ano letivo estiver ENCERRADO
// PROFESSOR: Removido - professor NÃO pode ajustar carga horária
// SECRETARIA: Removida - apenas consulta permitida
router.post('/:planoEnsinoId/ajustar-carga-horaria', authorize('ADMIN', 'SUPER_ADMIN'), validarProfessorAtivo, bloquearAnoLetivoEncerrado, planoEnsinoController.ajustarCargaHorariaAutomatico);

// Copiar plano de ano anterior
// REGRA INSTITUCIONAL: Bloquear se ano letivo estiver ENCERRADO (ano de origem)
// PROFESSOR: Removido - professor NÃO pode copiar planos de ensino
// SECRETARIA: Removida - apenas consulta permitida
router.post('/:planoEnsinoId/copiar', authorize('ADMIN', 'SUPER_ADMIN'), bloquearAnoLetivoEncerrado, planoEnsinoController.copiarPlanoAnterior);

// Deletar plano de ensino
// REGRA INSTITUCIONAL: Bloquear se ano letivo estiver ENCERRADO
// PROFESSOR: Removido - professor NÃO pode deletar planos de ensino
// SECRETARIA: Removida - apenas consulta permitida
router.delete('/:planoEnsinoId', authorize('ADMIN', 'SUPER_ADMIN'), bloquearAnoLetivoEncerrado, planoEnsinoController.deletePlanoEnsino);

export default router;
