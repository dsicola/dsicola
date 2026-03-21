import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import * as debugController from '../controllers/debug.controller.js';

const router = Router();

// Produção: nunca expor. Staging / outros: exige ALLOW_DEBUG_ENDPOINT=true. Dev: permitido por defeito.
router.use((_req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Não encontrado' });
  }
  const isDev = process.env.NODE_ENV === 'development';
  if (!isDev && process.env.ALLOW_DEBUG_ENDPOINT !== 'true') {
    return res.status(404).json({ error: 'Não encontrado' });
  }
  next();
});

router.use(authenticate);
router.use(authorize('SUPER_ADMIN'));

router.get('/multi-tenant', debugController.debugMultiTenant);

export default router;

