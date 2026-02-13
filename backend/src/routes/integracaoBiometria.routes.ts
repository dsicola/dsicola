import { Router } from 'express';
import * as integracaoBiometriaController from '../controllers/integracaoBiometria.controller.js';

const router = Router();

// IMPORTANTE: Estes endpoints são INTERNOS e não requerem autenticação JWT padrão
// A autenticação é feita via token do dispositivo nos próprios controllers
// NOTA: Esta é uma exceção intencional para integração com dispositivos biométricos externos
// Validação RBAC: Rotas de integração biométrica usam autenticação alternativa (token de dispositivo)

// Receber evento de presença do dispositivo
router.post(
  '/evento',
  integracaoBiometriaController.receberEvento
);

// Sincronizar funcionários com dispositivo
router.post(
  '/sync-funcionarios',
  integracaoBiometriaController.syncFuncionarios
);

export default router;

