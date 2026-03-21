import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import * as debugController from '../controllers/debug.controller.js';

const router = Router();

// Produção: não expor (evita contagens globais / metadata a utilizadores autenticados).
router.use((_req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Não encontrado' });
  }
  next();
});

router.use(authenticate);
router.use(authorize('SUPER_ADMIN'));

router.get('/multi-tenant', debugController.debugMultiTenant);

export default router;

