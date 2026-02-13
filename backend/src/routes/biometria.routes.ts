import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import * as biometriaController from '../controllers/biometria.controller.js';
import * as presencaBiometricaController from '../controllers/presencaBiometrica.controller.js';
import * as justificativaController from '../controllers/justificativaFalta.controller.js';

const router = Router();

// Todas as rotas exigem autenticação
router.use(authenticate);

// ============== BIOMETRIA ==============
// Registrar biometria (apenas ADMIN/RH)
router.post(
  '/registrar',
  authorize('ADMIN', 'RH', 'SUPER_ADMIN'),
  biometriaController.registrarBiometria
);

// Marcar presença via biometria (qualquer funcionário autenticado)
router.post(
  '/marcar-presenca',
  authorize('ADMIN', 'PROFESSOR', 'RH', 'SECRETARIA', 'SUPER_ADMIN'),
  biometriaController.marcarPresenca
);

// Buscar biometrias de funcionário
router.get(
  '/funcionario/:funcionarioId',
  authorize('ADMIN', 'RH', 'SUPER_ADMIN'),
  biometriaController.getBiometriasFuncionario
);

// Desativar biometria
router.delete(
  '/:biometriaId',
  authorize('ADMIN', 'RH', 'SUPER_ADMIN'),
  biometriaController.desativarBiometria
);

// ============== PRESENÇA BIOMÉTRICA ==============
// Processar presenças do dia (marcar faltas automaticamente)
router.post(
  '/presencas/processar',
  authorize('ADMIN', 'RH', 'SUPER_ADMIN'),
  presencaBiometricaController.processarPresencasDia
);

// Buscar presenças de funcionário
router.get(
  '/presencas/funcionario/:funcionarioId',
  authorize('ADMIN', 'PROFESSOR', 'RH', 'SECRETARIA', 'SUPER_ADMIN'),
  presencaBiometricaController.getPresencas
);

// Buscar presenças do dia (painel diário)
router.get(
  '/presencas/dia',
  authorize('ADMIN', 'RH', 'SECRETARIA', 'SUPER_ADMIN'),
  presencaBiometricaController.getPresencasDia
);

// ============== JUSTIFICATIVAS ==============
// Criar justificativa
router.post(
  '/justificativas',
  authorize('ADMIN', 'PROFESSOR', 'RH', 'SECRETARIA', 'SUPER_ADMIN'),
  justificativaController.criarJustificativa
);

// Aprovar justificativa (apenas ADMIN/RH)
router.post(
  '/justificativas/:justificativaId/aprovar',
  authorize('ADMIN', 'RH', 'SUPER_ADMIN'),
  justificativaController.aprovarJustificativa
);

// Rejeitar justificativa (apenas ADMIN/RH)
router.post(
  '/justificativas/:justificativaId/rejeitar',
  authorize('ADMIN', 'RH', 'SUPER_ADMIN'),
  justificativaController.rejeitarJustificativa
);

// Buscar justificativas
router.get(
  '/justificativas',
  authorize('ADMIN', 'PROFESSOR', 'RH', 'SECRETARIA', 'SUPER_ADMIN'),
  justificativaController.getJustificativas
);

export default router;

