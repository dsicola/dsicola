import { Router } from 'express';
import * as academicProgressionController from '../controllers/academicProgression.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validateLicense } from '../middlewares/license.middleware.js';

const podeConsultarMotor = authorize(
  'ADMIN',
  'SECRETARIA',
  'SUPER_ADMIN',
  'DIRECAO',
  'COORDENADOR'
);

const podeConfigurarRegras = authorize('ADMIN', 'DIRECAO', 'SUPER_ADMIN', 'COORDENADOR');

/** Operação sensível: marcar desistentes em lote */
const podeMarcarDesistentes = authorize('ADMIN', 'DIRECAO', 'SUPER_ADMIN');

const router = Router();

router.use(authenticate);
router.use(validateLicense);

const progression = Router();

progression.post('/simular', podeConsultarMotor, academicProgressionController.simularProgressao);
progression.post('/avaliar', podeConsultarMotor, academicProgressionController.avaliarMatriculaAnual);
progression.get('/proxima-classe/:classeId', podeConsultarMotor, academicProgressionController.proximaClasse);
progression.post('/detectar-desistentes', podeMarcarDesistentes, academicProgressionController.detectarDesistentes);
progression.get('/taxa-aprovacao', podeConsultarMotor, academicProgressionController.taxaAprovacao);

progression.get('/regras', podeConfigurarRegras, academicProgressionController.listarRegras);
progression.post('/regras', podeConfigurarRegras, academicProgressionController.criarRegra);
progression.delete('/regras/:id', podeConfigurarRegras, academicProgressionController.removerRegra);

progression.get('/disciplinas-chave', podeConfigurarRegras, academicProgressionController.listarDisciplinasChave);
progression.post('/disciplinas-chave', podeConfigurarRegras, academicProgressionController.criarDisciplinaChave);
progression.delete('/disciplinas-chave/:id', podeConfigurarRegras, academicProgressionController.removerDisciplinaChave);

router.use('/progression', progression);

export default router;
